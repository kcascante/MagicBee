import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientsClient from '@/components/ClientsClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  const orgId = userData?.organizations?.id

  let enrichedClients: any[] = []

  if (orgId) {
    const [{ data: clients }, { data: appts }] = await Promise.all([
      supabase.from('clients').select('*').eq('organization_id', orgId).order('full_name'),
      supabase
        .from('appointments')
        .select('id, client_id, start_time, status, services(name, price), staff(full_name)')
        .eq('organization_id', orgId),
    ])

    const now = new Date()
    type Stats = {
      totalVisits: number
      totalSpent: number
      lastVisitAt: string | null
      history: any[]
      serviceCounts: Record<string, number>
    }
    const statsByClient: Record<string, Stats> = {}

    for (const c of clients || []) {
      statsByClient[c.id] = { totalVisits: 0, totalSpent: 0, lastVisitAt: null, history: [], serviceCounts: {} }
    }

    for (const a of appts || []) {
      const cid = (a as any).client_id
      if (!cid || !statsByClient[cid]) continue
      const entry = statsByClient[cid]
      entry.history.push(a)
      if (a.status === 'completed') {
        entry.totalVisits++
        entry.totalSpent += (a as any).services?.price || 0
        if (!entry.lastVisitAt || a.start_time > entry.lastVisitAt) entry.lastVisitAt = a.start_time
        const svcName = (a as any).services?.name
        if (svcName) entry.serviceCounts[svcName] = (entry.serviceCounts[svcName] || 0) + 1
      }
    }

    for (const id in statsByClient) {
      statsByClient[id].history.sort((x, y) => y.start_time.localeCompare(x.start_time))
    }

    const visitCounts = (clients || [])
      .map((c) => statsByClient[c.id].totalVisits)
      .filter((v) => v > 0)
      .sort((a, b) => b - a)
    const vipIndex = Math.max(0, Math.ceil(visitCounts.length * 0.1) - 1)
    const vipThreshold = visitCounts.length > 0 ? Math.max(visitCounts[vipIndex], 3) : Infinity

    const daysSince = (dateStr: string | null) =>
      dateStr ? (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) : Infinity

    enrichedClients = (clients || []).map((c) => {
      const stats = statsByClient[c.id]
      const sinceLastVisit = daysSince(stats.lastVisitAt)
      const sinceCreated = daysSince(c.created_at)

      let favoriteService: string | null = null
      let bestCount = 0
      for (const svc in stats.serviceCounts) {
        if (stats.serviceCounts[svc] > bestCount) { favoriteService = svc; bestCount = stats.serviceCounts[svc] }
      }

      let segment: string
      if (stats.totalVisits >= vipThreshold) {
        segment = 'vip'
      } else if (stats.totalVisits === 0) {
        segment = sinceCreated <= 30 ? 'nuevo' : 'sin_citas'
      } else if (stats.totalVisits === 1 && sinceLastVisit <= 30) {
        segment = 'nuevo'
      } else if (sinceLastVisit > 45) {
        segment = 'en_riesgo'
      } else if (stats.totalVisits >= 2 && sinceLastVisit <= 60) {
        segment = 'regular'
      } else {
        segment = 'sin_citas'
      }

      return {
        ...c,
        total_visits: stats.totalVisits,
        total_spent: stats.totalSpent,
        last_visit_at: stats.lastVisitAt,
        favorite_service: favoriteService,
        segment,
        history: stats.history,
      }
    })
  }

  return <ClientsClient userData={userData} initialClients={enrichedClients} organizationId={orgId ?? ''} />
}
