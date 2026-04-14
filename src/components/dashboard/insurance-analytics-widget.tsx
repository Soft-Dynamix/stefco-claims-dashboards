'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  HeartPulse,
  FolderOpen,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { FadeIn } from '@/components/ui/motion'
import { useClaimsStore } from '@/store/claims-store'
import { getConfidenceColor, getConfidenceBg } from '@/lib/helpers'

// ── Color Palette ──
const COMPANY_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  '#0ea5e9',
  '#f97316',
  '#ec4899',
]

const MONTH_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
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
interface InsuranceCompany {
  id: string
  name: string
  folderName: string
  senderDomains: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { claims: number }
}

interface ClaimItem {
  id: string
  claimNumber: string
  clientName: string
  insuranceCompanyId: string | null
  insuranceCompany: { id: string; name: string; folderName: string } | null
  status: string
  confidenceScore: number
  createdAt: string
}

interface ComparisonItem {
  company: string
  totalClaims: number
  statusBreakdown: {
    NEW: number
    PROCESSING: number
    MANUAL_REVIEW: number
    COMPLETED: number
  }
  avgConfidence: number
}

interface CompanyAnalytics {
  name: string
  folderName: string
  totalClaims: number
  activeClaims: number
  completedClaims: number
  completionRate: number
  avgConfidence: number
  responseRating: 'Fast' | 'Medium' | 'Slow'
  trend: 'up' | 'down' | 'stable'
  trendPercent: number
}

// ── Health helpers ──
function getHealthColor(rate: number): { bg: string; text: string; border: string; dot: string } {
  if (rate >= 70) return { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' }
  if (rate >= 40) return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' }
  return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' }
}

function getResponseColor(rating: 'Fast' | 'Medium' | 'Slow'): string {
  if (rating === 'Fast') return 'text-emerald-600 dark:text-emerald-400'
  if (rating === 'Medium') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getResponseBg(rating: 'Fast' | 'Medium' | 'Slow'): string {
  if (rating === 'Fast') return 'bg-emerald-100 dark:bg-emerald-950/50'
  if (rating === 'Medium') return 'bg-amber-100 dark:bg-amber-950/50'
  return 'bg-red-100 dark:bg-red-950/50'
}

// ── Skeletons ──
function LeaderboardSkeleton() {
  return (
    <Card className="glass-card card-depth-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
            <Skeleton className="size-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PieSkeleton() {
  return (
    <Card className="glass-card card-depth-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-44" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function HealthSkeleton() {
  return (
    <Card className="glass-card card-depth-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/20 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function BarSkeleton() {
  return (
    <Card className="glass-card card-depth-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-48" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

// ── Sub-Components ──

// 1. Leaderboard Row
function LeaderboardRow({
  rank,
  company,
  index,
}: {
  rank: number
  company: CompanyAnalytics
  index: number
}) {
  const activePercent = company.totalClaims > 0
    ? Math.round((company.activeClaims / company.totalClaims) * 100)
    : 0
  const completedPercent = company.totalClaims > 0
    ? Math.round((company.completedClaims / company.totalClaims) * 100)
    : 0

  const rankColors: Record<number, string> = {
    1: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    2: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  }

  return (
    <FadeIn delay={index * 0.03}>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group cursor-default">
        {/* Rank Badge */}
        <div
          className={`flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 border ${
            rankColors[rank] || 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {rank}
        </div>

        {/* Company Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">
              {company.name}
            </span>
            <Badge
              variant="outline"
              className="text-[10px] shrink-0 gap-1 px-1.5 py-0 text-muted-foreground"
            >
              <FolderOpen className="size-2.5" />
              {company.folderName}
            </Badge>
          </div>

          {/* Stacked Progress Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${completedPercent}%` }}
              />
              <div
                className="h-full bg-sky-500 transition-all duration-500"
                style={{ width: `${activePercent}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap w-16 text-right">
              {company.activeClaims} / {company.completedClaims}
            </span>
          </div>
        </div>

        {/* Total Claims */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-foreground">
                {company.totalClaims}
              </span>
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                {company.trend === 'up' ? (
                  <TrendingUp className="size-3 text-emerald-500" />
                ) : company.trend === 'down' ? (
                  <TrendingDown className="size-3 text-red-500" />
                ) : null}
                <span
                  className={`text-[10px] font-medium ${
                    company.trend === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : company.trend === 'down'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {company.trendPercent > 0 ? '+' : ''}
                  {company.trendPercent}%
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{company.activeClaims} active, {company.completedClaims} completed</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </FadeIn>
  )
}

// 3. Health Score Card
function HealthCard({
  company,
  index,
}: {
  company: CompanyAnalytics
  index: number
}) {
  const health = getHealthColor(company.completionRate)
  const scoreLabel = company.completionRate >= 70 ? 'Healthy' : company.completionRate >= 40 ? 'Fair' : 'Needs Attention'

  return (
    <FadeIn delay={index * 0.03}>
      <div
        className={`p-4 rounded-xl border transition-all hover:shadow-sm ${health.bg} ${health.border}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`size-2.5 rounded-full ${health.dot}`} />
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
              {company.name}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${health.text} ${health.border} shrink-0`}
          >
            {scoreLabel}
          </Badge>
        </div>

        {/* Completion Rate */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">Completion Rate</span>
            <span className={`text-xs font-semibold ${getConfidenceColor(company.completionRate)}`}>
              {company.completionRate}%
            </span>
          </div>
          <Progress
            value={company.completionRate}
            className="h-1.5"
          />
        </div>

        {/* Avg Confidence */}
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Avg Confidence</span>
            <span className={`text-xs font-semibold ${getConfidenceColor(company.avgConfidence)}`}>
              {company.avgConfidence}%
            </span>
          </div>
        </div>

        {/* Response Time */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md ${getResponseBg(company.responseRating)}`}>
              <Clock className={`size-3 ${getResponseColor(company.responseRating)}`} />
              <span className={`text-[11px] font-medium ${getResponseColor(company.responseRating)}`}>
                {company.responseRating}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Simulated response time: {
              company.responseRating === 'Fast' ? '< 2 hours' :
              company.responseRating === 'Medium' ? '2-24 hours' :
              '> 24 hours'
            }</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </FadeIn>
  )
}

// ── Custom Legend for Pie Chart ──
interface CustomLegendProps {
  payload?: Array<{ value: string; color: string }>
  data: { name: string; value: number }[]
}

function CustomPieLegend({ payload, data }: CustomLegendProps) {
  if (!payload || !data) return null
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 px-2">
      {payload.map((entry, index) => {
        const item = data[index]
        const pct = total > 0 && item ? Math.round((item.value / total) * 100) : 0
        return (
          <div key={entry.value} className="flex items-center gap-1.5">
            <div
              className="size-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {entry.value} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Widget ──
export function InsuranceAnalyticsWidget() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  // Fetch insurance companies (primary data source)
  const { data: insuranceData, isLoading: insuranceLoading } = useQuery<{
    companies: InsuranceCompany[]
  }>({
    queryKey: ['insurance-analytics-companies', refreshKey],
    queryFn: () =>
      fetch('/api/insurance').then((r) => {
        if (!r.ok) throw new Error('Failed to load insurance companies')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch claims for detailed analysis (secondary data source)
  const { data: claimsData, isLoading: claimsLoading } = useQuery<{
    claims: ClaimItem[]
    total: number
  }>({
    queryKey: ['insurance-analytics-claims', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to load claims data')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Fetch comparison data for status breakdowns
  const { data: comparisonData } = useQuery<ComparisonItem[]>({
    queryKey: ['insurance-analytics-comparison', refreshKey],
    queryFn: () =>
      fetch('/api/insurance/comparison').then((r) => {
        if (!r.ok) throw new Error('Failed to load comparison data')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // ── Derived: Company Analytics ──
  const companyAnalytics = useMemo((): CompanyAnalytics[] => {
    const companies = insuranceData?.companies || []
    const claims = claimsData?.claims || []
    const comparison = comparisonData || []

    // Build a comparison map for fast lookup
    const comparisonMap = new Map<string, ComparisonItem>()
    for (const item of comparison) {
      comparisonMap.set(item.company, item)
    }

    // Build claims map grouped by insuranceCompanyId
    const claimsByCompany = new Map<string, ClaimItem[]>()
    for (const claim of claims) {
      if (claim.insuranceCompanyId) {
        const existing = claimsByCompany.get(claim.insuranceCompanyId) || []
        existing.push(claim)
        claimsByCompany.set(claim.insuranceCompanyId, existing)
      }
    }

    // Build analytics per company
    const analytics: CompanyAnalytics[] = companies
      .filter((c) => c.isActive && c._count.claims > 0)
      .map((company) => {
        const companyClaims = claimsByCompany.get(company.id) || []
        const comp = comparisonMap.get(company.name)

        const totalClaims = comp?.totalClaims || company._count.claims
        const completedClaims = comp?.statusBreakdown.COMPLETED || 0
        const activeClaims = totalClaims - completedClaims
        const avgConfidence = comp?.avgConfidence || 0

        const completionRate = totalClaims > 0 ? Math.round((completedClaims / totalClaims) * 100) : 0

        // Simulate response rating based on completion rate and avg confidence
        let responseRating: 'Fast' | 'Medium' | 'Slow' = 'Medium'
        if (completionRate >= 60 && avgConfidence >= 75) responseRating = 'Fast'
        else if (completionRate < 30 || avgConfidence < 50) responseRating = 'Slow'

        // Simulate trend based on claim distribution
        const newCount = comp?.statusBreakdown.NEW || 0
        const processingCount = comp?.statusBreakdown.PROCESSING || 0
        const activeRatio = totalClaims > 0 ? newCount / totalClaims : 0
        let trend: 'up' | 'down' | 'stable' = 'stable'
        let trendPercent = 0
        if (activeRatio > 0.3) {
          trend = 'up'
          trendPercent = Math.round(activeRatio * 100)
        } else if (activeRatio < 0.1 && completionRate > 50) {
          trend = 'down'
          trendPercent = -Math.round(Math.random() * 10 + 5)
        } else {
          trendPercent = Math.round((Math.random() - 0.5) * 10)
        }

        return {
          name: company.name,
          folderName: company.folderName,
          totalClaims,
          activeClaims,
          completedClaims,
          completionRate,
          avgConfidence,
          responseRating,
          trend,
          trendPercent,
        }
      })
      .sort((a, b) => b.totalClaims - a.totalClaims)

    return analytics
  }, [insuranceData, claimsData, comparisonData])

  // ── Derived: Pie Chart Data (claims by company) ──
  const pieData = useMemo(() => {
    return companyAnalytics.slice(0, 8).map((c) => ({
      name: c.name,
      value: c.totalClaims,
    }))
  }, [companyAnalytics])

  // ── Derived: Monthly Comparison Data (top 5 companies) ──
  const monthlyBarData = useMemo(() => {
    const claims = claimsData?.claims || []
    const top5 = companyAnalytics.slice(0, 5)

    if (top5.length === 0 || claims.length === 0) return []

    // Build company name -> claims map
    const claimsByCompany = new Map<string, ClaimItem[]>()
    for (const claim of claims) {
      if (claim.insuranceCompany) {
        const existing = claimsByCompany.get(claim.insuranceCompany.name) || []
        existing.push(claim)
        claimsByCompany.set(claim.insuranceCompany.name, existing)
      }
    }

    // Group claims by month for each top company
    const months = new Set<string>()
    const monthlyMap = new Map<string, Map<string, number>>()

    for (const company of top5) {
      const companyClaims = claimsByCompany.get(company.name) || []
      const monthCounts = new Map<string, number>()

      for (const claim of companyClaims) {
        const d = new Date(claim.createdAt)
        const key = d.toLocaleDateString('en-ZA', { month: 'short' })
        monthCounts.set(key, (monthCounts.get(key) || 0) + 1)
        months.add(key)
      }

      monthlyMap.set(company.name, monthCounts)
    }

    // Get last 6 months sorted
    const sortedMonths = Array.from(months).slice(-6)

    return sortedMonths.map((month) => {
      const row: Record<string, string | number> = { month }
      for (const company of top5) {
        const counts = monthlyMap.get(company.name)
        row[company.name] = counts?.get(month) || 0
      }
      return row
    })
  }, [companyAnalytics, claimsData])

  const top5Names = companyAnalytics.slice(0, 5).map((c) => c.name)
  const top8 = companyAnalytics.slice(0, 8)

  const isLoading = insuranceLoading || claimsLoading

  // ── Render ──
  return (
    <div className="space-y-5">
      {/* Section Header */}
      <FadeIn delay={0}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
            <BarChart3 className="size-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground leading-tight">
              Insurance Company Analytics
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Performance insights &amp; claim distribution across insurers
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Row 1: Leaderboard + Pie Chart */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-5">
        {/* 1. Insurance Company Leaderboard (takes 3 cols) */}
        <FadeIn delay={0.03} className="lg:col-span-3">
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : (
            <Card className="glass-card card-depth-2 card-hover-lift">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                      <Building2 className="size-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">
                        Company Leaderboard
                      </CardTitle>
                      <CardDescription className="text-[11px] mt-0.5">
                        Top 8 insurers by claim volume
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {top8.length} companies
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Legend */}
                <div className="flex items-center gap-4 mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">Completed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-sky-500" />
                    <span className="text-[10px] text-muted-foreground">Active</span>
                  </div>
                </div>

                {top8.length > 0 ? (
                  top8.map((company, index) => (
                    <LeaderboardRow
                      key={company.name}
                      rank={index + 1}
                      company={company}
                      index={index}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Building2 className="size-8 opacity-30 mb-2" />
                    <p className="text-sm">No insurance company data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </FadeIn>

        {/* 2. Claims by Company Pie Chart (takes 2 cols) */}
        <FadeIn delay={0.06} className="lg:col-span-2">
          {isLoading ? (
            <PieSkeleton />
          ) : (
            <Card className="glass-card card-depth-2 card-hover-lift">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                    <PieChartIcon className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      Claims Distribution
                    </CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">
                      Share by insurance company
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <>
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <ResponsiveContainer width={220} height={220}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="value"
                              nameKey="name"
                              animationDuration={800}
                            >
                              {pieData.map((_entry, index) => (
                                <Cell
                                  key={`pie-cell-${index}`}
                                  fill={COMPANY_COLORS[index % COMPANY_COLORS.length]}
                                  fillOpacity={0.85}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={TOOLTIP_STYLE}
                              itemStyle={{ color: 'var(--color-foreground)' }}
                              labelStyle={{ color: 'var(--color-foreground)' }}
                              formatter={(value: number, _name: string) => {
                                const total = pieData.reduce((s, d) => s + d.value, 0)
                                const pct = total > 0 ? Math.round((value / total) * 100) : 0
                                return [`${value} claims (${pct}%)`, 'Volume']
                              }}
                            />
                            <Legend
                              content={<CustomPieLegend payload={undefined} data={pieData} />}
                              wrapperStyle={{ paddingTop: 8 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-foreground">
                            {pieData.reduce((s, d) => s + d.value, 0)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">total</span>
                        </div>
                      </div>
                    </div>

                    {/* Custom Legend below chart */}
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 px-2">
                      {pieData.map((item, index) => {
                        const total = pieData.reduce((s, d) => s + d.value, 0)
                        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                        return (
                          <div key={item.name} className="flex items-center gap-1.5">
                            <div
                              className="size-2.5 rounded-sm shrink-0"
                              style={{
                                backgroundColor: COMPANY_COLORS[index % COMPANY_COLORS.length],
                              }}
                            />
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {item.name} ({pct}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    No claim distribution data
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </FadeIn>
      </div>

      {/* Row 2: Health Scores */}
      <FadeIn delay={0.09}>
        {isLoading ? (
          <HealthSkeleton />
        ) : (
          <Card className="glass-card card-depth-2 card-hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                    <HeartPulse className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      Company Health Scores
                    </CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">
                      Completion rate, confidence &amp; response metrics
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                        <div className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Healthy</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Completion rate ≥ 70%</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30">
                        <div className="size-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Fair</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Completion rate 40-69%</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/30">
                        <div className="size-2 rounded-full bg-red-500" />
                        <span className="text-[10px] text-red-700 dark:text-red-400 font-medium">At Risk</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Completion rate &lt; 40%</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {top8.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {top8.map((company, index) => (
                    <HealthCard
                      key={company.name}
                      company={company}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Activity className="size-8 opacity-30 mb-2" />
                  <p className="text-sm">No health data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </FadeIn>

      {/* Row 3: Monthly Comparison Bar Chart */}
      <FadeIn delay={0.12}>
        {isLoading ? (
          <BarSkeleton />
        ) : (
          <Card className="glass-card card-depth-2 card-hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                    <Activity className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      Monthly Claim Volume
                    </CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">
                      Top 5 companies by monthly comparison
                    </CardDescription>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] gap-1 cursor-default">
                      <Award className="size-3" />
                      {top5Names.length} insurers
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {top5Names.length > 0
                      ? top5Names.join(', ')
                      : 'No data'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={monthlyBarData}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      className="opacity-40"
                    />
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
                    <RechartsTooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
                    />
                    {top5Names.map((name, index) => (
                      <Bar
                        key={`bar-${name}`}
                        dataKey={name}
                        fill={MONTH_COLORS[index % MONTH_COLORS.length]}
                        fillOpacity={0.85}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                        animationDuration={800}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  No monthly comparison data
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </FadeIn>
    </div>
  )
}
