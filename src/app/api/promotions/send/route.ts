import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import {
  getAnnotatedClients,
  filterBySegment,
  renderTemplate,
  fmtVisitDate,
  normalizeOutboundPhone,
  buildPromotionEmailHtml,
  type SegmentKey,
} from '@/lib/promotions'

const VALID_SEGMENTS: SegmentKey[] = ['todos', 'nuevos', 'inactivos', 'vip', 'por_servicio']
const VALID_CHANNELS = ['whatsapp', 'email']
const FROM = 'MagicBee <notificaciones@magicbee.bond>'

function sanitizeTemplate(value: string): string {
  // Permite { } para variables, pero elimina caracteres de inyección/control.
  return value.replace(/[<>`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('organizations(id, name, slug, timezone, primary_color, whatsapp_phone_number_id, whatsapp_access_token)')
      .eq('id', user.id)
      .single()

    const org = (userData as any)?.organizations
    if (!org?.id) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })

    const body = await req.json()
    const channel = body?.channel
    const segment = body?.segment as SegmentKey
    const serviceId: string | null = body?.service_id || null
    const rawTemplate: string = typeof body?.template === 'string' ? body.template : ''
    const rawSubject: string = typeof body?.subject === 'string' ? body.subject : ''

    if (!VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
    }
    if (!VALID_SEGMENTS.includes(segment)) {
      return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 })
    }
    if (segment === 'por_servicio' && !serviceId) {
      return NextResponse.json({ error: 'Seleccioná un servicio para este segmento' }, { status: 400 })
    }

    const template = sanitizeTemplate(rawTemplate).trim()
    if (!template) return NextResponse.json({ error: 'La plantilla no puede estar vacía' }, { status: 400 })
    if (template.length > 1000) return NextResponse.json({ error: 'La plantilla es demasiado larga' }, { status: 400 })

    const subject = sanitizeTemplate(rawSubject).trim().slice(0, 150) || `Novedades de ${org.name}`

    if (channel === 'whatsapp' && (!org.whatsapp_phone_number_id || !org.whatsapp_access_token)) {
      return NextResponse.json({ error: 'WhatsApp no está configurado para tu negocio. Configuralo en Configuración.' }, { status: 400 })
    }
    if (channel === 'email' && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'El envío de correos no está configurado en este momento.' }, { status: 400 })
    }

    const annotated = await getAnnotatedClients(supabase, org.id)
    const recipients = filterBySegment(annotated, segment, serviceId)

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No hay clientes en este segmento.' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const linkAgendar = `${appUrl}/p/${org.slug}`
    const timezone = org.timezone || 'America/Costa_Rica'
    const accent = org.primary_color && /^#[0-9a-fA-F]{6}$/.test(org.primary_color) ? org.primary_color : '#f5a623'

    let sent = 0
    let failed = 0
    let skipped = 0
    const recipientRows: { client_id: string; status: 'sent' | 'failed' | 'skipped' }[] = []
    const resend = channel === 'email' ? new Resend(process.env.RESEND_API_KEY!) : null

    for (const r of recipients) {
      const vars = {
        nombre: (r.full_name || '').split(' ')[0] || r.full_name || 'Cliente',
        negocio: org.name,
        servicio: r.last_service || 'nuestros servicios',
        fecha_ultima_visita: fmtVisitDate(r.last_visit_at, timezone),
        link_agendar: linkAgendar,
      }
      const message = renderTemplate(template, vars)

      if (channel === 'whatsapp') {
        const to = r.phone ? normalizeOutboundPhone(r.phone) : null
        if (!to) {
          skipped++
          recipientRows.push({ client_id: r.id, status: 'skipped' })
          continue
        }
        try {
          await sendWhatsAppMessage(org.whatsapp_phone_number_id, org.whatsapp_access_token, to, message)
          sent++
          recipientRows.push({ client_id: r.id, status: 'sent' })
        } catch (err: any) {
          console.error('[promotions] envio whatsapp fallo para', r.id, err?.message ?? err)
          failed++
          recipientRows.push({ client_id: r.id, status: 'failed' })
        }
        // Pequeña pausa para no saturar la API de Meta con envíos en bucle.
        await new Promise((res) => setTimeout(res, 400))
      } else {
        if (!r.email) {
          skipped++
          recipientRows.push({ client_id: r.id, status: 'skipped' })
          continue
        }
        try {
          await resend!.emails.send({
            from: FROM,
            to: r.email,
            subject,
            html: buildPromotionEmailHtml(org.name, message, accent, linkAgendar),
          })
          sent++
          recipientRows.push({ client_id: r.id, status: 'sent' })
        } catch (err: any) {
          console.error('[promotions] envio email fallo para', r.id, err?.message ?? err)
          failed++
          recipientRows.push({ client_id: r.id, status: 'failed' })
        }
      }
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        organization_id: org.id,
        channel,
        segment,
        service_id: segment === 'por_servicio' ? serviceId : null,
        template,
        subject: channel === 'email' ? subject : null,
        recipient_count: recipients.length,
        sent_count: sent,
        failed_count: failed,
      })
      .select('id')
      .single()

    if (campaignError) {
      console.error('[promotions] error guardando campaña', campaignError.message)
    } else if (campaign && recipientRows.length > 0) {
      const { error: recipientsError } = await supabase
        .from('campaign_recipients')
        .insert(recipientRows.map((row) => ({ campaign_id: campaign.id, client_id: row.client_id, status: row.status })))
      if (recipientsError) console.error('[promotions] error guardando destinatarios', recipientsError.message)
    }

    return NextResponse.json({ ok: true, recipients: recipients.length, sent, failed, skipped })
  } catch (err: any) {
    console.error('[promotions] error inesperado', err?.message ?? err)
    return NextResponse.json({ error: 'Ocurrió un error al enviar la campaña.' }, { status: 500 })
  }
}
