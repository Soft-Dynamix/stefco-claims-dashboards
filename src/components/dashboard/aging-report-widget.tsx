'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Hourglass,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'
import { getConfidenceColor } from '@/lib/helpers'

interface AgingBucket {
  label: string
  minDays: number
  maxDays: number
  count: number
  avgConfidence: number
  statuses: Record<string, number>
}

interface AgingSummary {
  totalAged: number
  avgAge: number
  criticalCount: number
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-sky-500',
  PROCESSING: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  MANUAL_REVIEW: 'bg-orange-500',
  PENDING_REVIEW: 'bg-violet-500',
  FAILED: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  MANUAL_REVIEW: 'Manual Review',
  PENDING_REVIEW: 'Pending Review',
  FAILED: 'Failed',
}

const BUCKET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '0-7 days': {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  '8-30 days': {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  '31-60 days': {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  '61-90 days': {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  '90+ days': {
    bg: 'bg-red-100 dark:bg-red-950/50',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
  },
}

export function AgingReportWidget() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading } = useQuery<{
    buckets: AgingBucket[]
    summary: AgingSummary
  }>({
    queryKey: ['claim-aging-report', refreshKey],
    queryFn: () => fetch('/api/claims/aging').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    retryDelay: 1000,
  })

  const buckets = data?.buckets || []
  const summary = data?.summary

  const totalClaimsInBuckets = buckets.reduce((sum, b) => sum + b.count, 0)
  const maxBucketCount = buckets.length > 0 ? Math.max(...buckets.map((b) => b.count)) : 1
  const criticalBucketCount = buckets
    .filter((b) => b.minDays > 30)
    .reduce((sum, b) => sum + b.count, 0)

  return (
    <Card className="py-5 card-shine">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hourglass className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Claim Aging Analysis</CardTitle>
            {summary && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {summary.totalAged} claims
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            {isOpen ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>

      {/* Summary Cards (always visible) */}
      {isLoading ? (
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      ) : summary ? (
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Total Aged Claims */}
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
              <div className="flex items-center justify-center size-9 rounded-lg bg-sky-100 dark:bg-sky-950/50 shrink-0">
                <BarChart3 className="size-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">
                  {summary.totalAged}
                </p>
                <p className="text-[10px] text-muted-foreground">Total Claims</p>
              </div>
            </div>

            {/* Average Age */}
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
              <div className="flex items-center justify-center size-9 rounded-lg bg-violet-100 dark:bg-violet-950/50 shrink-0">
                <Clock className="size-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">
                  {summary.avgAge}d
                </p>
                <p className="text-[10px] text-muted-foreground">Avg Age</p>
              </div>
            </div>

            {/* Critical (>30 days) */}
            <div className={`flex items-center gap-2.5 p-3 rounded-lg transition-all metric-card border ${
              criticalBucketCount > 0
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
            }`}>
              <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${
                criticalBucketCount > 0
                  ? 'bg-red-100 dark:bg-red-950/50'
                  : 'bg-emerald-100 dark:bg-emerald-950/50'
              }`}>
                <AlertTriangle className={`size-4 ${
                  criticalBucketCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`} />
              </div>
              <div className="min-w-0">
                <p className={`text-lg font-bold leading-tight ${
                  criticalBucketCount > 0
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {criticalBucketCount}
                </p>
                <p className="text-[10px] text-muted-foreground">Critical (&gt;30d)</p>
              </div>
            </div>
          </div>

          {/* Expanded Detail */}
          {isOpen && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Mini bar summary */}
              <div className="space-y-3">
                {buckets.map((bucket) => {
                  const colors = BUCKET_COLORS[bucket.label] || BUCKET_COLORS['0-7 days']
                  const barWidth = totalClaimsInBuckets > 0
                    ? (bucket.count / totalClaimsInBuckets) * 100
                    : 0
                  const maxWidth = totalClaimsInBuckets > 0
                    ? (bucket.count / maxBucketCount) * 100
                    : 0

                  // Build stacked bar segments by status
                  const statusEntries = Object.entries(bucket.statuses).sort(
                    (a, b) => b[1] - a[1]
                  )

                  return (
                    <div
                      key={bucket.label}
                      className={`rounded-lg border p-3 transition-colors hover:bg-muted/20 ${colors.border}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${colors.text}`}>
                            {bucket.label}
                          </span>
                          <Badge variant="outline" className={`text-[10px] h-4 px-1 ${colors.bg} ${colors.text} ${colors.border}`}>
                            {bucket.count}
                          </Badge>
                        </div>
                        {bucket.count > 0 && (
                          <span className={`text-xs font-medium ${colors.text}`}>
                            Avg conf: <span className={getConfidenceColor(bucket.avgConfidence)}>{bucket.avgConfidence}%</span>
                          </span>
                        )}
                      </div>

                      {/* Stacked horizontal bar */}
                      {bucket.count > 0 ? (
                        <div className="space-y-2">
                          {/* Main stacked bar */}
                          <div className="h-3 rounded-full overflow-hidden flex bg-muted/30">
                            {statusEntries.map(([status, count]) => {
                              const segWidth = (count / bucket.count) * 100
                              return (
                                <div
                                  key={status}
                                  className={`${STATUS_COLORS[status] || 'bg-gray-400'} h-full transition-all duration-500`}
                                  style={{ width: `${segWidth}%` }}
                                  title={`${STATUS_LABELS[status] || status}: ${count}`}
                                />
                              )
                            })}
                          </div>

                          {/* Status legend row */}
                          <div className="flex flex-wrap gap-2">
                            {statusEntries.map(([status, count]) => (
                              <div key={status} className="flex items-center gap-1">
                                <div className={`size-2 rounded-sm ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
                                <span className="text-[10px] text-muted-foreground">
                                  {STATUS_LABELS[status] || status}
                                </span>
                                <span className="text-[10px] font-medium text-foreground">
                                  {count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No claims in this bucket</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Overall legend */}
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={`size-2.5 rounded-sm ${STATUS_COLORS[status]}`} />
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isOpen && !isLoading && (
            <p className="text-xs text-muted-foreground">
              Click &quot;Expand&quot; to view aging bucket details with status breakdowns.
            </p>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}
