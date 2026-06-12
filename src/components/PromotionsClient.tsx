'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './promotions.css'
import {
  SEGMENTS,
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLES,
  filterBySegment,
  renderTemplate,
  fmtVisitDate,
  type SegmentKey,
  type AnnotatedClient,
} from '@/lib/promotions'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Promociones', href: '/dashboard/promotions', active: true },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

function sanitizeTemplate(value: string): string {
  return value.replace(/[<>`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

type PlainClient = Omit<AnnotatedClient, 'segments'> & { segments: SegmentKey[] }

type Campaign = {
  id: string
  channel: 'whatsapp' | 'email'
  segment: SegmentKey
  service_id: string | null
  template: string
  subject: string | null
  recipient_count: number
  sent_count: number
  failed_count: number
  created_at: string
  services: { name: string } | null
  conversions: number | null
}

type UserData = {
  full_name: string
  organizations: { name: string; slug: string; timezone?: string; primary_color?: string }
}

const SEGMENT_LABELS: Record<SegmentKey, string> = {
  todos: 'Todos los clientes',
  nuevos: 'Clientes nuevos',
  inactivos: 'Clientes inactivos',
  vip: 'Clientes VIP',
  por_servicio: 'Por servicio',
}

const CHANNEL_LABELS: Record<'whatsapp' | 'email', string> = { whatsapp: 'WhatsApp', email: 'Email' }

export default function PromotionsClient({
  userData,
  organizationId,
  hasWhatsapp,
  hasEmail,
  clients,
  services,
  campaigns,
}: {
  userData: UserData | null
  organizationId: string
  hasWhatsapp: boolean
  hasEmail: boolean
  clients: PlainClient[]
  services: { id: string; name: string }[]
  campaigns: Campaign[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [channel, setChannel] = useState<'whatsapp' | 'email'>(hasWhatsapp ? 'whatsapp' : 'email')
  const [segment, setSegment] = useState<SegmentKey>('todos')
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? '')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATES.todos)
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number; recipients: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen || showConfirm ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, showConfirm])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/register')
    router.refresh()
  }

  const orgName = userData?.organizations?.name ?? 'Tu negocio'
  const orgSlug = userData?.organizations?.slug ?? ''
  const timezone = userData?.organizations?.timezone || 'America/Costa_Rica'
  const firstName = userData?.full_name?.split(' ')[0] ?? 'Admin'
  const linkAgendar = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${orgSlug}`

  const counts = useMemo(() => {
    const c: Record<SegmentKey, number> = { todos: 0, nuevos: 0, inactivos: 0, vip: 0, por_servicio: 0 }
    for (const cl of clients) {
      for (const seg of cl.segments) c[seg] = (c[seg] || 0) + 1
    }
    if (serviceId) c.por_servicio = clients.filter((cl) => cl.service_ids.includes(serviceId)).length
    return c
  }, [clients, serviceId])

  const recipients = useMemo(() => filterBySegment(clients as AnnotatedClient[], segment, serviceId), [clients, segment, serviceId])

  const selectSegment = (key: SegmentKey) => {
    setSegment(key)
    setTemplate(DEFAULT_TEMPLATES[key])
    setError('')
    setResult(null)
  }

  const selectChannel = (key: 'whatsapp' | 'email') => {
    setChannel(key)
    setError('')
    setResult(null)
  }

  const insertVariable = (key: string) => {
    const el = textareaRef.current
    const insertion = `{${key}}`
    if (!el) { setTemplate((t) => t + insertion); return }
    const start = el.selectionStart ?? template.length
    const end = el.selectionEnd ?? template.length
    const newVal = template.slice(0, start) + insertion + template.slice(end)
    setTemplate(newVal)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + insertion.length
      el.setSelectionRange(pos, pos)
    })
  }

  const previewMessage = useMemo(() => {
    const sample = recipients[0]
    const vars = {
      nombre: sample ? (sample.full_name || '').split(' ')[0] || sample.full_name : 'Cliente',
      negocio: orgName,
      servicio: sample?.last_service || 'nuestros servicios',
      fecha_ultima_visita: sample ? fmtVisitDate(sample.last_visit_at, timezone) : 'tu primera visita',
      link_agendar: linkAgendar,
    }
    return renderTemplate(template, vars)
  }, [template, recipients, orgName, timezone, linkAgendar])

  const channelAvailable = (ch: 'whatsapp' | 'email') => (ch === 'whatsapp' ? hasWhatsapp : hasEmail)

  const handleSend = async () => {
    setSending(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/promotions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          segment,
          service_id: segment === 'por_servicio' ? serviceId : null,
          template: sanitizeTemplate(template).trim(),
          subject: channel === 'email' ? sanitizeTemplate(subject).trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'No se pudo enviar la campaña.')
      } else {
        setResult({ sent: data.sent, failed: data.failed, skipped: data.skipped, recipients: data.recipients })
        router.refresh()
      }
    } catch {
      setError('No se pudo enviar la campaña. Intentá de nuevo.')
    } finally {
      setSending(false)
      setShowConfirm(false)
    }
  }

  const fmtDateShort = (iso: string) =>
    new Date(iso).toLocaleString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone })

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
            <h1 className="db-header-title">Promociones</h1>
            <p className="db-header-date">Enviá campañas por WhatsApp o email a segmentos de tus clientes</p>
          </div>
        </div>

        <h2 className="promo-section-title">1. Elegí el segmento</h2>
        <div className="promo-segment-grid">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              className={"promo-segment-card" + (segment === seg.key ? " selected" : "")}
              onClick={() => selectSegment(seg.key)}
            >
              <span className="promo-segment-count">{seg.key === 'por_servicio' ? counts.por_servicio : counts[seg.key]}</span>
              <span className="promo-segment-label">{seg.label}</span>
              <span className="promo-segment-desc">{seg.description}</span>
            </button>
          ))}
        </div>

        {segment === 'por_servicio' && (
          <div className="auth-field promo-service-select">
            <label>Servicio</label>
            {services.length === 0 ? (
              <p className="promo-hint">No tenés servicios configurados todavía.</p>
            ) : (
              <select className="auth-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <h2 className="promo-section-title">2. Elegí el canal</h2>
        <div className="promo-channel-row">
          {(['whatsapp', 'email'] as const).map((ch) => (
            <button
              key={ch}
              className={"promo-channel-btn" + (channel === ch ? " active" : "") + (!channelAvailable(ch) ? " disabled" : "")}
              onClick={() => channelAvailable(ch) && selectChannel(ch)}
              disabled={!channelAvailable(ch)}
              title={!channelAvailable(ch) ? 'No configurado para tu negocio' : undefined}
            >
              {CHANNEL_LABELS[ch]}
              {!channelAvailable(ch) && <span className="promo-channel-warning"> — no configurado</span>}
            </button>
          ))}
        </div>

        <h2 className="promo-section-title">3. Escribí el mensaje</h2>
        <div className="promo-card">
          {channel === 'email' && (
            <div className="auth-field">
              <label>Asunto del correo</label>
              <input
                className="auth-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                placeholder={`Novedades de ${orgName}`}
              />
            </div>
          )}

          <div className="auth-field">
            <label>Mensaje</label>
            <textarea
              ref={textareaRef}
              className="auth-input promo-textarea"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              maxLength={1000}
              rows={5}
            />
          </div>

          <div className="promo-vars">
            <span className="promo-vars-label">Insertar variable:</span>
            {TEMPLATE_VARIABLES.map((v) => (
              <button key={v.key} type="button" className="promo-var-btn" onClick={() => insertVariable(v.key)}>
                {`{${v.key}}`}
              </button>
            ))}
          </div>

          <div className="promo-preview">
            <p className="promo-preview-label">Vista previa{recipients[0] ? ` (para ${recipients[0].full_name.split(' ')[0]})` : ''}</p>
            <p className="promo-preview-text">{previewMessage || '—'}</p>
          </div>
        </div>

        <div className="promo-send-bar">
          <div>
            <p className="promo-send-count">{recipients.length} cliente{recipients.length === 1 ? '' : 's'} recibirán este mensaje</p>
            {segment === 'por_servicio' && recipients.length === 0 && (
              <p className="promo-hint">No hay clientes que hayan tomado este servicio.</p>
            )}
          </div>
          <button
            className="db-cta"
            disabled={recipients.length === 0 || !template.trim() || !channelAvailable(channel) || sending}
            onClick={() => setShowConfirm(true)}
          >
            {sending ? 'Enviando…' : 'Enviar campaña'}
          </button>
        </div>

        {error && <div className="promo-banner error">{error}</div>}
        {result && (
          <div className="promo-banner success">
            Campaña enviada: {result.sent} entregado{result.sent === 1 ? '' : 's'}
            {result.failed > 0 && `, ${result.failed} con error`}
            {result.skipped > 0 && `, ${result.skipped} sin ${channel === 'whatsapp' ? 'teléfono' : 'email'} registrado`}.
          </div>
        )}

        <h2 className="promo-section-title">Campañas enviadas</h2>
        {campaigns.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">Todavía no enviaste campañas</p>
            <p className="db-empty-subtitle">Elegí un segmento y un canal arriba para enviar tu primera promoción.</p>
          </div>
        ) : (
          <div className="promo-table-wrap">
            <table className="promo-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Canal</th>
                  <th>Segmento</th>
                  <th>Destinatarios</th>
                  <th>Enviados</th>
                  <th>Citas en 7 días</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDateShort(c.created_at)}</td>
                    <td>{CHANNEL_LABELS[c.channel]}</td>
                    <td>{c.segment === 'por_servicio' ? `Servicio: ${c.services?.name ?? '—'}` : SEGMENT_LABELS[c.segment]}</td>
                    <td>{c.recipient_count}</td>
                    <td>{c.sent_count}{c.failed_count > 0 ? ` (${c.failed_count} con error)` : ''}</td>
                    <td>{c.conversions === null ? '—' : c.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showConfirm && (
        <div className="svc-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="auth-card-title" style={{ marginBottom: 4 }}>Confirmar envío</h2>
            <p className="auth-card-subtitle" style={{ marginBottom: 20 }}>
              Vas a enviar esta campaña por <strong>{CHANNEL_LABELS[channel]}</strong> a <strong>{recipients.length}</strong> cliente{recipients.length === 1 ? '' : 's'} del segmento <strong>{segment === 'por_servicio' ? services.find((s) => s.id === serviceId)?.name : SEGMENT_LABELS[segment]}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="promo-confirm-actions">
              <button className="db-action-btn" style={{ color: '#888', border: '1px solid rgba(136,136,136,0.3)' }} onClick={() => setShowConfirm(false)} disabled={sending}>
                Cancelar
              </button>
              <button className="db-cta" onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando…' : 'Confirmar y enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
