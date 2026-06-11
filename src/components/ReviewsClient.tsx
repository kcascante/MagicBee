'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './services.css'
import './reviews.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: true },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending_reply', label: 'Sin responder' },
  { key: 'replied', label: 'Respondidas' },
  { key: 'hidden', label: 'Ocultas' },
]

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  admin_reply: string | null
  admin_reply_at: string | null
  is_public: boolean
  created_at: string
  clients: { full_name: string; phone: string | null; email: string | null } | null
  appointments: { start_time: string; services: { name: string } | null } | null
}

type UserData = { full_name: string; organizations: { name: string } }

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="rv-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={'rv-star' + (n <= rating ? ' filled' : '')}>★</span>
      ))}
    </div>
  )
}

export default function ReviewsClient({
  userData,
  initialReviews,
}: {
  userData: UserData | null
  initialReviews: ReviewRow[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [reviews, setReviews] = useState<ReviewRow[]>(initialReviews)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

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

  const stats = useMemo(() => {
    const total = reviews.length
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
    const avg = total > 0 ? sum / total : 0
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of reviews) counts[r.rating] = (counts[r.rating] ?? 0) + 1
    return { total, avg, counts }
  }, [reviews])

  const filteredReviews = useMemo(() => {
    switch (filter) {
      case 'pending_reply':
        return reviews.filter((r) => !r.admin_reply)
      case 'replied':
        return reviews.filter((r) => !!r.admin_reply)
      case 'hidden':
        return reviews.filter((r) => !r.is_public)
      default:
        return reviews
    }
  }, [reviews, filter])

  const counts = useMemo(() => ({
    all: reviews.length,
    pending_reply: reviews.filter((r) => !r.admin_reply).length,
    replied: reviews.filter((r) => !!r.admin_reply).length,
    hidden: reviews.filter((r) => !r.is_public).length,
  }), [reviews])

  const togglePublic = async (review: ReviewRow) => {
    setSavingId(review.id)
    const { data, error } = await supabase
      .from('reviews')
      .update({ is_public: !review.is_public })
      .eq('id', review.id)
      .select('id, is_public')
      .single()

    if (!error && data) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, is_public: data.is_public } : r)))
    }
    setSavingId(null)
  }

  const saveReply = async (review: ReviewRow) => {
    const reply = sanitizeText(drafts[review.id] ?? '').trim().slice(0, 1000)
    if (!reply) return

    setSavingId(review.id)
    const { data, error } = await supabase
      .from('reviews')
      .update({ admin_reply: reply, admin_reply_at: new Date().toISOString() })
      .eq('id', review.id)
      .select('id, admin_reply, admin_reply_at')
      .single()

    if (!error && data) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, admin_reply: data.admin_reply, admin_reply_at: data.admin_reply_at } : r)))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[review.id]
        return next
      })
    }
    setSavingId(null)
  }

  const removeReply = async (review: ReviewRow) => {
    if (!confirm('¿Quitar la respuesta de esta reseña?')) return
    setSavingId(review.id)
    const { error } = await supabase
      .from('reviews')
      .update({ admin_reply: null, admin_reply_at: null })
      .eq('id', review.id)

    if (!error) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, admin_reply: null, admin_reply_at: null } : r)))
    }
    setSavingId(null)
  }

  const deleteReview = async (id: string) => {
    if (!confirm('¿Eliminar esta reseña? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (!error) {
      setReviews((prev) => prev.filter((r) => r.id !== id))
    }
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
            <h1 className="db-header-title">Reseñas</h1>
            <p className="db-header-date">Opiniones de tus clientes</p>
          </div>
        </div>

        <div className="rv-summary">
          <div className="rv-summary-score">
            <span className="rv-summary-number">{stats.avg.toFixed(1)}</span>
            <Stars rating={Math.round(stats.avg)} />
            <span className="rv-summary-total">{stats.total} reseña{stats.total === 1 ? '' : 's'}</span>
          </div>
          <div className="rv-summary-bars">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = stats.counts[n] ?? 0
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={n} className="rv-summary-row">
                  <span className="rv-summary-label">{n} ★</span>
                  <div className="rv-summary-track">
                    <div className="rv-summary-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="rv-summary-count">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="apt-toolbar">
          <div className="apt-view-toggle">
            {FILTERS.map((f) => (
              <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
                {f.label} ({counts[f.key as keyof typeof counts] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {filteredReviews.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">
              {reviews.length === 0 ? 'Todavía no tenés reseñas' : 'No hay reseñas en este filtro'}
            </p>
            <p className="db-empty-subtitle">
              {reviews.length === 0
                ? 'Cuando un cliente complete una cita, podrá dejar una reseña desde el enlace de su cita.'
                : 'Probá con otro filtro.'}
            </p>
          </div>
        ) : (
          <div className="rv-list">
            {filteredReviews.map((review) => (
              <div key={review.id} className={'svc-card rv-card' + (review.is_public ? '' : ' rv-hidden')}>
                <div className="rv-card-top">
                  <div>
                    <p className="rv-client-name">{review.clients?.full_name ?? 'Cliente'}</p>
                    <p className="rv-meta">
                      {review.appointments?.services?.name ? review.appointments.services.name + ' · ' : ''}
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                  <Stars rating={review.rating} />
                </div>

                {review.comment && <p className="rv-comment">{review.comment}</p>}

                {review.admin_reply ? (
                  <div className="rv-reply-existing">
                    <div className="rv-reply-existing-label">Tu respuesta</div>
                    <p className="rv-reply-existing-text">{review.admin_reply}</p>
                    <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => removeReply(review)} disabled={savingId === review.id}>
                      Quitar respuesta
                    </button>
                  </div>
                ) : (
                  <div className="rv-reply-box">
                    <textarea
                      className="auth-input"
                      placeholder="Responder a esta reseña..."
                      value={drafts[review.id] ?? ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [review.id]: e.target.value.slice(0, 1000) }))}
                      maxLength={1000}
                      rows={2}
                    />
                    <button className="db-cta" onClick={() => saveReply(review)} disabled={savingId === review.id || !(drafts[review.id] ?? '').trim()}>
                      Responder
                    </button>
                  </div>
                )}

                <div className="rv-card-actions">
                  <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => togglePublic(review)} disabled={savingId === review.id}>
                    {review.is_public ? 'Ocultar del portal' : 'Mostrar en el portal'}
                  </button>
                  <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => deleteReview(review.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
