import { NextResponse } from 'next/server'
import { sendAppointmentNotification, AppointmentEmailEvent } from '@/lib/appointmentEmails'

export async function POST(req: Request) {
  try {
    const { appointmentId, event } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })

    const result = await sendAppointmentNotification(appointmentId, (event as AppointmentEmailEvent) ?? 'created')
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error enviando notificaciones:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
