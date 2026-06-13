'use client'

import { useState, useCallback, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import '../styles/appointments-big-calendar.css'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes: string | null
  booked_via: 'web' | 'whatsapp' | 'admin'
  client_id: string
  service_id: string
  staff_id: string | null
  clients: { full_name: string; phone: string; email: string | null } | null
  services: { name: string; duration_minutes: number; price: number } | null
  staff: { id: string; full_name: string; avatar_url: string | null } | null
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
}

interface StaffMember {
  id: string
  full_name: string
  avatar_url: string | null
}

interface UserData {
  full_name: string
  role: string
  organization_id: string
  organizations: { name: string; requires_staff_selection: boolean; timezone: string } | null
}

interface AppointmentsClientProps {
  userData: UserData | null
  organizationId: string
  timezone: string
  requiresStaffSelection: boolean
  initialAppointments: Appointment[]
  initialWeekStart: string
  services: Service[]
  staff: StaffMember[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f5a623',
  confirmed: '#22d3a5',
  completed: '#7c6af7',
  cancelled: '#888888',
}

export default function AppointmentsClient({
  userData,
  organizationId,
  timezone,
  requiresStaffSelection,
  initialAppointments,
  services,
  staff,
  supabase,
}: AppointmentsClientProps) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [view, setView] = useState<View>('week')
  const [date, setDate] = useState(new Date())
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  // Detect theme from document
  useEffect(() => {
    const root = document.documentElement
    const currentTheme = root.getAttribute('data-theme') || 'dark'
    setTheme(currentTheme as 'light' | 'dark')

    const observer = new MutationObserver(() => {
      const newTheme = root.getAttribute('data-theme') || 'dark'
      setTheme(newTheme as 'light' | 'dark')
    })

    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Convert appointments to Big Calendar events
  const events = appointments.map((appt) => ({
    id: appt.id,
    title: `${appt.clients?.full_name || 'Cliente'} · ${appt.services?.name || 'Servicio'}`,
    start: new Date(appt.start_time),
    end: new Date(appt.end_time),
    resource: appt,
  }))

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedAppt(event.resource as Appointment)
    setShowModal(true)
  }, [])

  const handleSelectSlot = useCallback((slotInfo: any) => {
    // TODO: Implement new appointment creation
    console.log('Slot selected:', slotInfo)
  }, [])

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId)

    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: status as any } : a))
      )
      setShowModal(false)
    }
  }

  const eventStyleGetter = (event: any) => {
    const appt = event.resource as Appointment
    const backgroundColor = STATUS_COLORS[appt.status] || '#7c6af7'

    return {
      style: {
        backgroundColor: backgroundColor + '33',
        borderLeft: `4px solid ${backgroundColor}`,
        borderRadius: '4px',
        opacity: appt.status === 'cancelled' ? 0.6 : 1,
        cursor: 'pointer',
      },
    }
  }

  return (
    <div className={`appointments-container theme-${theme}`}>
      <div className="appointments-header">
        <h1>Citas</h1>
        <div className="view-controls">
          <button onClick={() => setView('month')} className={view === 'month' ? 'active' : ''}>
            Mes
          </button>
          <button onClick={() => setView('week')} className={view === 'week' ? 'active' : ''}>
            Semana
          </button>
          <button onClick={() => setView('day')} className={view === 'day' ? 'active' : ''}>
            Día
          </button>
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%', minHeight: '600px' }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        popup
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        defaultView="week"
        step={30}
        timeslots={2}
        defaultDate={new Date()}
      />

      {showModal && selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setShowModal(false)}
          onUpdateStatus={updateAppointmentStatus}
        />
      )}
    </div>
  )
}

interface AppointmentDetailModalProps {
  appointment: Appointment
  onClose: () => void
  onUpdateStatus: (id: string, status: string) => Promise<void>
}

function AppointmentDetailModal({
  appointment,
  onClose,
  onUpdateStatus,
}: AppointmentDetailModalProps) {
  const [loading, setLoading] = useState(false)

  const handleStatusChange = async (status: string) => {
    setLoading(true)
    await onUpdateStatus(appointment.id, status)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <h2>{appointment.clients?.full_name || 'Cliente'}</h2>

        <div className="modal-section">
          <label>Servicio</label>
          <p>{appointment.services?.name || 'N/A'}</p>
        </div>

        <div className="modal-section">
          <label>Horario</label>
          <p>
            {format(new Date(appointment.start_time), 'HH:mm')} –{' '}
            {format(new Date(appointment.end_time), 'HH:mm')} ·{' '}
            {format(new Date(appointment.start_time), 'EEEE d MMMM')}
          </p>
        </div>

        <div className="modal-section">
          <label>Teléfono</label>
          <p>{appointment.clients?.phone || 'N/A'}</p>
        </div>

        <div className="modal-section">
          <label>Estado</label>
          <div className="status-buttons">
            <button
              onClick={() => handleStatusChange('pending')}
              disabled={loading}
              className={appointment.status === 'pending' ? 'active' : ''}
            >
              Pendiente
            </button>
            <button
              onClick={() => handleStatusChange('confirmed')}
              disabled={loading}
              className={appointment.status === 'confirmed' ? 'active' : ''}
            >
              Confirmada
            </button>
            <button
              onClick={() => handleStatusChange('completed')}
              disabled={loading}
              className={appointment.status === 'completed' ? 'active' : ''}
            >
              Completada
            </button>
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={loading}
              className={appointment.status === 'cancelled' ? 'active' : ''}
            >
              Cancelada
            </button>
          </div>
        </div>

        <button className="btn-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
