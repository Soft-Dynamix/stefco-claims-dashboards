'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  LayoutDashboard,
  Mail,
  FileText,
  Building2,
  ClipboardList,
  Printer,
  GitBranch,
  Settings,
  BookOpen,
  Wrench,
  Plus,
  Search,
  Moon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useClaimsStore, type TabType } from '@/store/claims-store'

interface NavItemDef {
  id: TabType
  label: string
  icon: React.ElementType
  group: string
  shortcut?: string
}

const navItems: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'MAIN', shortcut: 'D' },
  { id: 'email', label: 'Email Processing', icon: Mail, group: 'MAIN', shortcut: 'E' },
  { id: 'claims', label: 'Claims Management', icon: FileText, group: 'MAIN', shortcut: 'C' },
  { id: 'insurance', label: 'Insurance Companies', icon: Building2, group: 'MAIN', shortcut: 'I' },
  { id: 'audit', label: 'Audit Logs', icon: ClipboardList, group: 'OPERATIONS', shortcut: 'A' },
  { id: 'print-queue', label: 'Print Queue', icon: Printer, group: 'OPERATIONS', shortcut: 'P' },
  { id: 'workflow', label: 'Workflow Pipeline', icon: GitBranch, group: 'AUTOMATION', shortcut: 'W' },
  { id: 'config', label: 'System Settings', icon: Settings, group: 'SYSTEM', shortcut: 'S' },
  { id: 'setup', label: 'Setup Guide', icon: BookOpen, group: 'SYSTEM' },
  { id: 'installer', label: 'Installation Manager', icon: Wrench, group: 'SYSTEM' },
]

const groupOrder = ['MAIN', 'OPERATIONS', 'AUTOMATION', 'SYSTEM']

export function CommandPalette() {
  const showCommandPalette = useClaimsStore((s) => s.showCommandPalette)
  const setShowCommandPalette = useClaimsStore((s) => s.setShowCommandPalette)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setShowNewClaimDialog = useClaimsStore((s) => s.setShowNewClaimDialog)
  const setFilter = useClaimsStore((s) => s.setFilter)
  const { theme, setTheme } = useTheme()

  // Derive open state: either from local keyboard toggle or from store trigger
  const [localOpen, setLocalOpen] = useState(false)
  const prevShowCommandPalette = React.useRef(false)

  React.useEffect(() => {
    if (showCommandPalette && !prevShowCommandPalette.current) {
      setLocalOpen(true)
      setShowCommandPalette(false)
    }
    prevShowCommandPalette.current = showCommandPalette
  }, [showCommandPalette, setShowCommandPalette])

  const open = localOpen

  // Keyboard shortcut handler: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setLocalOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const runAction = useCallback(
    (action: () => void) => {
      action()
      setLocalOpen(false)
    },
    []
  )

  const handleNavigate = useCallback(
    (tab: TabType) => {
      runAction(() => setActiveTab(tab))
    },
    [runAction, setActiveTab]
  )

  const handleNewClaim = useCallback(() => {
    runAction(() => {
      setShowNewClaimDialog(true)
    })
  }, [runAction, setShowNewClaimDialog])

  const handleSearchClaims = useCallback(() => {
    runAction(() => {
      setActiveTab('claims')
      // Focus the search in claims view after a small delay
      setTimeout(() => {
        const searchInput = document.querySelector(
          'input[placeholder*="Search"]'
        ) as HTMLInputElement | null
        if (searchInput) searchInput.focus()
      }, 100)
    })
  }, [runAction, setActiveTab])

  const handleToggleTheme = useCallback(() => {
    runAction(() => {
      setTheme(theme === 'dark' ? 'light' : 'dark')
    })
  }, [runAction, theme, setTheme])

  // Group nav items by their group
  const groupedItems = groupOrder.map((group) => ({
    heading: group,
    items: navItems.filter((item) => item.group === group),
  }))

  return (
    <CommandDialog
      open={open}
      onOpenChange={setLocalOpen}
      title="Command Palette"
      description="Search for pages and actions..."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={handleNewClaim}>
            <Plus className="mr-2 size-4" />
            <span>New Claim</span>
          </CommandItem>
          <CommandItem onSelect={handleSearchClaims}>
            <Search className="mr-2 size-4" />
            <span>Search Claims</span>
          </CommandItem>
          <CommandItem onSelect={handleToggleTheme}>
            <Moon className="mr-2 size-4" />
            <span>Toggle Theme</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation Groups */}
        {groupedItems.map((group) => (
          <React.Fragment key={group.heading}>
            <CommandGroup heading={group.heading}>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.id}`}
                    onSelect={() => handleNavigate(item.id)}
                  >
                    <Icon className="mr-2 size-4" />
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-auto text-xs text-muted-foreground font-mono tracking-wider">
                        {item.shortcut}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {group.heading !== 'SYSTEM' && <CommandSeparator />}
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
