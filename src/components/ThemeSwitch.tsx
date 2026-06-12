'use client'

import { useTheme } from '@/lib/theme'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function ThemeSwitch() {
  const { theme, toggle } = useTheme()
  const pathname = usePathname()

  // La pagina de gestion de cita (/p/[slug]/cita/[id]) no usa
  // cambio de tema: siempre se muestra en claro.
  if (pathname && /^\/p\/[^/]+\/cita\//.test(pathname)) {
    return null
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        width: 44,
        height: 44,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        transition: 'all 0.2s',
        background: theme === 'light' ? '#1a1a2e' : '#f0f0f3',
        boxShadow: theme === 'light'
          ? '4px 4px 10px rgba(0,0,0,0.3)'
          : '4px 4px 10px #d1d1d4, -2px -2px 6px #ffffff',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)' }}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}

export function MagicBeeLogo({ size = 72 }: { size?: number }) {
  const pathRef = useRef<SVGRectElement>(null)
  const animRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = pathRef.current
    if (!el) return

    const perimeter = (size - 8) * 4
    el.style.strokeDasharray = String(perimeter)
    el.style.strokeDashoffset = String(perimeter)

    const runAnim = () => {
      el.style.transition = 'none'
      el.style.strokeDashoffset = String(perimeter)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
          el.style.strokeDashoffset = '0'
          timeoutRef.current = setTimeout(() => {
            el.style.transition = 'stroke-dashoffset 0.4s ease'
            el.style.strokeDashoffset = String(-perimeter)
            timeoutRef.current = setTimeout(scheduleNext, 600)
          }, 1400)
        })
      })
    }

    const scheduleNext = () => {
      timeoutRef.current = setTimeout(runAnim, 3000 + Math.random() * 2000)
    }

    scheduleNext()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [size])

  const r = 20 * (size / 72)
  const pad = 4
  const s = size - pad * 2

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #f5a623, #f56342)',
        borderRadius: size * 0.278,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: size * 0.444, color: '#fff',
        boxShadow: '0 8px 24px rgba(245,166,35,0.35)',
        zIndex: 1,
      }}>M</div>
      <svg
        style={{ position: 'absolute', inset: 0, zIndex: 2, overflow: 'visible' }}
        width={size} height={size}
        viewBox={"0 0 " + size + " " + size}
      >
        <rect
          ref={pathRef}
          x={pad} y={pad}
          width={s} height={s}
          rx={r} ry={r}
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}
        />
      </svg>
    </div>
  )
}
