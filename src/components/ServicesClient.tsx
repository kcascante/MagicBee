'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './services.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: true },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

type Service = {
  id: string
  organization_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  is_active: boolean
  created_at: string
}

type UserData = { full_name: string; organizations: { name: string } }

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

const EMPTY_FORM = { name: '', description: '', duration_minutes: '30', price: '' }

export default function ServicesClient({
  userData,
  initialServices,
  organizationId,
}: {
  userData: UserData | null
  initialServices: Service[]
  organizationId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [services, setServices] = useState<Service[]>(initialServices)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  const openNewForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  const openEditForm = (service: Service) => {
    setEditingId(service.id)
    setForm({
      name: service.name,
      description: service.description ?? '',
      duration_minutes: String(service.duration_minutes),
      price: String(service.price),
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

    const name = sanitizeText(form.name).trim()
    const description = sanitizeText(form.description).trim()
    const duration = parseInt(form.duration_minutes, 10)
    const price = parseFloat(form.price)

    if (!name) { setError('El nombre del servicio es obligatorio'); return }
    if (name.length > 100) { setError('El nombre es demasiado largo'); return }
    if (description.length > 500) { setError('La descripción es demasiado larga'); return }
    if (isNaN(duration) || duration < 5 || duration > 480) { setError('La duración debe ser entre 5 y 480 minutos'); return }
    if (isNaN(price) || price < 0 || price > 999999) { setError('El precio no es válido'); return }

    setSaving(true)

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from('services')
        .update({ name, description, duration_minutes: duration, price })
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) { setError('Error al actualizar el servicio'); setSaving(false); return }
      setServices((prev) => prev.map((s) => (s.id === editingId ? (data as Service) : s)))
    } else {
      const { data, error: insertError } = await supabase
        .from('services')
        .insert({ organization_id: organizationId, name, description, duration_minutes: duration, price })
        .select()
        .single()

      if (insertError) { setError('Error al crear el servicio'); setSaving(false); return }
      setServices((prev) => [data as Service, ...prev])
    }

    setSaving(false)
    closeForm()
  }

  const toggleActive = async (service: Service) => {
    const { data, error: updateError } = await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error al cambiar estado:', updateError)
      alert('Error al cambiar el estado: ' + updateError.message)
      return
    }

    if (data) {
      setServices((prev) => prev.map((s) => (s.id === service.id ? (data as Service) : s)))
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm('¿Eliminar este servicio? Esta acción no se puede deshacer.')) return
    const { error: deleteError } = await supabase.from('services').delete().eq('id', id)
    if (!deleteError) {
      setServices((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price)

  return (
    <div className="db-root">
      {menuOpen && <div className="db-overlay" onClick={() => setMenuOpen(false)} />}

      <button className="db-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>
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
            <h1 className="db-header-title">Servicios</h1>
            <p className="db-header-date">Gestioná el catálogo de servicios de tu negocio</p>
          </div>
          <button className="db-cta" onClick={openNewForm}>+ Nuevo servicio</button>
        </div>

        {services.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">Todavía no tenés servicios</p>
            <p className="db-empty-subtitle">Agregá tu primer servicio para que tus clientes puedan agendar citas.</p>
            <button className="db-cta" onClick={openNewForm}>+ Agregar servicio</button>
          </div>
        ) : (
          <div className="svc-grid">
            {services.map((service) => (
              <div key={service.id} className={"svc-card" + (service.is_active ? "" : " inactive")}>
                <div className="svc-card-top">
                  <div>
                    <h3 className="svc-card-name">{service.name}</h3>
                    {service.description && <p className="svc-card-desc">{service.description}</p>}
                  </div>
                  <span className={"svc-badge" + (service.is_active ? " active" : " inactive")}>
                    {service.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="svc-card-meta">
                  <div className="svc-meta-item">
                    <span className="svc-meta-label">Duración</span>
                    <span className="svc-meta-value">{service.duration_minutes} min</span>
                  </div>
                  <div className="svc-meta-item">
                    <span className="svc-meta-label">Precio</span>
                    <span className="svc-meta-value price">{formatPrice(service.price)}</span>
                  </div>
                </div>
                <div className="svc-card-actions">
                  <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => openEditForm(service)}>
                    Editar
                  </button>
                  <button className="db-action-btn" style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }} onClick={() => toggleActive(service)}>
                    {service.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => deleteService(service.id)}>
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
              {editingId ? 'Editar servicio' : 'Nuevo servicio'}
            </h2>
            <p className="auth-card-subtitle" style={{ marginBottom: 20 }}>
              Completá la información del servicio que ofrecés.
            </p>
            <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
              <div className="auth-field">
                <label>Nombre del servicio</label>
                <input
                  className="auth-input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="Ej. Corte de cabello"
                  autoComplete="off"
                />
              </div>
              <div className="auth-field">
                <label>Descripción (opcional)</label>
                <input
                  className="auth-input"
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={500}
                  placeholder="Breve descripción del servicio"
                  autoComplete="off"
                />
              </div>
              <div className="svc-form-row">
                <div className="auth-field">
                  <label>Duración (minutos)</label>
                  <input
                    className="auth-input"
                    type="number"
                    inputMode="numeric"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    required
                    min={5}
                    max={480}
                    step={5}
                  />
                </div>
                <div className="auth-field">
                  <label>Precio ($)</label>
                  <input
                    className="auth-input"
                    type="number"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <div className="svc-form-actions">
                <button type="button" className="db-action-btn" onClick={closeForm} style={{ color: '#888' }}>
                  Cancelar
                </button>
                <button type="submit" className="db-cta" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
