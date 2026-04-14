'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  PlusCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatusSummaryItem {
  status: string
  count: number
  percentage: number
}

interface AnalyticsData {
  statusSummary: StatusSummaryItem[]
  totalClaims: number
}

const METRIC_CONFIG = [
  {
    key: 'TOTAL',
    label: 'Total Claims',
    icon: FileText,
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    barColor: 'bg-primary',
  },
  {
    key: 'NEW',
    label: 'New Claims',
    icon: PlusCircle,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500 dark:text-blue-400',
    barColor: 'bg-blue-500',
  },
  {
    key: 'PROCESSING',
    label: 'Processing',
    icon: Loader2,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500 dark:text-amber-400',
    barColor: 'bg-amber-500',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  {
    key: 'FAILED',
    label: 'Failed',
    icon: XCircle,
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-500 dark:text-red-400',
    barColor: 'bg-red-500',
  },
  {
    key: 'MANUAL_REVIEW',
    label: 'Manual Review',
    icon: AlertCircle,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500 dark:text-orange-400',
    barColor: 'bg-orange-500',
  },
] as const

function getMetricValue(
  data: AnalyticsData | undefined,
  key: string
): { count: number; percentage: number } {
  if (!data) return { count: 0, percentage: 0 }

  if (key === 'TOTAL') {
    return { count: data.totalClaims, percentage: 100 }
  }

  const item = data.statusSummary.find((s) => s.status === key)
  return item
    ? { count: item.count, percentage: item.percentage }
    : { count: 0, percentage: 0 }
}

function StatsPanelSkeleton() {
  return (
    <Card className="rounded-xl border shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-5 w-10" />
              </div>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ClaimsStatsPanel() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['claims-analytics'],
    queryFn: () => fetch('/api/claims/analytics').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    staleTime: 30000,
  })

  if (isLoading) {
    return <StatsPanelSkeleton />
  }

  return (
    <Card className="rounded-xl border shadow-sm bg-card card-enter">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="size-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Claims Statistics
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {METRIC_CONFIG.map((metric, index) => {
            const Icon = metric.icon
            const { count, percentage } = getMetricValue(data, metric.key)

            return (
              <div
                key={metric.key}
                className={`hover-scale stagger-${index + 1} flex flex-col gap-2.5 p-3 rounded-lg border border-transparent hover:border-border/50 bg-muted/20 hover:bg-muted/40 transition-all duration-200 cursor-default`}
              >
                {/* Icon and percentage */}
                <div className="flex items-center justify-between">
                  <div
                    className={`flex items-center justify-center size-9 rounded-lg ${metric.iconBg}`}
                  >
                    <Icon
                      className={`size-4.5 ${metric.iconColor} ${
                        metric.key === 'PROCESSING' ? 'animate-spin' : ''
                      }`}
                      style={metric.key === 'PROCESSING' ? { animationDuration: '3s' } : undefined}
                    />
                  </div>
                  {metric.key !== 'TOTAL' && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {percentage}%
                    </span>
                  )}
                </div>

                {/* Value and label */}
                <div>
                  <p className="text-2xl font-bold text-foreground tracking-tight count-up">
                    {count}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {metric.label}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 progress-bar ${metric.barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
