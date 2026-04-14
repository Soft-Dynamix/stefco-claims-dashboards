'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Mail,
  FileText,
  Brain,
  FileSearch,
  FolderPlus,
  ArrowRight,
  MessageSquare,
  Printer,
  Settings,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/ui/motion'
import { formatRelativeTime, formatDate } from '@/lib/helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string
  action: string
  details: string | null
  status: string
  claimNumber?: string | null
  clientName?: string | null
  processedBy?: string | null
  createdAt: string
}

interface ActivityTypeConfig {
  icon: React.ElementType
  dotColor: string
  ringColor: string
  iconBg: string
  iconColor: string
  label: string
}

// ─── Activity Type Configuration ─────────────────────────────────────────────

const activityTypeMap: Record<string, ActivityTypeConfig> = {
  email_received: {
    icon: Mail,
    dotColor: 'bg-sky-500',
    ringColor: 'ring-sky-500/20',
    iconBg: 'bg-sky-100 dark:bg-sky-950/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    label: 'Email Received',
  },
  claim_created: {
    icon: FileText,
    dotColor: 'bg-primary',
    ringColor: 'ring-primary/20',
    iconBg: 'bg-primary/10 dark:bg-primary/20',
    iconColor: 'text-primary',
    label: 'Claim Created',
  },
  classification: {
    icon: Brain,
    dotColor: 'bg-violet-500',
    ringColor: 'ring-violet-500/20',
    iconBg: 'bg-violet-100 dark:bg-violet-950/60',
    iconColor: 'text-violet-600 dark:text-violet-400',
    label: 'Classification',
  },
  data_extraction: {
    icon: FileSearch,
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-500/20',
    iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Data Extraction',
  },
  folder_created: {
    icon: FolderPlus,
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Folder Created',
  },
  status_change: {
    icon: ArrowRight,
    dotColor: 'bg-blue-500',
    ringColor: 'ring-blue-500/20',
    iconBg: 'bg-blue-100 dark:bg-blue-950/60',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Status Changed',
  },
  note_added: {
    icon: MessageSquare,
    dotColor: 'bg-sky-400',
    ringColor: 'ring-sky-400/20',
    iconBg: 'bg-sky-100 dark:bg-sky-950/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
    label: 'Note Added',
  },
  print_queued: {
    icon: Printer,
    dotColor: 'bg-orange-500',
    ringColor: 'ring-orange-500/20',
    iconBg: 'bg-orange-100 dark:bg-orange-950/60',
    iconColor: 'text-orange-600 dark:text-orange-400',
    label: 'Print Queued',
  },
  system: {
    icon: Settings,
    dotColor: 'bg-muted-foreground/60',
    ringColor: 'ring-muted-foreground/10',
    iconBg: 'bg-muted dark:bg-muted/50',
    iconColor: 'text-muted-foreground',
    label: 'System',
  },
}

// Status-based dot overrides for status_change type
const statusDotColors: Record<string, string> = {
  SUCCESS: 'bg-emerald-500',
  COMPLETED: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  PROCESSING: 'bg-amber-500',
  MANUAL_REVIEW: 'bg-orange-500',
  PENDING_REVIEW: 'bg-orange-500',
  ERROR: 'bg-red-500',
  FAILED: 'bg-red-500',
  NEW: 'bg-sky-500',
}

// ─── Action-to-Type Mapping ─────────────────────────────────────────────────

function classifyAction(action: string): string {
  const normalized = action.toUpperCase().replace(/[^A-Z_]/g, '')

  if (normalized.includes('EMAIL') && (normalized.includes('RECEIVE') || normalized.includes('INCOMING'))) {
    return 'email_received'
  }
  if (normalized.includes('CLAIM') && normalized.includes('CREATE')) {
    return 'claim_created'
  }
  if (normalized.includes('CLASSIF') || normalized.includes('AI_CLASSIF')) {
    return 'classification'
  }
  if (normalized.includes('EXTRACT') || normalized.includes('DATA') || normalized.includes('AI_EXTRACT')) {
    return 'data_extraction'
  }
  if (normalized.includes('FOLDER') && normalized.includes('CREATE')) {
    return 'folder_created'
  }
  if (normalized.includes('STATUS') || normalized.includes('CHANGE') || normalized.includes('APPROVE') || normalized.includes('REJECT') || normalized.includes('LOG')) {
    return 'status_change'
  }
  if (normalized.includes('NOTE') || normalized.includes('COMMENT')) {
    return 'note_added'
  }
  if (normalized.includes('PRINT') || normalized.includes('QUEUE')) {
    return 'print_queued'
  }
  return 'system'
}

function getActivityConfig(entry: ActivityEntry): ActivityTypeConfig {
  const type = classifyAction(entry.action)
  const config = activityTypeMap[type] || activityTypeMap.system

  // Override dot color for status_change based on status
  if (type === 'status_change' && entry.status) {
    const dotOverride = statusDotColors[entry.status.toUpperCase()]
    if (dotOverride) {
      return { ...config, dotColor: dotOverride }
    }
  }

  return config
}

// ─── Status Dot Colors (for the timeline line dots) ─────────────────────────

function getTimelineLineColor(status: string): string {
  const s = status.toUpperCase()
  if (s === 'SUCCESS' || s === 'COMPLETED') return 'bg-emerald-300 dark:bg-emerald-700'
  if (s === 'WARNING' || s === 'PROCESSING' || s === 'PENDING_REVIEW' || s === 'MANUAL_REVIEW') return 'bg-amber-300 dark:bg-amber-700'
  if (s === 'ERROR' || s === 'FAILED') return 'bg-red-300 dark:bg-red-700'
  return 'bg-muted-foreground/20 dark:bg-muted-foreground/20'
}

// ─── Format helpers ──────────────────────────────────────────────────────────

function formatTimelineDate(dateStr: string): { time: string; date: string; relative: string } {
  const date = new Date(dateStr)
  return {
    time: date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
    date: date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
    relative: formatRelativeTime(dateStr),
  }
}

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Timeline Skeleton ──────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="px-1 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-stretch gap-4 mb-4">
          {/* Timestamp skeleton */}
          <div className="w-20 shrink-0 text-right pt-1">
            <Skeleton className="h-3 w-12 ml-auto" />
            <Skeleton className="h-3 w-10 ml-auto mt-1.5" />
          </div>
          {/* Dot skeleton */}
          <div className="flex flex-col items-center shrink-0 pt-1">
            <Skeleton className="size-8 rounded-full" />
            {i < 4 && <Skeleton className="w-0.5 flex-1 mt-2 min-h-[32px]" />}
          </div>
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 pb-4">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-64 mt-2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single Timeline Item ────────────────────────────────────────────────────

function TimelineItem({
  entry,
  isLast,
  index,
}: {
  entry: ActivityEntry
  isLast: boolean
  index: number
}) {
  const config = getActivityConfig(entry)
  const Icon = config.icon
  const { time, date, relative } = formatTimelineDate(entry.createdAt)
  const lineColor = getTimelineLineColor(entry.status)
  const isSystem = !entry.processedBy || entry.processedBy === 'SYSTEM' || entry.processedBy === 'AUTO'
  const actionLabel = formatActionLabel(entry.action)

  return (
    <FadeIn delay={Math.min(index * 0.04, 0.4)}>
      <div className="group flex items-stretch gap-4 mb-0">
        {/* ── Left: Timestamps ── */}
        <div className="w-20 shrink-0 text-right pt-0.5 hidden sm:block">
          <span className="text-xs font-medium text-foreground/80">{time}</span>
          <br />
          <span className="text-[10px] text-muted-foreground">{date}</span>
        </div>

        {/* ── Center: Timeline Dot + Line ── */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className={`
              relative z-10 flex items-center justify-center size-8 rounded-full shrink-0
              ring-2 ${config.ringColor}
              bg-background border border-border
              transition-all duration-300 group-hover:scale-110 group-hover:shadow-md
              ${config.dotColor} shadow-[0_0_0_3px_currentColor]
              [&]:shadow-[0_0_0_3px_var(--tw-shadow-color)]
            `}
            style={{ '--tw-shadow-color': `${config.dotColor.replace('bg-', 'oklch(var(--')}` } as React.CSSProperties}
          >
            <div className={`flex items-center justify-center size-7 rounded-full ${config.iconBg}`}>
              <Icon className={`size-3.5 ${config.iconColor}`} />
            </div>
          </div>
          {!isLast && (
            <div className={`w-0.5 flex-1 min-h-[20px] mt-1 ${lineColor} transition-colors duration-300`} />
          )}
        </div>

        {/* ── Right: Event Details ── */}
        <div className="flex-1 min-w-0 pb-5">
          <div
            className="
              rounded-lg border bg-background p-3
              transition-all duration-200
              hover:border-primary/20 hover:shadow-sm
              group-hover:translate-x-0.5
            "
          >
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {actionLabel}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 ${config.iconBg} ${config.iconColor} border-transparent`}
              >
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                {isSystem ? (
                  <span className="flex items-center gap-1">
                    <Bot className="size-2.5" /> System
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <User className="size-2.5" /> {entry.processedBy || 'System'}
                  </span>
                )}
              </Badge>
              {/* Status indicator */}
              {entry.status && entry.status !== 'SUCCESS' && (
                <Badge
                  variant="outline"
                  className={`text-[10px] h-4 px-1.5 shrink-0 ${
                    entry.status === 'ERROR' || entry.status === 'FAILED'
                      ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
                      : entry.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {entry.status === 'ERROR' || entry.status === 'FAILED' ? (
                    <AlertCircle className="size-2.5 mr-0.5" />
                  ) : entry.status === 'WARNING' ? (
                    <AlertCircle className="size-2.5 mr-0.5" />
                  ) : null}
                  {entry.status}
                </Badge>
              )}
            </div>

            {/* Details text */}
            {entry.details && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                {entry.details}
              </p>
            )}

            {/* Footer with timestamps */}
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/60">
              <Clock className="size-2.5" />
              <span>{relative}</span>
              <span className="opacity-40">·</span>
              <span>{formatDate(entry.createdAt)}</span>
              {/* Mobile-only timestamp */}
              <span className="sm:hidden opacity-40">·</span>
              <span className="sm:hidden">{time}</span>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function TimelineLegend({ entries }: { entries: ActivityEntry[] }) {
  // Compute which types are actually present
  const presentTypes = useMemo(() => {
    const types = new Set<string>()
    entries.forEach((entry) => {
      types.add(classifyAction(entry.action))
    })
    return Array.from(types)
  }, [entries])

  if (presentTypes.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 px-1">
      {presentTypes.map((type) => {
        const config = activityTypeMap[type]
        if (!config) return null
        const Icon = config.icon
        return (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${config.dotColor}`} />
            <span className="text-[10px] text-muted-foreground">{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <FadeIn>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4 animate-pulse">
          <Clock className="size-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No activity recorded</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
          Activity will appear here as the claim moves through processing stages
        </p>
      </div>
    </FadeIn>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ClaimActivityTimeline({ claimId }: { claimId: string }) {
  // Fetch claim-specific audit logs
  const { data: auditData, isLoading: auditLoading, error: auditError } = useQuery<{
    auditLogs: ActivityEntry[]
  }>({
    queryKey: ['claim-activity-audit', claimId],
    queryFn: () =>
      fetch(`/api/audit-logs?claimId=${claimId}&limit=100`).then((r) => {
        if (!r.ok) throw new Error('Failed to load audit logs')
        return r.json()
      }),
    enabled: !!claimId,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30_000,
  })

  // Fetch general activity feed (for cross-referencing)
  const { data: activityData } = useQuery<{
    activities: ActivityEntry[]
  }>({
    queryKey: ['claim-activity-feed', claimId],
    queryFn: () =>
      fetch('/api/activity-feed').then((r) => {
        if (!r.ok) throw new Error('Failed to load activity feed')
        return r.json()
      }),
    enabled: !!claimId,
    retry: 1,
    staleTime: 60_000,
  })

  // Merge and deduplicate entries
  const entries = useMemo(() => {
    const seenIds = new Set<string>()
    const merged: ActivityEntry[] = []

    // Prioritize claim-specific audit logs
    const auditLogs = auditData?.auditLogs || []
    for (const log of auditLogs) {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id)
        merged.push(log)
      }
    }

    // Add matching entries from activity feed
    const activities = activityData?.activities || []
    for (const activity of activities) {
      if (!seenIds.has(activity.id)) {
        seenIds.add(activity.id)
        merged.push(activity)
      }
    }

    // Sort newest first
    return merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [auditData, activityData])

  if (auditLoading) return <TimelineSkeleton />
  if (auditError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <AlertCircle className="size-5 text-red-400 mb-2" />
        <p className="text-sm text-muted-foreground">Failed to load activity</p>
      </div>
    )
  }

  if (entries.length === 0) return <EmptyState />

  return (
    <FadeIn>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <TimelineLegend entries={entries} />
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
          {entries.length} event{entries.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Timeline */}
      <div className="max-h-[400px] overflow-y-auto scrollbar-glass pr-2">
        {entries.map((entry, index) => (
          <TimelineItem
            key={entry.id}
            entry={entry}
            isLast={index === entries.length - 1}
            index={index}
          />
        ))}
      </div>
    </FadeIn>
  )
}
