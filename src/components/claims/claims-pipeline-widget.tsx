'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Workflow } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getStatusColor, getStatusLabel } from '@/lib/helpers'
import { useClaimsStore } from '@/store/claims-store'

const PIPELINE_STATUSES = ['NEW', 'PROCESSING', 'MANUAL_REVIEW', 'PENDING_REVIEW', 'COMPLETED'] as const

const STATUS_NODE_COLORS: Record<string, { bg: string; border: string; dot: string; connector: string }> = {
  NEW: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
    connector: '#0ea5e9',
  },
  PROCESSING: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    connector: '#f59e0b',
  },
  MANUAL_REVIEW: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    connector: '#f97316',
  },
  PENDING_REVIEW: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
    connector: '#8b5cf6',
  },
  COMPLETED: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    connector: '#10b981',
  },
}

interface StatusCounts {
  [key: string]: number
}

function PipelineSkeleton() {
  return (
    <Card className="py-5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="size-14 rounded-xl" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-8" />
              </div>
              {i < 5 && <Skeleton className="size-6 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PipelineNode({
  status,
  count,
  index,
  total,
}: {
  status: string
  count: number
  index: number
  total: number
}) {
  const isActive = count > 0
  const colors = STATUS_NODE_COLORS[status] || STATUS_NODE_COLORS.NEW
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setFilter = useClaimsStore((s) => s.setFilter)

  const handleClick = () => {
    setActiveTab('claims')
    setFilter('status', status)
  }

  return (
    <React.Fragment>
      <button
        onClick={handleClick}
        className={`flex flex-col items-center gap-2 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl p-3 transition-all duration-200 hover:bg-muted/30 ${
          isActive ? 'pipeline-node-active' : ''
        }`}
        title={`${getStatusLabel(status)}: ${count} claims`}
      >
        {/* Node circle */}
        <div
          className={`relative flex items-center justify-center size-14 rounded-xl border-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${
            isActive
              ? `${colors.bg} ${colors.border} shadow-sm`
              : 'bg-muted/30 border-border/50'
          }`}
        >
          {/* Status dot */}
          <div
            className={`size-3 rounded-full transition-all duration-300 ${
              isActive ? colors.dot : 'bg-muted-foreground/30'
            }`}
          />
          {/* Active pulse ring */}
          {isActive && (
            <div
              className={`absolute inset-0 rounded-xl animate-ping opacity-20 ${colors.dot}`}
              style={{ animationDuration: '2s' }}
            />
          )}
        </div>

        {/* Label */}
        <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight max-w-[72px] group-hover:text-foreground transition-colors">
          {getStatusLabel(status)}
        </span>

        {/* Count badge */}
        <Badge
          variant={isActive ? 'default' : 'secondary'}
          className={`h-5 min-w-[24px] px-1.5 text-xs font-bold tabular-nums transition-all count-up ${
            isActive ? 'shadow-sm' : 'text-muted-foreground/60'
          }`}
        >
          {count}
        </Badge>
      </button>

      {/* Connector arrow */}
      {index < total - 1 && (
        <div className="flex items-center shrink-0 pipeline-connector h-10 mx-1">
          <ArrowRight
            className="size-5 text-muted-foreground/40 relative z-10"
            style={{
              color: isActive && count > 0 ? STATUS_NODE_COLORS[status]?.connector : undefined,
              opacity: isActive && count > 0 ? 0.7 : 0.3,
            }}
          />
        </div>
      )}
    </React.Fragment>
  )
}

export function ClaimsPipelineWidget() {
  const { data, isLoading } = useQuery<{ total: number; claims: unknown[] }>({
    queryKey: ['claims-pipeline-counts'],
    queryFn: () =>
      fetch(
        '/api/claims?status=NEW,PROCESSING,MANUAL_REVIEW,PENDING_REVIEW,COMPLETED&limit=0'
      ).then((r) => {
        if (!r.ok) throw new Error('Failed to load pipeline counts')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch per-status counts in parallel
  const statusQueries = useQuery<StatusCounts>({
    queryKey: ['claims-pipeline-status-counts'],
    queryFn: async () => {
      const statuses = PIPELINE_STATUSES.join(',')
      const res = await fetch(`/api/claims?status=${statuses}&limit=0`)
      if (!res.ok) throw new Error('Failed to load status counts')
      const json = await res.json()

      // If the API returns status breakdown, use it
      if (json.statusCounts) {
        return json.statusCounts as StatusCounts
      }

      // Otherwise use the analytics endpoint for status breakdown
      const analyticsRes = await fetch('/api/claims/analytics')
      if (!analyticsRes.ok) throw new Error('Failed to load analytics')
      const analytics = await analyticsRes.json()
      const counts: StatusCounts = {}
      if (analytics.statusSummary) {
        for (const item of analytics.statusSummary) {
          counts[item.status] = item.count
        }
      }
      return counts
    },
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  if (isLoading || !data || !statusQueries.data) {
    return <PipelineSkeleton />
  }

  const statusCounts = statusQueries.data

  return (
    <Card className="py-5 card-shine card-depth-2 hover-scale" id="claims-pipeline">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
            <Workflow className="size-4 text-primary" />
          </div>
          <CardTitle className="text-base font-semibold">Claims Pipeline</CardTitle>
          {data.total > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto tabular-nums">
              {data.total} total
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="card-content-reveal">
        <div className="overflow-x-auto scrollbar-fancy pb-2 -mx-2 px-2">
          <div className="flex items-center min-w-max">
            {PIPELINE_STATUSES.map((status, index) => (
              <PipelineNode
                key={status}
                status={status}
                count={statusCounts[status] || 0}
                index={index}
                total={PIPELINE_STATUSES.length}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
