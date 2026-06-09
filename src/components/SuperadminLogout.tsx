'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SuperadminLogout() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleLogout} style={{
      marginTop: 16,
      padding: '8px 16px',
      background: 'rgba(245,99,66,0.1)',
      border: '1px solid rgba(245,99,66,0.25)',
      borderRadius: 8,
      color: '#f56342',
      fontSize: 12,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,99,66,0.2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,99,66,0.1)'}
    >
      Cerrar sesión
    </button>
  )
}
