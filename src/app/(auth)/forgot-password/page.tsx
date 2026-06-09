'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import '@/components/auth.css'
import { MagicBeeLogo } from '@/components/ThemeSwitch'

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim()
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanEmail = sanitizeText(email).toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) { setError('Correo electrónico no válido'); return }
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })


    if (error) {
      setError(`Error: ${error.message}`)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <MagicBeeLogo size={72} />
          <h1 className="auth-brand-name" style={{ marginTop: 24 }}>MagicBee</h1>
          <p className="auth-brand-tagline">Recuperá el acceso a tu cuenta en segundos.</p>
          <ul className="auth-features">
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Revisá tu bandeja de entrada</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Hacé clic en el enlace del email</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Creá una nueva contraseña</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Volvé a tu panel en segundos</li>
          </ul>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          {sent ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
                <h2 className="auth-card-title">Revisá tu correo</h2>
                <p className="auth-card-subtitle" style={{ marginBottom: 0 }}>
                  Enviamos un enlace de recuperación a <strong style={{ color: '#f5a623' }}>{email}</strong>.
                  El enlace expira en 1 hora.
                </p>
              </div>
              <p className="auth-link">
                <Link href="/login">Volver al inicio de sesión</Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="auth-card-title">¿Olvidaste tu contraseña?</h2>
              <p className="auth-card-subtitle">Ingresá tu correo y te enviamos un enlace para recuperarla.</p>
              <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                <div className="auth-field">
                  <label>Correo electrónico</label>
                  <input
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    maxLength={254}
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                  />
                </div>
                {error && <div className="auth-error" role="alert">{error}</div>}
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
              <p className="auth-link">
                ¿Recordaste tu contraseña? <Link href="/login">Iniciá sesión</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
