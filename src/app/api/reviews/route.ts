import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId : ''
    const rating = Number(body.rating)
    const commentRaw = typeof body.comment === 'string' ? body.comment : ''

    if (!appointmentId) {
      return NextResponse.json({ error: 'missing_appointment' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'invalid_rating' }, { status: 400 })
    }

    const comment = sanitizeText(commentRaw).slice(0, 1000)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, status, organization_id, client_id')
      .eq('id', appointmentId)
      .single()

    if (!appt) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (appt.status !== 'completed') {
      return NextResponse.json({ error: 'not_completed' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'already_reviewed' }, { status: 400 })
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        organization_id: appt.organization_id,
        appointment_id: appt.id,
        client_id: appt.client_id,
        rating,
        comment: comment || null,
      })
      .select('id, rating, comment, admin_reply, admin_reply_at, created_at')
      .single()

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json({ error: 'already_reviewed' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, review })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'unknown_error' }, { status: 500 })
  }
}
