import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppointmentsClient from '@/components/AppointmentsClient'

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export default async function AppointmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role, organization_id, organizations(name, requires_staff_selection, timezone)')
    .eq('id', user.id)
    .single()

  if (!userData?.organization_id) redirect('/dashboard')

  const organizationId = userData.organization_id
  const requiresStaffSelection = (userData.organizations as any)?.requires_staff_selection ?? false

  const monday = getMonday(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 7)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, start_time, end_time, status, notes, booked_via,
      client_id, service_id, staff_id,
      clients(full_name, phone, email),
      services(name, duration_minutes, price),
      staff(id, full_name, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .gte('start_time', monday.toISOString())
    .lt('start_time', sunday.toISOString())
    .order('start_time', { ascending: true })

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, full_name, avatar_url')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('full_name')

  return (
    <AppointmentsClient
      userData={userData as any}
      organizationId={organizationId}
      timezone={(userData.organizations as any)?.timezone || 'America/Costa_Rica'}
      requiresStaffSelection={requiresStaffSelection}
      initialAppointments={(appointments ?? []) as any}
      initialWeekStart={monday.toISOString()}
      services={services ?? []}
      staff={staff ?? []}
    />
  )
}
