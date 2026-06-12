'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import '@/components/auth.css'
import './dashboard.css'
import './staff.css'

const NAV = [
  { label: 'Panel', href: '/dashboard', active: false },
  { label: 'Citas', href: '/dashboard/appointments', active: false },
  { label: 'Servicios', href: '/dashboard/services', active: false },
  { label: 'Staff', href: '/dashboard/staff', active: true },
  { label: 'Clientes', href: '/dashboard/clients', active: false },
  { label: 'Horarios', href: '/dashboard/schedules', active: false },
  { label: 'Estadísticas', href: '/dashboard/stats', active: false },
  { label: 'Reseñas', href: '/dashboard/reviews', active: false },
  { label: 'Promociones', href: '/dashboard/promotions', active: false },
  { label: 'Configuración', href: '/dashboard/settings', active: false },
]

type StaffMember = {
  id: string
  organization_id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

type UserData = { full_name: string; organizations: { name: string } }

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

const EMPTY_FORM = { full_name: '', email: '', phone: '' }
const MAX_IMAGE_MB = 3
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function StaffClient({
  userData,
  initialStaff,
  organizationId,
  initialRequiresStaffSelection,
}: {
  userData: UserData | null
  initialStaff: StaffMember[]
  organizationId: string
  initialRequiresStaffSelection: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [requiresSelection, setRequiresSelection] = useState(initialRequiresStaffSelection)
  const [savingToggle, setSavingToggle] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
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

  const handleToggleSelection = async (checked: boolean) => {
    setSavingToggle(true)
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ requires_staff_selection: checked })
      .eq('id', organizationId)

    if (!updateError) {
      setRequiresSelection(checked)
    } else {
      alert('Error al guardar la preferencia: ' + updateError.message)
    }
    setSavingToggle(false)
  }

  const openNewForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setExistingAvatarUrl(null)
    setError('')
    setShowForm(true)
  }

  const openEditForm = (member: StaffMember) => {
    setEditingId(member.id)
    setForm({
      full_name: member.full_name,
      email: member.email ?? '',
      phone: member.phone ?? '',
    })
    setImageFile(null)
    setImagePreview(null)
    setExistingAvatarUrl(member.avatar_url)
    setError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setExistingAvatarUrl(null)
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
    setExistingAvatarUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadAvatar = async (staffId: string): Promise<string | null> => {
    if (!imageFile) return existingAvatarUrl

    const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${organizationId}/${staffId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('staff-avatars')
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type })

    if (uploadError) {
      console.error('Error subiendo avatar:', uploadError)
      return existingAvatarUrl
    }

    const { data } = supabase.storage.from('staff-avatars').getPublicUrl(path)
    return data.publicUrl + '?v=' + Date.now()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const full_name = sanitizeText(form.full_name).trim()
    const email = sanitizeText(form.email).trim()
    const phone = sanitizeText(form.phone).trim()

    if (!full_name) { setError('El nombre es obligatorio'); return }
    if (full_name.length > 100) { setError('El nombre es demasiado largo'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('El correo no es válido'); return }
    if (phone.length > 30) { setError('El teléfono es demasiado largo'); return }

    setSaving(true)

    if (editingId) {
      const avatar_url = await uploadAvatar(editingId)
      const { data, error: updateError } = await supabase
        .from('staff')
        .update({ full_name, email: email || null, phone: phone || null, avatar_url })
        .eq('id', editingId)
        .select()
        .single()

      if (updateError) { setError('Error al actualizar: ' + updateError.message); setSaving(false); return }
      setStaff((prev) => prev.map((s) => (s.id === editingId ? (data as StaffMember) : s)))
    } else {
      const { data: created, error: insertError } = await supabase
        .from('staff')
        .insert({ organization_id: organizationId, full_name, email: email || null, phone: phone || null })
        .select()
        .single()

      if (insertError || !created) { setError('Error al crear: ' + insertError?.message); setSaving(false); return }

      let newMember = created as StaffMember

      if (imageFile) {
        const avatar_url = await uploadAvatar(newMember.id)
        if (avatar_url) {
          const { data: updated } = await supabase
            .from('staff')
            .update({ avatar_url })
            .eq('id', newMember.id)
            .select()
            .single()
          if (updated) newMember = updated as StaffMember
        }
      }

      setStaff((prev) => [newMember, ...prev])
    }

    setSaving(false)
    closeForm()
  }

  const toggleActive = async (member: StaffMember) => {
    const { data, error: updateError } = await supabase
      .from('staff')
      .update({ is_active: !member.is_active })
      .eq('id', member.id)
      .select()
      .single()

    if (updateError) {
      alert('Error al cambiar el estado: ' + updateError.message)
      return
    }

    if (data) {
      setStaff((prev) => prev.map((s) => (s.id === member.id ? (data as StaffMember) : s)))
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm('¿Eliminar este integrante del equipo? Esta acción no se puede deshacer.')) return
    const { error: deleteError } = await supabase.from('staff').delete().eq('id', id)
    if (!deleteError) {
      setStaff((prev) => prev.filter((s) => s.id !== id))
    } else {
      alert('Error al eliminar: ' + deleteError.message)
    }
  }

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')

  const currentPreview = imagePreview ?? existingAvatarUrl

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
            <h1 className="db-header-title">Staff</h1>
            <p className="db-header-date">Gestioná los profesionales de tu negocio</p>
          </div>
          <button className="db-cta" onClick={openNewForm}>+ Nuevo integrante</button>
        </div>

        <div className="staff-setting-row">
          <div>
            <p className="staff-setting-title">¿Tus clientes eligen profesional al agendar?</p>
            <p className="staff-setting-subtitle">
              Activalo si los clientes pueden elegir con quién atenderse (ej. barbería, estética).
              Desactivalo si no aplica (ej. taller, consultorio único).
            </p>
          </div>
          <label className="sch-toggle">
            <input
              type="checkbox"
              checked={requiresSelection}
              disabled={savingToggle}
              onChange={(e) => handleToggleSelection(e.target.checked)}
            />
            <span className="sch-toggle-slider"></span>
          </label>
        </div>

        {staff.length === 0 ? (
          <div className="db-empty">
            <p className="db-empty-title">Todavía no agregaste a tu equipo</p>
            <p className="db-empty-subtitle">Agregá a las personas que atienden en tu negocio.</p>
            <button className="db-cta" onClick={openNewForm}>+ Agregar integrante</button>
          </div>
        ) : (
          <div className="staff-grid">
            {staff.map((member) => (
              <div key={member.id} className={"staff-card" + (member.is_active ? "" : " inactive")}>
                <div className="staff-avatar">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} />
                  ) : (
                    <span className="staff-avatar-initials">{initials(member.full_name)}</span>
                  )}
                </div>
                <h3 className="staff-name">{member.full_name}</h3>
                {(member.email || member.phone) && (
                  <p className="staff-contact">{member.email || member.phone}</p>
                )}
                <span className={"svc-badge" + (member.is_active ? " active" : " inactive")}>
                  {member.is_active ? 'Activo' : 'Inactivo'}
                </span>
                <div className="staff-card-actions">
                  <button className="db-action-btn" style={{ color: '#7c6af7', border: '1px solid rgba(124,106,247,0.3)' }} onClick={() => openEditForm(member)}>
                    Editar
                  </button>
                  <button className="db-action-btn" style={{ color: '#22d3a5', border: '1px solid rgba(34,211,165,0.3)' }} onClick={() => toggleActive(member)}>
                    {member.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)' }} onClick={() => deleteMember(member.id)}>
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
              {editingId ? 'Editar integrante' : 'Nuevo integrante'}
            </h2>
            <p className="auth-card-subtitle" style={{ marginBottom: 20 }}>
              Completá la información del profesional.
            </p>
            <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">

              <div className="auth-field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ alignSelf: 'flex-start' }}>Foto (opcional)</label>
                <div className="staff-avatar-edit" onClick={() => fileInputRef.current?.click()}>
                  {currentPreview ? (
                    <img src={currentPreview} alt="Vista previa" />
                  ) : (
                    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
                  )}
                  <div className="staff-avatar-edit-overlay">Cambiar</div>
                </div>
                {currentPreview && (
                  <button type="button" className="db-action-btn" style={{ color: '#f56342', border: '1px solid rgba(245,99,66,0.3)', marginTop: 8 }} onClick={removeImage}>
                    Quitar foto
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
                <label>Nombre completo</label>
                <input
                  className="auth-input"
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                  maxLength={100}
                  placeholder="Ej. María Rodríguez"
                  autoComplete="off"
                />
              </div>
              <div className="svc-form-row">
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
                  />
                </div>
                <div className="auth-field">
                  <label>Teléfono (opcional)</label>
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
              </div>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <div className="svc-form-actions">
                <button type="button" className="db-action-btn" onClick={closeForm} style={{ color: '#888' }}>
                  Cancelar
                </button>
                <button type="submit" className="db-cta" disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear integrante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
