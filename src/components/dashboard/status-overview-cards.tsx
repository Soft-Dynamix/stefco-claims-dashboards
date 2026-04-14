'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileQuestion,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'
import { getStatusLabel, getStatusColor } from '@/lib/helpers'

// --- Status configuration ---
const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    color: string // Tailwind text color class for the icon
    bg: string // Tailwind bg class for icon container
    glowClass: string // badge-glow class
    trendSeed: number // deterministic seed for simulated trend
  }
> = {
  NEW: {
    icon: FileQuestion,
    color: 'text-sky-500 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    glowClass: '',
    trendSeed: 0.12,
  },
  PROCESSING: {
    icon: Loader2,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    glowClass: '',
    trendSeed: 0.05,
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    glowClass: 'badge-glow-success',
    trendSeed: 0.18,
  },
  MANUAL_REVIEW: {
    icon: AlertTriangle,
    color: 'text-orange-500 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    glowClass: 'badge-glow-warning',
    trendSeed: -0.08,
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/60',
    glowClass: 'badge-glow-danger',
    trendSeed: -0.15,
  },
  PENDING_REVIEW: {
    icon: Clock,
    color: 'text-violet-500 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-950/60',
    glowClass: '',
    trendSeed: -0.03,
  },
}

const STATUS_ORDER = [
  'NEW',
  'PROCESSING',
  'COMPLETED',
  'MANUAL_REVIEW',
  'FAILED',
  'PENDING_REVIEW',
]

// --- Progress bar color per status ---
const PROGRESS_COLORS: Record<string, string> = {
  NEW: 'bg-sky-500',
  PROCESSING: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  MANUAL_REVIEW: 'bg-orange-500',
  FAILED: 'bg-red-500',
  PENDING_REVIEW: 'bg-violet-500',
}

function TrendIndicator({ status, count }: { status: string; count: number }) {
  const config = STATUS_CONFIG[status]
  if (!config || count === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" />
        <span>0%</span>
      </div>
    )
  }

  // Simulated trend: combine the seed with the current count for a stable but varied value
  const simulatedChange = Math.round(config.trendSeed * 100 + (count % 7) * 1.2)
  const isUp = simulatedChange >= 0
  const isNeutral = Math.abs(simulatedChange) < 3

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" />
        <span>Stable</span>
      </div>
    )
  }

  // For negative statuses like FAILED, a decrease is actually good
  const isPositive = status === 'FAILED'
    ? !isUp // decrease in failed is good
    : isUp // increase in others is generally good

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {isUp ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      <span>{isUp ? '+' : ''}{simulatedChange}%</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {STATUS_ORDER.map((status) => (
        <Card key={status} className="py-4 px-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-6 w-10 mb-1" />
          <Skeleton className="h-3 w-12 mb-3" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </Card>
      ))}
    </div>
  )
}

export function StatusOverviewCards() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setFilter = useClaimsStore((s) => s.setFilter)
  const clearFilters = useClaimsStore((s) => s.clearFilters)

  const { data, isLoading } = useQuery<{
    claimsByStatus: Record<string, number>
    totalClaims: number
  }>({
    queryKey: ['dashboard-status-overview'],
    queryFn: () =>
      fetch('/api/dashboard').then((r) => {
        if (!r.ok) throw new Error('Failed to load status data')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const statusEntries = useMemo(() => {
    if (!data) return []
    const { claimsByStatus } = data
    const total = Object.values(claimsByStatus).reduce((sum, c) => sum + c, 0)

    return STATUS_ORDER.map((status) => {
      const count = claimsByStatus[status] || 0
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return { status, count, percentage }
    })
  }, [data])

  const handleCardClick = (status: string) => {
    clearFilters()
    setFilter('status', status)
    setActiveTab('claims')
  }

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statusEntries.map(({ status, count, percentage }) => {
        const config = STATUS_CONFIG[status]
        if (!config) return null

        const Icon = config.icon
        const progressColor = PROGRESS_COLORS[status] || 'bg-muted-foreground'

        return (
          <Card
            key={status}
            onClick={() => handleCardClick(status)}
            className={`
              py-4 px-3 cursor-pointer
              card-depth-1 hover-scale
              transition-all duration-200
              border border-border/50
              hover:border-primary/30
              hover:shadow-md
              group
              ${config.glowClass}
            `}
          >
            <CardContent className="p-0">
              {/* Icon + Status Label */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex items-center justify-center size-8 rounded-lg ${config.bg} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className={`size-4 ${config.color} ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground leading-tight truncate">
                  {getStatusLabel(status)}
                </span>
              </div>

              {/* Count */}
              <div className="flex items-baseline justify-between gap-1 mb-0.5">
                <span className="text-2xl font-bold text-foreground tracking-tight leading-none">
                  {count}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium h-5 px-1.5 ${getStatusColor(status)}`}
                >
                  {percentage}%
                </Badge>
              </div>

              {/* Mini Progress Bar */}
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden mb-2 mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>

              {/* Trend Indicator */}
              <TrendIndicator status={status} count={count} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
