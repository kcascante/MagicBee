'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import '@/components/auth.css'
import './dashboard.css'
import './clients.css'
import './stats.css'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: true },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Promociones', href: '/dashboard/promotions', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

const SEGMENT_LABELS: Record<string, string> = { nuevo: 'Nuevos', regular: 'Regulares', en_riesgo: 'En riesgo', vip: 'VIP', sin_citas: 'Sin citas' }
const SEGMENT_COLORS: Record<string, string> = { nuevo: '#22d3a5', regular: '#f5a623', en_riesgo: '#f56342', vip: '#7c6af7', sin_citas: '#888888' }
const PERIOD_LABELS: Record<string, string> = { today: 'Hoy', week: 'Esta semana', month: 'Este mes' }
const AXIS_COLOR = '#888888'
const GRID_COLOR = 'rgba(150,150,150,0.12)'

type PeriodResult = {
  total: number
  completed: number
  cancelled: number
  noShow: number
  attendanceRate: number
  cancellationRate: number
  revenue: number
  deltaTotal: number
  deltaRevenue: number
  topServices: { name: string; count: number; revenue: number }[]
  topStaff: { name: string; count: number; revenue: number; cancelled?: number }[]
}

type StatsData = {
  periods: { today: PeriodResult; week: PeriodResult; month: PeriodResult }
  topClients: { name: string; visits: number; lastVisit: string }[]
  segmentCounts: Record<string, number>
  heatmap: { dayLabels: string[]; hours: number[]; grid: number[][]; max: number }
}

type UserData = { full_name: string; organizations: { name: string } }

function formatCurrency(value: number) {
  return '\u20a1' + Math.round(value).toLocaleString('es-CR')
}

function formatDelta(value: number) {
  if (value === 0) return <span className="stat-delta neutral">sin cambio</span>
  const positive = value > 0
  return <span className={"stat-delta " + (positive ? "up" : "down")}>{positive ? '▲' : '▼'} {Math.abs(value)}% vs período anterior</span>
}

function Gauge({ value, color }: { value: number; color: string }) {
  const data = {
    datasets: [{
      data: [value, Math.max(0, 100 - value)],
      backgroundColor: [color, 'rgba(150,150,150,0.15)'],
      borderWidth: 0,
    }],
  }
  const options: any = {
    cutout: '78%',
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    animation: { animateRotate: true, duration: 900 },
    maintainAspectRatio: false,
  }
  return <div className="stat-gauge"><Doughnut data={data} options={options} /></div>
}

function RankBarChart({ items, valueKey, color, valueLabel }: { items: any[]; valueKey: string; color: string; valueLabel: (item: any) => string }) {
  const data = {
    labels: items.map((i) => i.name),
    datasets: [{ data: items.map((i) => i[valueKey]), backgroundColor: color, borderRadius: 6, maxBarThickness: 28 }],
  }
  const options: any = {
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => valueLabel(items[ctx.dataIndex]) } },
    },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: AXIS_COLOR }, grid: { color: GRID_COLOR } },
      y: { ticks: { color: AXIS_COLOR, font: { size: 12 } }, grid: { display: false } },
    },
    animation: { duration: 900 },
    maintainAspectRatio: false,
  }
  return <div className="stat-chart-wrap" style={{ height: Math.max(140, items.length * 44) }}><Bar data={data} options={options} /></div>
}

const doughnutOptions: any = {
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 }, color: AXIS_COLOR } } },
  animation: { animateScale: true, animateRotate: true, duration: 900 },
  maintainAspectRatio: false,
}

export default function StatsClient({ userData, stats }: { userData: UserData | null; stats: StatsData }) {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/register')
    router.refresh()
  }

  const orgName = userData?.organizations?.name ?? 'Tu negocio'
  const firstName = userData?.full_name?.split(' ')[0] ?? 'Admin'
  const data = stats.periods[period]

  const statusEntries = [
    { label: 'Completadas', value: data.completed, color: '#22d3a5' },
    { label: 'Pendientes/confirmadas', value: Math.max(0, data.total - data.completed - data.noShow), color: '#7c6af7' },
    { label: 'No asistió', value: data.noShow, color: '#f56342' },
    { label: 'Canceladas', value: data.cancelled, color: '#888888' },
  ].filter((s) => s.value > 0)

  const statusData = {
    labels: statusEntries.map((s) => s.label),
    datasets: [{ data: statusEntries.map((s) => s.value), backgroundColor: statusEntries.map((s) => s.color), borderWidth: 0 }],
  }

  const segEntries = Object.entries(stats.segmentCounts).filter(([, v]) => v > 0)
  const segData = {
    labels: segEntries.map(([k]) => SEGMENT_LABELS[k]),
    datasets: [{ data: segEntries.map(([, v]) => v), backgroundColor: segEntries.map(([k]) => SEGMENT_COLORS[k]), borderWidth: 0 }],
  }

  return (
    <div className="db-root">
      {menuOpen && <div className="db-overlay" onClick={() => setMenuOpen(false)} />}

      <button className={"db-mobile-toggle" + (menuOpen ? " open" : "")} onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
        {menuOpen ? (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        )}
      </button>

      <aside className={"db-sidebar" + (menuOpen ? " open" : "")}>
        <div className="db-logo">
          <div className="db-logo-icon">M</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>MagicBee</span>
        </div>
        <div className="db-org">
          <p className="db-org-label">Negocio</p>
          <p className="db-org-name">{orgName}</p>
        </div>
        <nav className="db-nav">
          {NAV.map((item) => (
            <a key={item.label} href={item.href} className={"db-nav-item" + (item.active ? " active" : "")} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="db-user">
          <p className="db-username">{firstName}</p>
          <button className="db-logout" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="db-main">
        <div className={"db-header" + (scrolled ? " scrolled" : "")}>
          <div>
            <h1 className="db-header-title">Estadísticas</h1>
            <p className="db-header-date">Rendimiento de tu negocio</p>
          </div>
        </div>

        <div className="cl-segment-tabs" style={{ marginBottom: 24 }}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <button key={p} className={"cl-segment-tab" + (period === p ? " active" : "")} onClick={() => setPeriod(p)}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="db-metrics">
          <div className="db-card">
            <div className="db-card-dot" style={{ background: '#f5a623', boxShadow: '0 0 8px #f5a623' }} />
            <p className="db-card-label">Citas</p>
            <p className="db-card-value">{data.total}</p>
            {formatDelta(data.deltaTotal)}
          </div>

          <div className="db-card">
            <div className="db-card-dot" style={{ background: '#22d3a5', boxShadow: '0 0 8px #22d3a5' }} />
            <p className="db-card-label">Tasa de asistencia</p>
            <p className="db-card-value">{data.attendanceRate}%</p>
            <Gauge value={data.attendanceRate} color="#22d3a5" />
          </div>

          <div className="db-card">
            <div className="db-card-dot" style={{ background: data.cancellationRate > 20 ? '#f56342' : '#7c6af7', boxShadow: `0 0 8px ${data.cancellationRate > 20 ? '#f56342' : '#7c6af7'}` }} />
            <p className="db-card-label">Tasa de cancelación</p>
            <p className="db-card-value" style={{ color: data.cancellationRate > 20 ? '#f56342' : undefined }}>{data.cancellationRate}%</p>
            <Gauge value={data.cancellationRate} color={data.cancellationRate > 20 ? '#f56342' : '#7c6af7'} />
          </div>

          <div className="db-card">
            <div className="db-card-dot" style={{ background: '#f56342', boxShadow: '0 0 8px #f56342' }} />
            <p className="db-card-label">Ingresos estimados</p>
            <p className="db-card-value">{formatCurrency(data.revenue)}</p>
            {formatDelta(data.deltaRevenue)}
          </div>
        </div>

        <div className="stat-grid">
          <div className="mi-card stat-section">
            <h2 className="stat-section-title">Servicios más solicitados</h2>
            {data.topServices.length === 0 ? (
              <p className="cl-empty-history">Sin citas completadas en este período.</p>
            ) : (
              <RankBarChart items={data.topServices} valueKey="count" color="#7c6af7" valueLabel={(i) => `${i.count} citas · ${formatCurrency(i.revenue)}`} />
            )}
          </div>

          <div className="mi-card stat-section">
            <h2 className="stat-section-title">Rendimiento de empleados</h2>
            {data.topStaff.length === 0 ? (
              <p className="cl-empty-history">Sin citas completadas en este período.</p>
            ) : (
              <RankBarChart items={data.topStaff} valueKey="count" color="#f5a623" valueLabel={(i) => `${i.count} citas · ${formatCurrency(i.revenue)}${i.cancelled ? ' · ' + i.cancelled + ' canceladas' : ''}`} />
            )}
          </div>
        </div>

        <div className="stat-grid">
          <div className="mi-card stat-section">
            <h2 className="stat-section-title">Estado de las citas</h2>
            {statusEntries.length === 0 ? (
              <p className="cl-empty-history">Sin citas en este período.</p>
            ) : (
              <div className="stat-chart-wrap" style={{ height: 220 }}><Doughnut data={statusData} options={doughnutOptions} /></div>
            )}
          </div>

          <div className="mi-card stat-section">
            <h2 className="stat-section-title">Segmentos de clientes</h2>
            {segEntries.length === 0 ? (
              <p className="cl-empty-history">Todavía no hay clientes clasificados.</p>
            ) : (
              <div className="stat-chart-wrap" style={{ height: 220 }}><Doughnut data={segData} options={doughnutOptions} /></div>
            )}
          </div>
        </div>

        <div className="mi-card stat-section">
          <h2 className="stat-section-title">Clientes frecuentes</h2>
          <p className="cl-empty-history" style={{ marginBottom: 12 }}>Top 10 por visitas en los últimos 90 días.</p>
          {stats.topClients.length === 0 ? (
            <p className="cl-empty-history">Todavía no hay citas completadas.</p>
          ) : (
            <RankBarChart items={stats.topClients} valueKey="visits" color="#22d3a5" valueLabel={(i) => `${i.visits} visitas`} />
          )}
        </div>

        <div className="mi-card stat-section">
          <h2 className="stat-section-title">Mapa de calor de ocupación</h2>
          <p className="cl-empty-history" style={{ marginBottom: 16 }}>Citas por día y hora en las últimas 8 semanas.</p>
          <div className="stat-heatmap-wrapper">
            <div className="stat-heatmap" style={{ gridTemplateColumns: `48px repeat(${stats.heatmap.dayLabels.length}, 1fr)` }}>
              <div></div>
              {stats.heatmap.dayLabels.map((d) => <div key={d} className="stat-heatmap-day-label">{d}</div>)}
              {stats.heatmap.hours.map((h, hi) => (
                <>
                  <div key={'h' + h} className="stat-heatmap-hour-label">{h}:00</div>
                  {stats.heatmap.dayLabels.map((_, di) => {
                    const v = stats.heatmap.grid[hi][di]
                    const intensity = v / stats.heatmap.max
                    return (
                      <div
                        key={`${hi}-${di}`}
                        className="stat-heatmap-cell"
                        style={{ background: v === 0 ? 'rgba(255,255,255,0.03)' : `rgba(245,166,35,${0.15 + intensity * 0.75})` }}
                        title={`${v} cita${v === 1 ? '' : 's'}`}
                      >
                        {v > 0 ? v : ''}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
