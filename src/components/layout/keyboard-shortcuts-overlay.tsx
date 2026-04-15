'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Command,
  HelpCircle,
  Plus,
  Sun,
  Moon,
  Search,
  Keyboard,
  ArrowRight,
  LayoutDashboard,
  Mail,
  FileText,
  Building2,
  ClipboardList,
  Printer,
  GitBranch,
  Settings,
  Download,
  CheckCircle2,
  XCircle,
  Flag,
  MessageSquare,
  Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useClaimsStore } from '@/store/claims-store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// ─── Shortcut Definitions ─────────────────────────────────────────────────────

interface ShortcutItem {
  key: string
  label: string
  icon: React.ElementType
  category: string
  description?: string
}

const navShortcuts: ShortcutItem[] = [
  { key: '1', label: 'Dashboard', icon: LayoutDashboard, category: 'Navigation' },
  { key: '2', label: 'Email Processing', icon: Mail, category: 'Navigation' },
  { key: '3', label: 'Claims', icon: FileText, category: 'Navigation' },
  { key: '4', label: 'Insurance', icon: Building2, category: 'Navigation' },
  { key: '5', label: 'Print Queue', icon: Printer, category: 'Navigation' },
  { key: '6', label: 'Workflow', icon: GitBranch, category: 'Navigation' },
  { key: '7', label: 'Config', icon: Settings, category: 'Navigation' },
  { key: '8', label: 'Audit Logs', icon: ClipboardList, category: 'Navigation' },
]

const actionShortcuts: ShortcutItem[] = [
  { key: 'N', label: 'New Claim', icon: Plus, category: 'Actions', description: 'Open new claim dialog' },
  { key: 'E', label: 'Export CSV', icon: Download, category: 'Actions', description: 'Export claims to CSV' },
  { key: '/', label: 'Search', icon: Search, category: 'Actions', description: 'Focus search bar' },
  { key: 'T', label: 'Toggle Theme', icon: Sun, category: 'Actions', description: 'Switch dark/light mode' },
  { key: 'Q', label: 'Quick Actions', icon: Zap, category: 'Actions', description: 'Toggle quick actions panel' },
  { key: '?', label: 'Shortcuts', icon: HelpCircle, category: 'Actions', description: 'Show this overlay' },
  { key: '⌘K', label: 'Command Palette', icon: Command, category: 'Actions', description: 'Open command palette' },
]

const claimShortcuts: ShortcutItem[] = [
  { key: 'A', label: 'Approve', icon: CheckCircle2, category: 'Claim Management', description: 'Approve selected claim' },
  { key: 'R', label: 'Reject', icon: XCircle, category: 'Claim Management', description: 'Reject selected claim' },
  { key: 'F', label: 'Flag', icon: Flag, category: 'Claim Management', description: 'Flag claim for review' },
  { key: 'M', label: 'Add Note', icon: MessageSquare, category: 'Claim Management', description: 'Add note to claim' },
]

const allShortcuts = [...navShortcuts, ...actionShortcuts, ...claimShortcuts]

const categories = [
  { id: 'Navigation', label: 'Navigation' },
  { id: 'Actions', label: 'Actions' },
  { id: 'Claim Management', label: 'Claim Management' },
] as const

// ─── Kbd Component ────────────────────────────────────────────────────────────

function Kbd({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded-lg border border-border/60 bg-muted/80 dark:bg-muted/40 px-2 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
        wide ? 'min-w-[32px]' : 'min-w-[24px]'
      }`}
    >
      {children}
    </kbd>
  )
}

// ─── Keyboard Icon with animation ─────────────────────────────────────────────

function AnimatedKeyboardIcon() {
  return (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Keyboard className="size-6 text-primary/80" />
    </motion.div>
  )
}

// ─── Shortcut Row ─────────────────────────────────────────────────────────────

function ShortcutRow({ shortcut, highlight }: { shortcut: ShortcutItem; highlight: string }) {
  const Icon = shortcut.icon
  const label = shortcut.label.toLowerCase()
  const desc = (shortcut.description ?? '').toLowerCase()
  const isMatch =
    highlight.length > 0 && (label.includes(highlight) || desc.includes(highlight))

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-default group ${
        isMatch
          ? 'bg-primary/10 ring-1 ring-primary/20'
          : 'hover:bg-primary/5'
      }`}
    >
      <Icon
        className={`size-4 shrink-0 transition-colors ${
          isMatch ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-muted-foreground'
        }`}
      />
      <span
        className={`text-sm flex-1 truncate transition-colors ${
          isMatch ? 'text-foreground font-medium' : 'text-foreground/80 group-hover:text-foreground'
        }`}
      >
        {shortcut.label}
      </span>
      <Kbd wide={shortcut.key.includes('⌘') || shortcut.key === 'Esc'}>
        {shortcut.key}
      </Kbd>
    </div>
  )
}

// ─── Shortcut Group ───────────────────────────────────────────────────────────

function ShortcutGroup({
  title,
  shortcuts,
  highlight,
}: {
  title: string
  shortcuts: ShortcutItem[]
  highlight: string
}) {
  const filtered = highlight.length > 0
    ? shortcuts.filter(
        (s) =>
          s.label.toLowerCase().includes(highlight) ||
          (s.description ?? '').toLowerCase().includes(highlight) ||
          s.key.toLowerCase().includes(highlight)
      )
    : shortcuts

  if (filtered.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 mb-2.5 flex items-center gap-2">
        <ArrowRight className="size-3 text-primary/50" />
        {title}
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto font-mono">
          {filtered.length}
        </Badge>
      </p>
      <div className="space-y-0.5">
        {filtered.map((shortcut) => (
          <ShortcutRow key={`${shortcut.category}-${shortcut.key}`} shortcut={shortcut} highlight={highlight} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Overlay Component ───────────────────────────────────────────────────

export function KeyboardShortcutsOverlay() {
  const showShortcutsOverlay = useClaimsStore((s) => s.showShortcutsOverlay)
  const setShowShortcutsOverlay = useClaimsStore((s) => s.setShowShortcutsOverlay)
  const { theme, setTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [overlayOpenCount, setOverlayOpenCount] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const highlight = searchQuery.toLowerCase().trim()

  const totalResults = useMemo(() => {
    if (highlight.length === 0) return allShortcuts.length
    return allShortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(highlight) ||
        (s.description ?? '').toLowerCase().includes(highlight) ||
        s.key.toLowerCase().includes(highlight)
    ).length
  }, [highlight])

  // Track overlay opens to reset search input via key
  useEffect(() => {
    if (showShortcutsOverlay) {
      const timer = setTimeout(() => {
        setOverlayOpenCount((c) => c + 1)
        setSearchQuery('')
        searchRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [showShortcutsOverlay])

  // Escape to close (backup handler)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShortcutsOverlay) {
        e.preventDefault()
        e.stopPropagation()
        setShowShortcutsOverlay(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [showShortcutsOverlay, setShowShortcutsOverlay])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setShowShortcutsOverlay(false)
      }
    },
    [setShowShortcutsOverlay]
  )

  return (
    <AnimatePresence>
      {showShortcutsOverlay && (
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
            className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
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
                  <AnimatedKeyboardIcon />
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      Keyboard Shortcuts
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Navigate faster with keyboard commands
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>?</Kbd>
                  <button
                    onClick={() => setShowShortcutsOverlay(false)}
                    className="ml-1 inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="size-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="px-6 pt-4 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    key={overlayOpenCount}
                    placeholder="Filter shortcuts..."
                    className="pl-9 pr-4 h-9 text-sm focus-ring-primary modern-input"
                    defaultValue=""
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-mono">
                      {totalResults}
                    </span>
                  )}
                </div>
              </div>

              {/* Shortcuts Grid — 3 columns */}
              <div className="px-6 py-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
                {highlight.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {categories.map((cat) => {
                      const shortcuts = allShortcuts.filter((s) => s.category === cat.id)
                      return (
                        <ShortcutGroup
                          key={cat.id}
                          title={cat.label}
                          shortcuts={shortcuts}
                          highlight={highlight}
                        />
                      )
                    })}
                  </div>
                ) : totalResults === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="size-8 mb-3 opacity-40" />
                    <p className="text-sm font-medium">No shortcuts found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {categories.map((cat) => {
                      const shortcuts = allShortcuts.filter((s) => s.category === cat.id)
                      return (
                        <ShortcutGroup
                          key={cat.id}
                          title={cat.label}
                          shortcuts={shortcuts}
                          highlight={highlight}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 px-6 py-3 bg-muted/10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-muted-foreground">
                    Press <Kbd>?</Kbd> to toggle · <Kbd>Esc</Kbd> to close
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {theme === 'dark' ? (
                        <Sun className="size-3.5" />
                      ) : (
                        <Moon className="size-3.5" />
                      )}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {allShortcuts.length} shortcuts
                    </span>
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
