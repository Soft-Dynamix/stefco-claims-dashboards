'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  User,
  Bot,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate, formatRelativeTime, getStatusLabel, getStatusColor } from '@/lib/helpers'

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

const statusDotConfig: Record<string, { dot: string; ring: string }> = {
  SUCCESS: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  WARNING: { dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
  ERROR: { dot: 'bg-red-500', ring: 'ring-red-500/30' },
  INFO: { dot: 'bg-sky-500', ring: 'ring-sky-500/30' },
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="w-0.5 flex-1 mt-1" />
          </div>
          <div className="flex-1 space-y-2 pb-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineNode({
  entry,
  isFirst,
  isLast,
  isCurrent,
}: {
  entry: AuditLogEntry
  isFirst: boolean
  isLast: boolean
  isCurrent: boolean
}) {
  const dotConfig = statusDotConfig[entry.status] || statusDotConfig.INFO
  const isSystem = !entry.processedBy || entry.processedBy === 'SYSTEM'

  return (
    <div className="relative flex gap-4 group">
      {/* Timeline Line + Dot */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`relative z-10 flex items-center justify-center size-4 rounded-full shrink-0 transition-all ${
            isCurrent
              ? `${dotConfig.dot} ring-4 ${dotConfig.ring} animate-pulse`
              : dotConfig.dot
          }`}
        >
          {isCurrent && (
            <div className={`absolute inset-0 rounded-full ${dotConfig.dot} opacity-30 animate-ping`} />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[40px] ${
              isCurrent ? 'bg-primary/30' : 'bg-border'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 pb-4 ${isCurrent ? 'bg-primary/3 rounded-lg p-3 -mx-1 border border-primary/10' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {entry.action
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
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
          <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap shrink-0">
            {formatRelativeTime(entry.createdAt)}
          </span>
        </div>

        {entry.details && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {entry.details}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock className="size-3 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50">
            {formatDate(entry.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ClaimStatusTimeline({ claimId }: { claimId: string }) {
  const { data, isLoading } = useQuery<{ logs: AuditLogEntry[] }>({
    queryKey: ['claim-audit-timeline', claimId],
    queryFn: () =>
      fetch(`/api/audit-logs?claimId=${claimId}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load timeline')
        return r.json()
      }),
    enabled: !!claimId,
    retry: 2,
    retryDelay: 1000,
  })

  const logs = data?.logs || []

  if (isLoading) return <TimelineSkeleton />

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
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
    <ScrollArea className="max-h-[400px] pr-2">
      <div className="space-y-0">
        {logs.map((entry, index) => (
          <TimelineNode
            key={entry.id}
            entry={entry}
            isFirst={index === 0}
            isLast={index === logs.length - 1}
            isCurrent={index === 0}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
