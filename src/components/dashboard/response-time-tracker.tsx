'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Timer,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  ShieldCheck,
  Info,
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
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip as ShTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClaimsStore } from '@/store/claims-store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClaimItem {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  confidenceScore: number
  createdAt: string
  updatedAt: string
  processedAt: string | null
  insuranceCompany: { name: string; folderName: string } | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SLA_TARGET_HOURS = 24

const BUCKET_COLORS = [
  '#10b981', // < 1h - green
  '#22c55e', // 1-4h - light green
  '#84cc16', // 4-12h - lime
  '#f59e0b', // 12-24h - amber
  '#f97316', // 1-3d - orange
  '#ef4444', // 3-7d - red
  '#991b1b', // >7d - dark red
]

const TIME_BUCKETS = [
  { label: '< 1h', minHours: 0, maxHours: 1, count: 0 },
  { label: '1-4h', minHours: 1, maxHours: 4, count: 0 },
  { label: '4-12h', minHours: 4, maxHours: 12, count: 0 },
  { label: '12-24h', minHours: 12, maxHours: 24, count: 0 },
  { label: '1-3d', minHours: 24, maxHours: 72, count: 0 },
  { label: '3-7d', minHours: 72, maxHours: 168, count: 0 },
  { label: '> 7d', minHours: 168, maxHours: Infinity, count: 0 },
]

const rechartsTooltipStyle = {
  fontSize: 12,
  padding: '8px 12px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getProcessingTimeMs(claim: ClaimItem): number | null {
  const created = new Date(claim.createdAt).getTime()
  const processed = claim.processedAt
    ? new Date(claim.processedAt).getTime()
    : (claim.status === 'COMPLETED' ? new Date(claim.updatedAt).getTime() : null)
  if (!processed || !created) return null
  return processed - created
}

function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60)
  if (hours < 1) {
    const mins = Math.round(hours * 60)
    return `${mins}m`
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`
  }
  const days = hours / 24
  return `${days.toFixed(1)}d`
}

function formatDurationDetailed(ms: number): string {
  const totalMins = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours === 0) return `${mins}m`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  if (days === 0) return `${hours}h ${mins}m`
  return `${days}d ${remainHours}h`
}

// ── Circular Progress Component ────────────────────────────────────────────────

function CircularProgress({
  value,
  size = 90,
  strokeWidth = 7,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedValue = Math.min(100, Math.max(0, value))
  const offset = circumference - (clampedValue / 100) * circumference

  const colorClass =
    clampedValue >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : clampedValue >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

  const strokeColor =
    clampedValue >= 80
      ? '#059669'
      : clampedValue >= 50
        ? '#D97706'
        : '#DC2626'

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={{ overflow: 'visible' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className={`absolute text-lg font-bold ${colorClass}`}>
        {Math.round(clampedValue)}%
      </span>
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <Card className="py-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-52" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top row skeleton */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-4 p-4 rounded-xl bg-muted/20">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-4 rounded-xl bg-muted/20">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        </div>

        {/* Chart skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24 flex-1" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export function ResponseTimeTracker() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  // Fetch completed claims for processing time analysis
  const { data: completedData, isLoading: completedLoading, error: completedError, refetch: refetchCompleted } = useQuery<{
    claims: ClaimItem[]
    total: number
  }>({
    queryKey: ['response-time-completed', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=200&status=COMPLETED').then((r) => {
        if (!r.ok) throw new Error('Failed to load completed claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch recent claims (all statuses) for claims still being processed
  const { data: recentData, isLoading: recentLoading } = useQuery<{
    claims: ClaimItem[]
    total: number
  }>({
    queryKey: ['response-time-recent', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=50').then((r) => {
        if (!r.ok) throw new Error('Failed to load recent claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const completedClaims = completedData?.claims || []
  const recentClaims = recentData?.claims || []

  const isLoading = completedLoading || recentLoading

  // ── Calculations ─────────────────────────────────────────────────────────────

  // Get all claims that have measurable processing times
  const claimsWithTime = useMemo(() => {
    // Start with completed claims
    const allClaims = [...completedClaims]

    // Merge in recent claims that aren't already included
    const completedIds = new Set(completedClaims.map((c) => c.id))
    for (const claim of recentClaims) {
      if (!completedIds.has(claim.id)) {
        allClaims.push(claim)
      }
    }

    return allClaims
      .map((claim) => ({
        ...claim,
        processingTimeMs: getProcessingTimeMs(claim),
      }))
      .filter((c) => c.processingTimeMs !== null && c.processingTimeMs! > 0)
  }, [completedClaims, recentClaims])

  // Average processing time
  const avgProcessingMs = useMemo(() => {
    if (claimsWithTime.length === 0) return null
    const total = claimsWithTime.reduce(
      (sum, c) => sum + (c.processingTimeMs || 0),
      0
    )
    return total / claimsWithTime.length
  }, [claimsWithTime])

  // Time distribution buckets
  const distributionData = useMemo(() => {
    const buckets = TIME_BUCKETS.map((b) => ({ ...b, count: 0 }))

    for (const claim of claimsWithTime) {
      const hours = (claim.processingTimeMs || 0) / (1000 * 60 * 60)
      for (const bucket of buckets) {
        if (hours >= bucket.minHours && hours < bucket.maxHours) {
          bucket.count++
          break
        }
      }
    }

    return buckets.map((b, i) => ({
      ...b,
      color: BUCKET_COLORS[i],
    }))
  }, [claimsWithTime])

  // SLA compliance (processed within 24 hours)
  const slaMetrics = useMemo(() => {
    const total = claimsWithTime.length
    if (total === 0) return { rate: 0, withinSLA: 0, overSLA: 0 }

    const withinSLA = claimsWithTime.filter(
      (c) => (c.processingTimeMs || 0) <= SLA_TARGET_HOURS * 60 * 60 * 1000
    ).length

    const overSLA = total - withinSLA
    const rate = Math.round((withinSLA / total) * 100)

    return { rate, withinSLA, overSLA }
  }, [claimsWithTime])

  // Slowest claims (top 5)
  const slowestClaims = useMemo(() => {
    return [...claimsWithTime]
      .sort((a, b) => (b.processingTimeMs || 0) - (a.processingTimeMs || 0))
      .slice(0, 5)
  }, [claimsWithTime])

  // Average time in hours
  const avgHours = avgProcessingMs ? avgProcessingMs / (1000 * 60 * 60) : 0
  const isUnderSLA = avgHours > 0 && avgHours <= SLA_TARGET_HOURS

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) return <WidgetSkeleton />

  if (completedError) {
    return (
      <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertTriangle className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Failed to load response time data</p>
          <button
            onClick={() => refetchCompleted()}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
              <Timer className="size-4.5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Claim Response Time Tracker
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Based on {claimsWithTime.length} claims with processing data
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs font-medium gap-1 px-2 py-0.5 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300"
          >
            <Clock className="size-3" />
            SLA: {SLA_TARGET_HOURS}h
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Section: Average Processing Time + SLA Compliance */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Average Processing Time Card */}
          <div className="p-5 rounded-xl bg-muted/30 border border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Average Processing Time
              </h3>
            </div>

            <div className="flex items-center gap-5">
              {isUnderSLA && avgProcessingMs ? (
                <>
                  <CircularProgress
                    value={Math.min(100, Math.round((avgHours / SLA_TARGET_HOURS) * 100))}
                    size={90}
                    strokeWidth={7}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-bold text-foreground tracking-tight">
                      {formatDuration(avgProcessingMs)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDurationDetailed(avgProcessingMs)} average
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Within SLA target
                      </span>
                    </div>
                  </div>
                </>
              ) : avgProcessingMs ? (
                <div className="flex flex-col gap-1">
                  <span className="text-3xl font-bold text-foreground tracking-tight">
                    {formatDuration(avgProcessingMs)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDurationDetailed(avgProcessingMs)} average
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="size-3.5 text-red-500" />
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Exceeds {SLA_TARGET_HOURS}h SLA target
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No data available</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{claimsWithTime.length}</span>{' '}
                claims measured
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>Target: {SLA_TARGET_HOURS}h</span>
            </div>
          </div>

          {/* SLA Compliance Rate */}
          <div className="p-5 rounded-xl bg-muted/30 border border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                SLA Compliance Rate
              </h3>
            </div>

            <div className="flex items-center gap-5">
              <CircularProgress
                value={slaMetrics.rate}
                size={90}
                strokeWidth={7}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg font-bold ${
                      slaMetrics.rate >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : slaMetrics.rate >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {slaMetrics.rate}%
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      slaMetrics.rate >= 80
                        ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : slaMetrics.rate >= 50
                          ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                          : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {slaMetrics.rate >= 80
                      ? 'Good'
                      : slaMetrics.rate >= 50
                        ? 'Warning'
                        : 'Critical'}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Claims processed within {SLA_TARGET_HOURS}h
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Within SLA</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {slaMetrics.withinSLA} claims
                </span>
              </div>
              <Progress
                value={slaMetrics.rate}
                className="h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-emerald-400"
              />
              {slaMetrics.overSLA > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {slaMetrics.overSLA} claim{slaMetrics.overSLA > 1 ? 's' : ''} exceeded SLA target
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Response Time Distribution Chart */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Response Time Distribution
              </h3>
            </div>
            <ShTooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-help">
                  <Info className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Buckets</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p>Claims grouped by total processing time from creation to completion.</p>
                <p className="text-muted-foreground mt-1">
                  SLA target: {SLA_TARGET_HOURS} hours
                </p>
              </TooltipContent>
            </ShTooltip>
          </div>

          <div className="chart-container-modern">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={distributionData}
                margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  className="opacity-40"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={rechartsTooltipStyle}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-foreground)' }}
                  formatter={(value: number) => [`${value} claims`, 'Count']}
                  labelFormatter={(label: string) => `Processing Time: ${label}`}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  animationDuration={800}
                >
                  {distributionData.map((entry, index) => (
                    <Cell
                      key={`dist-cell-${index}`}
                      fill={entry.color}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bucket legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center">
            {distributionData.map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-muted-foreground">
                  {item.label}{' '}
                  <span className="font-medium text-foreground/70">
                    ({item.count})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Slowest Claims Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Slowest Claims
              </h3>
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5">
              Top 5 bottlenecks
            </Badge>
          </div>

          {slowestClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="size-6 opacity-30" />
              <p className="text-sm mt-2">No claims data available</p>
            </div>
          ) : (
            <div className="table-container rounded-lg border max-h-[280px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="border-b hover:bg-transparent table-header-modern">
                    <TableHead className="text-xs font-semibold h-9">Claim #</TableHead>
                    <TableHead className="text-xs font-semibold h-9 hidden sm:table-cell">Client</TableHead>
                    <TableHead className="text-xs font-semibold h-9 hidden md:table-cell">Type</TableHead>
                    <TableHead className="text-xs font-semibold h-9 text-right">Time Taken</TableHead>
                    <TableHead className="text-xs font-semibold h-9 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="table-stripe">
                  {slowestClaims.map((claim, index) => {
                    const hours = (claim.processingTimeMs || 0) / (1000 * 60 * 60)
                    const isOverSLA = hours > SLA_TARGET_HOURS

                    return (
                      <TableRow
                        key={claim.id}
                        className={`group transition-colors ${
                          isOverSLA
                            ? 'bg-red-50/60 dark:bg-red-950/20 hover:bg-red-50/80 dark:hover:bg-red-950/30'
                            : 'hover:bg-primary/5'
                        }`}
                      >
                        <TableCell className="font-mono text-sm text-foreground font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-normal w-4">
                              {index + 1}.
                            </span>
                            {claim.claimNumber}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {claim.clientName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className="text-xs font-medium"
                          >
                            {claim.claimType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-sm font-semibold ${
                              isOverSLA
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-foreground'
                            }`}
                          >
                            {formatDurationDetailed(claim.processingTimeMs || 0)}
                          </span>
                          {isOverSLA && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[9px] px-1 py-0 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                            >
                              OVER SLA
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${
                              claim.status === 'COMPLETED'
                                ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                : claim.status === 'FAILED'
                                  ? 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                                  : claim.status === 'MANUAL_REVIEW'
                                    ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                    : 'border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {claim.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
