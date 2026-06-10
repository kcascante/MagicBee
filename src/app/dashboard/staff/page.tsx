import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StaffClient from '@/components/StaffClient'

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role, organization_id, organizations(name, requires_staff_selection)')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) redirect('/dashboard')

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('organization_id', userData.organization_id)
    .order('created_at', { ascending: false })

  return (
    <StaffClient
      userData={userData as any}
      initialStaff={staff ?? []}
      organizationId={userData.organization_id}
      initialRequiresStaffSelection={(userData.organizations as any)?.requires_staff_selection ?? false}
    />
  )
}
