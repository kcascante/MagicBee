'use client'

import { useEffect } from 'react'

const SELECTOR =
  '.apt-list-card, .cl-card, .svc-card, .staff-card, .sa-card, .auth-card, .db-empty'

export function GlassSpotlight() {
  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(SELECTOR)
      if (!target) return
      const rect = target.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      target.style.setProperty('--spot-x', `${x}%`)
      target.style.setProperty('--spot-y', `${y}%`)
    }

    document.addEventListener('pointermove', handleMove, { passive: true })
    return () => document.removeEventListener('pointermove', handleMove)
  }, [])

  return null
}
