// Lógica compartida del módulo de Promociones: segmentación de clientes,
// plantillas por defecto y renderizado de variables dinámicas.

export type SegmentKey = 'todos' | 'nuevos' | 'inactivos' | 'vip' | 'por_servicio'

export const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: 'todos', label: 'Todos los clientes', description: 'Cualquier cliente con al menos una cita en el historial' },
  { key: 'nuevos', label: 'Clientes nuevos', description: 'Primera visita en los últimos 30 días' },
  { key: 'inactivos', label: 'Clientes inactivos', description: 'Sin cita en los últimos 45 días, pero con historial' },
  { key: 'vip', label: 'Clientes VIP', description: 'Top 10% por número de visitas' },
  { key: 'por_servicio', label: 'Por servicio', description: 'Clientes que tomaron un servicio específico' },
]

export const DEFAULT_TEMPLATES: Record<SegmentKey, string> = {
  todos: 'Hola {nombre}, en {negocio} tenemos novedades para vos. Agenda tu próxima cita aquí: {link_agendar}',
  nuevos: '¡Hola {nombre}! Gracias por visitarnos en {negocio}. Como agradecimiento, tenés 20% de descuento en tu próxima cita. Agenda aquí: {link_agendar}',
  inactivos: 'Hola {nombre}, te extrañamos en {negocio}. Volvé a agendar tu {servicio} y aprovechá una promoción especial: {link_agendar}',
  vip: 'Hola {nombre}, gracias por ser un cliente VIP de {negocio}. Tenés acceso anticipado a nuestras promociones. Agenda aquí: {link_agendar}',
  por_servicio: 'Hola {nombre}, en {negocio} tenemos novedades sobre {servicio}. Agenda tu próxima cita aquí: {link_agendar}',
}

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'nombre', label: 'Nombre del cliente' },
  { key: 'negocio', label: 'Nombre del negocio' },
  { key: 'servicio', label: 'Último servicio' },
  { key: 'fecha_ultima_visita', label: 'Fecha de última visita' },
  { key: 'link_agendar', label: 'Link para agendar' },
]

export type AnnotatedClient = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  visit_count: number
  last_visit_at: string | null
  last_service: string | null
  service_ids: string[]
  segments: Exclude<SegmentKey, 'por_servicio'>[]
}

/**
 * Calcula, para cada cliente del comercio, sus visitas completadas,
 * último servicio, y a qué segmentos pertenece (puede pertenecer a varios).
 */
export async function getAnnotatedClients(supabase: any, orgId: string): Promise<AnnotatedClient[]> {
  const [{ data: clients }, { data: appts }] = await Promise.all([
    supabase.from('clients').select('id, full_name, email, phone, created_at').eq('organization_id', orgId),
    supabase
      .from('appointments')
      .select('client_id, start_time, status, service_id, services(name)')
      .eq('organization_id', orgId)
      .eq('status', 'completed'),
  ])

  const now = Date.now()
  const daysSince = (iso: string | null) => (iso ? (now - new Date(iso).getTime()) / 86400000 : Infinity)

  type Agg = { count: number; last: string | null; lastService: string | null; serviceIds: Set<string> }
  const byClient: Record<string, Agg> = {}

  for (const a of appts || []) {
    const cid = (a as any).client_id
    if (!cid) continue
    if (!byClient[cid]) byClient[cid] = { count: 0, last: null, lastService: null, serviceIds: new Set() }
    const e = byClient[cid]
    e.count++
    if ((a as any).service_id) e.serviceIds.add((a as any).service_id)
    if (!e.last || a.start_time > e.last) {
      e.last = a.start_time
      e.lastService = (a as any).services?.name ?? null
    }
  }

  const counts = Object.values(byClient).map((v) => v.count).sort((a, b) => b - a)
  const vipIdx = Math.max(0, Math.ceil(counts.length * 0.1) - 1)
  const vipThreshold = counts.length > 0 ? Math.max(counts[vipIdx], 3) : Infinity

  return (clients || []).map((c: any) => {
    const agg = byClient[c.id] || { count: 0, last: null, lastService: null, serviceIds: new Set<string>() }
    const sinceLast = daysSince(agg.last)
    const segments: Exclude<SegmentKey, 'por_servicio'>[] = []
    if (agg.count > 0) segments.push('todos')
    if (agg.count === 1 && sinceLast <= 30) segments.push('nuevos')
    if (agg.count > 0 && sinceLast > 45) segments.push('inactivos')
    if (agg.count >= vipThreshold) segments.push('vip')

    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      visit_count: agg.count,
      last_visit_at: agg.last,
      last_service: agg.lastService,
      service_ids: Array.from(agg.serviceIds),
      segments,
    }
  })
}

export function filterBySegment(clients: AnnotatedClient[], segment: SegmentKey, serviceId?: string | null): AnnotatedClient[] {
  if (segment === 'por_servicio') {
    if (!serviceId) return []
    return clients.filter((c) => c.service_ids.includes(serviceId))
  }
  return clients.filter((c) => c.segments.includes(segment))
}

export type TemplateVars = {
  nombre: string
  negocio: string
  servicio: string
  fecha_ultima_visita: string
  link_agendar: string
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{nombre\}/g, vars.nombre)
    .replace(/\{negocio\}/g, vars.negocio)
    .replace(/\{servicio\}/g, vars.servicio)
    .replace(/\{fecha_ultima_visita\}/g, vars.fecha_ultima_visita)
    .replace(/\{link_agendar\}/g, vars.link_agendar)
}

export function fmtVisitDate(iso: string | null, timezone: string): string {
  if (!iso) return 'tu primera visita'
  try {
    return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone })
  } catch {
    return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
}

/**
 * Normaliza un número de teléfono guardado localmente (8 digitos, Costa Rica)
 * al formato internacional que requiere la API de WhatsApp. Si ya parece
 * tener código de país (más de 8 dígitos), se deja tal cual.
 */
export function normalizeOutboundPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 8) return '506' + digits
  return digits
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Envuelve el mensaje de una campaña en el layout de email de MagicBee.
 */
export function buildPromotionEmailHtml(orgName: string, message: string, accent: string, linkAgendar: string): string {
  const bodyHtml = escapeHtml(message).replace(/\n/g, '<br>')
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: ${accent}; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">${escapeHtml(orgName)}</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px; font-size: 14px; line-height: 1.6;">
        <p>${bodyHtml}</p>
        <a href="${linkAgendar}" style="display: block; text-align: center; background: ${accent}; color: #fff; text-decoration: none; padding: 12px; border-radius: 10px; font-weight: 600; margin-top: 16px;">Agendar cita</a>
      </div>
    </div>
  `
}
