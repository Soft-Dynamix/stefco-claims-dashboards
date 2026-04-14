'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  PlusCircle,
  Pencil,
  ArrowRightLeft,
  Printer,
  AlertCircle,
  Mail,
  Brain,
  FileSearch,
  FolderPlus,
  Save,
  ClipboardCheck,
  Send,
  Check,
  Bot,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate, formatRelativeTime } from '@/lib/helpers'

interface AuditLogEntry {
  id: string
  action: string
  details: string | null
  status: string
  claimNumber: string | null
  clientName: string | null
  processedBy: string | null
  createdAt: string
}

// Action type categorization with icons and colors
const actionTypeConfig: Record<string, { category: string; icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  CLAIM_CREATED: { category: 'create', icon: PlusCircle, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', label: 'Created' },
  CLAIM_UPDATED: { category: 'update', icon: Pencil, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'Updated' },
  STATUS_CHANGED: { category: 'status_change', icon: ArrowRightLeft, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', label: 'Status Changed' },
  DOCUMENT_PRINTED: { category: 'print', icon: Printer, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', label: 'Printed' },
  PRINT_QUEUE: { category: 'print', icon: Printer, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', label: 'Print Queue' },
  ERROR: { category: 'error', icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-950/50 border-red-200 dark:border-red-800', label: 'Error' },
  EMAIL_RECEIVED: { category: 'create', icon: Mail, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', label: 'Email Received' },
  AI_CLASSIFIED: { category: 'update', icon: Brain, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'AI Classified' },
  AI_EXTRACTED: { category: 'update', icon: FileSearch, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'Data Extracted' },
  FOLDER_CREATED: { category: 'update', icon: FolderPlus, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'Folder Created' },
  DOCUMENTS_SAVED: { category: 'update', icon: Save, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'Documents Saved' },
  CLAIM_LOGGED: { category: 'status_change', icon: ClipboardCheck, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', label: 'Logged' },
  REPLY_SENT: { category: 'update', icon: Send, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', label: 'Reply Sent' },
  CLAIM_APPROVED: { category: 'status_change', icon: Check, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', label: 'Approved' },
}

// Color map for timeline line dots by category
const categoryDotColors: Record<string, { dot: string; line: string }> = {
  create: { dot: 'bg-emerald-500', line: 'bg-emerald-300 dark:bg-emerald-700' },
  update: { dot: 'bg-sky-500', line: 'bg-sky-300 dark:bg-sky-700' },
  status_change: { dot: 'bg-amber-500', line: 'bg-amber-300 dark:bg-amber-700' },
  print: { dot: 'bg-violet-500', line: 'bg-violet-300 dark:bg-violet-700' },
  error: { dot: 'bg-red-500', line: 'bg-red-300 dark:bg-red-700' },
}

function getActionConfig(action: string) {
  const normalizedAction = action.toUpperCase().replace(/[^A-Z_]/g, '')
  // Try exact match first
  if (actionTypeConfig[normalizedAction]) return actionTypeConfig[normalizedAction]
  // Try partial match
  for (const [key, config] of Object.entries(actionTypeConfig)) {
    if (normalizedAction.includes(key) || key.includes(normalizedAction)) return config
  }
  // Default based on heuristics
  if (normalizedAction.includes('CREATE') || normalizedAction.includes('RECEIVE')) return actionTypeConfig.CLAIM_CREATED
  if (normalizedAction.includes('STATUS') || normalizedAction.includes('CHANGE')) return actionTypeConfig.STATUS_CHANGED
  if (normalizedAction.includes('PRINT')) return actionTypeConfig.DOCUMENT_PRINTED
  if (normalizedAction.includes('ERROR') || normalizedAction.includes('FAIL')) return actionTypeConfig.ERROR
  if (normalizedAction.includes('CLASSIF') || normalizedAction.includes('EXTRACT') || normalizedAction.includes('FOLDER') || normalizedAction.includes('SAVE') || normalizedAction.includes('REPLY') || normalizedAction.includes('APPROVE') || normalizedAction.includes('LOG')) return actionTypeConfig.CLAIM_UPDATED
  return actionTypeConfig.CLAIM_UPDATED
}

function TimelineSkeleton() {
  return (
    <div className="space-y-5 p-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="w-0.5 flex-1 mt-2 min-h-[32px]" />
          </div>
          <div className="flex-1 space-y-2 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineEntry({
  entry,
  isLast,
}: {
  entry: AuditLogEntry
  isLast: boolean
}) {
  const config = getActionConfig(entry.action)
  const categoryColors = categoryDotColors[config.category] || categoryDotColors.update
  const Icon = config.icon
  const isSystem = !entry.processedBy || entry.processedBy === 'SYSTEM' || entry.processedBy === 'AUTO'
  const actionLabel = entry.action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="relative flex gap-3 group card-enter">
      {/* Timeline line + node */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`relative z-10 flex items-center justify-center size-8 rounded-lg border shrink-0 transition-all duration-200 hover:scale-110 ${config.bgColor} ${config.color}`}
        >
          <Icon className="size-3.5" />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[40px] transition-colors ${categoryColors.line}`} />
        )}
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="rounded-lg border bg-background hover:shadow-sm hover:border-primary/20 transition-all duration-200 p-3 hover:translate-x-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {actionLabel}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 shrink-0 ${config.bgColor} ${config.color}`}
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
            </div>
          </div>

          {entry.details && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
              {entry.details}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-2">
            <Clock className="size-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/70">
              {formatRelativeTime(entry.createdAt)}
            </span>
            <span className="text-[10px] text-muted-foreground/40">•</span>
            <span className="text-[10px] text-muted-foreground/50">
              {formatDate(entry.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend() {
  const categories = [
    { label: 'Created', color: 'bg-emerald-500' },
    { label: 'Updated', color: 'bg-sky-500' },
    { label: 'Status Change', color: 'bg-amber-500' },
    { label: 'Print', color: 'bg-violet-500' },
    { label: 'Error', color: 'bg-red-500' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 px-1">
      {categories.map((cat) => (
        <div key={cat.label} className="flex items-center gap-1.5">
          <div className={`size-2.5 rounded-sm ${cat.color}`} />
          <span className="text-[10px] text-muted-foreground">{cat.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ClaimTimeline({ claimId }: { claimId: string }) {
  const { data, isLoading } = useQuery<{ auditLogs: AuditLogEntry[] }>({
    queryKey: ['claim-full-timeline', claimId],
    queryFn: () =>
      fetch(`/api/audit-logs?claimId=${claimId}&limit=100`).then((r) => {
        if (!r.ok) throw new Error('Failed to load timeline')
        return r.json()
      }),
    enabled: !!claimId,
    retry: 2,
    retryDelay: 1000,
  })

  const logs = useMemo(() => {
    if (!data?.auditLogs) return []
    return [...data.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [data])

  if (isLoading) return <TimelineSkeleton />

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3 breathe">
          <Clock className="size-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">No timeline events yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Activity will appear here as the claim progresses
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Legend />
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
          {logs.length} event{logs.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      <ScrollArea className="max-h-[450px] pr-2">
        <div className="space-y-0">
          {logs.map((entry, index) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={index === logs.length - 1}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
