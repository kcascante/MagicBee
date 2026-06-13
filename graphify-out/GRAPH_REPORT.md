# MagicBee — Graph Report
Generado: 2026-06-13

## Resumen del corpus

```
Total: 53 archivos analizados
  pages:       20 (rutas Next.js)
  api:          6 (route handlers)
  components:  17 (client components)
  lib:         10 (utilidades y servicios)
  tables:      11 (Supabase PostgreSQL)
  external:     4 (servicios de terceros)

Conexiones mapeadas: ~120 edges
```

---

## Arquitectura General

MagicBee es un SaaS de gestión de negocios de belleza/servicios con:
- **Dashboard** para dueños de negocios (citas, clientes, servicios, staff, stats)
- **Portal público** (`/p/[slug]`) para que clientes reserven en línea
- **Bot WhatsApp** con IA para reservas automatizadas
- **Campañas** de email/WhatsApp por segmento de cliente

### Patrón arquitectónico central
```
Page Server Component
  ├── lee datos con lib/supabase/server
  ├── pasa props al Client Component
  └── Client Component
        ├── lib/supabase/client para mutaciones
        └── fetch a /api/* para operaciones complejas
```

---

## Nodos Hub (más conexiones)

| Nodo | Tipo | Conexiones | Rol |
|------|------|-----------|-----|
| `organizations` | Tabla | 14 | Ancla central: casi todo apunta a ella |
| `appointments` | Tabla | 13 | Core del negocio: citas con estado/cliente/servicio/staff |
| `clients` | Tabla | 10 | Base de clientes con segmentación |
| `lib/supabase/server` | Lib | 12 | Usada por todos los Server Components |
| `lib/supabase/client` | Lib | 10 | Usada por todos los Client Components |
| `lib/appointmentEmails` | Lib | 4 | Centraliza notificaciones de citas |
| `lib/whatsappBot` | Lib | 9 | Bot IA que orquesta reservas completas |

---

## Flujos Clave

### 1. Reserva por WhatsApp (flujo más complejo)
```
Meta WhatsApp API
  → POST /api/whatsapp/webhook
      → lib/whatsappBot (Claude Haiku con tools)
          → lee: organizations, services, schedules, staff, clients
          → escribe: clients (si nuevo), appointments, whatsapp_sessions
          → lib/appointmentEmails → Resend (confirmación email)
          → lib/whatsapp → Meta API (respuesta al cliente)
```

### 2. Reserva desde Portal Público
```
/p/[slug] (PortalClient)
  → crea appointment en Supabase directamente
  → POST /api/notifications/appointment
      → lib/appointmentEmails → Resend
```

### 3. Cancelación de Cita
```
/p/[slug]/cita/[id] (CitaManageClient)
  → POST /api/appointments/cancel
      → valida ventana de cancelación
      → actualiza appointments.status
      → lib/appointmentEmails → Resend (notificación)
```

### 4. Campaña Promocional
```
PromotionsClient
  → lib/promotions.getAnnotatedClients() → segmentación VIP/Regular/At-risk/New
  → POST /api/promotions/send
      → Resend (email) o Meta WhatsApp API
      → escribe campaigns, campaign_recipients
```

### 5. Autenticación
```
/login → Supabase signInWithPassword
  → /auth/callback (OAuth) → intercambia código por sesión
  → middleware.ts → lib/supabase/middleware
      → lee users.role
      → redirige: superadmin → /superadmin | user → /dashboard
```

---

## Conexiones Sorpresa (cross-domain)

1. **`lib/whatsappBot` escribe en `clients`** — el bot crea clientes nuevos automáticamente si el número no existe, conectando el canal WhatsApp con la BD de CRM.

2. **`lib/promotions` es compartido** entre `page-promotions` (server, para segmentación inicial) y `comp-promotions` (client, para re-filtrar) y `api-promo` (server, para envío). Tres capas de la app usan la misma lógica.

3. **`appointments.client_name`** — dato desnormalizado en la tabla `appointments` para evitar joins en el bot de WhatsApp y en el portal público.

4. **`comp-stats` usa Chart.js** pero no hace ninguna llamada a Supabase — recibe todos los datos pre-procesados desde el Server Component, patrón inusual para un dashboard analytics.

5. **`organizations` conecta todo** — es la única tabla referenciada por API routes, lib-bot, lib-emails, y casi todos los dashboard pages. Es el verdadero núcleo del sistema multi-tenant.

---

## Tablas Supabase — Mapa de Relaciones

```
organizations
  ├── users (org_id FK)
  ├── services (org_id FK)
  ├── staff (org_id FK)
  ├── schedules (org_id FK)
  ├── clients (org_id FK)
  │     └── appointments (client_id FK)
  │           ├── services (service_id FK)
  │           ├── staff (staff_id FK)
  │           └── reviews (appointment_id FK)
  ├── campaigns (org_id FK)
  │     └── campaign_recipients (campaign_id FK)
  └── whatsapp_sessions (org_id FK + phone)
```

---

## Servicios Externos

| Servicio | Uso | Archivos |
|---------|-----|---------|
| **Supabase** | Auth + PostgreSQL + Storage | todos |
| **Meta WhatsApp Cloud API v21** | Mensajería bidireccional | lib/whatsapp, api/whatsapp/webhook |
| **Anthropic Claude Haiku** | Bot de reservas con tools | lib/whatsappBot |
| **Resend** | Emails transaccionales + campañas | lib/appointmentEmails, api/promotions/send |

---

## Archivos para Revisar Primero (onboarding)

Si eres nuevo en este codebase, lee en este orden:

1. [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) — cómo se conecta a Supabase
2. [src/middleware.ts](../src/middleware.ts) — cómo funciona el auth y redirects
3. [src/app/dashboard/page.tsx](../src/app/dashboard/page.tsx) — patrón Server → Client Component
4. [src/lib/whatsappBot.ts](../src/lib/whatsappBot.ts) — la lógica más compleja del sistema
5. [src/lib/promotions.ts](../src/lib/promotions.ts) — segmentación de clientes

---

## Visualización Interactiva

Abre [graph.html](./graph.html) en el navegador para explorar el grafo con:
- Filtros por categoría
- Búsqueda de nodos
- Hover para ver conexiones y descripción
- Drag & drop para reorganizar
- Zoom y pan
