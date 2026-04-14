'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  Check,
  AlertTriangle,
  Info,
  X,
  ShieldCheck,
  RefreshCw,
  FileText,
  Settings,
  AlertOctagon,
  Inbox,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/helpers'

// ─── Types ────────────────────────────────────────────────────────────────────────

type NotificationType = 'success' | 'warning' | 'info' | 'error'
type NotificationCategory = 'all' | 'claims' | 'system' | 'alerts'

interface NotificationEntry {
  id: string
  action: string
  title: string
  description: string
  type: NotificationType
  category: string
  status: string
  createdAt: string
  read: boolean
  claim?: {
    claimNumber: string
    clientName: string
    claimType: string
    status: string
  } | null
}

interface CategoryTab {
  key: NotificationCategory
  label: string
  icon: React.ElementType
}

// ─── Constants ────────────────────────────────────────────────────────────────────

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'claims', label: 'Claims', icon: FileText },
  { key: 'system', label: 'System', icon: Settings },
  { key: 'alerts', label: 'Alerts', icon: AlertOctagon },
]

const ICON_MAP: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/50' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/50' },
  error: { icon: X, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/50' },
  info: { icon: Info, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-950/50' },
}

const EMPTY_STATE_MAP: Record<NotificationCategory, { icon: React.ElementType; title: string; subtitle: string }> = {
  all: { icon: ShieldCheck, title: 'All caught up', subtitle: 'No new notifications' },
  claims: { icon: FileText, title: 'No claim updates', subtitle: 'Claim notifications will appear here' },
  system: { icon: Settings, title: 'System is quiet', subtitle: 'No system notifications right now' },
  alerts: { icon: ShieldCheck, title: 'No alerts', subtitle: "Everything is running smoothly" },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="size-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          {i < 4 && <Separator />}
        </div>
      ))}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────────

function NotificationError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <div className="size-12 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center mb-3">
        <AlertTriangle className="size-5 text-red-500" />
      </div>
      <p className="text-sm font-medium">Could not load notifications</p>
      <p className="text-xs text-muted-foreground/60 mt-1 mb-3">
        Check your connection and try again
      </p>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onRetry}>
        <RefreshCw className="size-3" />
        Retry
      </Button>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────────

function EmptyState({ category }: { category: NotificationCategory }) {
  const { icon: EmptyIcon, title, subtitle } = EMPTY_STATE_MAP[category]

  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <EmptyIcon className="size-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>
    </div>
  )
}

// ─── Notification Item ────────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  isRead,
  onMarkRead,
}: {
  notification: NotificationEntry
  isRead: boolean
  onMarkRead: (id: string) => void
}) {
  const { icon: TypeIcon, color, bg } = ICON_MAP[notification.type]
  const claimNumber = notification.claim?.claimNumber

  return (
    <button
      onClick={() => onMarkRead(notification.id)}
      className={cn(
        'w-full text-left px-4 py-3 transition-all duration-150 flex items-start gap-3 group relative btn-press-enhanced',
        !isRead
          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
          : 'hover:bg-muted/50'
      )}
    >
      {/* Unread dot indicator */}
      {!isRead && (
        <span className="absolute top-4 left-1.5 size-2 rounded-full bg-primary animate-pulse" />
      )}

      {/* Type icon */}
      <div
        className={cn(
          'mt-0.5 shrink-0 size-9 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105',
          bg,
          !isRead && 'ring-2 ring-background shadow-sm'
        )}
      >
        <TypeIcon className={cn('size-4', color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm leading-tight truncate',
              !isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
            )}
          >
            {notification.title}
          </p>
          {claimNumber && (
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] h-4 px-1.5 font-mono"
            >
              {claimNumber}
            </Badge>
          )}
        </div>
        {notification.description && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.description}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all')

  const { data, isLoading, isError, refetch } = useQuery<{
    notifications: NotificationEntry[]
    unreadCount: number
    summary: {
      total: number
      errorCount: number
      warningCount: number
      successCount: number
      infoCount: number
      categories: { claims: number; system: number; alerts: number }
    }
  }>({
    queryKey: ['notifications'],
    queryFn: () =>
      fetch('/api/notifications?limit=20').then((r) => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`)
        return r.json()
      }),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Filter notifications by active category
  const notifications = useMemo(() => {
    const items = data?.notifications ?? []
    if (activeCategory === 'all') return items
    return items.filter((n) => n.category === activeCategory)
  }, [data, activeCategory])

  // Count unread (errors + warnings that haven't been marked read)
  const unreadCount = useMemo(() => {
    return (data?.notifications ?? []).filter((n) => {
      if (readIds.has(n.id)) return false
      return n.type === 'error' || n.type === 'warning'
    }).length
  }, [data, readIds])

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    const items = data?.notifications ?? []
    return {
      all: items.length,
      claims: items.filter((n) => n.category === 'claims').length,
      system: items.filter((n) => n.category === 'system').length,
      alerts: items.filter((n) => n.category === 'alerts').length,
    }
  }, [data])

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id))
  }, [])

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      ;(data?.notifications ?? []).forEach((n) => next.add(n.id))
      return next
    })
  }, [data])

  const handleRetry = useCallback(() => {
    refetch()
  }, [refetch])

  // Whether there are any unread items in the current category filter
  const hasUnreadInCategory = useMemo(() => {
    return notifications.some((n) => !readIds.has(n.id))
  }, [notifications, readIds])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 relative icon-btn-glow"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full pointer-events-none notification-ping"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications ({unreadCount} unread)</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[360px] p-0 shadow-elevated glass-card"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px] px-1.5 font-semibold">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasUnreadInCategory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary gap-1"
                onClick={markAllAsRead}
              >
                <CheckCheck className="size-3" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center gap-0.5">
            {CATEGORY_TABS.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeCategory === tab.key
              const count = categoryCounts[tab.key]

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveCategory(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 relative',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <TabIcon className="size-3" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-[10px] tabular-nums',
                        isActive ? 'text-primary/70' : 'text-muted-foreground/50'
                      )}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-[min(384px,calc(100vh-220px))] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <NotificationSkeleton />
          ) : isError ? (
            <NotificationError onRetry={handleRetry} />
          ) : notifications.length === 0 ? (
            <EmptyState category={activeCategory} />
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification, index) => {
                const isRead = notification.read || readIds.has(notification.id)
                return (
                  <div key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      isRead={isRead}
                      onMarkRead={markAsRead}
                    />
                    {index < notifications.length - 1 && <Separator />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Auto-refreshing every 30s
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
