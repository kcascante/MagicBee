import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ServicesClient from '@/components/ServicesClient'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) redirect('/dashboard')

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })

  return (
    <ServicesClient
      userData={userData as any}
      initialServices={services ?? []}
      organizationId={userData.organization_id}
    />
  )
}
