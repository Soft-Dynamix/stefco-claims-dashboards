'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useClaimsStore, type TabType } from '@/store/claims-store'
import { toast } from 'sonner'

/**
 * Global keyboard shortcuts for the Stefco Claims Dashboard.
 *
 * Handles:
 * - 1-8: Navigate to respective tabs (only when not in input/textarea)
 * - N: Open new claim dialog
 * - E: Trigger CSV export
 * - /: Focus search input in header
 * - T: Toggle dark/light mode
 * - Q: Toggle Quick Actions FAB
 * - ?: Open keyboard shortcuts overlay
 * - Escape: Close any open overlay/dialog
 */
const numericTabMap: Record<string, TabType> = {
  '1': 'dashboard',
  '2': 'email',
  '3': 'claims',
  '4': 'insurance',
  '5': 'audit',
  '6': 'print-queue',
  '7': 'workflow',
  '8': 'config',
}

function isInputFocused(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement).tagName
  const isEditable =
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  const isContentEditable =
    (e.target as HTMLElement).isContentEditable
  return isEditable || isContentEditable
}

export function GlobalHotkeys() {
  const { setTheme } = useTheme()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useClaimsStore.getState()
      const tag = (e.target as HTMLElement).tagName
      const isInput = isInputFocused(e)

      // Escape — close any open overlay/dialog
      if (e.key === 'Escape') {
        if (store.showShortcutsOverlay) {
          e.preventDefault()
          store.setShowShortcutsOverlay(false)
          return
        }
        if (store.showCommandPalette) {
          e.preventDefault()
          store.setShowCommandPalette(false)
          return
        }
        if (store.showNewClaimDialog) {
          e.preventDefault()
          store.setShowNewClaimDialog(false)
          return
        }
        // Close any open dialog/radix dialog
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        document.dispatchEvent(escapeEvent)
        return
      }

      // All shortcuts below require NOT being in an input field
      if (isInput) return

      // Ctrl/Cmd + K is handled by CommandPalette — do not intercept
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        return
      }

      // Don't process when modifier keys are held (except for specific combos)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // ? — toggle keyboard shortcuts overlay
      if (e.key === '?') {
        e.preventDefault()
        store.setShowShortcutsOverlay(!store.showShortcutsOverlay)
        return
      }

      // 1-8 — tab navigation
      const tab = numericTabMap[e.key]
      if (tab) {
        e.preventDefault()
        store.setActiveTab(tab)
        return
      }

      // N — new claim
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        store.setActiveTab('claims')
        store.setShowNewClaimDialog(true)
        toast.info('New claim dialog opened', { duration: 2000 })
        return
      }

      // E — CSV export
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        store.setActiveTab('claims')
        window.dispatchEvent(new CustomEvent('trigger-csv-export'))
        return
      }

      // / — focus search
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector(
          'header input[type="text"]'
        ) as HTMLInputElement | null
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
        return
      }

      // T — toggle theme
      if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        return
      }

      // Q — toggle quick actions FAB
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('toggle-quick-actions'))
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setTheme])

  // This is a headless component — no UI
  return null
}
