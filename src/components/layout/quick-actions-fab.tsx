'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  FileText,
  Download,
  Settings,
  Search,
  Command,
  ChevronRight,
} from 'lucide-react'
import { useClaimsStore } from '@/store/claims-store'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface QuickAction {
  id: string
  label: string
  icon: React.ElementType
  onClick: () => void
  color: string
  hoverColor: string
  shortcut?: string
  mobileDisabled?: boolean
  mobileTooltip?: string
}

// ─── Mobile FAB ─────────────────────────────────────────────────────────────

function MobileFab({
  expanded,
  actions,
  onToggle,
  onBackdropClose,
}: {
  expanded: boolean
  actions: QuickAction[]
  onToggle: () => void
  onBackdropClose: () => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 lg:hidden">
      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 fab-backdrop"
              onClick={onBackdropClose}
            />

            {/* Action buttons */}
            <div className="flex flex-col items-end gap-2 relative z-50">
              {actions.map((action, index) => {
                const Icon = action.icon
                const isDisabled = action.mobileDisabled

                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={{
                      duration: 0.25,
                      delay: index * 0.05,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          disabled={isDisabled}
                          className={`size-12 rounded-full shadow-lg text-white ${action.color} ${isDisabled ? 'opacity-50 cursor-not-allowed' : action.hoverColor} btn-press`}
                          onClick={isDisabled ? undefined : action.onClick}
                        >
                          <Icon className="size-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="flex items-center gap-2">
                        <span>
                          {isDisabled && action.mobileTooltip
                            ? action.mobileTooltip
                            : action.label}
                        </span>
                        {action.shortcut && !isDisabled && (
                          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {action.shortcut}
                          </kbd>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.div className="relative z-50" whileTap={{ scale: 0.9 }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={onToggle}
              className={`size-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground fab-glow pulse-ring relative btn-press transition-transform duration-300 ${
                expanded ? 'rotate-45' : 'rotate-0'
              }`}
            >
              <Plus className="size-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {expanded ? 'Close' : 'Quick Actions'}
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </div>
  )
}

// ─── Desktop Vertical Bar ─────────────────────────────────────────────────

function DesktopBar({
  expanded,
  collapsed,
  actions,
  onToggle,
  onBackdropClose,
  onCollapseChange,
  onCommandPalette,
  onShortcutsOverlay,
}: {
  expanded: boolean
  collapsed: boolean
  actions: QuickAction[]
  onToggle: () => void
  onBackdropClose: () => void
  onCollapseChange: (v: boolean) => void
  onCommandPalette: () => void
  onShortcutsOverlay: () => void
}) {
  return (
    <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 fab-backdrop"
              onClick={onBackdropClose}
            />
          </>
        )}
      </AnimatePresence>

      {/* Vertical card with action buttons */}
      <motion.div
        className="relative z-50"
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Card className="p-1.5 shadow-xl border-border/40 glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {collapsed ? (
              /* Collapsed state — single icon */
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={() => onCollapseChange(false)}
                      className="size-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg btn-press"
                    >
                      <Plus className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Quick Actions</TooltipContent>
                </Tooltip>
              </motion.div>
            ) : (
              /* Expanded state — vertical buttons */
              <motion.div
                key="expanded"
                initial={{ opacity: 0, scale: 0.9, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 8 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="flex flex-col gap-1"
              >
                {actions.map((action, index) => {
                  const Icon = action.icon
                  return (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, x: 10, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        duration: 0.2,
                        delay: index * 0.04,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            onClick={action.onClick}
                            className={`size-11 rounded-xl shadow-md text-white ${action.color} ${action.hoverColor} hover:scale-110 transition-transform duration-200 btn-press`}
                          >
                            <Icon className="size-4.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="left"
                          className="flex items-center gap-2"
                        >
                          <span>{action.label}</span>
                          {action.shortcut && (
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {action.shortcut}
                            </kbd>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </motion.div>
                  )
                })}

                <Separator className="my-1" />

                {/* Command palette + shortcuts */}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: actions.length * 0.04 }}
                  className="flex flex-col gap-1"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          onCommandPalette()
                          onCollapseChange(true)
                        }}
                        className="size-11 rounded-xl hover:bg-muted/80 btn-press"
                      >
                        <Command className="size-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="flex items-center gap-2">
                      <span>Command Palette</span>
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        ⌘K
                      </kbd>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          onShortcutsOverlay()
                          onCollapseChange(true)
                        }}
                        className="size-11 rounded-xl hover:bg-muted/80 btn-press"
                      >
                        <svg
                          className="size-4.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="flex items-center gap-2">
                      <span>Keyboard Shortcuts</span>
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        ?
                      </kbd>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onCollapseChange(true)}
                        className="size-11 rounded-xl hover:bg-muted/80 btn-press"
                      >
                        <ChevronRight className="size-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Collapse</TooltipContent>
                  </Tooltip>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export function QuickActionsFab() {
  const [expanded, setExpanded] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const activeTab = useClaimsStore((s) => s.activeTab)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setShowNewClaimDialog = useClaimsStore((s) => s.setShowNewClaimDialog)
  const setShowCommandPalette = useClaimsStore((s) => s.setShowCommandPalette)
  const setShowShortcutsOverlay = useClaimsStore((s) => s.setShowShortcutsOverlay)

  const triggerCsvExport = useCallback(() => {
    window.dispatchEvent(new CustomEvent('trigger-csv-export'))
    toast.info('Exporting claims to CSV...', { duration: 2000 })
  }, [])

  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector(
      'header input[type="text"]'
    ) as HTMLInputElement | null
    if (searchInput) {
      searchInput.focus()
      searchInput.select()
    }
  }, [])

  // Listen for Q key toggle
  useEffect(() => {
    const handleToggle = () => {
      setExpanded((prev) => !prev)
      setCollapsed(false)
    }
    window.addEventListener('toggle-quick-actions', handleToggle)
    return () => window.removeEventListener('toggle-quick-actions', handleToggle)
  }, [])

  // Hidden on Install Manager and Setup Guide views
  if (activeTab === 'installer' || activeTab === 'setup') {
    return null
  }

  const actions: QuickAction[] = [
    {
      id: 'new-claim',
      label: 'New Claim',
      icon: FileText,
      onClick: () => {
        setShowNewClaimDialog(true)
        setExpanded(false)
      },
      color: 'bg-emerald-600',
      hoverColor: 'hover:bg-emerald-700 dark:hover:bg-emerald-700',
      shortcut: 'N',
    },
    {
      id: 'export-report',
      label: 'Export Report',
      icon: Download,
      onClick: () => {
        triggerCsvExport()
        setExpanded(false)
      },
      color: 'bg-amber-600',
      hoverColor: 'hover:bg-amber-700 dark:hover:bg-amber-700',
      shortcut: 'E',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: () => {
        setActiveTab('config')
        setExpanded(false)
      },
      color: 'bg-violet-600',
      hoverColor: 'hover:bg-violet-700 dark:hover:bg-violet-700',
      mobileDisabled: true,
      mobileTooltip: 'Available on desktop',
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      onClick: () => {
        focusSearch()
        setExpanded(false)
      },
      color: 'bg-sky-600',
      hoverColor: 'hover:bg-sky-700 dark:hover:bg-sky-700',
      shortcut: '/',
    },
  ]

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  const handleBackdropClose = () => {
    setExpanded(false)
  }

  return (
    <>
      <MobileFab
        expanded={expanded}
        actions={actions}
        onToggle={handleToggle}
        onBackdropClose={handleBackdropClose}
      />
      <DesktopBar
        expanded={expanded}
        collapsed={collapsed}
        actions={actions}
        onToggle={handleToggle}
        onBackdropClose={handleBackdropClose}
        onCollapseChange={setCollapsed}
        onCommandPalette={() => setShowCommandPalette(true)}
        onShortcutsOverlay={() => setShowShortcutsOverlay(true)}
      />
    </>
  )
}
