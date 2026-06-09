import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">MagicBee</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {userData?.organizations?.name}
            </span>
            <span className="text-sm font-medium">
              {userData?.full_name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Bienvenido, {userData?.full_name?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-500 mt-1">
            Panel de administración de {userData?.organizations?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-500">Citas hoy</p>
            <p className="text-3xl font-bold mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-500">Citas esta semana</p>
            <p className="text-3xl font-bold mt-1">0</p>
          </div>
          <div className="bg-white rounded-xl border p-6">
            <p className="text-sm text-gray-500">Clientes totales</p>
            <p className="text-3xl font-bold mt-1">0</p>
          </div>
        </div>
      </div>
    </div>
  )
}