'use client'

import { useEffect } from 'react'

const SELECTOR =
  '.db-card, .db-empty, .apt-list-card, .cl-card, .svc-card, .svc-modal, .staff-card, .sa-card, .sa-panel, .auth-card, .portal-header, .portal-service-card, .portal-modal'

export function GlassSpotlight() {
  useEffect(() => {
    let current: HTMLElement | null = null

    function reset(el: HTMLElement) {
      el.style.setProperty('--spot-x', '-9999px')
      el.style.setProperty('--spot-y', '-9999px')
    }

    function handleMove(e: PointerEvent) {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(SELECTOR)

      if (target !== current) {
        if (current) reset(current)
        current = target
      }
      if (!target) return

      const rect = target.getBoundingClientRect()
      target.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
      target.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
    }

    function handleLeaveWindow() {
      if (current) {
        reset(current)
        current = null
      }
    }

    document.addEventListener('pointermove', handleMove, { passive: true })
    document.addEventListener('pointerleave', handleLeaveWindow)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerleave', handleLeaveWindow)
    }
  }, [])

  return null
}
