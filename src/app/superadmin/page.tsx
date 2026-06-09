import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import '@/components/superadmin.css'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'superadmin') redirect('/dashboard')

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })

  const adminsCount = users?.filter(u => u.role === 'admin').length ?? 0

  return (
    <div className="sa-root">
      <div className="sa-content">

        <div className="sa-header">
          <div className="sa-brand">
            <div className="sa-logo-icon">M</div>
            <span className="sa-brand-name">MagicBee</span>
            <span className="sa-badge">Superadmin</span>
          </div>
          <h1 className="sa-title">Panel Global</h1>
          <p className="sa-subtitle">Bienvenido, {userData?.full_name}</p>
        </div>

        <div className="sa-metrics">
          {[
            { label: 'Comercios registrados', value: orgs?.length ?? 0, color: '#f5a623' },
            { label: 'Usuarios totales', value: users?.length ?? 0, color: '#7c6af7' },
            { label: 'Admins activos', value: adminsCount, color: '#22d3a5' },
          ].map((m) => (
            <div key={m.label} className="sa-card">
              <div className="sa-card-dot" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
              <p className="sa-card-label">{m.label}</p>
              <p className="sa-card-value">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="sa-panel">
          <p className="sa-panel-label">Comercios registrados</p>
          {orgs && orgs.length > 0 ? (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Fecha de registro</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className="sa-td-name">{org.name}</td>
                    <td className="sa-td-mono">{org.slug}</td>
                    <td className="sa-td-date">{new Date(org.created_at).toLocaleDateString('es-CR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sa-empty">No hay comercios registrados aún.</p>
          )}
        </div>

        <div className="sa-panel">
          <p className="sa-panel-label">Usuarios del sistema</p>
          {users && users.length > 0 ? (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Fecha de registro</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="sa-td-name">{u.full_name}</td>
                    <td className="sa-td-muted">{u.email}</td>
                    <td>
                      <span className={`sa-role-badge sa-role-${u.role}`}>{u.role}</span>
                    </td>
                    <td className="sa-td-date">{new Date(u.created_at).toLocaleDateString('es-CR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sa-empty">No hay usuarios registrados aún.</p>
          )}
        </div>

      </div>
    </div>
  )
}
