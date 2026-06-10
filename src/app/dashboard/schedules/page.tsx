import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SchedulesClient from '@/components/SchedulesClient'

export default async function SchedulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) redirect('/dashboard')

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('organization_id', userData.organization_id)
    .is('staff_id', null)
    .order('day_of_week', { ascending: true })

  return (
    <SchedulesClient
      userData={userData as any}
      initialSchedules={schedules ?? []}
      organizationId={userData.organization_id}
    />
  )
}
