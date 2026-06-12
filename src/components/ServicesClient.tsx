'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './services.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: true },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Promociones', href: '/dashboard/promotions', active: false },
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
  image_url: string | null
  created_at: string
}

type UserData = { full_name: string; organizations: { name: string } }

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

const EMPTY_FORM = { name: '', description: '', duration_minutes: '30', price: '' }
const MAX_IMAGE_MB = 3
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen || showForm ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, showForm])

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
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
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
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(service.image_url)
    setError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    setError('')
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`La imagen no puede superar ${MAX_IMAGE_MB}MB`)
      return
    }

    setError('')
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async (serviceId: string): Promise<string | null> => {
    if (!imageFile) return existingImageUrl

    const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${organizationId}/${serviceId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('service-images')
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type })

    if (uploadError) {
      console.error('Error subiendo imagen:', uploadError)
      return existingImageUrl
    }

    const { data } = supabase.storage.from('service-images').getPublicUrl(path)
    // Cache-bust para que se refresque al reemplazar la imagen
    return data.publicUrl + '?v=' + Date.now()
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
      const image_url = await uploadImage(editingId)
      const { data, error: updateError } = await supabase
        .from('services')
        .update({ name, description, duration_minutes: duration, price, image_url })
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) { setError('Error al actualizar el servicio'); setSaving(false); return }
      setServices((prev) => prev.map((s) => (s.id === editingId ? (data as Service) : s)))
    } else {
      const { data: created, error: insertError } = await supabase
        .from('services')
        .insert({ organization_id: organizationId, name, description, duration_minutes: duration, price })
        .select()
        .single()

      if (insertError || !created) { setError('Error al crear el servicio'); setSaving(false); return }

      let newService = created as Service

      if (imageFile) {
        const image_url = await uploadImage(newService.id)
        if (image_url) {
          const { data: updated } = await supabase
            .from('services')
            .update({ image_url })
            .eq('id', newService.id)
            .select()
            .single()
          if (updated) newService = updated as Service
        }
      }

      setServices((prev) => [newService, ...prev])
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

  const currentPreview = imagePreview ?? existingImageUrl

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
                {service.image_url && (
                  <div className="svc-card-image">
                    <img src={service.image_url} alt={service.name} loading="lazy" />
                  </div>
                )}
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
                <label>Imagen del servicio (opcional)</label>
                {currentPreview ? (
                  <div className="svc-image-preview">
                    <img src={currentPreview} alt="Vista previa" />
                    <div className="svc-image-actions">
                      <button type="button" className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => fileInputRef.current?.click()}>
                        Cambiar
                      </button>
                      <button type="button" className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={removeImage}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="svc-image-drop" onClick={() => fileInputRef.current?.click()}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    <span>Subir imagen</span>
                    <span className="svc-image-hint">JPG, PNG o WebP — máx {MAX_IMAGE_MB}MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>

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
