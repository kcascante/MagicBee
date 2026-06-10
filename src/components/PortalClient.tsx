'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import './portal.css'

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
  requires_staff_selection: boolean
}

type ServiceItem = {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  image_url: string | null
}

type StaffItem = { id: string; full_name: string; avatar_url: string | null }

function fmtPrice(price: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price)
}

function fmtDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '')
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

export default function PortalClient({
  organization,
  services,
  staff,
}: {
  organization: Organization
  services: ServiceItem[]
  staff: StaffItem[]
}) {
  const supabase = createClient()
  const accent = organization.primary_color || '#f5a623'

  const [bookingService, setBookingService] = useState<ServiceItem | null>(null)

  return (
    <div className="portal-root" style={{ ['--accent' as any]: accent }}>
      <header className="portal-header">
        <div className="portal-header-inner">
          <div className="portal-brand">
            {organization.logo_url ? (
              <img src={organization.logo_url} alt={organization.name} className="portal-logo" />
            ) : (
              <div className="portal-logo-placeholder">{initials(organization.name)}</div>
            )}
            <div>
              <h1 className="portal-brand-name">{organization.name}</h1>
              {organization.address && <p className="portal-brand-address">{organization.address}</p>}
            </div>
          </div>
          {(organization.phone || organization.email) && (
            <div className="portal-contact">
              {organization.phone && <a href={`tel:${organization.phone}`}>{organization.phone}</a>}
              {organization.email && <a href={`mailto:${organization.email}`}>{organization.email}</a>}
            </div>
          )}
        </div>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <h2>Reserva tu cita en línea</h2>
          <p>Elegí el servicio que necesitás y agendá en pocos pasos.</p>
        </section>

        {services.length === 0 ? (
          <div className="portal-empty">
            <p>Este negocio todavía no tiene servicios publicados.</p>
          </div>
        ) : (
          <section className="portal-services-grid">
            {services.map((service) => (
              <div key={service.id} className="portal-service-card">
                {service.image_url && (
                  <div className="portal-service-image">
                    <img src={service.image_url} alt={service.name} loading="lazy" />
                  </div>
                )}
                <div className="portal-service-body">
                  <h3>{service.name}</h3>
                  {service.description && <p className="portal-service-desc">{service.description}</p>}
                  <div className="portal-service-meta">
                    <span className="portal-service-duration">{service.duration_minutes} min</span>
                    <span className="portal-service-price">{fmtPrice(service.price)}</span>
                  </div>
                  <button className="portal-cta" onClick={() => setBookingService(service)}>
                    Reservar
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="portal-footer">
        <p>Powered by MagicBee</p>
      </footer>

      {bookingService && (
        <BookingModal
          organization={organization}
          service={bookingService}
          staff={staff}
          onClose={() => setBookingService(null)}
        />
      )}
    </div>
  )
}

function BookingModal({
  organization,
  service,
  staff,
  onClose,
}: {
  organization: Organization
  service: ServiceItem
  staff: StaffItem[]
  onClose: () => void
}) {
  const supabase = createClient()
  const [step, setStep] = useState(organization.requires_staff_selection && staff.length > 0 ? 1 : 2)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [date, setDate] = useState(fmtDateInput(new Date()))
  const [slots, setSlots] = useState<{ slot_start: string; slot_end: string }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ slot_start: string; slot_end: string } | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const loadSlots = async (d: string, stf: string | null) => {
    setLoadingSlots(true)
    setSelectedSlot(null)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('get_available_slots', {
      p_organization_id: organization.id,
      p_service_id: service.id,
      p_date: d,
      p_staff_id: stf,
    })
    if (rpcError) {
      setError('No se pudieron cargar los horarios. Intentá de nuevo.')
      setSlots([])
    } else {
      setSlots(data ?? [])
    }
    setLoadingSlots(false)
  }

  const chooseStaff = (id: string | null) => {
    setStaffId(id)
    setStep(2)
    loadSlots(date, id)
  }

  const handleDateChange = (d: string) => {
    setDate(d)
    if (step >= 2) loadSlots(d, staffId)
  }

  // Cargar slots la primera vez si no requiere staff
  useState(() => {
    if (step === 2) loadSlots(date, staffId)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedSlot) { setError('Seleccioná un horario'); return }
    const cleanName = sanitizeText(name).trim()
    const cleanPhone = sanitizeText(phone).trim()
    const cleanEmail = sanitizeText(email).trim()
    if (!cleanName) { setError('Tu nombre es obligatorio'); return }
    if (!cleanPhone) { setError('Tu teléfono es obligatorio'); return }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError('El correo no es válido'); return }

    setSaving(true)

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ organization_id: organization.id, full_name: cleanName, phone: cleanPhone, email: cleanEmail || null })
      .select('id')
      .single()

    if (clientError || !newClient) {
      setError('Error al guardar tus datos. Intentá de nuevo.')
      setSaving(false)
      return
    }

    const startISO = new Date(`${date}T${selectedSlot.slot_start}`).toISOString()
    const endISO = new Date(`${date}T${selectedSlot.slot_end}`).toISOString()

    const { error: apptError } = await supabase
      .from('appointments')
      .insert({
        organization_id: organization.id,
        client_id: newClient.id,
        service_id: service.id,
        staff_id: staffId,
        start_time: startISO,
        end_time: endISO,
        status: 'pending',
        booked_via: 'web',
      })

    if (apptError) {
      setError('Error al crear la cita. Intentá de nuevo.')
      setSaving(false)
      return
    }

    setSaving(false)
    setDone(true)
  }

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="portal-modal-close" onClick={onClose} aria-label="Cerrar">×</button>

        {done ? (
          <div className="portal-confirm">
            <div className="portal-confirm-icon">✓</div>
            <h2>¡Cita solicitada!</h2>
            <p>
              {service.name} el {new Date(`${date}T00:00:00`).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
              a las {selectedSlot?.slot_start.slice(0, 5)}.
            </p>
            <p className="portal-confirm-note">El negocio confirmará tu cita pronto.</p>
            <button className="portal-cta" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <h2 className="portal-modal-title">{service.name}</h2>
            <p className="portal-modal-subtitle">{service.duration_minutes} min · {fmtPrice(service.price)}</p>

            {step === 1 && (
              <div className="portal-form">
                <p className="portal-step-label">¿Con quién querés tu cita?</p>
                <div className="portal-staff-grid">
                  <button type="button" className="portal-staff-option" onClick={() => chooseStaff(null)}>
                    <div className="portal-avatar"><span>?</span></div>
                    <span>Cualquiera</span>
                  </button>
                  {staff.map((s) => (
                    <button key={s.id} type="button" className="portal-staff-option" onClick={() => chooseStaff(s.id)}>
                      <div className="portal-avatar">
                        {s.avatar_url ? <img src={s.avatar_url} alt={s.full_name} /> : <span>{initials(s.full_name)}</span>}
                      </div>
                      <span>{s.full_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="portal-form">
                <div className="portal-field">
                  <label>Fecha</label>
                  <input
                    className="portal-input"
                    type="date"
                    value={date}
                    min={fmtDateInput(new Date())}
                    onChange={(e) => handleDateChange(e.target.value)}
                  />
                </div>
                <div className="portal-field">
                  <label>Horarios disponibles</label>
                  {loadingSlots ? (
                    <p className="portal-note">Cargando horarios...</p>
                  ) : slots.length === 0 ? (
                    <p className="portal-note">No hay horarios disponibles para esta fecha.</p>
                  ) : (
                    <div className="portal-slots-grid">
                      {slots.map((s) => (
                        <button
                          type="button"
                          key={s.slot_start}
                          className={"portal-slot-btn" + (selectedSlot?.slot_start === s.slot_start ? " selected" : "")}
                          onClick={() => setSelectedSlot(s)}
                        >
                          {s.slot_start.slice(0, 5)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {error && <div className="portal-error">{error}</div>}
                <div className="portal-form-actions">
                  {organization.requires_staff_selection && staff.length > 0 && (
                    <button type="button" className="portal-btn-secondary" onClick={() => setStep(1)}>Atrás</button>
                  )}
                  <button type="button" className="portal-cta" disabled={!selectedSlot} onClick={() => { setError(''); setStep(3) }}>Continuar</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form className="portal-form" onSubmit={handleSubmit}>
                <div className="portal-field">
                  <label>Nombre completo</label>
                  <input className="portal-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Tu nombre" />
                </div>
                <div className="portal-field">
                  <label>Teléfono</label>
                  <input className="portal-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30} placeholder="8888-8888" />
                </div>
                <div className="portal-field">
                  <label>Correo (opcional)</label>
                  <input className="portal-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder="correo@ejemplo.com" />
                </div>
                {error && <div className="portal-error">{error}</div>}
                <div className="portal-form-actions">
                  <button type="button" className="portal-btn-secondary" onClick={() => setStep(2)}>Atrás</button>
                  <button type="submit" className="portal-cta" disabled={saving}>{saving ? 'Reservando...' : 'Confirmar cita'}</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
