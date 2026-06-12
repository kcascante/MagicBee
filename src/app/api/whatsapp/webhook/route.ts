import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { runWhatsAppBot, type ChatMessage, type ScheduleRow } from '@/lib/whatsappBot'

/**
 * Verificacion del webhook por parte de Meta.
 * Meta llama a esta URL con hub.mode=subscribe, hub.verify_token y
 * hub.challenge cuando configurás el webhook en el panel de desarrolladores.
 * Debe responder con el challenge tal cual si el token coincide.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

/**
 * Mensajes entrantes de WhatsApp.
 * Por ahora responde con un mensaje de confirmacion (eco) mientras se
 * integra la IA de agendamiento. Siempre responde 200 para que Meta no
 * reintente en bucle, incluso si algo falla internamente.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id
    const message = value?.messages?.[0]
    const statuses = value?.statuses

    // Los "statuses" reportan el resultado real de entrega de mensajes salientes
    // (sent/delivered/read/failed), incluyendo las imagenes de show_services.
    if (Array.isArray(statuses) && statuses.length > 0) {
      for (const s of statuses) {
        console.log(`[whatsapp-status] id=${s.id} status=${s.status} recipient=${s.recipient_id}${s.errors ? ' errors=' + JSON.stringify(s.errors) : ''}`)
      }
    }

    // Ignorar webhooks que no son mensajes entrantes (ej. status updates: sent/delivered/read)
    if (!phoneNumberId || !message) {
      return NextResponse.json({ ok: true })
    }

    const from: string = message.from
    const text: string = message.text?.body ?? ''

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, timezone, cancellation_window_hours, whatsapp_phone_number_id, whatsapp_access_token')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .maybeSingle()

    if (!org || !org.whatsapp_access_token) {
      console.error('whatsapp webhook: no organization configured for phone_number_id', phoneNumberId)
      return NextResponse.json({ ok: true })
    }

    const { data: services } = await supabase
      .from('services')
      .select('id, name, description, duration_minutes, price, image_url')
      .eq('organization_id', org.id)
      .eq('is_active', true)

    const { data: schedules } = await supabase
      .from('schedules')
      .select('day_of_week, start_time, end_time, break_start, break_end, is_active')
      .eq('organization_id', org.id)
      .is('staff_id', null)

    // Cargar/crear la sesion de conversacion (historial para darle contexto a la IA)
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id, messages')
      .eq('organization_id', org.id)
      .eq('phone_number', from)
      .maybeSingle()

    const history: ChatMessage[] = Array.isArray(session?.messages)
      ? session.messages.filter((m: any) => m?.role === 'user' || m?.role === 'assistant').map((m: any) => ({ role: m.role, content: String(m.content ?? '') }))
      : []

    let replyText: string
    try {
      replyText = await runWhatsAppBot({
        supabase,
        org,
        services: services ?? [],
        schedules: (schedules ?? []) as ScheduleRow[],
        fromPhone: from,
        history,
        userMessage: text,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappAccessToken: org.whatsapp_access_token,
      })
    } catch (err) {
      console.error('whatsapp bot error', err)
      replyText = `¡Hola! Soy el asistente de ${org.name}. En este momento no puedo procesar tu mensaje, pero el equipo lo va a revisar pronto.`
    }

    const updatedMessages = [
      ...history,
      { role: 'user', content: text },
      { role: 'assistant', content: replyText },
    ]

    if (session) {
      await supabase
        .from('whatsapp_sessions')
        .update({ messages: updatedMessages })
        .eq('id', session.id)
    } else {
      await supabase
        .from('whatsapp_sessions')
        .insert({
          organization_id: org.id,
          phone_number: from,
          messages: updatedMessages,
        })
    }

    await sendWhatsAppMessage(phoneNumberId, org.whatsapp_access_token, from, replyText)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('whatsapp webhook error', err)
    return NextResponse.json({ ok: true })
  }
}
