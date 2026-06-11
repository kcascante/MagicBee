'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './appointments.css'
import './services.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: true },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const START_HOUR = 7
const END_HOUR = 21
const PX_PER_MIN = 1.4

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#7c6af7',
  confirmed: '#f5a623',
  completed: '#22d3a5',
  cancelled: '#888888',
  no_show: '#f56342',
}

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  booked_via: string | null
  client_id: string | null
  service_id: string | null
  staff_id: string | null
  clients: { full_name: string; phone: string | null; email: string | null } | null
  services: { name: string; duration_minutes: number; price: number } | null
  staff: { id: string; full_name: string; avatar_url: string | null } | null
}

type ServiceOption = { id: string; name: string; duration_minutes: number; price: number }
type StaffOption = { id: string; full_name: string; avatar_url: string | null }
type UserData = { full_name: string; organizations: { name: string } }

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function apptDateStr(iso: string) {
  return fmtDateInput(new Date(iso))
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtPrice(price: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price)
}

export default function AppointmentsClient({
  userData,
  organizationId,
  requiresStaffSelection,
  initialAppointments,
  initialWeekStart,
  services,
  staff,
}: {
  userData: UserData | null
  organizationId: string
  requiresStaffSelection: boolean
  initialAppointments: Appointment[]
  initialWeekStart: string
  services: ServiceOption[]
  staff: StaffOption[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [weekStart, setWeekStart] = useState(new Date(initialWeekStart))
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [view, setView] = useState<'week' | 'day' | 'month'>('week')
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [monthAppointments, setMonthAppointments] = useState<Appointment[]>([])
  const [monthLoading, setMonthLoading] = useState(false)
  const [selectedDayIdx, setSelectedDayIdx] = useState(() => {
    const today = new Date()
    const diff = Math.floor((today.getTime() - getMonday(today).getTime()) / 86400000)
    return diff
  })
  const [staffFilter, setStaffFilter] = useState<string>('all')
  // MB-STATUS-FILTER-V1
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 880px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const lock = menuOpen || !!selectedAppt || showNewModal
    document.body.style.overflow = lock ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, selectedAppt, showNewModal])

  useEffect(() => {
    if (view === 'month' && monthAppointments.length === 0 && !monthLoading) {
      fetchMonth(monthDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/register')
    router.refresh()
  }

  const orgName = userData?.organizations?.name ?? 'Tu negocio'
  const firstName = userData?.full_name?.split(' ')[0] ?? 'Admin'

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const fetchWeek = async (newWeekStart: Date) => {
    setLoading(true)
    const sunday = new Date(newWeekStart)
    sunday.setDate(sunday.getDate() + 7)

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status, notes, booked_via,
        client_id, service_id, staff_id,
        clients(full_name, phone, email),
        services(name, duration_minutes, price),
        staff(id, full_name, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .gte('start_time', newWeekStart.toISOString())
      .lt('start_time', sunday.toISOString())
      .order('start_time', { ascending: true })

    setAppointments((data ?? []) as any)
    setWeekStart(newWeekStart)
    setLoading(false)
  }

  const fetchMonth = async (date: Date) => {
    setMonthLoading(true)
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const gridStart = getMonday(firstOfMonth)
    const gridEnd = new Date(gridStart)
    gridEnd.setDate(gridEnd.getDate() + 42)

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status, notes, booked_via,
        client_id, service_id, staff_id,
        clients(full_name, phone, email),
        services(name, duration_minutes, price),
        staff(id, full_name, avatar_url)
      `)
      .eq('organization_id', organizationId)
      .gte('start_time', gridStart.toISOString())
      .lt('start_time', gridEnd.toISOString())
      .order('start_time', { ascending: true })

    setMonthAppointments((data ?? []) as any)
    setMonthDate(firstOfMonth)
    setMonthLoading(false)
  }

  const goToToday = () => {
    if (view === 'month') {
      const d = new Date()
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      fetchMonth(d)
      return
    }
    const monday = getMonday(new Date())
    fetchWeek(monday)
    const today = new Date()
    setSelectedDayIdx(Math.floor((today.getTime() - monday.getTime()) / 86400000))
  }

  const goPrevWeek = () => {
    if (view === 'month') {
      const d = new Date(monthDate)
      d.setMonth(d.getMonth() - 1)
      fetchMonth(d)
      return
    }
    const prev = new Date(weekStart)
    prev.setDate(prev.getDate() - 7)
    fetchWeek(prev)
  }

  const goNextWeek = () => {
    if (view === 'month') {
      const d = new Date(monthDate)
      d.setMonth(d.getMonth() + 1)
      fetchMonth(d)
      return
    }
    const next = new Date(weekStart)
    next.setDate(next.getDate() + 7)
    fetchWeek(next)
  }

  const filteredAppointments = useMemo(() => {
    let result = appointments
    if (staffFilter === 'all') {
      // sin cambios
    } else if (staffFilter === 'none') {
      result = result.filter((a) => !a.staff_id)
    } else {
      result = result.filter((a) => a.staff_id === staffFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }
    return result
  }, [appointments, staffFilter, statusFilter])

  const apptsForDay = (day: Date) => {
    const dayStr = fmtDateInput(day)
    return filteredAppointments.filter((a) => apptDateStr(a.start_time) === dayStr)
  }

  const toMinutes = (iso: string) => {
    const d = new Date(iso)
    return d.getHours() * 60 + d.getMinutes()
  }

  const layoutDay = (dayAppts: Appointment[]) => {
    const sorted = [...dayAppts].sort((a, b) => a.start_time.localeCompare(b.start_time))
    const result: { appt: Appointment; col: number; cols: number }[] = []
    let cluster: { appt: Appointment; col: number; cols: number }[] = []
    let clusterEnd = -Infinity

    const flushCluster = () => {
      if (cluster.length === 0) return
      const colsEnd: number[] = []
      for (const item of cluster) {
        const start = toMinutes(item.appt.start_time)
        let placed = false
        for (let c = 0; c < colsEnd.length; c++) {
          if (colsEnd[c] <= start) {
            item.col = c
            colsEnd[c] = toMinutes(item.appt.end_time)
            placed = true
            break
          }
        }
        if (!placed) {
          item.col = colsEnd.length
          colsEnd.push(toMinutes(item.appt.end_time))
        }
      }
      const totalCols = colsEnd.length
      for (const item of cluster) {
        item.cols = totalCols
        result.push(item)
      }
      cluster = []
    }

    for (const appt of sorted) {
      const start = toMinutes(appt.start_time)
      if (start >= clusterEnd) {
        flushCluster()
        clusterEnd = -Infinity
      }
      cluster.push({ appt, col: 0, cols: 1 })
      clusterEnd = Math.max(clusterEnd, toMinutes(appt.end_time))
    }
    flushCluster()
    return result
  }

  const filteredMonthAppointments = useMemo(() => {
    let result = monthAppointments
    if (staffFilter === 'all') {
      // sin cambios
    } else if (staffFilter === 'none') {
      result = result.filter((a) => !a.staff_id)
    } else {
      result = result.filter((a) => a.staff_id === staffFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }
    return result
  }, [monthAppointments, staffFilter, statusFilter])

  const apptsForMonthDay = (day: Date) => {
    const dayStr = fmtDateInput(day)
    return filteredMonthAppointments.filter((a) => apptDateStr(a.start_time) === dayStr)
  }

  const updateStatus = async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select(`
        id, start_time, end_time, status, notes, booked_via,
        client_id, service_id, staff_id,
        clients(full_name, phone, email),
        services(name, duration_minutes, price),
        staff(id, full_name, avatar_url)
      `)
      .single()

    if (error) {
      alert('Error al actualizar: ' + error.message)
      return
    }

    if (data) {
      setAppointments((prev) => prev.map((a) => (a.id === id ? (data as any) : a)))
      setSelectedAppt(data as any)

      if (status === 'confirmed' || status === 'cancelled') {
        fetch('/api/notifications/appointment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: id, event: 'status_update' }),
        }).catch(() => {})
      }
    }
  }

  const handleNewAppointmentCreated = (appt: Appointment) => {
    const apptDay = apptDateStr(appt.start_time)
    const weekDays = days.map((d) => fmtDateInput(d))
    if (weekDays.includes(apptDay)) {
      setAppointments((prev) => [...prev, appt].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    }
    setShowNewModal(false)
  }

  const renderList = (day: Date) => {
    const dayAppts = apptsForDay(day)
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    if (dayAppts.length === 0) {
      return (
        <div className="db-empty">
          <p className="db-empty-title">No hay citas este dia</p>
          <p className="db-empty-subtitle">Usa "+ Nueva cita" para agendar una.</p>
        </div>
      )
    }

    return (
      <div className="apt-list">
        {dayAppts.map((appt) => {
          const color = STATUS_COLORS[appt.status] ?? '#7c6af7'
          return (
            <button
              key={appt.id}
              type="button"
              className={"apt-list-card" + (appt.status === 'cancelled' ? " cancelled" : "")}
              style={{ borderLeftColor: color }}
              onClick={() => setSelectedAppt(appt)}
            >
              <div className="apt-list-time">
                <span>{fmtTime(appt.start_time)}</span>
                <span className="apt-list-time-end">{fmtTime(appt.end_time)}</span>
              </div>
              <div className="apt-list-info">
                <span className="apt-list-name">{appt.clients?.full_name ?? 'Cliente'}</span>
                <span className="apt-list-service">
                  {appt.services?.name}{appt.staff ? ` \u00b7 ${appt.staff.full_name}` : ''}
                </span>
              </div>
              <span className="svc-badge" style={{ color, background: color + '22', border: `1px solid ${color}55` }}>
                {STATUS_LABELS[appt.status] ?? appt.status}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const renderGrid = (dayList: Date[]) => {
    const totalMinutes = (END_HOUR - START_HOUR) * 60
    const gridHeight = totalMinutes * PX_PER_MIN
    const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

    return (
      <div className="apt-grid-wrapper">
        <div className="apt-grid" style={{ gridTemplateColumns: `60px repeat(${dayList.length}, 1fr)` }}>
          {/* Header row */}
          <div className="apt-corner"></div>
          {dayList.map((d) => {
            const isToday = fmtDateInput(d) === fmtDateInput(new Date())
            return (
              <div key={d.toISOString()} className={"apt-day-header" + (isToday ? " today" : "")}>
                <span className="apt-day-name">{DAY_NAMES_SHORT[d.getDay()]}</span>
                <span className="apt-day-num">{d.getDate()}</span>
              </div>
            )
          })}

          {/* Hours column */}
          <div className="apt-hours-col" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div key={h} className="apt-hour-label" style={{ height: PX_PER_MIN * 60 }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayList.map((d) => {
            const dayAppts = layoutDay(apptsForDay(d))
            return (
              <div key={d.toISOString()} className="apt-day-col" style={{ height: gridHeight }}>
                {hours.map((h) => (
                  <div key={h} className="apt-hour-line" style={{ height: PX_PER_MIN * 60 }}></div>
                ))}
                {dayAppts.map(({ appt, col, cols }) => {
                  const start = new Date(appt.start_time)
                  const end = new Date(appt.end_time)
                  const startMin = start.getHours() * 60 + start.getMinutes() - START_HOUR * 60
                  const durMin = (end.getTime() - start.getTime()) / 60000
                  const top = Math.max(0, startMin * PX_PER_MIN)
                  const height = Math.max(durMin * PX_PER_MIN, 28)
                  const color = STATUS_COLORS[appt.status] ?? '#7c6af7'
                  const widthPct = 100 / cols
                  const leftPct = col * widthPct
                  return (
                    <button
                      key={appt.id}
                      className={"apt-block" + (appt.status === 'cancelled' ? " cancelled" : "") + (cols > 1 ? " split" : "")}
                      style={{ top, height, left: `${leftPct}%`, width: `calc(${widthPct}% - 2px)`, borderLeftColor: color, background: color + '22' }}
                      onClick={() => setSelectedAppt(appt)}
                    >
                      <span className="apt-block-time">{fmtTime(appt.start_time)}</span>
                      <span className="apt-block-name">{appt.clients?.full_name ?? 'Cliente'}</span>
                      <span className="apt-block-service">{appt.services?.name}{appt.staff ? ` \u00b7 ${appt.staff.full_name}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthGrid = () => {
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const gridStart = getMonday(firstOfMonth)
    const monthDays = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(d.getDate() + i)
      return d
    })
    const currentMonth = monthDate.getMonth()
    const monthDayNames = [...DAY_NAMES_SHORT.slice(1), DAY_NAMES_SHORT[0]]

    const handleDayClick = (day: Date) => {
      const monday = getMonday(day)
      fetchWeek(monday)
      setSelectedDayIdx(Math.floor((day.getTime() - monday.getTime()) / 86400000))
      setView('day')
    }

    return (
      <div className="apt-month-grid">
        {monthDayNames.map((name) => (
          <div key={name} className="apt-month-day-name">{name}</div>
        ))}
        {monthDays.map((d) => {
          const dayAppts = apptsForMonthDay(d)
          const isToday = fmtDateInput(d) === fmtDateInput(new Date())
          const inMonth = d.getMonth() === currentMonth
          const counts: Record<string, number> = {}
          dayAppts.forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1 })
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={"apt-month-cell" + (isToday ? " today" : "") + (inMonth ? "" : " outside")}
              onClick={() => handleDayClick(d)}
            >
              <span className="apt-month-date">{d.getDate()}</span>
              {dayAppts.length > 0 && (
                <div className="apt-month-dots">
                  {Object.entries(counts).map(([status]) => (
                    <span key={status} className="apt-month-dot" style={{ background: STATUS_COLORS[status] ?? '#888' }} />
                  ))}
                  <span className="apt-month-count">{dayAppts.length}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  const weekRangeLabel = () => {
    if (view === 'month') {
      return monthDate.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
    }
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    return `${weekStart.toLocaleDateString('es-CR', opts)} — ${end.toLocaleDateString('es-CR', opts)}`
  }

  return (
    <div className="db-root">
      {(menuOpen) && <div className="db-overlay" onClick={() => setMenuOpen(false)} />}

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
            <h1 className="db-header-title">Citas</h1>
            <p className="db-header-date">{weekRangeLabel()}</p>
          </div>
          <button className="db-cta" onClick={() => setShowNewModal(true)}>+ Nueva cita</button>
        </div>

        <div className="apt-toolbar">
          <div className="apt-toolbar-left">
            <button className="db-action-btn" onClick={goPrevWeek} aria-label="Semana anterior">‹</button>
            <button className="db-action-btn" onClick={goToToday}>Hoy</button>
            <button className="db-action-btn" onClick={goNextWeek} aria-label="Semana siguiente">›</button>
          </div>
          <div className="apt-toolbar-right">
            {requiresStaffSelection && staff.length > 0 && (
              <select className="auth-input apt-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="all">Todos los profesionales</option>
                <option value="none">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            )}
            <select className="auth-input apt-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="apt-view-toggle">
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Semana</button>
              <button className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>Día</button>
              <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Mes</button>
            </div>
          </div>
        </div>

        {view === 'day' && (
          <div className="apt-day-nav">
            {days.map((d, i) => {
              const isToday = fmtDateInput(d) === fmtDateInput(new Date())
              return (
                <button
                  key={d.toISOString()}
                  className={"apt-day-chip" + (i === selectedDayIdx ? " active" : "") + (isToday ? " today" : "")}
                  onClick={() => setSelectedDayIdx(i)}
                >
                  <span>{DAY_NAMES_SHORT[d.getDay()]}</span>
                  <strong>{d.getDate()}</strong>
                </button>
              )
            })}
          </div>
        )}

        {view === 'month' ? (
          monthLoading ? (
            <div className="db-empty"><p className="db-empty-title">Cargando...</p></div>
          ) : renderMonthGrid()
        ) : loading ? (
          <div className="db-empty"><p className="db-empty-title">Cargando...</p></div>
        ) : (
          view === 'week' ? renderGrid(days) : renderGrid([days[selectedDayIdx]])
        )}
      </main>

      {selectedAppt && (
        <AppointmentDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onUpdateStatus={updateStatus}
        />
      )}

      {showNewModal && (
        <NewAppointmentModal
          organizationId={organizationId}
          requiresStaffSelection={requiresStaffSelection}
          services={services}
          staff={staff}
          defaultDate={fmtDateInput(view === 'day' ? days[selectedDayIdx] : new Date())}
          onClose={() => setShowNewModal(false)}
          onCreated={handleNewAppointmentCreated}
        />
      )}
    </div>
  )
}

function AppointmentDetailModal({
  appt,
  onClose,
  onUpdateStatus,
}: {
  appt: Appointment
  onClose: () => void
  onUpdateStatus: (id: string, status: string) => void
}) {
  return (
    <div
      className="svc-modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-start', overflowY: 'auto', padding: '40px 20px' }}
    >
      <div
        className="svc-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ margin: '0 auto', maxHeight: 'none' }}
      >
        <div className="apt-detail-header">
          <h2 className="auth-card-title" style={{ marginBottom: 4 }}>{appt.clients?.full_name ?? 'Cliente'}</h2>
          <span className="svc-badge" style={{ color: STATUS_COLORS[appt.status], background: STATUS_COLORS[appt.status] + '22', border: `1px solid ${STATUS_COLORS[appt.status]}55` }}>
            {STATUS_LABELS[appt.status] ?? appt.status}
          </span>
        </div>

        <div className="apt-detail-rows">
          <div className="apt-detail-row">
            <span className="sch-time-field-label">Servicio</span>
            <span>{appt.services?.name} {appt.services && `· ${fmtPrice(appt.services.price)}`}</span>
          </div>
          <div className="apt-detail-row">
            <span className="sch-time-field-label">Horario</span>
            <span>{fmtTime(appt.start_time)} – {fmtTime(appt.end_time)} · {new Date(appt.start_time).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          {appt.staff && (
            <div className="apt-detail-row">
              <span className="sch-time-field-label">Profesional</span>
              <span>{appt.staff.full_name}</span>
            </div>
          )}
          {appt.clients?.phone && (
            <div className="apt-detail-row">
              <span className="sch-time-field-label">Teléfono</span>
              <span>{appt.clients.phone}</span>
            </div>
          )}
          {appt.clients?.email && (
            <div className="apt-detail-row">
              <span className="sch-time-field-label">Correo</span>
              <span>{appt.clients.email}</span>
            </div>
          )}
          {appt.notes && (
            <div className="apt-detail-row">
              <span className="sch-time-field-label">Notas</span>
              <span>{appt.notes}</span>
            </div>
          )}
          <div className="apt-detail-row">
            <span className="sch-time-field-label">Origen</span>
            <span>{appt.booked_via === 'admin' ? 'Agendada por el negocio' : appt.booked_via === 'whatsapp' ? 'WhatsApp' : 'Portal web'}</span>
          </div>
        </div>

        <p className="sch-time-field-label" style={{ marginTop: 16, marginBottom: 8 }}>Cambiar estado</p>
        <div className="apt-status-actions">
          {appt.status !== 'pending' && (
            <button className="db-action-btn" style={{ color: STATUS_COLORS.pending, border: `1px solid ${STATUS_COLORS.pending}55` }} onClick={() => onUpdateStatus(appt.id, 'pending')}>Pendiente</button>
          )}
          {appt.status !== 'confirmed' && (
            <button className="db-action-btn" style={{ color: STATUS_COLORS.confirmed, border: `1px solid ${STATUS_COLORS.confirmed}55` }} onClick={() => onUpdateStatus(appt.id, 'confirmed')}>Confirmar</button>
          )}
          {appt.status !== 'completed' && (
            <button className="db-action-btn" style={{ color: STATUS_COLORS.completed, border: `1px solid ${STATUS_COLORS.completed}55` }} onClick={() => onUpdateStatus(appt.id, 'completed')}>Completada</button>
          )}
          {appt.status !== 'no_show' && (
            <button className="db-action-btn" style={{ color: STATUS_COLORS.no_show, border: `1px solid ${STATUS_COLORS.no_show}55` }} onClick={() => onUpdateStatus(appt.id, 'no_show')}>No asistió</button>
          )}
          {appt.status !== 'cancelled' && (
            <button className="db-action-btn" style={{ color: STATUS_COLORS.cancelled, border: `1px solid ${STATUS_COLORS.cancelled}55` }} onClick={() => onUpdateStatus(appt.id, 'cancelled')}>Cancelar</button>
          )}
        </div>

        <div className="svc-form-actions">
          <button type="button" className="db-action-btn" onClick={onClose} style={{ color: '#888' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

function NewAppointmentModal({
  organizationId,
  requiresStaffSelection,
  services,
  staff,
  defaultDate,
  onClose,
  onCreated,
}: {
  organizationId: string
  requiresStaffSelection: boolean
  services: ServiceOption[]
  staff: StaffOption[]
  defaultDate: string
  onClose: () => void
  onCreated: (appt: Appointment) => void
}) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ slot_start: string; slot_end: string }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ slot_start: string; slot_end: string } | null>(null)
  const [phone, setPhone] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [foundClientId, setFoundClientId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedService = services.find((s) => s.id === serviceId)

  const loadSlots = async (svcId: string, d: string, stf: string | null) => {
    setLoadingSlots(true)
    setSelectedSlot(null)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('get_available_slots', {
      p_organization_id: organizationId,
      p_service_id: svcId,
      p_date: d,
      p_staff_id: stf,
    })
    if (rpcError) {
      setError('Error al cargar horarios: ' + rpcError.message)
      setSlots([])
    } else {
      setSlots(data ?? [])
    }
    setLoadingSlots(false)
  }

  const goToSchedule = () => {
    if (!serviceId) { setError('Seleccioná un servicio'); return }
    setError('')
    if (requiresStaffSelection && staff.length > 0) {
      setStep(2) // elegir profesional
    } else {
      setStaffId(null)
      setStep(3) // elegir fecha/hora
      loadSlots(serviceId, date, null)
    }
  }

  const chooseStaff = (id: string | null) => {
    setStaffId(id)
    setStep(3)
    loadSlots(serviceId, date, id)
  }

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    loadSlots(serviceId, newDate, staffId)
  }

  const searchClient = async () => {
    const cleanPhone = sanitizeText(phone).trim()
    if (!cleanPhone) return
    setSearching(true)
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email')
      .eq('organization_id', organizationId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (data) {
      setFoundClientId(data.id)
      setClientName(data.full_name)
      setClientEmail(data.email ?? '')
    } else {
      setFoundClientId(null)
    }
    setSearching(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedSlot) { setError('Seleccioná un horario'); return }
    const name = sanitizeText(clientName).trim()
    const cleanPhone = sanitizeText(phone).trim()
    const email = sanitizeText(clientEmail).trim()
    if (!name) { setError('El nombre del cliente es obligatorio'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('El correo no es válido'); return }

    setSaving(true)

    let clientId = foundClientId

    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({ organization_id: organizationId, full_name: name, phone: cleanPhone || null, email: email || null })
        .select('id')
        .single()

      if (clientError || !newClient) {
        setError('Error al crear el cliente: ' + clientError?.message)
        setSaving(false)
        return
      }
      clientId = newClient.id
    }

    const startISO = new Date(`${date}T${selectedSlot.slot_start}`).toISOString()
    const endISO = new Date(`${date}T${selectedSlot.slot_end}`).toISOString()

    const { data: created, error: apptError } = await supabase
      .from('appointments')
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        service_id: serviceId,
        staff_id: staffId,
        start_time: startISO,
        end_time: endISO,
        status: 'confirmed',
        notes: sanitizeText(notes).trim() || null,
        booked_via: 'admin',
      })
      .select(`
        id, start_time, end_time, status, notes, booked_via,
        client_id, service_id, staff_id,
        clients(full_name, phone, email),
        services(name, duration_minutes, price),
        staff(id, full_name, avatar_url)
      `)
      .single()

    if (apptError || !created) {
      setError('Error al crear la cita: ' + apptError?.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onCreated(created as any)
  }

  return (
    <div className="svc-modal-overlay" onClick={onClose}>
      <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="auth-card-title" style={{ marginBottom: 4 }}>Nueva cita</h2>
        <p className="auth-card-subtitle" style={{ marginBottom: 20 }}>
          {step === 1 && 'Elegí el servicio'}
          {step === 2 && 'Elegí el profesional'}
          {step === 3 && 'Elegí fecha y horario'}
          {step === 4 && 'Datos del cliente'}
        </p>

        {step === 1 && (
          <div className="auth-form">
            <div className="auth-field">
              <label>Servicio</label>
              <select className="auth-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min · {fmtPrice(s.price)}</option>
                ))}
              </select>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="svc-form-actions">
              <button type="button" className="db-action-btn" onClick={onClose} style={{ color: '#888' }}>Cancelar</button>
              <button type="button" className="db-cta" onClick={goToSchedule}>Siguiente</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="auth-form">
            <div className="apt-staff-grid">
              <button type="button" className="apt-staff-option" onClick={() => chooseStaff(null)}>
                <div className="staff-avatar" style={{ width: 56, height: 56 }}>
                  <span className="staff-avatar-initials" style={{ fontSize: 18 }}>?</span>
                </div>
                <span>Cualquiera</span>
              </button>
              {staff.map((s) => (
                <button key={s.id} type="button" className="apt-staff-option" onClick={() => chooseStaff(s.id)}>
                  <div className="staff-avatar" style={{ width: 56, height: 56 }}>
                    {s.avatar_url ? <img src={s.avatar_url} alt={s.full_name} /> : (
                      <span className="staff-avatar-initials" style={{ fontSize: 18 }}>
                        {s.full_name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                      </span>
                    )}
                  </div>
                  <span>{s.full_name}</span>
                </button>
              ))}
            </div>
            <div className="svc-form-actions">
              <button type="button" className="db-action-btn" onClick={() => setStep(1)} style={{ color: '#888' }}>Atrás</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="auth-form">
            <div className="auth-field">
              <label>Fecha</label>
              <input
                className="auth-input"
                type="date"
                value={date}
                min={fmtDateInput(new Date())}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label>Horarios disponibles {selectedService && `(${selectedService.duration_minutes} min)`}</label>
              {loadingSlots ? (
                <p className="sch-note" style={{ marginTop: 4 }}>Cargando horarios...</p>
              ) : slots.length === 0 ? (
                <p className="sch-note" style={{ marginTop: 4 }}>No hay horarios disponibles para esta fecha.</p>
              ) : (
                <div className="apt-slots-grid">
                  {slots.map((s) => (
                    <button
                      type="button"
                      key={s.slot_start}
                      className={"apt-slot-btn" + (selectedSlot?.slot_start === s.slot_start ? " selected" : "")}
                      onClick={() => setSelectedSlot(s)}
                    >
                      {s.slot_start.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="svc-form-actions">
              <button type="button" className="db-action-btn" onClick={() => setStep(requiresStaffSelection && staff.length > 0 ? 2 : 1)} style={{ color: '#888' }}>Atrás</button>
              <button type="button" className="db-cta" disabled={!selectedSlot} onClick={() => { setError(''); setStep(4) }}>Siguiente</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
            <div className="auth-field">
              <label>Teléfono del cliente</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="auth-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setFoundClientId(null) }}
                  placeholder="8888-8888"
                  maxLength={30}
                />
                <button type="button" className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)', whiteSpace: 'nowrap' }} onClick={searchClient} disabled={searching}>
                  {searching ? '...' : 'Buscar'}
                </button>
              </div>
              {foundClientId && <p className="sch-note" style={{ marginTop: 4, color: '#22d3a5' }}>Cliente existente encontrado</p>}
            </div>
            <div className="auth-field">
              <label>Nombre completo</label>
              <input
                className="auth-input"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                maxLength={100}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="auth-field">
              <label>Correo (opcional)</label>
              <input
                className="auth-input"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                maxLength={254}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="auth-field">
              <label>Notas (opcional)</label>
              <input
                className="auth-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="Notas internas sobre la cita"
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="svc-form-actions">
              <button type="button" className="db-action-btn" onClick={() => setStep(3)} style={{ color: '#888' }}>Atrás</button>
              <button type="submit" className="db-cta" disabled={saving}>{saving ? 'Guardando...' : 'Crear cita'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
