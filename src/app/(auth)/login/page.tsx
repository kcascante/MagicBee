'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import '@/components/auth.css'
import { MagicBeeLogo } from '@/components/ThemeSwitch'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError('Correo o contrasena incorrectos'); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <MagicBeeLogo size={72} />
          <h1 className="auth-brand-name" style={{ marginTop: 24 }}>MagicBee</h1>
          <p className="auth-brand-tagline">Bienvenido de vuelta. Tu negocio te espera.</p>
          <ul className="auth-features">
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Ver citas de hoy</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Gestionar tu agenda</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Ver estadisticas</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Administrar clientes</li>
          </ul>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h2 className="auth-card-title">Iniciar sesion</h2>
          <p className="auth-card-subtitle">Accede al panel de tu negocio</p>
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label>Correo electronico</label>
              <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@correo.com" />
            </div>
            <div className="auth-field">
              <label>Contrasena</label>
              <div className="auth-input-wrap">
                <input className="auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Tu contrasena" style={{ paddingRight: 44 }} />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
          </form>
          <p className="auth-link">No tienes cuenta? <Link href="/register">Registrate gratis</Link></p>
        </div>
      </div>
    </div>
  )
}
