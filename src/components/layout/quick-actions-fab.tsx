'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  FileText,
  Mail,
  Printer,
  Command,
} from 'lucide-react'
import { useClaimsStore } from '@/store/claims-store'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

interface QuickAction {
  id: string
  label: string
  icon: React.ElementType
  onClick: () => void
  color: string
  shortcut?: string
}

export function QuickActionsFab() {
  const [expanded, setExpanded] = useState(false)
  const activeTab = useClaimsStore((s) => s.activeTab)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setShowNewClaimDialog = useClaimsStore((s) => s.setShowNewClaimDialog)
  const setShowCommandPalette = useClaimsStore((s) => s.setShowCommandPalette)

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
      color: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700',
    },
    {
      id: 'email-processing',
      label: 'Email Processing',
      icon: Mail,
      onClick: () => {
        setActiveTab('email')
        setExpanded(false)
      },
      color: 'bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700',
    },
    {
      id: 'print-queue',
      label: 'Print Queue',
      icon: Printer,
      onClick: () => {
        setActiveTab('print-queue')
        setExpanded(false)
      },
      color: 'bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700',
    },
    {
      id: 'command-palette',
      label: 'Command Palette',
      icon: Command,
      onClick: () => {
        setShowCommandPalette(true)
        setExpanded(false)
      },
      color: 'bg-primary hover:bg-primary/90',
      shortcut: '⌘K',
    },
  ]

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
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
              onClick={() => setExpanded(false)}
            />

            {/* Action buttons */}
            <div className="flex flex-col items-end gap-2 relative z-50">
              {actions.map((action, index) => {
                const Icon = action.icon
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
                          className={`size-12 rounded-full shadow-lg text-white ${action.color} btn-press`}
                          onClick={action.onClick}
                        >
                          <Icon className="size-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="flex items-center gap-2">
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
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.div
        className="relative z-50"
        whileTap={{ scale: 0.9 }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={handleToggle}
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
