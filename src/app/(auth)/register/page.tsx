'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import '@/components/auth.css'
import { MagicBeeLogo } from '@/components/ThemeSwitch'

// Sanitiza texto general: elimina caracteres de control, XSS y SQL básico
function sanitizeText(value: string): string {
  return value
    .replace(/[<>'"`;]/g, '')
    .replace(/(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b/gi, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
}

// Solo letras, espacios, guiones y caracteres latinos/acentuados
function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']/g, '').trim()
}

// Solo letras, números, espacios y puntuación segura para nombres de negocio
function sanitizeOrgName(value: string): string {
  return value.replace(/[<>'"`;\\]/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim()
}

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Sanitizar antes de validar
    const cleanOrg = sanitizeOrgName(orgName)
    const cleanFirst = sanitizeName(firstName)
    const cleanLast = sanitizeName(lastName)
    const cleanEmail = sanitizeText(email).toLowerCase()

    if (cleanOrg.length < 2) { setError('El nombre del negocio debe tener al menos 2 caracteres'); return }
    if (cleanFirst.length < 2) { setError('El nombre debe tener al menos 2 caracteres'); return }
    if (cleanLast.length < 2) { setError('Los apellidos deben tener al menos 2 caracteres'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) { setError('Correo electrónico no válido'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password.length > 128) { setError('La contraseña es demasiado larga'); return }

    setLoading(true)
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: cleanOrg, firstName: cleanFirst, lastName: cleanLast, email: cleanEmail, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Error al crear la cuenta'); setLoading(false); return }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (signInError) { setError('Cuenta creada. Por favor inicia sesion.'); setLoading(false); router.push('/login'); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <MagicBeeLogo size={72} />
          <h1 className="auth-brand-name" style={{ marginTop: 24 }}>MagicBee</h1>
          <p className="auth-brand-tagline">La plataforma de agendamiento para negocios de servicios que quieren crecer.</p>
          <ul className="auth-features">
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Portal de citas con tu marca</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Bot de WhatsApp con IA</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Recordatorios automaticos</li>
            <li className="auth-feature-item"><span className="auth-feature-dot"></span>Estadisticas en tiempo real</li>
          </ul>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h2 className="auth-card-title">Crea tu cuenta</h2>
          <p className="auth-card-subtitle">Empieza gratis. Sin tarjeta de credito.</p>
          <form className="auth-form" onSubmit={handleRegister} autoComplete="off">
            <div className="auth-field">
              <label>Nombre de tu negocio</label>
              <input
                className="auth-input"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                maxLength={100}
                placeholder="Barberia El Estilo"
                autoComplete="organization"
                spellCheck={false}
              />
            </div>
            <div className="auth-row">
              <div className="auth-field">
                <label>Nombre</label>
                <input
                  className="auth-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="Juan"
                  autoComplete="given-name"
                  pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']{2,50}"
                />
              </div>
              <div className="auth-field">
                <label>Apellidos</label>
                <input
                  className="auth-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="Perez"
                  autoComplete="family-name"
                  pattern="[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']{2,50}"
                />
              </div>
            </div>
            <div className="auth-field">
              <label>Correo electronico</label>
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
            <div className="auth-field">
              <label>Contrasena</label>
              <div className="auth-input-wrap">
                <input
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimo 8 caracteres"
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
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-btn" type="submit" disabled={loading}>{loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}</button>
          </form>
          <p className="auth-link">Ya tienes cuenta? <Link href="/login">Inicia sesion</Link></p>
        </div>
      </div>
    </div>
  )
}
