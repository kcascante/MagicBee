'use client'

import { useRef, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import './dashboard.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: true },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

const METRICS = [
  { label: 'Citas hoy', value: '0', color: '#f5a623' },
  { label: 'Citas esta semana', value: '0', color: '#7c6af7' },
  { label: 'Clientes totales', value: '0', color: '#22d3a5' },
  { label: 'Ingresos estimados', value: '\u20a10', color: '#f56342' },
]

type Metric = { label: string; value: string; color: string }
type UserData = { full_name: string; organizations: { name: string } }

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

export default function DashboardClient({ userData }: { userData: UserData | null }) {
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

  return (
    <div className="db-root">
      {menuOpen && <div className="db-overlay" onClick={() => setMenuOpen(false)} />}

      <button
        className="db-mobile-toggle"
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
          {METRICS.map((m) => <GlassCard key={m.label} metric={m} />)}
        </div>
        <p className="db-actions-label">Acciones rápidas</p>
        <div className="db-actions">
          <button className="db-action-btn" style={{ color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)' }}>+ Nueva cita</button>
          <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }}>+ Agregar servicio</button>
          <button className="db-action-btn" style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }}>+ Nuevo cliente</button>
        </div>
        <div className="db-empty">
          <p className="db-empty-title">No hay citas hoy</p>
          <p className="db-empty-subtitle">Configura tus servicios y horarios para empezar a recibir reservas</p>
          <button className="db-cta">Configurar mi negocio</button>
        </div>
      </main>
    </div>
  )
}
