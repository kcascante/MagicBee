'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import '@/components/auth.css'
import { MagicBeeLogo } from '@/components/ThemeSwitch'

function sanitizeText(value: string): string {
  return value.replace(/[<>'"`;]/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim()
}

function sanitizeCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

type Step = 'email' | 'verify' | 'done'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanEmail = sanitizeText(email).toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) { setError('Correo electrónico no válido'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)
    if (error) { setError('Error al enviar el código. Intentá de nuevo.'); setLoading(false); return }
    setEmail(cleanEmail)
    setStep('verify')
    setLoading(false)
  }

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanCode = sanitizeCode(code)
    if (cleanCode.length !== 8) { setError('El código debe tener 8 dígitos'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password.length > 128) { setError('La contraseña es demasiado larga'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: cleanCode,
      type: 'recovery',
    })

    if (verifyError) {
      setError('Código incorrecto o expirado. Verificá e intentá de nuevo.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      if (updateError.message.toLowerCase().includes('different') ||
          updateError.message.toLowerCase().includes('same')) {
        setError('La nueva contraseña debe ser diferente a la anterior.')
      } else {
        setError('Error al actualizar la contraseña. Intentá de nuevo.')
      }
      setLoading(false)
      return
    }

    setStep('done')
    setLoading(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <MagicBeeLogo size={72} />
          <h1 className="auth-brand-name" style={{ marginTop: 24 }}>MagicBee</h1>
          <p className="auth-brand-tagline">Recuperá el acceso a tu cuenta en segundos.</p>
          <ul className="auth-features">
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Pedí tu código de verificación</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Revisá tu correo</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Ingresá el código de 6 dígitos</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Creá tu nueva contraseña</li>
          </ul>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          {step === 'done' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 className="auth-card-title">Contraseña actualizada</h2>
              <p className="auth-card-subtitle">
                Tu contraseña fue cambiada correctamente. Redirigiendo al login...
              </p>
            </div>
          ) : step === 'verify' ? (
            <>
              <h2 className="auth-card-title">Ingresá el código</h2>
              <p className="auth-card-subtitle">
                Enviamos un código de 8 dígitos a <strong style={{ color: '#f5a623' }}>{email}</strong>.
                Ingresalo junto con tu nueva contraseña.
              </p>
              <form className="auth-form" onSubmit={handleVerifyAndReset} autoComplete="off">
                <div className="auth-field">
                  <label>Código de verificación</label>
                  <input
                    className="auth-input"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(sanitizeCode(e.target.value))}
                    required
                    placeholder="12345678"
                    maxLength={8}
                    autoComplete="one-time-code"
                    style={{ letterSpacing: '0.4em', fontSize: 20, textAlign: 'center', fontWeight: 600 }}
                  />
                </div>
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
                  {loading ? 'Verificando...' : 'Cambiar contraseña'}
                </button>
              </form>
              <p className="auth-link">
                ¿No recibiste el código?{' '}
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError('') }}
                  style={{ background: 'none', border: 'none', color: '#f5a623', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
                >
                  Reenviar
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="auth-card-title">¿Olvidaste tu contraseña?</h2>
              <p className="auth-card-subtitle">Ingresá tu correo y te enviamos un código de verificación.</p>
              <form className="auth-form" onSubmit={handleSendCode} autoComplete="off">
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
                  {loading ? 'Enviando...' : 'Enviar código de verificación'}
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
