'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './settings.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: false },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: true },
]

const TIMEZONES = [
  { value: 'America/Costa_Rica', label: 'Costa Rica (UTC-6)' },
  { value: 'America/Guatemala', label: 'Guatemala (UTC-6)' },
  { value: 'America/El_Salvador', label: 'El Salvador (UTC-6)' },
  { value: 'America/Tegucigalpa', label: 'Honduras (UTC-6)' },
  { value: 'America/Managua', label: 'Nicaragua (UTC-6)' },
  { value: 'America/Panama', label: 'Panamá (UTC-5)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Santiago', label: 'Chile (UTC-3/4)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (UTC-3)' },
]

const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico',
  profesional: 'Profesional',
  premium: 'Premium',
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  trialing: 'Período de prueba',
  past_due: 'Pago pendiente',
  cancelled: 'Cancelado',
}

const PLAN_STATUS_COLORS: Record<string, string> = {
  active: '#22d3a5',
  trialing: '#7c6af7',
  past_due: '#f56342',
  cancelled: '#888888',
}

type Organization = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  phone: string | null
  email: string | null
  address: string | null
  timezone: string | null
  plan_type: string | null
  plan_status: string | null
  plan_expires_at: string | null
  cancellation_window_hours: number | null
  whatsapp_phone_number_id: string | null
  whatsapp_access_token: string | null
}

type UserData = { full_name: string; organizations: Organization }

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

const MAX_IMAGE_MB = 2
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

export default function SettingsClient({ userData, organization }: { userData: UserData | null; organization: Organization | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [form, setForm] = useState({
    name: organization?.name ?? '',
    phone: organization?.phone ?? '',
    email: organization?.email ?? '',
    address: organization?.address ?? '',
    timezone: organization?.timezone ?? 'America/Costa_Rica',
    primary_color: organization?.primary_color ?? '#f5a623',
    slug: organization?.slug ?? '',
    cancellation_window_hours: organization?.cancellation_window_hours ?? 2,
    whatsapp_phone_number_id: organization?.whatsapp_phone_number_id ?? '',
    whatsapp_access_token: organization?.whatsapp_access_token ?? '',
  })

  const [logoUrl, setLogoUrl] = useState<string | null>(organization?.logo_url ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalUrl, setPortalUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPortalUrl(`${window.location.origin}/p/${form.slug}`)
    }
  }, [form.slug])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/register')
    router.refresh()
  }

  const orgName = organization?.name ?? 'Tu negocio'
  const firstName = userData?.full_name?.split(' ')[0] ?? 'Admin'

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !organization) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`El logo no puede superar ${MAX_IMAGE_MB}MB`)
      return
    }

    setError('')
    setUploadingLogo(true)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${organization.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('organization-logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Error al subir el logo: ' + uploadError.message)
      setUploadingLogo(false)
      return
    }

    const { data } = supabase.storage.from('organization-logos').getPublicUrl(path)
    const newUrl = data.publicUrl + '?v=' + Date.now()

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: newUrl })
      .eq('id', organization.id)

    if (updateError) {
      setError('Logo subido, pero no se pudo guardar: ' + updateError.message)
    } else {
      setLogoUrl(newUrl)
      setSuccess('Logo actualizado')
    }

    setUploadingLogo(false)
  }

  const removeLogo = async () => {
    if (!organization) return
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: null })
      .eq('id', organization.id)

    if (!updateError) {
      setLogoUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!organization) return

    const name = sanitizeText(form.name).trim()
    const phone = sanitizeText(form.phone).trim()
    const email = sanitizeText(form.email).trim()
    const address = sanitizeText(form.address).trim()
    const slug = sanitizeSlug(form.slug).trim()
    const primary_color = form.primary_color.trim()

    if (!name) { setError('El nombre del negocio es obligatorio'); return }
    if (name.length > 100) { setError('El nombre es demasiado largo'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('El correo no es válido'); return }
    if (phone.length > 30) { setError('El teléfono es demasiado largo'); return }
    if (address.length > 200) { setError('La dirección es demasiado larga'); return }
    if (!/^#[0-9a-fA-F]{6}$/.test(primary_color)) { setError('El color primario debe ser un código hexadecimal válido (ej. #F5A623)'); return }
    if (!slug || slug.length < 3) { setError('El identificador del portal debe tener al menos 3 caracteres'); return }
    if (slug.length > 60) { setError('El identificador del portal es demasiado largo'); return }

    const cancellationWindow = Number(form.cancellation_window_hours)
    if (!Number.isFinite(cancellationWindow) || cancellationWindow < 0 || cancellationWindow > 168) {
      setError('La ventana de cancelación debe ser un número entre 0 y 168 horas')
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        name, phone: phone || null, email: email || null, address: address || null,
        timezone: form.timezone, primary_color, slug, cancellation_window_hours: cancellationWindow,
        whatsapp_phone_number_id: form.whatsapp_phone_number_id.trim() || null,
        whatsapp_access_token: form.whatsapp_access_token.trim() || null,
      })
      .eq('id', organization.id)

    if (updateError) {
      if ((updateError as any).code === '23505') {
        setError('Ese identificador de portal ya está en uso por otro negocio. Probá con otro.')
      } else {
        setError('Error al guardar: ' + updateError.message)
      }
      setSaving(false)
      return
    }

    setSuccess('Cambios guardados')
    setSaving(false)
    router.refresh()
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
            <h1 className="db-header-title">Configuración</h1>
            <p className="db-header-date">Datos del negocio, branding y portal público</p>
          </div>
        </div>

        {!organization ? (
          <div className="db-empty">
            <p className="db-empty-title">No se encontró tu negocio</p>
            <p className="db-empty-subtitle">Contactá a soporte si este problema persiste.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="set-layout">
            <div className="set-main">

              <div className="mi-card set-section">
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Datos del negocio</h2>
                <p className="cl-empty-history" style={{ marginBottom: 16 }}>Esta información se muestra a tus clientes en el portal de agendamiento.</p>

                <div className="auth-field">
                  <label>Nombre del negocio</label>
                  <input className="auth-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required autoComplete="organization" />
                </div>

                <div className="svc-form-row">
                  <div className="auth-field">
                    <label>Teléfono</label>
                    <input className="auth-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} placeholder="8888-8888" autoComplete="off" />
                  </div>
                  <div className="auth-field">
                    <label>Correo</label>
                    <input className="auth-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} placeholder="contacto@negocio.com" autoComplete="off" spellCheck={false} inputMode="email" />
                  </div>
                </div>

                <div className="auth-field">
                  <label>Dirección</label>
                  <input className="auth-input" type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} placeholder="Calle, ciudad, provincia" autoComplete="off" />
                </div>

                <div className="auth-field">
                  <label>Zona horaria</label>
                  <select className="auth-input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mi-card set-section">
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Branding</h2>
                <p className="cl-empty-history" style={{ marginBottom: 16 }}>Tu logo y color principal aparecen en tu portal público.</p>

                <div className="auth-field">
                  <label>Logo</label>
                  <div className="set-logo-row">
                    <div className="set-logo-preview" style={{ background: logoUrl ? 'transparent' : form.primary_color }}>
                      {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>{initials(form.name || 'TN')}</span>}
                    </div>
                    <div className="set-logo-actions">
                      <button type="button" className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? 'Subiendo...' : logoUrl ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      {logoUrl && (
                        <button type="button" className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={removeLogo}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoSelect} style={{ display: 'none' }} />
                  </div>
                </div>

                <div className="auth-field">
                  <label>Color primario</label>
                  <div className="set-color-row">
                    <input type="color" className="set-color-swatch" value={/^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : '#f5a623'} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
                    <input className="auth-input" type="text" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} maxLength={7} placeholder="#F5A623" spellCheck={false} style={{ maxWidth: 140 }} />
                  </div>
                </div>
              </div>

              <div className="mi-card set-section">
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Portal público</h2>
                <p className="cl-empty-history" style={{ marginBottom: 16 }}>Tus clientes agendan citas desde esta dirección.</p>

                <div className="auth-field">
                  <label>Identificador (slug)</label>
                  <input className="auth-input" type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: sanitizeSlug(e.target.value) })} maxLength={60} placeholder="mi-negocio" spellCheck={false} autoComplete="off" />
                  {form.slug !== (organization.slug ?? '') && (
                    <p className="set-slug-warning">
                      Si cambiás este identificador, los links que ya compartiste con tus clientes ({window.location.origin}/p/{organization.slug}) dejarán de funcionar.
                    </p>
                  )}
                </div>

                <div className="auth-field" style={{ marginTop: 16 }}>
                  <label>Ventana de cancelación (horas)</label>
                  <input
                    className="auth-input"
                    type="number"
                    min={0}
                    max={168}
                    value={form.cancellation_window_hours}
                    onChange={(e) => setForm({ ...form, cancellation_window_hours: e.target.value === '' ? 0 : Number(e.target.value) })}
                    style={{ maxWidth: 140 }}
                  />
                  <p className="cl-empty-history" style={{ marginTop: 6 }}>
                    Tus clientes podrán cancelar su cita online hasta esta cantidad de horas antes de la cita.
                  </p>
                </div>

                {portalUrl && (
                  <div className="set-portal-link">
                    <a href={portalUrl} target="_blank" rel="noopener noreferrer">{portalUrl}</a>
                    <button
                      type="button"
                      className="db-action-btn"
                      style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }}
                      onClick={() => navigator.clipboard.writeText(portalUrl)}
                    >
                      Copiar
                    </button>
                  </div>
                )}
              </div>

              {organization && (
                <div className="mi-card set-section">
                  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>WhatsApp</h2>
                  <p className="cl-empty-history" style={{ marginBottom: 16 }}>
                    Conectá tu número de WhatsApp Business para que tus clientes puedan agendar, consultar y cancelar citas por chat.
                  </p>

                  <div className="auth-field">
                    <label>Webhook URL (configurala en Meta &gt; Configuración de la API)</label>
                    <div className="set-portal-link">
                      <a href="#" onClick={(e) => e.preventDefault()}>{typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}</a>
                      <button
                        type="button"
                        className="db-action-btn"
                        style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }}
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`)}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="auth-field">
                    <label>Identificador del número de teléfono (Phone Number ID)</label>
                    <input
                      className="auth-input"
                      type="text"
                      value={form.whatsapp_phone_number_id}
                      onChange={(e) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })}
                      placeholder="107677746...282"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={64}
                    />
                  </div>

                  <div className="auth-field">
                    <label>Token de acceso (Access Token)</label>
                    <input
                      className="auth-input"
                      type="password"
                      value={form.whatsapp_access_token}
                      onChange={(e) => setForm({ ...form, whatsapp_access_token: e.target.value })}
                      placeholder="EAAG..."
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={512}
                    />
                  </div>

                  <p className="cl-empty-history" style={{ marginTop: 6 }}>
                    El token de prueba de Meta vence cada 24h; cuando lo renueves, actualizalo aquí.
                  </p>
                </div>
              )}

              {organization && (
                <div className="mi-card set-section">
                  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Plan</h2>
                  <p className="cl-empty-history" style={{ marginBottom: 16 }}>La gestión de membresías y facturación estará disponible próximamente.</p>
                  <div className="apt-detail-rows">
                    <div className="apt-detail-row">
                      <span className="sch-time-field-label">Plan actual</span>
                      <span>{PLAN_LABELS[organization.plan_type ?? ''] ?? organization.plan_type ?? 'Sin definir'}</span>
                    </div>
                    <div className="apt-detail-row">
                      <span className="sch-time-field-label">Estado</span>
                      <span style={{ color: PLAN_STATUS_COLORS[organization.plan_status ?? ''] ?? '#888' }}>
                        {PLAN_STATUS_LABELS[organization.plan_status ?? ''] ?? organization.plan_status ?? 'Sin definir'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && <div className="auth-error" role="alert">{error}</div>}
              {success && <div className="set-success" role="status">{success}</div>}

              <div className="svc-form-actions">
                <button type="submit" className="db-cta" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>

            <div className="set-preview-col">
              <p className="sch-time-field-label" style={{ marginBottom: 8 }}>Vista previa del portal</p>
              <div className="set-preview">
                <div className="set-preview-header" style={{ borderBottom: `3px solid ${/^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : '#f5a623'}` }}>
                  <div className="set-preview-logo" style={{ background: logoUrl ? 'transparent' : (/^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : '#f5a623') }}>
                    {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span>{initials(form.name || 'TN')}</span>}
                  </div>
                  <span className="set-preview-name">{form.name || 'Tu negocio'}</span>
                </div>
                <div className="set-preview-body">
                  <div className="set-preview-service">
                    <div>
                      <p className="set-preview-service-name">Corte de cabello</p>
                      <p className="set-preview-service-meta">30 min</p>
                    </div>
                    <span className="set-preview-price">{'\u20a1'}5.000</span>
                  </div>
                  <button type="button" className="set-preview-btn" style={{ background: /^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : '#f5a623' }}>
                    Reservar
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
