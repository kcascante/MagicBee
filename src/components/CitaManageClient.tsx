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

type Review = {
  id: string
  rating: number
  comment: string | null
  admin_reply: string | null
  admin_reply_at: string | null
  created_at: string
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

export default function CitaManageClient({ appointment, organization, existingReview }: { appointment: Appointment; organization: Organization; existingReview: Review | null }) {
  const [status, setStatus] = useState(appointment.status)
  const [cancelling, setCancelling] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState<Review | null>(existingReview)
  const [ratingInput, setRatingInput] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')

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

  const handleSubmitReview = async () => {
    if (ratingInput < 1 || ratingInput > 5) {
      setReviewError('Seleccioná una calificación de 1 a 5 estrellas.')
      return
    }
    setSubmittingReview(true)
    setReviewError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: appointment.id, rating: ratingInput, comment: commentInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_reviewed') {
          setReviewError('Ya enviaste una reseña para esta cita.')
        } else {
          setReviewError('No se pudo enviar la reseña. Intentá de nuevo.')
        }
        setSubmittingReview(false)
        return
      }
      setReview(data.review)
    } catch {
      setReviewError('No se pudo enviar la reseña. Intentá de nuevo.')
    }
    setSubmittingReview(false)
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

          {status === 'completed' && (
            <div className="cm-review">
              {review ? (
                <>
                  <p className="cm-review-title">Tu reseña</p>
                  <div className="cm-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={'cm-star' + (n <= review.rating ? ' filled' : '')}>★</span>
                    ))}
                  </div>
                  {review.comment && <p className="cm-review-thanks">{review.comment}</p>}
                  {!review.comment && <p className="cm-review-thanks">¡Gracias por tu calificación!</p>}
                  {review.admin_reply && (
                    <div className="cm-review-reply">
                      <div className="cm-review-reply-label">Respuesta de {organization.name}</div>
                      <div className="cm-review-reply-text">{review.admin_reply}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="cm-review-title">¿Cómo fue tu experiencia?</p>
                  <div className="cm-stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={'cm-star' + (n <= (hoverRating || ratingInput) ? ' filled' : '')}
                        onMouseEnter={() => setHoverRating(n)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRatingInput(n)}
                        disabled={submittingReview}
                        aria-label={`${n} estrella${n === 1 ? '' : 's'}`}
                      >★</button>
                    ))}
                  </div>
                  <textarea
                    className="cm-review-textarea"
                    placeholder="Contanos cómo te fue (opcional)"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value.slice(0, 1000))}
                    maxLength={1000}
                    disabled={submittingReview}
                  />
                  <button
                    type="button"
                    className="cm-review-submit"
                    style={{ background: accent }}
                    onClick={handleSubmitReview}
                    disabled={submittingReview || ratingInput < 1}
                  >
                    {submittingReview ? 'Enviando...' : 'Enviar reseña'}
                  </button>
                  {reviewError && <p className="cm-error">{reviewError}</p>}
                </>
              )}
            </div>
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
