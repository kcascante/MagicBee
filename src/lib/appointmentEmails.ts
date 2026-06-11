import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

function detailsTable(rows: { label: string; value: string }[]) {
  return `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">${rows
    .map(
      (r, i) =>
        `<tr${i > 0 ? ' style="border-top: 1px solid #eee;"' : ''}><td style="padding: 8px 0; color: #888;">${r.label}</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${r.value}</td></tr>`
    )
    .join('')}</table>`
}

function wrapper(accent: string, headerHtml: string, bodyHtml: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: ${accent}; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
        ${headerHtml}
      </div>
      <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px;">
        ${bodyHtml}
      </div>
    </div>
  `
}

function manageButton(accent: string, manageUrl: string, label: string) {
  return `<a href="${manageUrl}" style="display: block; text-align: center; background: ${accent}; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600; margin-top: 16px;">${label}</a>`
}

export type AppointmentEmailEvent = 'created' | 'status_update' | 'cancelled_by_client'

export async function sendAppointmentNotification(appointmentId: string, event: AppointmentEmailEvent) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurada, omitiendo envio de notificaciones')
    return { skipped: true }
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

  if (!appt) return { error: 'appointment not found' }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, email, slug, primary_color, logo_url, timezone, phone, address')
    .eq('id', appt.organization_id)
    .single()

  if (!org) return { error: 'organization not found' }

  const timezone = org.timezone || 'America/Costa_Rica'
  const { date, time } = fmtDateTime(appt.start_time, timezone)
  const accent = org.primary_color && /^#[0-9a-fA-F]{6}$/.test(org.primary_color) ? org.primary_color : '#f5a623'
  const client = (appt as any).clients
  const service = (appt as any).services
  const staff = (appt as any).staff
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const portalUrl = `${appUrl}/p/${org.slug}`
  const manageUrl = `${appUrl}/p/${org.slug}/cita/${appt.id}`
  const dashboardUrl = `${appUrl}/dashboard/appointments`
  const logoHeader = org.logo_url
    ? `<img src="${org.logo_url}" alt="${org.name}" style="height: 48px; border-radius: 8px;" />`
    : `<h1 style="color: #fff; margin: 0; font-size: 20px;">${org.name}</h1>`

  const baseRows = [
    { label: 'Servicio', value: service?.name ?? '' },
    { label: 'Fecha', value: date.charAt(0).toUpperCase() + date.slice(1) },
    { label: 'Hora', value: time },
    ...(staff?.full_name ? [{ label: 'Profesional', value: staff.full_name }] : []),
    ...(service?.price ? [{ label: 'Precio', value: fmtPrice(service.price) }] : []),
  ]

  const results: { client?: any; admin?: any } = {}

  if (event === 'cancelled_by_client') {
    if (!org.email) return { skipped: true, reason: 'no admin email' }
    const adminRows = [
      { label: 'Cliente', value: client?.full_name ?? 'Sin nombre' },
      ...(client?.phone ? [{ label: 'Teléfono', value: client.phone }] : []),
      ...baseRows,
    ]
    const html = wrapper(
      accent,
      `<h1 style="color: #fff; margin: 0; font-size: 20px;">El cliente canceló su cita</h1>`,
      `<p><strong>${client?.full_name ?? 'Un cliente'}</strong> canceló la siguiente cita:</p>
       ${detailsTable(adminRows)}
       <a href="${dashboardUrl}" style="display: block; text-align: center; background: ${accent}; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600;">Ver en el panel</a>`
    )
    results.admin = await resend.emails.send({
      from: FROM,
      to: org.email,
      subject: `Cita cancelada por el cliente: ${client?.full_name ?? 'Cliente'}`,
      html,
    })
    return { ok: true, results }
  }

  if (event === 'status_update') {
    if (!client?.email) return { skipped: true, reason: 'no client email' }

    if (appt.status === 'confirmed') {
      const html = wrapper(
        accent,
        logoHeader,
        `<h2 style="margin-top: 0;">¡Hola ${client.full_name}!</h2>
         <p>Tu cita en <strong>${org.name}</strong> fue <strong style="color: #22d3a5;">confirmada</strong>. ¡Te esperamos!</p>
         ${detailsTable(baseRows)}
         ${manageButton(accent, manageUrl, 'Ver o cancelar mi cita')}
         ${org.phone ? `<p style="color: #888; font-size: 13px; margin-top: 12px;">¿Necesitás cambiar algo? Contactá al negocio: ${org.phone}</p>` : ''}
         <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Enviado por MagicBee en nombre de ${org.name}.</p>`
      )
      results.client = await resend.emails.send({
        from: FROM,
        to: client.email,
        subject: `Tu cita en ${org.name} fue confirmada`,
        html,
      })
    } else if (appt.status === 'cancelled') {
      const html = wrapper(
        accent,
        logoHeader,
        `<h2 style="margin-top: 0;">¡Hola ${client.full_name}!</h2>
         <p>Tu cita en <strong>${org.name}</strong> fue <strong style="color: #f56342;">cancelada</strong>.</p>
         ${detailsTable(baseRows)}
         ${manageButton(accent, portalUrl, 'Agendar otra cita')}
         <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Enviado por MagicBee en nombre de ${org.name}.</p>`
      )
      results.client = await resend.emails.send({
        from: FROM,
        to: client.email,
        subject: `Tu cita en ${org.name} fue cancelada`,
        html,
      })
    } else {
      return { skipped: true, reason: 'status not notifiable' }
    }

    return { ok: true, results }
  }

  // event === 'created'
  if (client?.email) {
    const html = wrapper(
      accent,
      logoHeader,
      `<h2 style="margin-top: 0;">¡Hola ${client.full_name}!</h2>
       <p>Recibimos tu solicitud de cita en <strong>${org.name}</strong>. El negocio la confirmará pronto.</p>
       ${detailsTable(baseRows)}
       ${manageButton(accent, manageUrl, 'Ver o cancelar mi cita')}
       ${org.phone ? `<p style="color: #888; font-size: 13px; margin-top: 12px;">¿Necesitás cambiar algo? Contactá al negocio: ${org.phone}</p>` : ''}
       <p style="color: #aaa; font-size: 12px; margin-top: 24px;">Enviado por MagicBee en nombre de ${org.name}.</p>`
    )
    results.client = await resend.emails.send({
      from: FROM,
      to: client.email,
      subject: `Tu cita en ${org.name} fue solicitada`,
      html,
    })
  }

  if (org.email) {
    const adminRows = [
      { label: 'Cliente', value: client?.full_name ?? 'Sin nombre' },
      ...(client?.phone ? [{ label: 'Teléfono', value: client.phone }] : []),
      ...baseRows,
    ]
    const html = wrapper(
      accent,
      `<h1 style="color: #fff; margin: 0; font-size: 20px;">Nueva cita solicitada</h1>`,
      `<p>Tenés una nueva solicitud de cita${appt.booked_via === 'web' ? ' desde tu portal de agendamiento' : ''}:</p>
       ${detailsTable(adminRows)}
       <a href="${dashboardUrl}" style="display: block; text-align: center; background: ${accent}; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600;">Ver en el panel</a>`
    )
    results.admin = await resend.emails.send({
      from: FROM,
      to: org.email,
      subject: `Nueva cita: ${client?.full_name ?? 'Cliente'} · ${service?.name ?? ''}`,
      html,
    })
  }

  return { ok: true, results }
}
