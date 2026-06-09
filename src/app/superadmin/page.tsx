import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '40px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #f5a623, #f56342)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14,
          }}>M</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>MagicBee</span>
          <span style={{
            background: 'rgba(245,166,35,0.15)',
            border: '1px solid rgba(245,166,35,0.3)',
            borderRadius: 6, padding: '2px 8px',
            fontSize: 11, color: '#f5a623', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Superadmin</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
          Panel Global
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Bienvenido, {userData?.full_name}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'Comercios registrados', value: orgs?.length ?? 0, color: '#f5a623' },
          { label: 'Usuarios totales', value: users?.length ?? 0, color: '#7c6af7' },
          { label: 'Admins activos', value: users?.filter(u => u.role === 'admin').length ?? 0, color: '#22d3a5' },
        ].map((m) => (
          <div key={m.label} style={{
            background: 'rgba(20,15,40,0.35)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderTop: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 16, padding: '28px 24px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}`, marginBottom: 16 }} />
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{m.label}</p>
            <p style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla de comercios */}
      <div style={{
        background: 'rgba(20,15,40,0.3)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 16, padding: '28px 24px', marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
          Comercios registrados
        </p>
        {orgs && orgs.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Nombre', 'Slug', 'Fecha de registro'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px', color: '#fff', fontWeight: 500 }}>{org.name}</td>
                  <td style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 12 }}>{org.slug}</td>
                  <td style={{ padding: '12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    {new Date(org.created_at).toLocaleDateString('es-CR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No hay comercios registrados aún.
          </p>
        )}
      </div>

      {/* Tabla de usuarios */}
      <div style={{
        background: 'rgba(20,15,40,0.3)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 16, padding: '28px 24px',
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
          Usuarios del sistema
        </p>
        {users && users.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Nombre', 'Correo', 'Rol', 'Fecha de registro'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px', color: '#fff', fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: u.role === 'superadmin'
                        ? 'rgba(245,166,35,0.15)' : u.role === 'admin'
                        ? 'rgba(124,106,247,0.15)' : 'rgba(34,211,165,0.15)',
                      color: u.role === 'superadmin' ? '#f5a623' : u.role === 'admin' ? '#7c6af7' : '#22d3a5',
                      border: `1px solid ${u.role === 'superadmin' ? 'rgba(245,166,35,0.3)' : u.role === 'admin' ? 'rgba(124,106,247,0.3)' : 'rgba(34,211,165,0.3)'}`,
                    }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('es-CR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No hay usuarios registrados aún.
          </p>
        )}
      </div>
    </div>
  )
}
