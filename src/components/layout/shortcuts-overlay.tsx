'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Command,
  HelpCircle,
  Hash,
  Plus,
  Sun,
  Moon,
  PanelLeftClose,
  LayoutDashboard,
  Mail,
  FileText,
  Building2,
  ClipboardList,
  Printer,
  GitBranch,
  Settings,
  Search,
  BookOpen,
  Wrench,
  Keyboard,
  ArrowRight,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useClaimsStore, type TabType } from '@/store/claims-store'

const navShortcuts: { key: string; label: string; icon: React.ElementType; tab: TabType }[] = [
  { key: '1', label: 'Dashboard', icon: LayoutDashboard, tab: 'dashboard' },
  { key: '2', label: 'Email Processing', icon: Mail, tab: 'email' },
  { key: '3', label: 'Claims', icon: FileText, tab: 'claims' },
  { key: '4', label: 'Insurance Companies', icon: Building2, tab: 'insurance' },
  { key: '5', label: 'Audit Logs', icon: ClipboardList, tab: 'audit' },
  { key: '6', label: 'Print Queue', icon: Printer, tab: 'print-queue' },
  { key: '7', label: 'Workflow', icon: GitBranch, tab: 'workflow' },
  { key: '8', label: 'Settings', icon: Settings, tab: 'config' },
  { key: '9', label: 'Setup Guide', icon: BookOpen, tab: 'setup' },
  { key: '0', label: 'Install Manager', icon: Wrench, tab: 'installer' },
]

const actionShortcuts = [
  { key: 'N', label: 'New Claim', icon: Plus },
  { key: 'D', label: 'Go to Dashboard', icon: LayoutDashboard },
  { key: 'C', label: 'Go to Claims', icon: FileText },
  { key: 'E', label: 'Go to Email', icon: Mail },
  { key: 'I', label: 'Go to Insurance', icon: Building2 },
  { key: 'A', label: 'Go to Audit Logs', icon: ClipboardList },
]

const systemShortcuts = [
  { key: '⌘K', label: 'Command Palette / Search', icon: Command },
  { key: '?', label: 'Show Shortcuts', icon: HelpCircle },
  { key: 'T', label: 'Toggle Theme', icon: Sun },
  { key: '/', label: 'Focus Search Bar', icon: Search },
  { key: 'Esc', label: 'Close Dialogs / Panels', icon: PanelLeftClose },
]

function Kbd({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-mono font-semibold text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)] backdrop-blur-sm ${
        wide ? 'min-w-[36px]' : 'min-w-[28px]'
      }`}
    >
      {children}
    </kbd>
  )
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Keyboard className="size-6 text-primary/80" />
    </motion.div>
  )
}

function ShortcutGroup({
  title,
  shortcuts,
}: {
  title: string
  shortcuts: { key: string; label: string; icon: React.ElementType }[]
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 mb-2.5 flex items-center gap-2">
        <ArrowRight className="size-3 text-primary/50" />
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <div
              key={shortcut.key}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-primary/5 transition-colors cursor-default group"
            >
              <Kbd wide={shortcut.key.includes('⌘') || shortcut.key === 'Esc'}>{shortcut.key}</Kbd>
              <Icon className="size-4 text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 transition-colors" />
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors truncate">
                {shortcut.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)
  const { setTheme, theme } = useTheme()

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // ? key — toggle overlay (ignore in inputs)
      if (e.key === '?' && !isInput) {
        e.preventDefault()
        toggleOpen()
        return
      }

      // Escape — close overlay
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }

      // Don't process other shortcuts when overlay is open or in input
      if (open || isInput) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // 0-9 tab switching
      const tabNum = parseInt(e.key, 10)
      if (tabNum >= 0 && tabNum <= 9) {
        e.preventDefault()
        const tabEntry = navShortcuts.find((s) => s.key === e.key)
        if (tabEntry) {
          useClaimsStore.getState().setActiveTab(tabEntry.tab)
        }
        return
      }

      // N — new claim
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        useClaimsStore.getState().setActiveTab('claims')
        window.dispatchEvent(new CustomEvent('open-new-claim'))
        return
      }

      // T — toggle theme
      if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, toggleOpen, setTheme])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          {/* Backdrop with glassmorphism */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.75))',
              backdropFilter: 'blur(20px) saturate(180%)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            {/* Dark mode overlay */}
            <div className="absolute inset-0 hidden dark:block bg-card/80 backdrop-blur-xl" />

            {/* Content */}
            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                <div className="flex items-center gap-3">
                  <KeyboardIcon />
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Keyboard Shortcuts</h2>
                    <p className="text-[11px] text-muted-foreground">Navigate faster with keyboard commands</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>?</Kbd>
                </div>
              </div>

              {/* Shortcuts Grid */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Navigation Section */}
                <ShortcutGroup title="Navigation" shortcuts={navShortcuts} />

                {/* Actions Section */}
                <ShortcutGroup title="Actions" shortcuts={actionShortcuts} />

                {/* System Section */}
                <ShortcutGroup title="System" shortcuts={systemShortcuts} />
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 px-6 py-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Press <Kbd>?</Kbd> to toggle · <Kbd>Esc</Kbd> to close
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Theme:</span>
                    <Kbd>{theme === 'dark' ? '☀' : '☽'}</Kbd>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
