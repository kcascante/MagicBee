import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  const orgId = userData?.organizations?.id
  const timezone = userData?.organizations?.timezone || 'America/Costa_Rica'

  let metrics = { today: 0, week: 0, clients: 0, revenue: 0 }
  let todayAppointments: any[] = []

  if (orgId) {
    const now = new Date()
    const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const rangeEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: appts }, { count: clientsCount }] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, start_time, status, clients(full_name), services(name, price)')
        .eq('organization_id', orgId)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
    ])

    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = fmt.format(now)

    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now)
    const dayIndex = weekdayMap[weekday] ?? 0
    const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex
    const monday = new Date(now)
    monday.setUTCDate(monday.getUTCDate() + mondayOffset)
    const sunday = new Date(monday)
    sunday.setUTCDate(sunday.getUTCDate() + 6)
    const mondayStr = fmt.format(monday)
    const sundayStr = fmt.format(sunday)

    let todayCount = 0
    let weekCount = 0
    let revenue = 0
    const todayList: any[] = []

    for (const appt of appts || []) {
      const apptDateStr = fmt.format(new Date(appt.start_time))

      if (appt.status !== 'cancelled') {
        if (apptDateStr === todayStr) {
          todayCount++
          todayList.push(appt)
        }
        if (apptDateStr >= mondayStr && apptDateStr <= sundayStr) {
          weekCount++
        }
      }

      if (appt.status === 'completed') {
        revenue += (appt as any).services?.price || 0
      }
    }

    metrics = { today: todayCount, week: weekCount, clients: clientsCount || 0, revenue }
    todayAppointments = todayList.sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  return <DashboardClient userData={userData} metrics={metrics} todayAppointments={todayAppointments} />
}
