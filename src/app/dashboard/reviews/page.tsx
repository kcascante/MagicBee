import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewsClient from '@/components/ReviewsClient'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  const orgId = userData?.organizations?.id

  let reviews: any[] = []
  if (orgId) {
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, admin_reply, admin_reply_at, is_public, created_at, clients(full_name, phone, email), appointments(start_time, services(name))')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    reviews = data ?? []
  }

  return <ReviewsClient userData={userData as any} initialReviews={reviews as any} />
}
