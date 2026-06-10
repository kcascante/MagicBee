import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsClient from '@/components/StatsClient'

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7) // 7..21
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function emptyPeriod() {
  return { total: 0, attendanceRate: 0, cancellationRate: 0, revenue: 0, deltaTotal: 0, deltaRevenue: 0, topServices: [] as any[], topStaff: [] as any[] }
}

export default async function StatsPage() {
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

  const empty = {
    periods: { today: emptyPeriod(), week: emptyPeriod(), month: emptyPeriod() },
    topClients: [] as any[],
    segmentCounts: { nuevo: 0, regular: 0, en_riesgo: 0, vip: 0, sin_citas: 0 },
    heatmap: { dayLabels: DAY_LABELS, hours: HOURS, grid: HOURS.map(() => DAY_LABELS.map(() => 0)), max: 1 },
  }

  if (!orgId) return <StatsClient userData={userData} stats={empty} />

  const now = new Date()
  const rangeStart = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000).toISOString()
  const rangeEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const [{ data: appts }, { data: clients }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, client_id, start_time, status, services(name, price), staff(full_name), clients(full_name)')
      .eq('organization_id', orgId)
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd),
    supabase.from('clients').select('id, created_at').eq('organization_id', orgId),
  ])

  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
  const dStr = (d: Date) => dateFmt.format(d)
  const todayStr = dStr(now)

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const wdToday = weekdayMap[weekdayFmt.format(now)] ?? 0
  const mondayOffset = wdToday === 0 ? -6 : 1 - wdToday
  const monday = new Date(now); monday.setUTCDate(monday.getUTCDate() + mondayOffset)
  const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6)
  const prevMonday = new Date(monday); prevMonday.setUTCDate(prevMonday.getUTCDate() - 7)
  const prevSunday = new Date(sunday); prevSunday.setUTCDate(prevSunday.getUTCDate() - 7)

  const [yStr, mStr] = todayStr.split('-')
  const y = parseInt(yStr), m = parseInt(mStr)
  const monthStart = `${y}-${mStr}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const monthEnd = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`
  let py = y, pm = m - 1
  if (pm === 0) { pm = 12; py = y - 1 }
  const pmStr = String(pm).padStart(2, '0')
  const prevMonthStart = `${py}-${pmStr}-01`
  const prevLastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate()
  const prevMonthEnd = `${py}-${pmStr}-${String(prevLastDay).padStart(2, '0')}`

  const yesterdayStr = dStr(new Date(now.getTime() - 86400000))

  function makePeriod(start: string, end: string) {
    return { start, end, total: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0, services: {} as Record<string, { count: number; revenue: number }>, staff: {} as Record<string, { count: number; revenue: number; cancelled: number }> }
  }

  const periodsRaw = {
    today: { cur: makePeriod(todayStr, todayStr), prev: makePeriod(yesterdayStr, yesterdayStr) },
    week: { cur: makePeriod(dStr(monday), dStr(sunday)), prev: makePeriod(dStr(prevMonday), dStr(prevSunday)) },
    month: { cur: makePeriod(monthStart, monthEnd), prev: makePeriod(prevMonthStart, prevMonthEnd) },
  }

  const heatStart = dStr(new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000))
  const heatGrid = HOURS.map(() => DAY_LABELS.map(() => 0))

  for (const a of appts || []) {
    const apptDate = new Date(a.start_time)
    const apptDateStr = dStr(apptDate)
    const svcName = (a as any).services?.name || 'Sin servicio'
    const svcPrice = (a as any).services?.price || 0
    const staffName = (a as any).staff?.full_name || 'Sin asignar'

    for (const key of ['today', 'week', 'month'] as const) {
      for (const which of ['cur', 'prev'] as const) {
        const p = periodsRaw[key][which]
        if (apptDateStr >= p.start && apptDateStr <= p.end) {
          if (a.status !== 'cancelled') p.total++
          if (a.status === 'completed') {
            p.completed++
            p.revenue += svcPrice
            p.services[svcName] = p.services[svcName] || { count: 0, revenue: 0 }
            p.services[svcName].count++
            p.services[svcName].revenue += svcPrice
            p.staff[staffName] = p.staff[staffName] || { count: 0, revenue: 0, cancelled: 0 }
            p.staff[staffName].count++
            p.staff[staffName].revenue += svcPrice
          } else if (a.status === 'cancelled') {
            p.cancelled++
            p.staff[staffName] = p.staff[staffName] || { count: 0, revenue: 0, cancelled: 0 }
            p.staff[staffName].cancelled++
          } else if (a.status === 'no_show') {
            p.noShow++
          }
        }
      }
    }

    if (a.status !== 'cancelled' && apptDateStr >= heatStart && apptDateStr <= todayStr) {
      const wd = weekdayMap[weekdayFmt.format(apptDate)] ?? 0
      const dayIdx = wd === 0 ? 6 : wd - 1
      const hour = parseInt(hourFmt.format(apptDate))
      const hourIdx = hour - 7
      if (hourIdx >= 0 && hourIdx < HOURS.length) heatGrid[hourIdx][dayIdx]++
    }
  }

  function topN(obj: Record<string, { count: number; revenue: number; cancelled?: number }>, n: number) {
    return Object.entries(obj).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count).slice(0, n)
  }

  function buildResult(key: 'today' | 'week' | 'month') {
    const cur = periodsRaw[key].cur
    const prev = periodsRaw[key].prev
    const denom = cur.completed + cur.cancelled + cur.noShow
    const attendanceRate = denom > 0 ? Math.round((cur.completed / denom) * 100) : 0
    const cancellationRate = denom > 0 ? Math.round((cur.cancelled / denom) * 100) : 0
    const deltaTotal = prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : (cur.total > 0 ? 100 : 0)
    const deltaRevenue = prev.revenue > 0 ? Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100) : (cur.revenue > 0 ? 100 : 0)
    return { total: cur.total, attendanceRate, cancellationRate, revenue: cur.revenue, deltaTotal, deltaRevenue, topServices: topN(cur.services, 5), topStaff: topN(cur.staff, 5) }
  }

  const clientVisits: Record<string, { name: string; visits: number; lastVisit: string }> = {}
  for (const a of appts || []) {
    if (a.status !== 'completed') continue
    const cid = (a as any).client_id
    const name = (a as any).clients?.full_name
    if (!cid || !name) continue
    if (!clientVisits[cid]) clientVisits[cid] = { name, visits: 0, lastVisit: a.start_time }
    clientVisits[cid].visits++
    if (a.start_time > clientVisits[cid].lastVisit) clientVisits[cid].lastVisit = a.start_time
  }
  const topClients = Object.values(clientVisits).sort((a, b) => b.visits - a.visits).slice(0, 10)

  const segmentCounts = { nuevo: 0, regular: 0, en_riesgo: 0, vip: 0, sin_citas: 0 }
  const visitsByClient: Record<string, { count: number; last: string | null }> = {}
  for (const a of appts || []) {
    if (a.status !== 'completed') continue
    const cid = (a as any).client_id
    if (!cid) continue
    if (!visitsByClient[cid]) visitsByClient[cid] = { count: 0, last: null }
    visitsByClient[cid].count++
    if (!visitsByClient[cid].last || a.start_time > visitsByClient[cid].last!) visitsByClient[cid].last = a.start_time
  }
  const allCounts = Object.values(visitsByClient).map((v) => v.count).sort((a, b) => b - a)
  const vipIdx = Math.max(0, Math.ceil(allCounts.length * 0.1) - 1)
  const vipThreshold = allCounts.length > 0 ? Math.max(allCounts[vipIdx], 3) : Infinity
  const days = (s: string | null) => s ? (now.getTime() - new Date(s).getTime()) / 86400000 : Infinity

  for (const c of clients || []) {
    const v = visitsByClient[c.id] || { count: 0, last: null }
    const sinceLast = days(v.last)
    const sinceCreated = days(c.created_at)
    let seg: keyof typeof segmentCounts
    if (v.count >= vipThreshold) seg = 'vip'
    else if (v.count === 0) seg = sinceCreated <= 30 ? 'nuevo' : 'sin_citas'
    else if (v.count === 1 && sinceLast <= 30) seg = 'nuevo'
    else if (sinceLast > 45) seg = 'en_riesgo'
    else if (v.count >= 2 && sinceLast <= 60) seg = 'regular'
    else seg = 'sin_citas'
    segmentCounts[seg]++
  }

  const maxHeat = Math.max(1, ...heatGrid.flat())

  const stats = {
    periods: { today: buildResult('today'), week: buildResult('week'), month: buildResult('month') },
    topClients,
    segmentCounts,
    heatmap: { dayLabels: DAY_LABELS, hours: HOURS, grid: heatGrid, max: maxHeat },
  }

  return <StatsClient userData={userData} stats={stats} />
}
