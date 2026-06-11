'use client'

import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import './dashboard.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: true },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

type Metric = { label: string; value: string; color: string }
type UserData = { full_name: string; organizations: { name: string } }
type DashboardMetrics = { today: number; week: number; clients: number; revenue: number }
type TodayAppointment = {
  id: string
  start_time: string
  status: string
  clients: { full_name: string } | null
  services: { name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#7c6af7',
  confirmed: '#f5a623',
  completed: '#22d3a5',
  cancelled: '#888888',
  no_show: '#f56342',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

function GlassCard({ metric }: { metric: Metric }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0, show: false })
  return (
    <div ref={ref} className="db-card" onMouseMove={(e) => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top, show: true }) }} onMouseLeave={() => setPos((p) => ({ ...p, show: false }))}>
      {pos.show && <div className="db-spotlight" style={{ top: pos.y - 80, left: pos.x - 80, background: 'radial-gradient(circle, ' + metric.color + '33 0%, transparent 70%)' }} />}
      <div className="db-card-dot" style={{ background: metric.color, boxShadow: '0 0 8px ' + metric.color }} />
      <p className="db-card-label">{metric.label}</p>
      <p className="db-card-value">{metric.value}</p>
    </div>
  )
}

export default function DashboardClient({
  userData,
  metrics,
  todayAppointments,
}: {
  userData: UserData | null
  metrics?: DashboardMetrics
  todayAppointments?: TodayAppointment[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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

  const m = metrics ?? { today: 0, week: 0, clients: 0, revenue: 0 }
  const appts = todayAppointments ?? []

  const METRICS: Metric[] = [
    { label: 'Citas hoy', value: String(m.today), color: '#f5a623' },
    { label: 'Citas esta semana', value: String(m.week), color: '#7c6af7' },
    { label: 'Clientes totales', value: String(m.clients), color: '#22d3a5' },
    { label: 'Ingresos estimados', value: '\u20a1' + m.revenue.toLocaleString('es-CR'), color: '#f56342' },
  ]

  return (
    <div className="db-root">
      {menuOpen && <div className="db-overlay" onClick={() => setMenuOpen(false)} />}

      <button
        className={"db-mobile-toggle" + (menuOpen ? " open" : "")}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
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
          <h1 className="db-header-title">Bienvenido, {firstName}</h1>
          <p className="db-header-date">{new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="db-metrics">
          {METRICS.map((mt) => <GlassCard key={mt.label} metric={mt} />)}
        </div>
        <p className="db-actions-label">Acciones rápidas</p>
        <div className="db-actions">
          <a href="/dashboard/appointments" className="db-action-btn" style={{ color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)' }}>+ Nueva cita</a>
          <a href="/dashboard/services" className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }}>+ Agregar servicio</a>
          <a href="/dashboard/clients" className="db-action-btn" style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }}>+ Nuevo cliente</a>
        </div>

        {appts.length > 0 ? (
          <div className="db-today-list">
            <p className="db-actions-label">Citas de hoy</p>
            {appts.map((a) => (
              <div key={a.id} className="db-today-row">
                <span className="db-today-time">
                  {new Date(a.start_time).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="db-today-client">{a.clients?.full_name ?? 'Cliente'}</span>
                <span className="db-today-service">{a.services?.name ?? ''}</span>
                <span
                  className="db-today-status"
                  style={{ color: STATUS_COLORS[a.status] ?? '#888', border: `1px solid ${STATUS_COLORS[a.status] ?? '#888'}55` }}
                >
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="db-empty">
            <p className="db-empty-title">No hay citas hoy</p>
            <p className="db-empty-subtitle">Configura tus servicios y horarios para empezar a recibir reservas</p>
            <a href="/dashboard/settings" className="db-cta">Configurar mi negocio</a>
          </div>
        )}
      </main>
    </div>
  )
}
