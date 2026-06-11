import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CitaManageClient from '@/components/CitaManageClient'

export default async function CitaPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, organization_id, services(name, price, duration_minutes), staff(full_name), clients(full_name)')
    .eq('id', id)
    .single()

  if (!appt) notFound()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug, logo_url, primary_color, timezone, phone, cancellation_window_hours')
    .eq('id', appt.organization_id)
    .single()

  if (!org || org.slug !== slug) notFound()

  return <CitaManageClient appointment={appt as any} organization={org as any} />
}
