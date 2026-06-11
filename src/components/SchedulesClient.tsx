'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './schedules.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: true },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

type ScheduleRow = {
  id: string | null
  organization_id: string
  staff_id: null
  day_of_week: number
  start_time: string
  end_time: string
  break_start: string | null
  break_end: string | null
  has_break: boolean
  is_active: boolean
}

type UserData = { full_name: string; organizations: { name: string } }

const DEFAULT_START = '09:00'
const DEFAULT_END = '18:00'
const DEFAULT_BREAK_START = '12:00'
const DEFAULT_BREAK_END = '13:00'

function buildInitialState(rows: any[], organizationId: string): Record<number, ScheduleRow> {
  const map: Record<number, ScheduleRow> = {}
  for (const day of DAYS) {
    const existing = rows.find((r) => r.day_of_week === day.value)
    map[day.value] = existing
      ? {
          id: existing.id,
          organization_id: organizationId,
          staff_id: null,
          day_of_week: day.value,
          start_time: existing.start_time,
          end_time: existing.end_time,
          break_start: existing.break_start,
          break_end: existing.break_end,
          has_break: !!(existing.break_start && existing.break_end),
          is_active: existing.is_active,
        }
      : {
          id: null,
          organization_id: organizationId,
          staff_id: null,
          day_of_week: day.value,
          start_time: DEFAULT_START,
          end_time: DEFAULT_END,
          break_start: null,
          break_end: null,
          has_break: false,
          is_active: false,
        }
  }
  return map
}

function timeToInput(value: string | null): string {
  if (!value) return DEFAULT_START
  return value.slice(0, 5)
}

function toTimeOrNull(value: string | null): string | null {
  if (!value) return null
  return value.length === 5 ? value + ':00' : value
}

export default function SchedulesClient({
  userData,
  initialSchedules,
  organizationId,
}: {
  userData: UserData | null
  initialSchedules: any[]
  organizationId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [schedules, setSchedules] = useState<Record<number, ScheduleRow>>(
    buildInitialState(initialSchedules, organizationId)
  )
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  const updateDay = (day: number, patch: Partial<ScheduleRow>) => {
    setSchedules((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
    setMessage('')
  }

  const toggleBreak = (day: number, enabled: boolean) => {
    if (enabled) {
      updateDay(day, {
        has_break: true,
        break_start: schedules[day].break_start ?? DEFAULT_BREAK_START,
        break_end: schedules[day].break_end ?? DEFAULT_BREAK_END,
      })
    } else {
      updateDay(day, { has_break: false, break_start: null, break_end: null })
    }
  }

  const handleSave = async () => {
    setError('')
    setMessage('')

    for (const day of DAYS) {
      const row = schedules[day.value]
      if (!row.is_active) continue

      if (row.start_time >= row.end_time) {
        setError(`En ${day.label}, la hora de apertura debe ser anterior a la de cierre`)
        return
      }

      if (row.has_break) {
        if (!row.break_start || !row.break_end) {
          setError(`En ${day.label}, completá el horario del descanso`)
          return
        }
        if (row.break_start >= row.break_end) {
          setError(`En ${day.label}, el inicio del descanso debe ser anterior al final`)
          return
        }
        if (row.break_start < row.start_time || row.break_end > row.end_time) {
          setError(`En ${day.label}, el descanso debe estar dentro del horario laboral`)
          return
        }
      }
    }

    setSaving(true)

    for (const day of DAYS) {
      const row = schedules[day.value]
      const payload = {
        organization_id: organizationId,
        staff_id: null,
        day_of_week: row.day_of_week,
        start_time: toTimeOrNull(row.start_time) ?? DEFAULT_START + ':00',
        end_time: toTimeOrNull(row.end_time) ?? DEFAULT_END + ':00',
        break_start: row.has_break ? toTimeOrNull(row.break_start) : null,
        break_end: row.has_break ? toTimeOrNull(row.break_end) : null,
        is_active: row.is_active,
      }

      if (row.id) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', row.id)

        if (updateError) {
          setError('Error al guardar: ' + updateError.message)
          setSaving(false)
          return
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('schedules')
          .insert(payload)
          .select()
          .single()

        if (insertError) {
          setError('Error al guardar: ' + insertError.message)
          setSaving(false)
          return
        }

        if (data) {
          setSchedules((prev) => ({ ...prev, [day.value]: { ...prev[day.value], id: data.id } }))
        }
      }
    }

    setSaving(false)
    setMessage('Horario guardado correctamente')
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
            <h1 className="db-header-title">Horarios</h1>
            <p className="db-header-date">Definí los días, horas y descansos en que tu negocio recibe citas</p>
          </div>
          <button className="db-cta" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>

        {error && <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
        {message && <div className="sch-success" role="status">{message}</div>}

        <div className="sch-list">
          {DAYS.map((day) => {
            const row = schedules[day.value]
            return (
              <div key={day.value} className={"sch-row" + (row.is_active ? "" : " closed")}>
                <div className="sch-row-top">
                  <div className="sch-day">
                    <label className="sch-toggle">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) => updateDay(day.value, { is_active: e.target.checked })}
                      />
                      <span className="sch-toggle-slider"></span>
                    </label>
                    <span className="sch-day-name">{day.label}</span>
                  </div>

                  {row.is_active ? (
                    <div className="sch-times">
                      <div className="sch-time-field">
                        <label>Apertura</label>
                        <input
                          type="time"
                          className="auth-input sch-time-input"
                          value={timeToInput(row.start_time)}
                          onChange={(e) => updateDay(day.value, { start_time: e.target.value })}
                        />
                      </div>
                      <span className="sch-time-sep">—</span>
                      <div className="sch-time-field">
                        <label>Cierre</label>
                        <input
                          type="time"
                          className="auth-input sch-time-input"
                          value={timeToInput(row.end_time)}
                          onChange={(e) => updateDay(day.value, { end_time: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="sch-closed-label">Cerrado</span>
                  )}
                </div>

                {row.is_active && (
                  <div className="sch-break-row">
                    <label className="sch-break-toggle">
                      <input
                        type="checkbox"
                        checked={row.has_break}
                        onChange={(e) => toggleBreak(day.value, e.target.checked)}
                      />
                      <span>Descanso (ej. almuerzo)</span>
                    </label>

                    {row.has_break && (
                      <div className="sch-times">
                        <div className="sch-time-field">
                          <label>Desde</label>
                          <input
                            type="time"
                            className="auth-input sch-time-input"
                            value={timeToInput(row.break_start)}
                            onChange={(e) => updateDay(day.value, { break_start: e.target.value })}
                          />
                        </div>
                        <span className="sch-time-sep">—</span>
                        <div className="sch-time-field">
                          <label>Hasta</label>
                          <input
                            type="time"
                            className="auth-input sch-time-input"
                            value={timeToInput(row.break_end)}
                            onChange={(e) => updateDay(day.value, { break_end: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="sch-note">
          Próximamente: excepciones por fecha (feriados, vacaciones).
        </p>
      </main>
    </div>
  )
}
