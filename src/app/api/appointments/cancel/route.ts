import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendAppointmentNotification } from '@/lib/appointmentEmails'

export async function POST(req: Request) {
  try {
    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, start_time, status, organization_id')
      .eq('id', appointmentId)
      .single()

    if (!appt) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (appt.status === 'cancelled') return NextResponse.json({ error: 'already_cancelled' }, { status: 400 })
    if (appt.status === 'completed' || appt.status === 'no_show') {
      return NextResponse.json({ error: 'not_cancellable' }, { status: 400 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('cancellation_window_hours')
      .eq('id', appt.organization_id)
      .single()

    const windowHours = org?.cancellation_window_hours ?? 2
    const diffHours = (new Date(appt.start_time).getTime() - Date.now()) / 3600000

    if (diffHours < windowHours) {
      return NextResponse.json({ error: 'window_passed', windowHours }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    sendAppointmentNotification(appointmentId, 'status_update').catch(() => {})
    sendAppointmentNotification(appointmentId, 'cancelled_by_client').catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error cancelando cita:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
