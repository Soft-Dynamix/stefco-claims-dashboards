'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  TrendingUp,
  Timer,
  CheckCircle2,
  Zap,
  ArrowRight,
  Building2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClaimsStore } from '@/store/claims-store'
import { getConfidenceColor, getConfidenceBg, formatRelativeTime } from '@/lib/helpers'

const INSURANCE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
]

const CLAIM_TYPE_COLORS: Record<string, string> = {
  Motor: 'var(--color-chart-1)',
  Building: 'var(--color-chart-2)',
  Marine: 'var(--color-chart-3)',
  Agricultural: 'var(--color-chart-4)',
  Household: 'var(--color-chart-5)',
  Liability: 'var(--color-chart-6)',
}

const tooltipStyle = {
  fontSize: 13,
  padding: '10px 14px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

interface ClaimsResponse {
  claims: {
    id: string
    claimNumber: string
    claimType: string
    status: string
    processingStage: string
    confidenceScore: number
    createdAt: string
    updatedAt: string
    processedAt: string | null
    insuranceCompany: { id: string; name: string } | null
  }[]
  total: number
}

interface InsuranceCompany {
  id: string
  name: string
  _count: { claims: number }
}

function AnalyticsSkeleton() {
  return (
    <Card className="card-depth-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-muted/30 p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-14 mt-1" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function KeyMetricBox({
  icon: Icon,
  label,
  value,
  subtext,
  colorClass = 'text-foreground',
  iconBg = 'bg-muted/50',
  iconColor = 'text-muted-foreground',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtext?: string
  colorClass?: string
  iconBg?: string
  iconColor?: string
}) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border/50 p-4 hover:bg-muted/50 transition-colors metric-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`flex items-center justify-center size-8 rounded-lg ${iconBg}`}>
          <Icon className={`size-4 ${iconColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight stat-glow ${colorClass}`}>{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  )
}

export function ClaimsAnalyticsWidget() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const [activeTab, setActiveTabLocal] = useState('insurance')

  const { data: claimsData, isLoading: claimsLoading } = useQuery<ClaimsResponse>({
    queryKey: ['claims-analytics-all'],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      }),
    staleTime: 60000,
    retry: 2,
  })

  const { data: insuranceData } = useQuery<{ companies: InsuranceCompany[] }>({
    queryKey: ['insurance-analytics'],
    queryFn: () =>
      fetch('/api/insurance').then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      }),
    staleTime: 60000,
    retry: 2,
  })

  const analytics = useMemo(() => {
    const claims = claimsData?.claims || []
    const companies = insuranceData?.companies || []

    // Claims by insurance company
    const byCompany: Record<string, number> = {}
    claims.forEach((c) => {
      const name = c.insuranceCompany?.name || 'Unassigned'
      byCompany[name] = (byCompany[name] || 0) + 1
    })
    const companyChartData = Object.entries(byCompany)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Average processing time by claim type
    const typeTimes: Record<string, { total: number; count: number }> = {}
    claims.forEach((c) => {
      if (c.processedAt && c.createdAt) {
        const created = new Date(c.createdAt).getTime()
        const processed = new Date(c.processedAt).getTime()
        const hours = Math.max(1, Math.round((processed - created) / (1000 * 60 * 60)))
        if (!typeTimes[c.claimType]) typeTimes[c.claimType] = { total: 0, count: 0 }
        typeTimes[c.claimType].total += hours
        typeTimes[c.claimType].count += 1
      }
    })
    const typeChartData = Object.entries(typeTimes).map(([type, data]) => ({
      type,
      avgHours: Math.round(data.total / data.count),
      count: data.count,
    }))

    // Monthly claims trend (last 6 months)
    const monthlyData: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
      monthlyData[key] = 0
    }
    claims.forEach((c) => {
      const d = new Date(c.createdAt)
      const key = d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
      if (key in monthlyData) monthlyData[key]++
    })
    const monthlyChartData = Object.entries(monthlyData).map(([month, count]) => ({
      month,
      count,
    }))

    // Key metrics
    const nowStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const thisMonth = claims.filter((c) => new Date(c.createdAt).getTime() >= nowStart)

    const processedClaims = claims.filter(
      (c) => c.status === 'COMPLETED' && c.processedAt && c.createdAt
    )
    const totalHours = processedClaims.reduce((sum, c) => {
      return sum + Math.max(1, (new Date(c.processedAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60))
    }, 0)
    const avgResolutionTime =
      processedClaims.length > 0 ? Math.round(totalHours / processedClaims.length) : 0

    const successRate =
      claims.length > 0
        ? Math.round((claims.filter((c) => c.status === 'COMPLETED').length / claims.length) * 100)
        : 0

    const fastestResolved =
      processedClaims.length > 0
        ? Math.round(
            Math.min(
              ...processedClaims.map(
                (c) => (new Date(c.processedAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60)
              )
            )
          )
        : 0

    return {
      companyChartData,
      typeChartData,
      monthlyChartData,
      keyMetrics: {
        processedThisMonth: thisMonth.length,
        avgResolutionTime: avgResolutionTime > 24 ? `${(avgResolutionTime / 24).toFixed(1)}d` : `${avgResolutionTime}h`,
        successRate,
        fastestResolved: fastestResolved > 24 ? `${(fastestResolved / 24).toFixed(1)}d` : `${fastestResolved}h`,
      },
      companies,
    }
  }, [claimsData, insuranceData])

  if (claimsLoading) return <AnalyticsSkeleton />

  return (
    <Card className="card-depth-2 card-shine card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Claims Analytics</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {claimsData?.total || 0} total
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => setActiveTab('claims')}
            >
              View All <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <KeyMetricBox
            icon={CheckCircle2}
            label="Processed This Month"
            value={analytics.keyMetrics.processedThisMonth}
            subtext={`of ${claimsData?.total || 0} total`}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <KeyMetricBox
            icon={Timer}
            label="Avg Resolution Time"
            value={analytics.keyMetrics.avgResolutionTime}
            subtext="Time to complete"
            iconBg="bg-sky-100 dark:bg-sky-950/50"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <KeyMetricBox
            icon={Zap}
            label="Success Rate"
            value={`${analytics.keyMetrics.successRate}%`}
            subtext="Completed claims"
            colorClass={analytics.keyMetrics.successRate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <KeyMetricBox
            icon={TrendingUp}
            label="Fastest Resolved"
            value={analytics.keyMetrics.fastestResolved}
            subtext="Quickest turnaround"
            iconBg="bg-violet-100 dark:bg-violet-950/50"
            iconColor="text-violet-600 dark:text-violet-400"
          />
        </div>

        {/* Tabs for Chart Views */}
        <Tabs value={activeTab} onValueChange={setActiveTabLocal}>
          <TabsList className="mb-4">
            <TabsTrigger value="insurance" className="text-xs gap-1">
              <Building2 className="size-3" />
              By Insurer
            </TabsTrigger>
            <TabsTrigger value="processing" className="text-xs gap-1">
              <Timer className="size-3" />
              Processing Time
            </TabsTrigger>
            <TabsTrigger value="trend" className="text-xs gap-1">
              <TrendingUp className="size-3" />
              Monthly Trend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insurance">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.companyChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-foreground)' }}
                  formatter={(value: number) => [value, 'Claims']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {analytics.companyChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={INSURANCE_COLORS[index % INSURANCE_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="processing">
            {analytics.typeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.typeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--color-muted-foreground)' } }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: number, name: string) => [
                      `${value}h`,
                      name === 'avgHours' ? 'Avg Hours' : 'Claims',
                    ]}
                  />
                  <Bar dataKey="avgHours" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {analytics.typeChartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.type}`}
                        fill={CLAIM_TYPE_COLORS[entry.type] || 'var(--color-muted-foreground)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No processed claims data available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: 'var(--color-foreground)' }}
                  labelStyle={{ color: 'var(--color-foreground)' }}
                  formatter={(value: number) => [value, 'Claims']}
                />
                <defs>
                  <linearGradient id="analyticsTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ fill: 'var(--color-primary)', r: 4, strokeWidth: 2, stroke: 'var(--color-background)' }}
                  activeDot={{ r: 6, fill: 'var(--color-primary)' }}
                  fill="url(#analyticsTrendGrad)"
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
