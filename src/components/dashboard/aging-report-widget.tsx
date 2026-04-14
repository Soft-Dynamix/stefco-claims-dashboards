'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getStatusColor, getStatusLabel } from '@/lib/helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClaimItem {
  id: string
  claimNumber: string
  clientName: string
  status: string
  claimType: string
  createdAt: string
  confidenceScore: number
}

interface AgingBucket {
  key: string
  label: string
  tag: string
  min: number
  max: number
  color: string
  fill: string
  count: number
}

interface StackedBarRow {
  status: string
  label: string
  '0-7d': number
  '8-14d': number
  '15-30d': number
  '31-60d': number
  '60+d': number
  total: number
}

// ─── Bucket Definitions ───────────────────────────────────────────────────────

const BUCKET_DEFS: Array<{ key: string; label: string; tag: string; min: number; max: number; color: string; fill: string }> = [
  { key: 'fresh', label: '0-7 days', tag: 'Fresh', min: 0, max: 7, color: 'text-emerald-600 dark:text-emerald-400', fill: '#10b981' },
  { key: 'normal', label: '8-14 days', tag: 'Normal', min: 8, max: 14, color: 'text-amber-600 dark:text-amber-400', fill: '#f59e0b' },
  { key: 'aging', label: '15-30 days', tag: 'Aging', min: 15, max: 30, color: 'text-orange-600 dark:text-orange-400', fill: '#f97316' },
  { key: 'old', label: '31-60 days', tag: 'Old', min: 31, max: 60, color: 'text-red-600 dark:text-red-400', fill: '#ef4444' },
  { key: 'critical', label: '60+ days', tag: 'Critical', min: 61, max: Infinity, color: 'text-crimson-600 dark:text-crimson-400', fill: '#dc2626' },
]

const STATUS_ORDER = ['NEW', 'PROCESSING', 'PENDING_REVIEW', 'MANUAL_REVIEW', 'FAILED', 'COMPLETED']

const CHART_BUCKET_KEYS = ['0-7d', '8-14d', '15-30d', '31-60d', '60+d'] as const
const BUCKET_FILL_MAP: Record<string, string> = {
  '0-7d': '#10b981',
  '8-14d': '#f59e0b',
  '15-30d': '#f97316',
  '31-60d': '#ef4444',
  '60+d': '#dc2626',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: Date): number {
  return Math.floor((b.getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function getBucketForAge(ageDays: number): typeof BUCKET_DEFS[number] {
  if (ageDays <= 7) return BUCKET_DEFS[0]
  if (ageDays <= 14) return BUCKET_DEFS[1]
  if (ageDays <= 30) return BUCKET_DEFS[2]
  if (ageDays <= 60) return BUCKET_DEFS[3]
  return BUCKET_DEFS[4]
}

function ageColor(ageDays: number): string {
  if (ageDays <= 7) return 'text-emerald-600 dark:text-emerald-400'
  if (ageDays <= 14) return 'text-amber-600 dark:text-amber-400'
  if (ageDays <= 30) return 'text-orange-600 dark:text-orange-400'
  if (ageDays <= 60) return 'text-red-600 dark:text-red-400'
  return 'text-red-700 dark:text-red-300'
}

function ageBadgeVariant(ageDays: number): 'outline' | 'destructive' | 'secondary' {
  if (ageDays > 60) return 'destructive'
  if (ageDays > 30) return 'outline'
  return 'secondary'
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AgingReportWidget() {
  const { data, isLoading, isError, error } = useQuery<{ claims: ClaimItem[] }>({
    queryKey: ['aging-report-claims'],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to fetch claims')
        return r.json()
      }),
    staleTime: 30_000,
    retry: 2,
  })

  const claims = data?.claims || []

  // ─── Computed Analytics ──────────────────────────────────────────────────

  const analytics = useMemo(() => {
    const now = new Date()

    if (claims.length === 0) {
      return {
        buckets: BUCKET_DEFS.map((d) => ({ ...d, count: 0 })),
        avgAge: 0,
        oldestAge: 0,
        criticalCount: 0,
        stackedData: [] as StackedBarRow[],
        oldestClaims: [] as Array<{ claimNumber: string; clientName: string; status: string; age: number }>,
      }
    }

    // Bucket counts
    const buckets: AgingBucket[] = BUCKET_DEFS.map((def) => ({ ...def, count: 0 }))

    // Per-status stacked data
    const statusMap: Record<string, Record<string, number>> = {}

    // Track oldest claims
    const agedClaims: Array<{ claimNumber: string; clientName: string; status: string; age: number }> = []

    let totalAge = 0
    let oldestAge = 0
    let criticalCount = 0

    for (const claim of claims) {
      const age = daysBetween(claim.createdAt, now)
      if (age < 0) continue

      totalAge += age
      if (age > oldestAge) oldestAge = age
      if (age > 60) criticalCount++

      // Bucket
      const bucket = getBucketForAge(age)
      const found = buckets.find((b) => b.key === bucket.key)
      if (found) found.count += 1

      // Status map
      if (!statusMap[claim.status]) {
        statusMap[claim.status] = { '0-7d': 0, '8-14d': 0, '15-30d': 0, '31-60d': 0, '60+d': 0 }
      }

      if (age <= 7) statusMap[claim.status]['0-7d']++
      else if (age <= 14) statusMap[claim.status]['8-14d']++
      else if (age <= 30) statusMap[claim.status]['15-30d']++
      else if (age <= 60) statusMap[claim.status]['31-60d']++
      else statusMap[claim.status]['60+d']++

      agedClaims.push({
        claimNumber: claim.claimNumber,
        clientName: claim.clientName,
        status: claim.status,
        age,
      })
    }

    // Sort statuses by defined order
    const stackedData: StackedBarRow[] = STATUS_ORDER.filter((s) => statusMap[s]).map((status) => {
      const row = statusMap[status]
      const total = CHART_BUCKET_KEYS.reduce((sum, k) => sum + (row[k] || 0), 0)
      if (total === 0) return null as unknown as StackedBarRow
      return {
        status,
        label: getStatusLabel(status),
        '0-7d': row['0-7d'] || 0,
        '8-14d': row['8-14d'] || 0,
        '15-30d': row['15-30d'] || 0,
        '31-60d': row['31-60d'] || 0,
        '60+d': row['60+d'] || 0,
        total,
      }
    }).filter(Boolean)

    // Add any statuses not in the defined order
    for (const status of Object.keys(statusMap)) {
      if (!STATUS_ORDER.includes(status)) {
        const row = statusMap[status]
        const total = CHART_BUCKET_KEYS.reduce((sum, k) => sum + (row[k] || 0), 0)
        if (total === 0) continue
        stackedData.push({
          status,
          label: getStatusLabel(status),
          '0-7d': row['0-7d'] || 0,
          '8-14d': row['8-14d'] || 0,
          '15-30d': row['15-30d'] || 0,
          '31-60d': row['31-60d'] || 0,
          '60+d': row['60+d'] || 0,
          total,
        })
      }
    }

    // Top 5 oldest claims
    const oldestClaims = agedClaims
      .sort((a, b) => b.age - a.age)
      .slice(0, 5)

    return {
      buckets,
      avgAge: Math.round(totalAge / claims.length),
      oldestAge,
      criticalCount,
      stackedData,
      oldestClaims,
    }
  }, [claims])

  const totalBucketed = analytics.buckets.reduce((s, b) => s + b.count, 0)

  // ─── Loading Skeleton ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="card-shine card-enter card-depth-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-64 mt-1.5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Metric cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          {/* Bucket bars skeleton */}
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-5 flex-1 rounded-full" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <Skeleton className="h-[260px] w-full rounded-lg" />
          {/* Table skeleton */}
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Error State ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <Card className="card-shine card-enter card-depth-1">
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="size-10 text-red-400" />
          <p className="text-sm font-medium">Failed to load aging report</p>
          <p className="text-xs">{error?.message || 'Unknown error'}</p>
        </CardContent>
      </Card>
    )
  }

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (claims.length === 0) {
    return (
      <Card className="card-shine card-enter card-depth-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <Calendar className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Claims Aging Report</CardTitle>
              <CardDescription className="text-xs">How long claims have been in each status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Clock className="size-10 opacity-30" />
          <p className="text-sm">No claims data available</p>
        </CardContent>
      </Card>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const tooltipStyle = {
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: '10px',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-popover)',
    color: 'var(--color-popover-foreground)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  }

  return (
    <Card className="card-shine card-hover card-enter card-depth-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <Calendar className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Claims Aging Report</CardTitle>
              <CardDescription className="text-xs">
                How long claims have been sitting in each status
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {totalBucketed} claims
            </Badge>
            {analytics.criticalCount > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="size-3" />
                {analytics.criticalCount} critical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Summary Metric Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Average Age */}
          <TooltipProvider>
            <ShadTooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 transition-colors cursor-default">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-sky-100 dark:bg-sky-950/50">
                    <TrendingUp className="size-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Average Age</p>
                    <p className="text-xl font-bold text-foreground">{analytics.avgAge} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Mean age across all {totalBucketed} claims</p>
              </TooltipContent>
            </ShadTooltip>
          </TooltipProvider>

          {/* Oldest Claim */}
          <TooltipProvider>
            <ShadTooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 transition-colors cursor-default">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-orange-100 dark:bg-orange-950/50">
                    <Clock className="size-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Oldest Claim</p>
                    <p className={`text-xl font-bold ${ageColor(analytics.oldestAge)}`}>{analytics.oldestAge} <span className="text-sm font-normal text-muted-foreground">days</span></p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Oldest unresolved claim in the system</p>
              </TooltipContent>
            </ShadTooltip>
          </TooltipProvider>

          {/* Critical Count */}
          <TooltipProvider>
            <ShadTooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-3 rounded-lg border p-4 transition-colors cursor-default ${analytics.criticalCount > 0 ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover:border-red-400' : 'hover:border-primary/30'}`}>
                  <div className="flex items-center justify-center size-10 rounded-lg bg-red-100 dark:bg-red-950/50">
                    <AlertTriangle className={`size-5 ${analytics.criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Critical (60+ days)</p>
                    <p className={`text-xl font-bold ${analytics.criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{analytics.criticalCount}</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Claims older than 60 days need immediate attention</p>
              </TooltipContent>
            </ShadTooltip>
          </TooltipProvider>
        </div>

        {/* ── Aging Bucket Distribution Bars ──────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aging Distribution</p>
          <div className="space-y-2.5">
            {analytics.buckets.map((bucket) => {
              const pct = totalBucketed > 0 ? (bucket.count / totalBucketed) * 100 : 0
              return (
                <div key={bucket.key} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-[72px] shrink-0">{bucket.label}</span>
                  <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(pct, bucket.count > 0 ? 8 : 0)}%`,
                        backgroundColor: bucket.fill,
                        opacity: 0.8,
                      }}
                    />
                    {bucket.count > 0 && (
                      <span className="absolute inset-0 flex items-center px-2">
                        <span className="text-[10px] font-semibold text-foreground drop-shadow-sm">{bucket.count}</span>
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 w-12 justify-center shrink-0">
                    {pct.toFixed(0)}%
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Stacked Bar Chart: Aging by Status ──────────────────────── */}
        {analytics.stackedData.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aging by Status</p>
            <div className="rounded-lg border p-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.stackedData} barCategoryGap="20%" layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  {CHART_BUCKET_KEYS.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="a"
                      fill={BUCKET_FILL_MAP[key]}
                      radius={key === '60+d' ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                      maxBarSize={24}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Top 5 Oldest Claims Table ──────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Oldest Open Claims</p>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent table-header-modern">
                  <TableHead className="text-xs font-semibold h-9">Claim #</TableHead>
                  <TableHead className="text-xs font-semibold h-9 hidden sm:table-cell">Client</TableHead>
                  <TableHead className="text-xs font-semibold h-9 hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-xs font-semibold h-9 text-right">Age (days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.oldestClaims.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground text-xs">
                      No aging claims found
                    </TableCell>
                  </TableRow>
                ) : (
                  analytics.oldestClaims.map((claim) => (
                    <TableRow key={claim.claimNumber} className="group hover:bg-primary/5 transition-colors table-row-animate">
                      <TableCell className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {claim.claimNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                        {claim.clientName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`${getStatusColor(claim.status)} text-[10px]`}>
                          {getStatusLabel(claim.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={ageBadgeVariant(claim.age)} className={`text-[10px] font-bold ${ageColor(claim.age)}`}>
                          {claim.age}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
