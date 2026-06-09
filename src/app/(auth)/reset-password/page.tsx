'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import '@/components/auth.css'
import { MagicBeeLogo } from '@/components/ThemeSwitch'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // El token viene en el hash: #access_token=...&type=recovery
    // Supabase client lo detecta automáticamente via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          setReady(true)
          setChecking(false)
        } else if (event === 'SIGNED_IN' && session) {
          // También funciona si ya procesó el token
          const hash = window.location.hash
          if (hash.includes('type=recovery')) {
            setReady(true)
            setChecking(false)
          }
        }
      }
    )

    // Timeout: si en 5s no llega el evento, el link es inválido
    const timeout = setTimeout(() => {
      setChecking(false)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password.length > 128) { setError('La contraseña es demasiado larga'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('Error al actualizar. El enlace puede haber expirado.'); setLoading(false); return }
    setDone(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <MagicBeeLogo size={72} />
          <h1 className="auth-brand-name" style={{ marginTop: 24 }}>MagicBee</h1>
          <p className="auth-brand-tagline">Creá una nueva contraseña segura para tu cuenta.</p>
          <ul className="auth-features">
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Mínimo 8 caracteres</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Usá letras y números</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>No la compartas con nadie</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Guardala en un lugar seguro</li>
          </ul>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 className="auth-card-title">Contraseña actualizada</h2>
              <p className="auth-card-subtitle">
                Tu contraseña fue cambiada. Redirigiendo al login...
              </p>
            </div>
          ) : checking ? (
            <div style={{ textAlign: 'center' }}>
              <h2 className="auth-card-title">Verificando enlace...</h2>
              <p className="auth-card-subtitle">Un momento por favor.</p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h2 className="auth-card-title">Enlace inválido o expirado</h2>
              <p className="auth-card-subtitle">
                Este enlace ya fue usado o expiró.
              </p>
              <Link href="/forgot-password" className="auth-btn" style={{
                display: 'block', textAlign: 'center',
                textDecoration: 'none', marginTop: 24
              }}>
                Solicitar nuevo enlace
              </Link>
            </div>
          ) : (
            <>
              <h2 className="auth-card-title">Nueva contraseña</h2>
              <p className="auth-card-subtitle">Elegí una contraseña segura para tu cuenta.</p>
              <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
                <div className="auth-field">
                  <label>Nueva contraseña</label>
                  <div className="auth-input-wrap">
                    <input
                      className="auth-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Mínimo 8 caracteres"
                      style={{ paddingRight: 44 }}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                    <button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="auth-field">
                  <label>Confirmar contraseña</label>
                  <input
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Repetí tu contraseña"
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </div>
                {error && <div className="auth-error" role="alert">{error}</div>}
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
