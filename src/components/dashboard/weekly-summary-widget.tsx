'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  FileCheck,
  Target,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useClaimsStore } from '@/store/claims-store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardData {
  claimsThisWeek: number
  claimsLastWeek: number
  claimsByStatus: Record<string, number>
  averageConfidenceScore: number
  dailyClaimsTrend: { date: string; count: number }[]
}

interface ClaimItem {
  id: string
  status: string
  confidenceScore: number
  createdAt: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  fontSize: 12,
  padding: '8px 12px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekStart(): Date {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - d.getDay() + 1) // Monday
  return d
}

function isThisWeek(dateStr: string): boolean {
  const weekStart = getWeekStart()
  const d = new Date(dateStr)
  return d >= weekStart
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 rounded" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI Row skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/20 space-y-2">
              <Skeleton className="h-3 w-20" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="size-4 rounded" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>

        <Separator />

        {/* Sparkline skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </div>

        {/* Top Actions skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/15">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Trend Arrow Component ─────────────────────────────────────────────────────

function TrendBadge({
  current,
  previous,
}: {
  current: number
  previous: number
}) {
  if (previous === 0) return null
  const pctChange = Math.round(((current - previous) / previous) * 100)
  const isUp = pctChange >= 0

  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium px-1.5 py-0 gap-0.5 shrink-0 ${
        isUp
          ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30'
          : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/30'
      }`}
    >
      {isUp ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownRight className="size-3" />
      )}
      {Math.abs(pctChange)}%
    </Badge>
  )
}

// ── Mini KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  suffix,
  trendBadge,
  barValue,
  barColor,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  suffix?: string
  trendBadge?: React.ReactNode
  barValue?: number
  barColor?: string
}) {
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors border border-transparent hover:border-border/40 group">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className={`flex items-center justify-center size-7 rounded-lg ${iconBg} group-hover:scale-105 transition-transform`}>
          <Icon className={`size-3.5 ${iconColor}`} />
        </div>
        {trendBadge}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {value}{suffix || ''}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
      {barValue !== undefined && barColor && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.min(100, barValue)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export function WeeklySummaryWidget() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  // Fetch dashboard data
  const { data: dashData, isLoading: dashLoading, error: dashError, refetch: refetchDash } = useQuery<DashboardData>({
    queryKey: ['weekly-summary-dash', refreshKey],
    queryFn: () =>
      fetch('/api/dashboard').then((r) => {
        if (!r.ok) throw new Error('Failed to load dashboard data')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch recent claims for weekly processed & confidence calculation
  const { data: claimsData, isLoading: claimsLoading } = useQuery<{
    claims: ClaimItem[]
    total: number
  }>({
    queryKey: ['weekly-summary-claims', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to load claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const isLoading = dashLoading || claimsLoading
  const allClaims = claimsData?.claims || []

  // ── Weekly Metrics (computed from dailyClaimsTrend) ──

  const last7Days = useMemo(() => {
    if (!dashData?.dailyClaimsTrend) return []
    return dashData.dailyClaimsTrend.slice(-7)
  }, [dashData])

  const prev7Days = useMemo(() => {
    if (!dashData?.dailyClaimsTrend || dashData.dailyClaimsTrend.length < 14) return []
    return dashData.dailyClaimsTrend.slice(-14, -7)
  }, [dashData])

  const newThisWeek = useMemo(() => {
    return last7Days.reduce((sum, d) => sum + d.count, 0)
  }, [last7Days])

  const newLastWeek = useMemo(() => {
    return prev7Days.reduce((sum, d) => sum + d.count, 0)
  }, [prev7Days])

  // Weekly processed claims (from claims API, filtered by this week)
  const weeklyProcessed = useMemo(() => {
    return allClaims.filter((c) => c.status === 'COMPLETED' && isThisWeek(c.createdAt)).length
  }, [allClaims])

  // Weekly avg confidence (from claims API, filtered by this week)
  const weeklyAvgConfidence = useMemo(() => {
    const weekClaims = allClaims.filter((c) => isThisWeek(c.createdAt))
    if (weekClaims.length === 0) return 0
    const total = weekClaims.reduce((sum, c) => sum + c.confidenceScore, 0)
    return Math.round(total / weekClaims.length)
  }, [allClaims])

  // Completion rate (completed this week / new this week)
  const completionRate = useMemo(() => {
    if (newThisWeek === 0) return 0
    return Math.round((weeklyProcessed / newThisWeek) * 100)
  }, [newThisWeek, weeklyProcessed])

  // Sparkline data — last 7 days with formatted labels
  const sparklineData = useMemo(() => {
    return last7Days.map((d) => {
      const date = new Date(d.date)
      return {
        day: DAY_LABELS[date.getDay()],
        shortDate: `${date.getDate()}/${date.getMonth() + 1}`,
        count: d.count,
      }
    })
  }, [last7Days])

  // Busiest day this week
  const busiestDay = useMemo(() => {
    if (last7Days.length === 0) return null
    let max = last7Days[0]
    for (const d of last7Days) {
      if (d.count > max.count) max = d
    }
    const date = new Date(max.date)
    return {
      label: DAY_LABELS[date.getDay()],
      count: max.count,
    }
  }, [last7Days])

  // Average claims per day this week
  const avgPerDay = useMemo(() => {
    if (last7Days.length === 0) return 0
    const total = last7Days.reduce((sum, d) => sum + d.count, 0)
    return (total / last7Days.length).toFixed(1)
  }, [last7Days])

  // Most common status change (use claimsByStatus for top non-NEW status)
  const topStatusAction = useMemo(() => {
    if (!dashData?.claimsByStatus) return null
    const entries = Object.entries(dashData.claimsByStatus).filter(
      ([status]) => status !== 'NEW'
    )
    if (entries.length === 0) return null
    entries.sort((a, b) => b[1] - a[1])
    const [status, count] = entries[0]
    return {
      status: status.replace(/_/g, ' '),
      count,
    }
  }, [dashData])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) return <WidgetSkeleton />

  if (dashError) {
    return (
      <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertTriangle className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Failed to load weekly summary</p>
          <button
            onClick={() => refetchDash()}
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
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-violet-100 dark:bg-violet-950/50">
              <BarChart3 className="size-4.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Claims Weekly Summary
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Executive overview of the current week&apos;s performance
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs font-medium gap-1 px-2 py-0.5 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
          >
            <Calendar className="size-3" />
            This Week
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Weekly KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* New Claims This Week */}
          <KpiCard
            icon={ArrowUpRight}
            iconBg="bg-sky-100 dark:bg-sky-950/50"
            iconColor="text-sky-600 dark:text-sky-400"
            label="New Claims"
            value={newThisWeek}
            trendBadge={<TrendBadge current={newThisWeek} previous={newLastWeek} />}
            barValue={newLastWeek > 0 ? (newThisWeek / newLastWeek) * 100 : 0}
            barColor={newThisWeek >= newLastWeek ? 'bg-sky-500' : 'bg-sky-400'}
          />

          {/* Claims Processed This Week */}
          <KpiCard
            icon={FileCheck}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
            label="Processed"
            value={weeklyProcessed}
            barValue={newThisWeek > 0 ? Math.round((weeklyProcessed / newThisWeek) * 100) : 0}
            barColor="bg-emerald-500"
          />

          {/* Avg Confidence Score */}
          <KpiCard
            icon={Target}
            iconBg={
              weeklyAvgConfidence >= 75
                ? 'bg-emerald-100 dark:bg-emerald-950/50'
                : weeklyAvgConfidence >= 50
                  ? 'bg-amber-100 dark:bg-amber-950/50'
                  : 'bg-red-100 dark:bg-red-950/50'
            }
            iconColor={
              weeklyAvgConfidence >= 75
                ? 'text-emerald-600 dark:text-emerald-400'
                : weeklyAvgConfidence >= 50
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }
            label="Avg Confidence"
            value={weeklyAvgConfidence}
            suffix="%"
            barValue={weeklyAvgConfidence}
            barColor={
              weeklyAvgConfidence >= 75
                ? 'bg-emerald-500'
                : weeklyAvgConfidence >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }
          />

          {/* Completion Rate */}
          <KpiCard
            icon={Activity}
            iconBg={
              completionRate >= 70
                ? 'bg-emerald-100 dark:bg-emerald-950/50'
                : completionRate >= 40
                  ? 'bg-amber-100 dark:bg-amber-950/50'
                  : 'bg-red-100 dark:bg-red-950/50'
            }
            iconColor={
              completionRate >= 70
                ? 'text-emerald-600 dark:text-emerald-400'
                : completionRate >= 40
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }
            label="Completion Rate"
            value={completionRate}
            suffix="%"
            barValue={completionRate}
            barColor={
              completionRate >= 70
                ? 'bg-emerald-500'
                : completionRate >= 40
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }
          />
        </div>

        <Separator />

        {/* ── Daily Claims Sparkline ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Daily Claims Volume
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 ml-auto">
              Last 7 days
            </Badge>
          </div>

          {sparklineData.length > 0 ? (
            <div className="chart-container-modern rounded-lg p-2">
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart
                  data={sparklineData}
                  margin={{ top: 5, right: 10, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient id="weeklySparkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: number) => [value, 'Claims']}
                    labelFormatter={(_label: string, payload) => {
                      if (payload?.[0]?.payload?.shortDate) {
                        return `${_label} (${payload[0].payload.shortDate})`
                      }
                      return _label
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#weeklySparkGradient)"
                    dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--color-primary)' }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
              No trend data available
            </div>
          )}
        </div>

        <Separator />

        {/* ── Top Actions This Week ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Top Actions This Week
            </h3>
          </div>

          <div className="space-y-2">
            {/* Most common status change */}
            {topStatusAction && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/15 hover:bg-muted/25 transition-colors">
                <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
                  <TrendingUp className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    <span className="text-primary font-semibold">{topStatusAction.count}</span>{' '}
                    claims → {topStatusAction.status}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Most common status</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-primary/20 text-primary shrink-0"
                >
                  Top
                </Badge>
              </div>
            )}

            {/* Busiest day */}
            {busiestDay && busiestDay.count > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/15 hover:bg-muted/25 transition-colors">
                <div className="flex items-center justify-center size-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 shrink-0">
                  <Calendar className="size-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{busiestDay.label}</span>{' '}
                    — {busiestDay.count} claims
                  </p>
                  <p className="text-[11px] text-muted-foreground">Busiest day this week</p>
                </div>
              </div>
            )}

            {/* Average per day */}
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/15 hover:bg-muted/25 transition-colors">
              <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 shrink-0">
                <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{avgPerDay}</span>{' '}
                  claims per day avg
                </p>
                <p className="text-[11px] text-muted-foreground">Weekly average</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
