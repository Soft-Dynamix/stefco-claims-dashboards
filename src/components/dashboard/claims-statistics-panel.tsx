'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  Clock,
  FileCheck,
  PlusCircle,
  Award,
  Building2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'

// ── Color Palette ──
const DONUT_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-muted-foreground)',
]

const INSURANCE_BAR_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#f97316',
  '#ec4899',
]

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

// ── Interfaces ──
interface DashboardData {
  totalClaims: number
  claimsThisWeek: number
  claimsByStatus: Record<string, number>
  claimsByType: Record<string, number>
  dailyClaimsTrend: { date: string; count: number }[]
  avgProcessingTime: number
  slaCompliance: number
}

interface CompletedClaimItem {
  id: string
  insuranceCompany: { name: string; folderName: string } | null
}

// ── Skeleton ──
function PanelSkeleton() {
  return (
    <Card className="py-6 card-shine">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-44" />
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Quick stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2 p-3 rounded-xl bg-muted/20">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <Separator className="mb-6" />
        {/* Charts skeleton */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[160px] w-full rounded-lg" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[160px] w-full rounded-lg" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-[160px] w-full rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Animated Counter Hook ──
function useAnimatedNumber(target: number, duration = 800) {
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    if (target === 0) {
      setDisplay(0)
      return
    }

    const startTime = Date.now()
    const startVal = display

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal + (target - startVal) * eased))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [target, duration])

  return display
}

// ── Mini Stat Card ──
function MiniStatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  suffix,
  label,
  trendColor,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  value: number
  suffix?: string
  label: string
  trendColor?: string
}) {
  const animatedValue = useAnimatedNumber(value)

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50 group cursor-default">
      <div className={`flex items-center justify-center size-9 rounded-lg ${iconBg} group-hover:scale-105 transition-transform`}>
        <Icon className={`size-4 ${iconColor}`} />
      </div>
      <div className="text-center">
        <span className={`text-xl font-bold tracking-tight ${trendColor || 'text-foreground'} count-up`}>
          {animatedValue}{suffix || ''}
        </span>
        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Main Component ──
export function ClaimsStatisticsPanel() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  // Fetch dashboard data for dailyClaimsTrend, claimsByType, stats
  const { data: dashData, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ['claims-stat-panel-dash', refreshKey],
    queryFn: () =>
      fetch('/api/dashboard').then((r) => {
        if (!r.ok) throw new Error('Failed to load dashboard data')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch completed claims for insurance company breakdown
  const { data: completedData, isLoading: completedLoading } = useQuery<{
    claims: CompletedClaimItem[]
    total: number
  }>({
    queryKey: ['claims-stat-panel-completed', refreshKey],
    queryFn: () =>
      fetch('/api/claims?status=COMPLETED&limit=100').then((r) => {
        if (!r.ok) throw new Error('Failed to load completed claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // ── 1. Monthly Claims Volume (group dailyClaimsTrend by month) ──
  const monthlyVolume = useMemo(() => {
    if (!dashData?.dailyClaimsTrend) return []

    const monthMap = new Map<string, number>()
    for (const item of dashData.dailyClaimsTrend) {
      const d = new Date(item.date)
      // Format as "Jan", "Feb", etc.
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
      monthMap.set(key, (monthMap.get(key) || 0) + item.count)
    }

    // Take last 6 months
    const entries = Array.from(monthMap.entries()).slice(-6)
    return entries.map(([month, count]) => ({ month, count }))
  }, [dashData])

  // ── 2. Top Insurance Companies by completed claims ──
  const topInsuranceCompanies = useMemo(() => {
    if (!completedData?.claims) return []

    const companyCounts: Record<string, number> = {}
    for (const claim of completedData.claims) {
      const name = claim.insuranceCompany?.name || 'Unknown'
      companyCounts[name] = (companyCounts[name] || 0) + 1
    }

    return Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [completedData])

  // ── 3. Claim Type Breakdown (donut) ──
  const claimTypeBreakdown = useMemo(() => {
    if (!dashData?.claimsByType) return []

    return Object.entries(dashData.claimsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  }, [dashData])

  // ── 4. Quick Stats ──
  const totalClaims = dashData?.totalClaims || 0
  const newThisWeek = dashData?.claimsThisWeek || 0
  const avgProcessingTime = dashData?.avgProcessingTime || 0 // in minutes
  const slaCompliance = dashData?.slaCompliance || 0

  // Derive success rate from completed vs total
  const successRate = useMemo(() => {
    if (!dashData?.claimsByStatus) return 0
    const completed = dashData.claimsByStatus['COMPLETED'] || 0
    const total = Object.values(dashData.claimsByStatus).reduce((s, v) => s + v, 0)
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [dashData])

  if (dashLoading || completedLoading) return <PanelSkeleton />

  return (
    <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
              <BarChart3 className="size-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Claims Statistics
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comprehensive claims overview &amp; analytics
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        {/* ── Quick Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pb-6">
          <MiniStatCard
            icon={FileCheck}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            value={totalClaims}
            label="Total Claims"
          />
          <MiniStatCard
            icon={PlusCircle}
            iconBg="bg-sky-100 dark:bg-sky-950/50"
            iconColor="text-sky-600 dark:text-sky-400"
            value={newThisWeek}
            label="New This Week"
            trendColor="text-sky-600 dark:text-sky-400"
          />
          <MiniStatCard
            icon={Clock}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            iconColor="text-amber-600 dark:text-amber-400"
            value={avgProcessingTime}
            suffix="m"
            label="Avg Resolution"
            trendColor={
              avgProcessingTime > 120
                ? 'text-red-600 dark:text-red-400'
                : avgProcessingTime > 60
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }
          />
          <MiniStatCard
            icon={Award}
            iconBg={
              successRate >= 80
                ? 'bg-emerald-100 dark:bg-emerald-950/50'
                : successRate >= 50
                  ? 'bg-amber-100 dark:bg-amber-950/50'
                  : 'bg-red-100 dark:bg-red-950/50'
            }
            iconColor={
              successRate >= 80
                ? 'text-emerald-600 dark:text-emerald-400'
                : successRate >= 50
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }
            value={successRate}
            suffix="%"
            label="Success Rate"
            trendColor={
              successRate >= 80
                ? 'text-emerald-600 dark:text-emerald-400'
                : successRate >= 50
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
            }
          />
        </div>

        <Separator className="mb-6" />

        {/* ── Charts Section ── */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Monthly Claims Volume — Area Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Monthly Volume</h3>
            </div>

            {monthlyVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={monthlyVolume} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monthlyVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    className="opacity-40"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: number) => [value, 'Claims']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#monthlyVolumeGradient)"
                    dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--color-primary)' }}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>

          {/* 2. Top Insurance Companies — Horizontal Bar Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Top Insurers (Completed)</h3>
            </div>

            {topInsuranceCompanies.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={topInsuranceCompanies}
                  layout="vertical"
                  margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    className="opacity-40"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'var(--color-foreground)', width: 90 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: number) => [value, 'Completed Claims']}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                    animationDuration={800}
                  >
                    {topInsuranceCompanies.map((_entry, index) => (
                      <Cell
                        key={`ins-cell-${index}`}
                        fill={INSURANCE_BAR_COLORS[index % INSURANCE_BAR_COLORS.length]}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                No completed claims data
              </div>
            )}
          </div>

          {/* 3. Claim Type Breakdown — Donut Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Claim Type Breakdown</h3>
            </div>

            {claimTypeBreakdown.length > 0 ? (
              <>
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <ResponsiveContainer width={160} height={120}>
                      <PieChart>
                        <Pie
                          data={claimTypeBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={54}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="type"
                          animationDuration={800}
                        >
                          {claimTypeBreakdown.map((_entry, index) => (
                            <Cell
                              key={`type-cell-${index}`}
                              fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          itemStyle={{ color: 'var(--color-foreground)' }}
                          labelStyle={{ color: 'var(--color-foreground)' }}
                          formatter={(value: number, _name: string, props: { payload: { type: string; count: number; _payload?: { total?: number } } }) => {
                            const total = claimTypeBreakdown.reduce((s, c) => s + c.count, 0)
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0
                            return [`${value} (${pct}%)`, props.payload.type]
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold text-foreground">
                        {claimTypeBreakdown.reduce((s, c) => s + c.count, 0)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">total</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {claimTypeBreakdown.map((item, index) => (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-sm shrink-0"
                        style={{
                          backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                        }}
                      />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {item.type} ({item.count})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                No claim type data
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
