import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortalClient from '@/components/PortalClient'

export default async function PublicPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: orgRows } = await supabase.rpc('get_organization_public', { p_slug: slug })
  const org = orgRows?.[0]

  if (!org) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, image_url')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('name')

  let staff: any[] = []
  if (org.requires_staff_selection) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, full_name, avatar_url')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('full_name')
    staff = staffData ?? []
  }

  return (
    <PortalClient
      organization={org}
      services={services ?? []}
      staff={staff}
    />
  )
}
