'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Shield,
  LayoutDashboard,
  Mail,
  FileText,
  Building2,
  ClipboardList,
  Printer,
  GitBranch,
  Settings,
  Search,
  Menu,
  X,
  BookOpen,
  Wrench,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap,
  BrainCircuit,
} from 'lucide-react'
import DailyEmailReview from '@/components/review/daily-email-review'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { NotificationDropdown } from '@/components/layout/notification-dropdown'
import { CommandPalette } from '@/components/layout/command-palette'
import { KeyboardShortcuts } from '@/components/layout/keyboard-shortcuts'
import { ShortcutsOverlay } from '@/components/layout/shortcuts-overlay'
import { AIChatPanel } from '@/components/layout/ai-chat-panel'
import { QuickActionsFab } from '@/components/layout/quick-actions-fab'
import { QuickStatsTooltip } from '@/components/dashboard/quick-stats-tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FadeIn } from '@/components/ui/motion'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useClaimsStore, type TabType } from '@/store/claims-store'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { EmailProcessingView } from '@/components/dashboard/email-processing-view'
import { ClaimsView } from '@/components/claims/claims-view'
import { InsuranceView } from '@/components/dashboard/insurance-view'
import { AuditView } from '@/components/dashboard/audit-view'
import { PrintQueueView } from '@/components/dashboard/print-queue-view'
import { WorkflowView } from '@/components/dashboard/workflow-view'
import { ConfigView } from '@/components/dashboard/config-view'
import { SetupGuideView } from '@/components/dashboard/setup-guide-view'
import { InstallationManagerView } from '@/components/dashboard/installation-manager-view'

const navItems: { id: TabType; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview of claims KPIs and metrics' },
  { id: 'email', label: 'Email Processing', icon: Mail, description: 'Incoming email classification and routing' },
  { id: 'claims', label: 'Claims', icon: FileText, description: 'Manage and review insurance claims' },
  { id: 'insurance', label: 'Insurance Companies', icon: Building2, description: 'Configure insurance company folders' },
  { id: 'audit', label: 'Audit Logs', icon: ClipboardList, description: 'Track system actions and changes' },
  { id: 'print-queue', label: 'Print Queue', icon: Printer, description: 'Manage document print jobs' },
  { id: 'workflow', label: 'Workflow', icon: GitBranch, description: 'View workflow pipeline status' },
  { id: 'config', label: 'Settings', icon: Settings, description: 'System configuration and preferences' },
  { id: 'setup', label: 'Setup Guide', icon: BookOpen, description: 'Deployment and setup instructions' },
  { id: 'installer', label: 'Install Manager', icon: Wrench, description: 'Component installation and updates' },
]

const pageTitles: Record<TabType, string> = {
  dashboard: 'Dashboard',
  email: 'Email Processing',
  claims: 'Claims Management',
  insurance: 'Insurance Companies',
  audit: 'Audit Logs',
  'print-queue': 'Print Queue',
  workflow: 'Workflow Pipeline',
  config: 'System Settings',
  setup: 'Setup & Deployment Guide',
  installer: 'Installation Manager',
}

const navSections = [
  { label: 'MAIN', items: navItems.slice(0, 4), dividerAfter: true },
  { label: 'OPERATIONS', items: navItems.slice(4, 6), dividerAfter: true },
  { label: 'AUTOMATION', items: navItems.slice(6, 7), dividerAfter: true },
  { label: 'SYSTEM', items: navItems.slice(7, 10), dividerAfter: false },
]

function SidebarNav({
  onItemClick,
  activeTab,
}: {
  onItemClick: (tab: TabType) => void
  activeTab: TabType
}) {
  const { data: activeClaimsData } = useQuery<{ total: number }>({
    queryKey: ['active-claims-count'],
    queryFn: () => fetch('/api/claims?status=NEW,PROCESSING,MANUAL_REVIEW,PENDING_REVIEW&limit=0').then((r) => { if (!r.ok) return { total: 0 }; return r.json() }),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  })
  const activeClaimsCount = activeClaimsData?.total ?? 0

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navSections.map((section, sectionIdx) => (
        <React.Fragment key={sectionIdx}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-4 pt-3 pb-1">
            {section.label}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            const showBadge = item.id === 'claims' && activeClaimsCount > 0
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      onItemClick(item.id)
                    }}
                    className={`relative flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-all duration-200 cursor-pointer nav-indicator w-full link-animated hover-underline-center btn-press ${
                      isActive
                        ? 'bg-primary/8 text-primary sidebar-active-glow shadow-glow nav-item-active sidebar-active-indicator'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:pl-5 transition-colors'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_8px_oklch(0.72_0.12_165/30%)] nav-active-indicator" />
                    )}
                    <Icon className="size-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {showBadge && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 leading-none">
                        {activeClaimsCount > 99 ? '99+' : activeClaimsCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="tooltip-arrow-sm">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {section.dividerAfter && sectionIdx < navSections.length - 1 && (
            <Separator className="my-2 opacity-50" />
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const activeTab = useClaimsStore((s) => s.activeTab)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const handleNav = (tab: TabType) => {
    setActiveTab(tab)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <div className="bg-gradient-to-b from-primary/8 to-transparent px-4 pt-5 pb-4 scroll-indicator">
          <div className="flex items-center gap-3">
            <Shield className="size-8 text-primary animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-foreground leading-tight glow-text gradient-text-primary">Stefco</h2>
                <Badge variant="outline" className="text-[10px] px-1.5 h-4">v3.0.3</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-tight">Claims Dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <SidebarNav onItemClick={handleNav} activeTab={activeTab} />
        </div>
        <div className="border-t px-4 py-3 space-y-2">
          <div className="flex justify-center">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            © {new Date().getFullYear()} Stefco Consultants
            <Sparkles className="size-3 text-primary" />
            <span>AI-Powered</span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DesktopSidebar() {
  const activeTab = useClaimsStore((s) => s.activeTab)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  return (
    <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:inset-y-0 lg:z-30 border-r shadow-card noise-bg sidebar-glow-border sidebar-glass card-lift shadow-soft glass-card" style={{ position: 'fixed' }}>
      <div className="animated-gradient bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 rounded-xl mx-4 mt-4 p-5 border-b-0 hover-zoom">
        <div className="flex items-center gap-3">
          <Shield className="size-9 text-primary animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-foreground leading-tight glow-text gradient-text-primary">Stefco</h1>
              <Badge variant="outline" className="text-[10px] px-1.5 h-4">v3.0.3</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-tight">Claims Dashboard</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-5 custom-scrollbar">
        <SidebarNav onItemClick={setActiveTab} activeTab={activeTab} />
      </div>
      <div className="border-t px-4 py-3 space-y-2">
        <div className="flex justify-center">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          © {new Date().getFullYear()} Stefco Consultants
          <Sparkles className="size-3 text-primary" />
          <span>AI-Powered</span>
        </p>
      </div>
    </aside>
  )
}

function HeaderLiveStats() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const { data } = useQuery<{
    totalClaims: number
    weeklyChange: number
    overdueClaims: number
    averageConfidenceScore: number
  }>({
    queryKey: ['header-live-stats'],
    queryFn: () => fetch('/api/dashboard').then((r) => { if (!r.ok) return null; return r.json() }),
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 1000,
  })

  return (
    <FadeIn delay={0.1} className="hidden md:flex items-center gap-2">
      <button
        onClick={() => setActiveTab('claims')}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <FileText className="size-3" />
        <span>{data?.totalClaims ?? '—'}</span>
        {data && data.weeklyChange !== 0 && (
          <span className={`flex items-center gap-0.5 ${data.weeklyChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {data.weeklyChange >= 0 ? (
              <TrendingUp className="size-2.5" />
            ) : (
              <TrendingDown className="size-2.5" />
            )}
            <span>{Math.abs(data.weeklyChange)}%</span>
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('claims')}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
          data && data.overdueClaims > 0
            ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`}
      >
        {data && data.overdueClaims > 0 ? (
          <AlertTriangle className="size-3" />
        ) : (
          <span className="size-2 rounded-full bg-emerald-500" />
        )}
        <span>{data?.overdueClaims ?? 0} overdue</span>
      </button>

      <button
        onClick={() => setActiveTab('dashboard')}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1">
          <div className="w-8 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (data?.averageConfidenceScore ?? 0) >= 75
                  ? 'bg-emerald-500'
                  : (data?.averageConfidenceScore ?? 0) >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${data?.averageConfidenceScore ?? 0}%` }}
            />
          </div>
          <span>{data?.averageConfidenceScore ?? 0}%</span>
        </div>
      </button>
    </FadeIn>
  )
}

function HeaderClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const timeStr = now.toLocaleTimeString('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      setTime(timeStr)
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground tabular-nums select-none chip">
      {time}
    </span>
  )
}

function DailyReviewButton() {
  const [reviewOpen, setReviewOpen] = useState(false)

  const { data: reviewData } = useQuery({
    queryKey: ['review-unreviewed-count'],
    queryFn: async () => {
      const res = await fetch('/api/review/daily')
      if (!res.ok) return { summary: { total: 0, reviewed: 0, unreviewed: 0 } }
      return res.json()
    },
    staleTime: 15000,
    refetchInterval: 60000,
  })

  const unreviewed = reviewData?.summary?.unreviewed ?? 0
  const total = reviewData?.summary?.total ?? 0

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative btn-press"
        onClick={() => setReviewOpen(true)}
      >
        <BrainCircuit className="size-5" />
        {unreviewed > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 shadow-sm">
            {unreviewed > 99 ? '99+' : unreviewed}
          </span>
        )}
        <span className="sr-only">Daily Email Review ({unreviewed} unreviewed)</span>
      </Button>
      <DailyEmailReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </>
  )
}

function TopHeader() {
  const activeTab = useClaimsStore((s) => s.activeTab)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setFilter = useClaimsStore((s) => s.setFilter)
  const sidebarOpen = useClaimsStore((s) => s.sidebarOpen)
  const setSidebarOpen = useClaimsStore((s) => s.setSidebarOpen)
  const [headerSearch, setHeaderSearch] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchExpanded])

  const handleHeaderSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setActiveTab('claims')
      setFilter('search', headerSearch)
      setHeaderSearch('')
      setSearchExpanded(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.04)] card-glass-frost shadow-soft">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden btn-press"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">Toggle sidebar</span>
        </Button>

        <h2 className="text-xl font-semibold text-foreground hidden sm:block">
          {pageTitles[activeTab]}
        </h2>

        <HeaderLiveStats />

        <div className="ml-auto flex items-center gap-3">
          {/* Mobile search toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden btn-press"
            onClick={() => setSearchExpanded(!searchExpanded)}
          >
            {searchExpanded ? <X className="size-5" /> : <Search className="size-5" />}
            <span className="sr-only">Search</span>
          </Button>

          {/* Mobile expandable search */}
          <div className={
            `md:hidden absolute inset-x-0 top-16 z-10 bg-background border-b px-5 transition-all duration-300 ease-in-out overflow-hidden ${
              searchExpanded ? 'max-h-20 py-3 opacity-100' : 'max-h-0 py-0 opacity-0'
            }`
          }>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search claims..."
                className="pl-9 pr-4 w-full h-10 text-sm focus-visible:ring-1 focus-ring-primary"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={handleHeaderSearch}
              />
            </div>
          </div>

          {/* Desktop search bar */}
          <div className="relative hidden md:block focus-within-glow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              placeholder="Search claims..."
              className="pl-9 pr-16 w-72 h-10 text-sm focus-visible:ring-1 focus-modern input-focus focus-ring-primary"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              onKeyDown={handleHeaderSearch}
            />
            <Badge
              variant="secondary"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 px-1.5 text-[10px] font-mono text-muted-foreground pointer-events-none select-none"
            >
              ⌘K
            </Badge>
          </div>

          {/* Quick Stats Tooltip */}
          <QuickStatsTooltip />
          <DailyReviewButton />
          <NotificationDropdown />

          <HeaderClock />

          <ThemeToggle />
        </div>
      </div>

    </header>
  )
}



function ActiveView() {
  const activeTab = useClaimsStore((s) => s.activeTab)

  switch (activeTab) {
    case 'dashboard':
      return <DashboardView />
    case 'email':
      return <EmailProcessingView />
    case 'claims':
      return <ClaimsView />
    case 'insurance':
      return <InsuranceView />
    case 'audit':
      return <AuditView />
    case 'print-queue':
      return <PrintQueueView />
    case 'workflow':
      return <WorkflowView />
    case 'config':
      return <ConfigView />
    case 'setup':
      return <SetupGuideView />
    case 'installer':
      return <InstallationManagerView />
    default:
      return <DashboardView />
  }
}

function FooterStats() {
  const { data } = useQuery<{
    totalClaims: number
    claimsByStatus: Record<string, number>
    averageConfidenceScore: number
    claimsToday: number
  }>({
    queryKey: ['footer-stats'],
    queryFn: () => fetch('/api/dashboard').then((r) => { if (!r.ok) return null; return r.json() }),
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 1000,
  })

  const activeClaims = data?.claimsByStatus
    ? Object.entries(data.claimsByStatus)
        .filter(([status]) => status !== 'COMPLETED')
        .reduce((sum, [, count]) => sum + count, 0)
    : null

  return (
    <footer className="relative glass-card mt-auto shadow-soft">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 via-30% to-transparent separator-gradient" />

      {/* Quick Stats Summary Row */}
      <div className="border-b px-5 lg:px-8 py-2.5">
        <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <Activity className="size-3.5 text-primary" />
            <span className="text-muted-foreground">Active Claims:</span>
            <span className="font-semibold text-foreground">{activeClaims ?? '—'}</span>
          </div>
          <Separator orientation="vertical" className="h-3 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap className="size-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Avg AI Confidence:</span>
            <span className={`font-semibold ${data && data.averageConfidenceScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : data && data.averageConfidenceScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {data?.averageConfidenceScore ?? '—'}%
            </span>
          </div>
          <Separator orientation="vertical" className="h-3 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Mail className="size-3.5 text-sky-500" />
            <span className="text-muted-foreground">Processed Today:</span>
            <span className="font-semibold text-foreground">{data?.claimsToday ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 lg:px-8 py-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Stefco Consultants (Pty) Ltd
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-none">
          <span className="flex items-center gap-1.5 shrink-0">
            <div className="size-2 rounded-full bg-emerald-500 pulse-dot shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            System Online
          </span>
          <Separator orientation="vertical" className="h-3 shrink-0" />
          <span className="shrink-0">{data?.totalClaims ?? '—'} Claims Processed</span>
          <Separator orientation="vertical" className="h-3 shrink-0" />
          <span className="shrink-0 badge-soft">AI-Powered Automation</span>
          <Separator orientation="vertical" className="h-3 shrink-0" />
          <span className="shrink-0">v3.0.3</span>
        </div>
      </div>
    </footer>
  )
}

export default function AppLayout() {
  const sidebarOpen = useClaimsStore((s) => s.sidebarOpen)
  const setSidebarOpen = useClaimsStore((s) => s.setSidebarOpen)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30 overflow-x-hidden">
      <DesktopSidebar />
      <MobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <KeyboardShortcuts />
      <ShortcutsOverlay />
      <CommandPalette />

      <div className="lg:pl-72 flex flex-col flex-1">
        <TopHeader />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 custom-scrollbar p-mobile-safe overflow-x-hidden relative z-0 scroll-indicator page-transition">
          <ActiveView />
        </main>

        <FooterStats />
      </div>

      <AIChatPanel />
      <QuickActionsFab />
    </div>
  )
}
