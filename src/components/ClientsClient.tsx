'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './services.css'
import './clients.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: true },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

type HistoryItem = {
  id: string
  start_time: string
  status: string
  services: { name: string; price: number } | null
  staff: { full_name: string } | null
}

type ClientRow = {
  id: string
  organization_id: string
  full_name: string
  email: string | null
  phone: string | null
  notes: string | null
  segment: string
  last_visit_at: string | null
  total_visits: number
  total_spent: number
  favorite_service: string | null
  created_at: string
  history: HistoryItem[]
}

type UserData = { full_name: string; organizations: { name: string } }

const SEGMENT_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  regular: 'Regular',
  en_riesgo: 'En riesgo',
  vip: 'VIP',
  sin_citas: 'Sin citas',
}

const SEGMENT_COLORS: Record<string, string> = {
  nuevo: '#22d3a5',
  regular: '#f5a623',
  en_riesgo: '#f56342',
  vip: '#7c6af7',
  sin_citas: '#888888',
}

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

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'nuevo', label: 'Nuevos' },
  { key: 'regular', label: 'Regulares' },
  { key: 'en_riesgo', label: 'En riesgo' },
  { key: 'vip', label: 'VIP' },
]

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

function sanitizeName(value: string): string {
  return value.replace(/[^\p{L}\s'-]/gu, '')
}

const EMPTY_FORM = { full_name: '', email: '', phone: '', notes: '' }

function formatCurrency(value: number) {
  return '\u20a1' + Math.round(value).toLocaleString('es-CR')
}

function formatDate(value: string | null) {
  if (!value) return 'Sin visitas'
  return new Date(value).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

export default function ClientsClient({
  userData,
  initialClients,
  organizationId,
}: {
  userData: UserData | null
  initialClients: ClientRow[]
  organizationId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [clients, setClients] = useState<ClientRow[]>(initialClients)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [detailClient, setDetailClient] = useState<ClientRow | null>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen || showForm || detailClient ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, showForm, detailClient])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/register')
    router.refresh()
  }

  const orgName = userData?.organizations?.name ?? 'Tu negocio'
  const firstName = userData?.full_name?.split(' ')[0] ?? 'Admin'

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (filter !== 'all' && c.segment !== filter) return false
      if (!term) return true
      return (
        c.full_name.toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term)
      )
    })
  }, [clients, search, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: clients.length, nuevo: 0, regular: 0, en_riesgo: 0, vip: 0 }
    for (const cl of clients) {
      if (cl.segment in c) c[cl.segment]++
    }
    return c
  }, [clients])

  const openNewForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  const openEditForm = (client: ClientRow) => {
    setEditingId(client.id)
    setForm({
      full_name: client.full_name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      notes: client.notes ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const full_name = sanitizeName(form.full_name).trim()
    const email = sanitizeText(form.email).trim()
    const phone = sanitizeText(form.phone).trim()
    const notes = sanitizeText(form.notes).trim()

    if (!full_name) { setError('El nombre es obligatorio'); return }
    if (full_name.length > 100) { setError('El nombre es demasiado largo'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('El correo no es válido'); return }
    if (phone.length > 30) { setError('El teléfono es demasiado largo'); return }
    if (notes.length > 500) { setError('La nota es demasiado larga'); return }

    setSaving(true)

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('clients')
        .update({ full_name, email: email || null, phone: phone || null, notes: notes || null })
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) { setError('Error al actualizar: ' + updateError.message); setSaving(false); return }

      setClients((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...(data as any) } : c)))
    } else {
      const { data: created, error: insertError } = await supabase
        .from('clients')
        .insert({ organization_id: organizationId, full_name, email: email || null, phone: phone || null, notes: notes || null })
        .select()
        .single()

      if (insertError || !created) { setError('Error al crear: ' + insertError?.message); setSaving(false); return }

      const newClient: ClientRow = {
        ...(created as any),
        total_visits: 0,
        total_spent: 0,
        last_visit_at: null,
        favorite_service: null,
        segment: 'sin_citas',
        history: [],
      }
      setClients((prev) => [newClient, ...prev])
    }

    setSaving(false)
    closeForm()
  }

  const deleteClient = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', id)
    if (!deleteError) {
      setClients((prev) => prev.filter((c) => c.id !== id))
      setDetailClient(null)
    } else {
      alert('No se pudo eliminar: el cliente tiene citas asociadas en el historial.')
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
            <h1 className="db-header-title">Clientes</h1>
            <p className="db-header-date">Tu base de clientes y su historial</p>
          </div>
          <button className="db-cta" onClick={openNewForm}>+ Nuevo cliente</button>
        </div>

        <div className="cl-toolbar">
          <input
            className="cl-search"
            type="text"
            placeholder="Buscar por nombre, teléfono o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            spellCheck={false}
          />
          <div className="cl-segment-tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={"cl-segment-tab" + (filter === f.key ? " active" : "")}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="cl-segment-count">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">
              {clients.length === 0 ? 'Todavía no tenés clientes' : 'No se encontraron clientes'}
            </p>
            <p className="db-empty-subtitle">
              {clients.length === 0
                ? 'Los clientes se agregan automáticamente cuando agendan, o podés crearlos manualmente.'
                : 'Probá con otra búsqueda o filtro.'}
            </p>
            {clients.length === 0 && <button className="db-cta" onClick={openNewForm}>+ Agregar cliente</button>}
          </div>
        ) : (
          <div className="cl-grid">
            {filteredClients.map((client) => (
              <div key={client.id} className="cl-card" onClick={() => setDetailClient(client)}>
                <div className="cl-card-top">
                  <div className="cl-avatar">{initials(client.full_name)}</div>
                  <span className="cl-segment-badge" style={{ color: SEGMENT_COLORS[client.segment], border: `1px solid ${SEGMENT_COLORS[client.segment]}55` }}>
                    {SEGMENT_LABELS[client.segment]}
                  </span>
                </div>
                <h3 className="cl-name">{client.full_name}</h3>
                {(client.phone || client.email) && (
                  <p className="cl-contact">{client.phone || client.email}</p>
                )}
                <div className="cl-stats-row">
                  <span><strong>{client.total_visits}</strong> visitas</span>
                  <span>{formatDate(client.last_visit_at)}</span>
                </div>
                <div className="cl-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => openEditForm(client)}>
                    Editar
                  </button>
                  <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => deleteClient(client.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="svc-modal-overlay" onClick={closeForm}>
          <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="auth-card-title" style={{ marginBottom: 4 }}>
              {editingId ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            <p className="auth-card-subtitle" style={{ marginBottom: 20 }}>
              Completá la información del cliente.
            </p>
            <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
              <div className="auth-field">
                <label>Nombre completo</label>
                <input
                  className="auth-input"
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="Ej. Ana Pérez"
                  autoComplete="off"
                />
              </div>
              <div className="svc-form-row">
                <div className="auth-field">
                  <label>Teléfono</label>
                  <input
                    className="auth-input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    maxLength={30}
                    placeholder="8888-8888"
                    autoComplete="off"
                  />
                </div>
                <div className="auth-field">
                  <label>Correo (opcional)</label>
                  <input
                    className="auth-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={254}
                    placeholder="correo@ejemplo.com"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="email"
                  />
                </div>
              </div>
              <div className="auth-field">
                <label>Notas (opcional)</label>
                <textarea
                  className="auth-input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={500}
                  rows={3}
                  placeholder="Preferencias, alergias, detalles a recordar..."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <div className="svc-form-actions">
                <button type="button" className="db-action-btn" onClick={closeForm} style={{ color: '#888' }}>
                  Cancelar
                </button>
                <button type="submit" className="db-cta" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailClient && (
        <div className="svc-modal-overlay" onClick={() => setDetailClient(null)}>
          <div className="svc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="apt-detail-header">
              <h2 className="auth-card-title" style={{ margin: 0 }}>{detailClient.full_name}</h2>
              <span className="cl-segment-badge" style={{ color: SEGMENT_COLORS[detailClient.segment], border: `1px solid ${SEGMENT_COLORS[detailClient.segment]}55` }}>
                {SEGMENT_LABELS[detailClient.segment]}
              </span>
            </div>

            <div className="apt-detail-rows">
              {detailClient.phone && (
                <div className="apt-detail-row">
                  <span className="sch-time-field-label">Teléfono</span>
                  <span>{detailClient.phone}</span>
                </div>
              )}
              {detailClient.email && (
                <div className="apt-detail-row">
                  <span className="sch-time-field-label">Correo</span>
                  <span>{detailClient.email}</span>
                </div>
              )}
              <div className="apt-detail-row">
                <span className="sch-time-field-label">Servicio favorito</span>
                <span>{detailClient.favorite_service ?? 'Sin datos aún'}</span>
              </div>
              <div className="apt-detail-row">
                <span className="sch-time-field-label">Total visitas</span>
                <span>{detailClient.total_visits}</span>
              </div>
              <div className="apt-detail-row">
                <span className="sch-time-field-label">Total gastado</span>
                <span>{formatCurrency(detailClient.total_spent)}</span>
              </div>
              <div className="apt-detail-row">
                <span className="sch-time-field-label">Última visita</span>
                <span>{formatDate(detailClient.last_visit_at)}</span>
              </div>
              {detailClient.notes && (
                <div className="apt-detail-row">
                  <span className="sch-time-field-label">Notas</span>
                  <span>{detailClient.notes}</span>
                </div>
              )}
            </div>

            <p className="sch-time-field-label" style={{ marginTop: 16, marginBottom: 8 }}>Historial de citas</p>
            {detailClient.history.length === 0 ? (
              <p className="cl-empty-history">Todavía no tiene citas.</p>
            ) : (
              <div className="cl-history-list">
                {detailClient.history.map((h) => (
                  <div key={h.id} className="cl-history-item">
                    <span className="cl-history-date">{formatDateTime(h.start_time)}</span>
                    <span className="cl-history-service">{h.services?.name ?? 'Servicio'}</span>
                    <span className="cl-history-status" style={{ color: STATUS_COLORS[h.status] ?? '#888', border: `1px solid ${STATUS_COLORS[h.status] ?? '#888'}55` }}>
                      {STATUS_LABELS[h.status] ?? h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="svc-form-actions" style={{ marginTop: 16 }}>
              <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => deleteClient(detailClient.id)}>
                Eliminar cliente
              </button>
              <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => { setDetailClient(null); openEditForm(detailClient) }}>
                Editar
              </button>
              <button className="db-cta" onClick={() => setDetailClient(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
