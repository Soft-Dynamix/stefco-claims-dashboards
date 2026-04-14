'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { useClaimsStore } from '@/store/claims-store'
import { getStatusLabel } from '@/lib/helpers'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_COLORS: Record<string, string> = {
  NEW: '#0ea5e9',
  PROCESSING: '#f59e0b',
  MANUAL_REVIEW: '#f97316',
  PENDING_REVIEW: '#8b5cf6',
  COMPLETED: '#10b981',
  FAILED: '#ef4444',
}

const STATUS_ORDER = ['NEW', 'PROCESSING', 'MANUAL_REVIEW', 'PENDING_REVIEW', 'COMPLETED', 'FAILED']

interface StatusSummaryItem {
  status: string
  count: number
  percentage: number
}

interface AnalyticsData {
  statusSummary: StatusSummaryItem[]
  totalClaims: number
}

function StatusSummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-full rounded-full" />
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>
    </div>
  )
}

export function StatusSummaryBar() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setFilter = useClaimsStore((s) => s.setFilter)

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['status-distribution'],
    queryFn: () => fetch('/api/claims/analytics').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  })

  const sortedStatuses = useMemo(() => {
    if (!data?.statusSummary) return []
    return STATUS_ORDER
      .map((status) => data.statusSummary.find((s) => s.status === status))
      .filter(Boolean) as StatusSummaryItem[]
  }, [data])

  const total = data?.totalClaims ?? 0

  const handleSegmentClick = (status: string) => {
    setActiveTab('claims')
    setFilter('status', status)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <StatusSummarySkeleton />
      </div>
    )
  }

  if (!sortedStatuses.length || total === 0) {
    return null
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 card-enter hover-scale">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Claims Status Distribution</h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{total} total claims</span>
      </div>

      {/* Stacked Bar */}
      <div className="relative h-7 sm:h-8 rounded-full overflow-hidden bg-muted/40 border border-border/50 flex">
        {sortedStatuses.map((item) => {
          const width = total > 0 ? (item.count / total) * 100 : 0
          if (width < 0.5) return null
          return (
            <button
              key={item.status}
              className="relative h-full transition-all duration-700 ease-out group cursor-pointer hover:brightness-110 first:rounded-l-full last:rounded-r-full min-w-[4px]"
              style={{
                width: `${width}%`,
                backgroundColor: STATUS_COLORS[item.status] || '#64748B',
              }}
              onClick={() => handleSegmentClick(item.status)}
              title={`${getStatusLabel(item.status)}: ${item.count} (${item.percentage}%)`}
            >
              {/* Hover tooltip overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-inherit">
                <span className="text-[10px] font-bold text-white drop-shadow-sm">
                  {item.percentage}%
                </span>
              </div>
            </button>
          )
        })}

        {/* Center total label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-bold text-foreground bg-background/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-sm border border-border/50">
            {total}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3">
        {sortedStatuses.map((item) => (
          <button
            key={item.status}
            className="flex items-center gap-1.5 group cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleSegmentClick(item.status)}
          >
            <div
              className="size-2.5 rounded-sm shrink-0 ring-1 ring-offset-1 ring-offset-background"
              style={{ backgroundColor: STATUS_COLORS[item.status] || '#64748B' }}
            />
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
              {getStatusLabel(item.status)}
            </span>
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
