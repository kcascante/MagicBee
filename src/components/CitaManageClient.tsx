'use client'

import { useState } from 'react'
import './cita-manage.css'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de confirmación',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#7c6af7',
  confirmed: '#22d3a5',
  completed: '#22d3a5',
  cancelled: '#888888',
  no_show: '#f56342',
}

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  services: { name: string; price: number; duration_minutes: number } | null
  staff: { full_name: string } | null
  clients: { full_name: string } | null
}

type Organization = {
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  timezone: string | null
  phone: string | null
  cancellation_window_hours: number
}

function fmtPrice(price: number) {
  return '\u20a1' + Math.round(price).toLocaleString('es-CR')
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

export default function CitaManageClient({ appointment, organization }: { appointment: Appointment; organization: Organization }) {
  const [status, setStatus] = useState(appointment.status)
  const [cancelling, setCancelling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')

  const accent = organization.primary_color && /^#[0-9a-fA-F]{6}$/.test(organization.primary_color) ? organization.primary_color : '#f5a623'
  const timezone = organization.timezone || 'America/Costa_Rica'
  const windowHours = organization.cancellation_window_hours ?? 2

  const start = new Date(appointment.start_time)
  const dateLabel = start.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone })
  const timeLabel = start.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
  const hoursUntil = (start.getTime() - Date.now()) / 3600000
  const canCancel = (status === 'pending' || status === 'confirmed') && hoursUntil >= windowHours

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const res = await fetch('/api/appointments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'window_passed') {
          setError(`Ya no se puede cancelar online: se requieren al menos ${data.windowHours} horas de anticipación.`)
        } else {
          setError('No se pudo cancelar la cita. Intentá de nuevo o contactá al negocio.')
        }
        setCancelling(false)
        return
      }
      setStatus('cancelled')
      setConfirmOpen(false)
    } catch {
      setError('No se pudo cancelar la cita. Intentá de nuevo.')
    }
    setCancelling(false)
  }

  return (
    <div className="cm-page">
      <div className="cm-card">
        <div className="cm-header" style={{ background: accent }}>
          {organization.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="cm-logo" />
          ) : (
            <div className="cm-logo cm-logo-fallback">{initials(organization.name)}</div>
          )}
          <span className="cm-org-name">{organization.name}</span>
        </div>

        <div className="cm-body">
          <div className="cm-status-row">
            <span className="cm-status-badge" style={{ color: STATUS_COLORS[status] ?? '#888', border: `1px solid ${STATUS_COLORS[status] ?? '#888'}55` }}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>

          {appointment.clients?.full_name && <h2 className="cm-title">¡Hola, {appointment.clients.full_name}!</h2>}

          <div className="cm-rows">
            <div className="cm-row">
              <span className="cm-label">Servicio</span>
              <span className="cm-value">{appointment.services?.name}</span>
            </div>
            <div className="cm-row">
              <span className="cm-label">Fecha</span>
              <span className="cm-value" style={{ textTransform: 'capitalize' }}>{dateLabel}</span>
            </div>
            <div className="cm-row">
              <span className="cm-label">Hora</span>
              <span className="cm-value">{timeLabel}</span>
            </div>
            {appointment.staff?.full_name && (
              <div className="cm-row">
                <span className="cm-label">Profesional</span>
                <span className="cm-value">{appointment.staff.full_name}</span>
              </div>
            )}
            {appointment.services?.price ? (
              <div className="cm-row">
                <span className="cm-label">Precio</span>
                <span className="cm-value">{fmtPrice(appointment.services.price)}</span>
              </div>
            ) : null}
          </div>

          {status === 'cancelled' && (
            <p className="cm-note">Esta cita fue cancelada.</p>
          )}

          {(status === 'completed' || status === 'no_show') && (
            <p className="cm-note">Esta cita ya fue atendida.</p>
          )}

          {(status === 'pending' || status === 'confirmed') && !canCancel && (
            <p className="cm-note">
              Ya no es posible cancelar esta cita online (se requieren al menos {windowHours} hora{windowHours === 1 ? '' : 's'} de anticipación).
              {organization.phone ? ` Para cambios, contactá al negocio: ${organization.phone}.` : ''}
            </p>
          )}

          {canCancel && !confirmOpen && (
            <button className="cm-cancel-btn" onClick={() => setConfirmOpen(true)}>Cancelar cita</button>
          )}

          {canCancel && confirmOpen && (
            <div className="cm-confirm">
              <p>¿Seguro que querés cancelar esta cita? Esta acción no se puede deshacer.</p>
              <div className="cm-confirm-actions">
                <button className="cm-secondary-btn" onClick={() => setConfirmOpen(false)} disabled={cancelling}>Volver</button>
                <button className="cm-cancel-btn" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="cm-error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
