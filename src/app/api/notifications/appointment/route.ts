import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const FROM = 'MagicBee <notificaciones@magicbee.bond>'

function fmtDateTime(iso: string, timezone: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone })
  const time = d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
  return { date, time }
}

function fmtPrice(price: number) {
  return '\u20a1' + Math.round(price).toLocaleString('es-CR')
}

export async function POST(req: Request) {
  try {
    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY no configurada, omitiendo envio de notificaciones')
      return NextResponse.json({ skipped: true })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, status, booked_via, organization_id, clients(full_name, email, phone), services(name, price, duration_minutes), staff(full_name)')
      .eq('id', appointmentId)
      .single()

    if (!appt) return NextResponse.json({ error: 'appointment not found' }, { status: 404 })

    const { data: org } = await supabase
      .from('organizations')
      .select('name, email, slug, primary_color, logo_url, timezone, phone, address')
      .eq('id', appt.organization_id)
      .single()

    if (!org) return NextResponse.json({ error: 'organization not found' }, { status: 404 })

    const timezone = org.timezone || 'America/Costa_Rica'
    const { date, time } = fmtDateTime(appt.start_time, timezone)
    const accent = org.primary_color && /^#[0-9a-fA-F]{6}$/.test(org.primary_color) ? org.primary_color : '#f5a623'
    const client = (appt as any).clients
    const service = (appt as any).services
    const staff = (appt as any).staff
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const dashboardUrl = `${appUrl}/dashboard/appointments`

    const results: { client?: any; admin?: any } = {}

    if (client?.email) {
      const html = `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
          <div style="background: ${accent}; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
            ${org.logo_url ? `<img src="${org.logo_url}" alt="${org.name}" style="height: 48px; border-radius: 8px;" />` : `<h1 style="color: #fff; margin: 0; font-size: 20px;">${org.name}</h1>`}
          </div>
          <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="margin-top: 0;">¡Hola ${client.full_name}!</h2>
            <p>Recibimos tu solicitud de cita en <strong>${org.name}</strong>. El negocio la confirmará pronto.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #888;">Servicio</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${service?.name ?? ''}</td></tr>
              <tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Fecha</td><td style="padding: 8px 0; text-align: right; font-weight: 600; text-transform: capitalize;">${date}</td></tr>
              <tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Hora</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${time}</td></tr>
              ${staff?.full_name ? `<tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Profesional</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${staff.full_name}</td></tr>` : ''}
              ${service?.price ? `<tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Precio</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${fmtPrice(service.price)}</td></tr>` : ''}
            </table>
            ${org.phone ? `<p style="color: #888; font-size: 13px;">¿Necesitás cambiar algo? Contactá al negocio: ${org.phone}</p>` : ''}
            <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Enviado por MagicBee en nombre de ${org.name}.</p>
          </div>
        </div>
      `
      results.client = await resend.emails.send({
        from: FROM,
        to: client.email,
        subject: `Tu cita en ${org.name} fue solicitada`,
        html,
      })
    }

    if (org.email) {
      const html = `
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
          <div style="background: ${accent}; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">Nueva cita solicitada</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px;">
            <p>Tenés una nueva solicitud de cita${appt.booked_via === 'web' ? ' desde tu portal de agendamiento' : ''}:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #888;">Cliente</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${client?.full_name ?? 'Sin nombre'}</td></tr>
              ${client?.phone ? `<tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Teléfono</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${client.phone}</td></tr>` : ''}
              <tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Servicio</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${service?.name ?? ''}</td></tr>
              <tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Fecha</td><td style="padding: 8px 0; text-align: right; font-weight: 600; text-transform: capitalize;">${date}</td></tr>
              <tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Hora</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${time}</td></tr>
              ${staff?.full_name ? `<tr style="border-top: 1px solid #eee;"><td style="padding: 8px 0; color: #888;">Profesional</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${staff.full_name}</td></tr>` : ''}
            </table>
            <a href="${dashboardUrl}" style="display: block; text-align: center; background: ${accent}; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600;">Ver en el panel</a>
          </div>
        </div>
      `
      results.admin = await resend.emails.send({
        from: FROM,
        to: org.email,
        subject: `Nueva cita: ${client?.full_name ?? 'Cliente'} · ${service?.name ?? ''}`,
        html,
      })
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    console.error('Error enviando notificaciones:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
