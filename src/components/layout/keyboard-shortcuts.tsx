'use client'

import React, { useEffect, useRef } from 'react'
import { useClaimsStore, type TabType } from '@/store/claims-store'

const keyToTab: Record<string, TabType> = {
  d: 'dashboard',
  c: 'claims',
  i: 'insurance',
  a: 'audit',
  p: 'print-queue',
  w: 'workflow',
  s: 'config',
}

export function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs, textareas, selects
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Still allow Escape in dialogs
        if (e.key !== 'Escape') return
      }

      // ? key is handled by ShortcutsOverlay — do not intercept here
      // Ctrl/Cmd + K is handled by CommandPalette — do not intercept here

      // / focuses search (when not in an input)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const searchInput = document.querySelector(
          'header input[type="text"]'
        ) as HTMLInputElement | null
        if (searchInput) {
          searchInput.focus()
        }
        return
      }

      // Single key shortcuts for navigation (only when not in input)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tab = keyToTab[e.key.toLowerCase()]
        if (tab) {
          e.preventDefault()
          useClaimsStore.getState().setActiveTab(tab)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // This component handles legacy single-letter navigation (D, C, I, A, P, W, S) and / for search focus.
  // The visual shortcuts overlay (? key, 1-9 tabs, N, T) is in shortcuts-overlay.tsx
  return null
}
