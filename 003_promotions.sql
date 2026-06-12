-- ============================================================
-- MagicBee — Módulo de Promociones
-- Ejecutar en: Supabase > SQL Editor (proyecto de MagicBee)
-- Es idempotente: se puede correr mas de una vez sin duplicar nada.
-- ============================================================

-- ------------------------------------------------------------
-- Campañas enviadas por un comercio (WhatsApp o email) a un
-- segmento de sus clientes.
-- ------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  segment text not null check (segment in ('todos', 'nuevos', 'inactivos', 'vip', 'por_servicio')),
  service_id uuid references public.services(id) on delete set null,
  template text not null,
  subject text,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_org_idx on public.campaigns (organization_id);

-- ------------------------------------------------------------
-- Destinatarios de cada campaña, para poder medir conversiones
-- (citas nuevas generadas en los 7 días posteriores al envío).
-- ------------------------------------------------------------
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id);
create index if not exists campaign_recipients_client_idx on public.campaign_recipients (client_id);

-- ------------------------------------------------------------
-- RLS: el equipo del comercio puede ver y crear sus propias
-- campañas y destinatarios.
-- ------------------------------------------------------------
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;

drop policy if exists campaigns_tenant_select on public.campaigns;
create policy campaigns_tenant_select on public.campaigns
  for select
  using (
    organization_id = (select organization_id from public.users where id = auth.uid())
  );

drop policy if exists campaigns_tenant_insert on public.campaigns;
create policy campaigns_tenant_insert on public.campaigns
  for insert
  with check (
    organization_id = (select organization_id from public.users where id = auth.uid())
  );

drop policy if exists campaign_recipients_tenant_select on public.campaign_recipients;
create policy campaign_recipients_tenant_select on public.campaign_recipients
  for select
  using (
    campaign_id in (
      select id from public.campaigns
      where organization_id = (select organization_id from public.users where id = auth.uid())
    )
  );

drop policy if exists campaign_recipients_tenant_insert on public.campaign_recipients;
create policy campaign_recipients_tenant_insert on public.campaign_recipients
  for insert
  with check (
    campaign_id in (
      select id from public.campaigns
      where organization_id = (select organization_id from public.users where id = auth.uid())
    )
  );
