import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PromotionsClient from '@/components/PromotionsClient'
import { getAnnotatedClients } from '@/lib/promotions'

export default async function PromotionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  const orgId = userData?.organizations?.id
  const org = userData?.organizations

  let clients: ReturnType<typeof annotatedToPlain> = []
  let services: { id: string; name: string }[] = []
  let campaigns: any[] = []

  if (orgId) {
    const [annotated, { data: svcs }, { data: camps }] = await Promise.all([
      getAnnotatedClients(supabase, orgId),
      supabase.from('services').select('id, name').eq('organization_id', orgId).order('name'),
      supabase
        .from('campaigns')
        .select('id, channel, segment, service_id, template, subject, recipient_count, sent_count, failed_count, created_at, services(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    clients = annotatedToPlain(annotated)
    services = svcs || []
    campaigns = camps || []

    // Calcular "nuevas citas en los 7 días posteriores" por campaña.
    if (campaigns.length > 0) {
      try {
        const campaignIds = campaigns.map((c) => c.id)
        const { data: recipients } = await supabase
          .from('campaign_recipients')
          .select('campaign_id, client_id, status')
          .in('campaign_id', campaignIds)
          .eq('status', 'sent')

        const clientIdsByCampaign: Record<string, Set<string>> = {}
        const allClientIds = new Set<string>()
        for (const r of recipients || []) {
          ;(clientIdsByCampaign[(r as any).campaign_id] ??= new Set()).add((r as any).client_id)
          allClientIds.add((r as any).client_id)
        }

        let futureAppts: { client_id: string; created_at: string }[] = []
        if (allClientIds.size > 0) {
          const { data } = await supabase
            .from('appointments')
            .select('client_id, created_at')
            .eq('organization_id', orgId)
            .in('client_id', Array.from(allClientIds))
            .neq('status', 'cancelled')
          futureAppts = data || []
        }

        campaigns = campaigns.map((c) => {
          const sentAt = new Date(c.created_at).getTime()
          const windowEnd = sentAt + 7 * 24 * 60 * 60 * 1000
          const cids = clientIdsByCampaign[c.id] || new Set<string>()
          let conversions = 0
          for (const a of futureAppts) {
            if (!cids.has(a.client_id)) continue
            const createdAt = new Date(a.created_at).getTime()
            if (createdAt >= sentAt && createdAt <= windowEnd) conversions++
          }
          return { ...c, conversions }
        })
      } catch (err) {
        console.error('[promotions] no se pudieron calcular conversiones', err)
        campaigns = campaigns.map((c) => ({ ...c, conversions: null }))
      }
    }
  }

  return (
    <PromotionsClient
      userData={userData}
      organizationId={orgId ?? ''}
      hasWhatsapp={Boolean(org?.whatsapp_phone_number_id && org?.whatsapp_access_token)}
      hasEmail={Boolean(process.env.RESEND_API_KEY)}
      clients={clients}
      services={services}
      campaigns={campaigns}
    />
  )
}

function annotatedToPlain(annotated: Awaited<ReturnType<typeof getAnnotatedClients>>) {
  return annotated.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    visit_count: c.visit_count,
    last_visit_at: c.last_visit_at,
    last_service: c.last_service,
    service_ids: c.service_ids,
    segments: c.segments,
  }))
}
