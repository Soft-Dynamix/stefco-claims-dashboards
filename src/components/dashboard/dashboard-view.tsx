'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowRight,
  Building2,
  ShieldCheck,
  Shield,
  AlertTriangle,
  User,
  Activity,
  Plus,
  Search,
  Printer,
  ClipboardList,
  RefreshCw,
  Zap,
  Timer,
  AlertCircle,
  Hourglass,
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronUp,
  Users,
  Target,
  Car,
  Heart,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FadeIn } from '@/components/ui/motion'
import { ErrorRetry } from '@/components/ui/error-retry'
import { useClaimsStore } from '@/store/claims-store'
import { ActivityFeedWidget } from '@/components/dashboard/activity-feed-widget'
import { ClaimsStatsPanel } from '@/components/dashboard/claims-stats-panel'
import { InsuranceBreakdownWidget } from '@/components/dashboard/insurance-breakdown-widget'
import { StatusSummaryBar } from '@/components/dashboard/status-summary-bar'
import { ClaimsAgingWidget } from '@/components/dashboard/claims-aging-widget'
import { AgingAlertCard } from '@/components/dashboard/aging-alert-card'
import { InsuranceComparisonChart } from '@/components/dashboard/insurance-comparison-chart'
import { ClaimsAnalyticsWidget } from '@/components/dashboard/claims-analytics-widget'
import { PerformanceAnalytics } from '@/components/dashboard/performance-analytics'
import { AIPerformanceWidget } from '@/components/dashboard/ai-performance-widget'
import { PrintQueueAnalytics } from '@/components/dashboard/print-queue-analytics'
import { ResponseTimeTracker } from '@/components/dashboard/response-time-tracker'
import { WeeklySummaryWidget } from '@/components/dashboard/weekly-summary-widget'
import { ClaimsStatisticsPanel } from '@/components/dashboard/claims-statistics-panel'
import { QuickActionsPanel } from '@/components/dashboard/quick-actions-panel'
import { QuickStatsWidget } from '@/components/dashboard/quick-stats-widget'
import { StatusOverviewCards } from '@/components/dashboard/status-overview-cards'
import { InsuranceScorecardWidget } from '@/components/dashboard/insurance-scorecard-widget'
import { AgingReportWidget } from '@/components/dashboard/aging-report-widget'
import { ClaimsPipelineWidget } from '@/components/claims/claims-pipeline-widget'
import { formatDistanceToNow } from 'date-fns'
import {
  getStatusColor,
  getStatusLabel,
  getStatusBadgeGlow,
  getConfidenceColor,
  getConfidenceBg,
  formatDate,
} from '@/lib/helpers'

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-muted-foreground)',
]

const INSURANCE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-muted-foreground)',
]

const STATUS_FILL_MAP: Record<string, string> = {
  NEW: '#0ea5e9',
  PROCESSING: '#f59e0b',
  COMPLETED: '#10b981',
  MANUAL_REVIEW: '#f97316',
  FAILED: '#ef4444',
  PENDING_REVIEW: '#8b5cf6',
}

interface ActivityFeedItem {
  id: string
  action: string
  details: string | null
  status: string
  claimNumber: string | null
  clientName: string | null
  createdAt: string
}

interface DashboardData {
  totalClaims: number
  claimsToday: number
  claimsThisWeek: number
  claimsThisMonth: number
  claimsByStatus: Record<string, number>
  claimsByType: Record<string, number>
  averageConfidenceScore: number
  documentsPrinted: number
  manualReviewPending: number
  recentClaims: {
    id: string
    claimNumber: string
    clientName: string
    claimType: string
    status: string
    insuranceCompany: { name: string; folderName: string } | null
    confidenceScore: number
    createdAt: string
  }[]
  dailyClaimsTrend: { date: string; count: number }[]
  topInsuranceCompanies: { name: string; folderName: string; count: number }[]
  slaCompliance: number
  overdueClaims: number
  weeklyChange: number
  claimsLastWeek: number
  highPriorityClaims: {
    id: string
    claimNumber: string
    clientName: string
    status: string
    confidenceScore: number
    claimType: string
    createdAt: string
    insuranceCompany: { name: string } | null
  }[]
  avgProcessingTime: number
}

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  confidenceValue,
  borderColor,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down'
  trendLabel?: string
  confidenceValue?: number
  borderColor?: string
}) {
  return (
    <Card className={`py-6 card-shine card-hover card-lift card-depth-1 hover:shadow-md transition-shadow duration-200 h-full card-enter fade-in-up card-premium hover-lift-sm card-gradient-border ${borderColor || ''}`}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="flex items-center justify-center size-11 rounded-xl bg-gradient-to-br from-primary/8 to-accent/5">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-foreground tracking-tight stat-glow stat-number-glow count-up stat-animate">
            {confidenceValue !== undefined ? (
              <span className={getConfidenceColor(confidenceValue)}>
                {value}%
              </span>
            ) : (
              value
            )}
          </span>
          {trend && trendLabel && (
            <span
              className={`flex items-center gap-1 text-sm font-medium mb-1 ${
                trend === 'up'
                  ? 'text-emerald-600'
                  : 'text-red-600'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
              {trendLabel}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

function SLACircularProgress({ value, size = 80 }: { value: number; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  const colorClass = value > 90 ? 'text-emerald-600 dark:text-emerald-400' : value > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
  const strokeColor = value > 90 ? '#059669' : value > 70 ? '#D97706' : '#DC2626'

  return (
    <div className={`relative inline-flex items-center justify-center ${value < 70 ? 'sla-warning-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ overflow: 'visible' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className={`absolute text-sm font-bold ${colorClass}`}>
        {value}%
      </span>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getConfidenceBg(value)} progress-bar`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${getConfidenceColor(value)}`}>
        {value}%
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const glowClass = getStatusBadgeGlow(status)
  const statusGlowClass = status === 'COMPLETED' ? 'badge-glow-success' : status === 'FAILED' ? 'badge-glow-danger' : status === 'MANUAL_REVIEW' ? 'badge-glow-warning' : ''
  return (
    <Badge
      variant="outline"
      className={`${getStatusColor(status)} text-xs font-medium ${glowClass} ${statusGlowClass}`}
    >
      {getStatusLabel(status)}
    </Badge>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="py-5 shimmer-bg shimmer-enhanced">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card className="py-5">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

// --- Claim Type Badge ---
const CLAIM_TYPE_CONFIG: Record<string, { className: string; icon: React.ElementType }> = {
  Motor: { className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800', icon: Car },
  Building: { className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', icon: Building2 },
  Household: { className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', icon: Building2 },
  Marine: { className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800', icon: ShieldCheck },
  Agricultural: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', icon: Heart },
  Liability: { className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800', icon: Shield },
}

function ClaimTypeBadge({ type }: { type: string }) {
  const config = CLAIM_TYPE_CONFIG[type] || { className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', icon: FileText }
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} text-xs font-medium gap-1 shrink-0`}>
      <Icon className="size-3" />
      {type}
    </Badge>
  )
}

// --- Recent Claims Table Widget ---
interface RecentClaimItem {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  confidenceScore: number
  createdAt: string
  insuranceCompany: { name: string; folderName: string } | null
}

function RecentClaimsTableWidget() {
  const setSelectedClaimId = useClaimsStore((s) => s.setSelectedClaimId)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const { data: recentData, isLoading: recentLoading } = useQuery<{ claims: RecentClaimItem[] }>({
    queryKey: ['recent-claims'],
    queryFn: () => fetch('/api/claims?limit=5').then((r) => {
      if (!r.ok) throw new Error('Failed to load recent claims')
      return r.json()
    }),
    staleTime: 10000,
    retry: 2,
    retryDelay: 1000,
  })

  const claims = recentData?.claims || []

  const handleRowClick = (claimId: string) => {
    setSelectedClaimId(claimId)
    setActiveTab('claims')
  }

  const handleViewAll = () => {
    setActiveTab('claims')
  }

  return (
    <Card className="card-shine card-enter hover-scale card-depth-2 scroll-shadow-top">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
              <FileText className="size-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight gradient-heading text-balance">Recent Claims</CardTitle>
              <CardDescription className="text-xs mt-0.5">Latest claims activity</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-primary gap-1 h-7 px-2"
            onClick={handleViewAll}
          >
            View All
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="table-container rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent table-header-modern">
                <TableHead className="text-xs font-semibold h-9">Claim #</TableHead>
                <TableHead className="text-xs font-semibold h-9 hidden sm:table-cell">Client</TableHead>
                <TableHead className="text-xs font-semibold h-9 hidden md:table-cell">Type</TableHead>
                <TableHead className="text-xs font-semibold h-9 hidden lg:table-cell">Status</TableHead>
                <TableHead className="text-xs font-semibold h-9 hidden lg:table-cell">Confidence</TableHead>
                <TableHead className="text-xs font-semibold h-9 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-stripe">
              {recentLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`} className="hover:bg-transparent">
                    <TableCell>
                      <Skeleton className="h-4 w-20 font-mono" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-2 w-full rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-3 w-12 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : claims.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="size-8 opacity-30" />
                      <p className="text-sm">No recent claims</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => (
                  <TableRow
                    key={claim.id}
                    className="group hover:bg-primary/5 transition-colors cursor-pointer table-row-animate"
                    onClick={() => handleRowClick(claim.id)}
                  >
                    <TableCell className="font-bold font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                      {claim.claimNumber}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {claim.clientName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ClaimTypeBadge type={claim.claimType} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <ConfidenceBar value={claim.confidenceScore} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true })
                        } catch {
                          return formatDate(claim.createdAt)
                        }
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

interface AgingData {
  aging: Record<string, { brackets: { label: string; count: number; minHours: number; maxHours: number }[] }>
}

const dateRangePresets = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
  { value: 'all', label: 'All Time' },
]

function getDateRangeParams(preset: string): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') return {}
  const days = parseInt(preset, 10)
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return { dateFrom: from.toISOString().split('T')[0] }
}

export function DashboardView() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const setSelectedClaimId = useClaimsStore((s) => s.setSelectedClaimId)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const queryClient = useQueryClient()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [countdown, setCountdown] = useState(30)
  const [dateRange, setDateRange] = useState('30')

  useEffect(() => {
    if (!autoRefresh) return
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(countdownInterval)
  }, [autoRefresh])

  const handleAutoRefreshToggle = () => {
    setAutoRefresh((prev) => !prev)
  }

  const { data: activityData } = useQuery<{ activities: ActivityFeedItem[] }>({
    queryKey: ['activity-feed', refreshKey],
    queryFn: () => fetch('/api/activity-feed').then((r) => { if (!r.ok) throw new Error('Failed to load activity feed'); return r.json() }),
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 2,
    retryDelay: 1000,
  })

  const { data, isLoading, error, dataUpdatedAt, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard', refreshKey, dateRange],
    queryFn: () => {
      const params = new URLSearchParams()
      const rangeParams = getDateRangeParams(dateRange)
      if (rangeParams.dateFrom) params.set('dateFrom', rangeParams.dateFrom)
      return fetch(`/api/dashboard?${params.toString()}`).then((r) => { if (!r.ok) throw new Error('Failed to load dashboard'); return r.json() })
    },
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 5000,
    retry: 3,
    retryDelay: 3000,
  })

  const { data: agingData } = useQuery<AgingData>({
    queryKey: ['claim-aging', refreshKey],
    queryFn: () => fetch('/api/claims/aging').then((r) => { if (!r.ok) throw new Error('Failed to load aging data'); return r.json() }),
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 2,
    retryDelay: 1000,
  })

  const lastUpdatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--'

  const statusChartData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.claimsByStatus).map(([status, count]) => ({
      status,
      count,
    }))
  }, [data])

  const typeChartData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.claimsByType).map(([type, count]) => ({
      type,
      count,
    }))
  }, [data])

  const trendChartData = useMemo(() => {
    if (!data) return []
    return data.dailyClaimsTrend
  }, [data])

  const handleClaimClick = (claimId: string) => {
    setSelectedClaimId(claimId)
    setActiveTab('claims')
  }

  if (error) {
    return (
      <ErrorRetry
        message="Failed to load dashboard data. The server may be temporarily unavailable."
        onRetry={() => refetchDashboard()}
      />
    )
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <>
          <StatsSkeleton />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      ) : data ? (
        <>
          {/* Row 1: KPI Cards */}
          {/* Welcome Banner */}
          <FadeIn delay={0}>
          <Card className="card-shine glass-card glass-card-enhanced banner-gradient-animate bg-gradient-to-r from-primary/8 via-primary/3 to-accent/5 border-l-4 border-l-primary rounded-r-lg overflow-hidden text-shadow-sm card-float">
            <CardContent className="p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-primary/10">
                    <User className="size-6 text-primary dark:text-primary/90" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground leading-tight text-gradient gradient-text">
                      {(() => {
                        const hour = new Date().getHours()
                        if (hour < 12) return 'Good morning'
                        if (hour < 18) return 'Good afternoon'
                        return 'Good evening'
                      })()}
                    </h2>
                    <p className="text-sm text-foreground/80 dark:text-foreground/70 leading-snug">Here's your claims processing overview</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-[130px] h-8 text-xs gap-1">
                        <Calendar className="size-3 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dateRangePresets.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value} className="text-xs">
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant={autoRefresh ? 'default' : 'secondary'}
                      size="sm"
                      className={`gap-1.5 text-xs h-8 btn-press btn-press-enhanced ${autoRefresh ? '' : 'shadow-sm hover:shadow-md'}`}
                      onClick={handleAutoRefreshToggle}
                    >
                      <RefreshCw className={`size-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
                      {autoRefresh ? `${countdown}s` : 'Auto-refresh'}
                    </Button>
                    {dateRange !== '30' && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {dateRangePresets.find(p => p.value === dateRange)?.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-muted-foreground"><span className="text-foreground font-semibold">Today:</span> {data.claimsToday}</span>
                    <span className="text-border hidden sm:inline">•</span>
                    <span className="text-muted-foreground hidden sm:inline"><span className="text-foreground font-semibold">Overdue:</span> {data.overdueClaims}</span>
                    <span className="text-border hidden sm:inline">•</span>
                    <span className="text-muted-foreground hidden sm:inline"><span className="text-foreground font-semibold">Queue:</span> {data.manualReviewPending}</span>
                    <span className="text-border hidden lg:inline">•</span>
                    <span className="text-muted-foreground/60 text-xs hidden lg:inline">Last updated: {lastUpdatedTime}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </FadeIn>

          <div className="divider-dot"></div>

          {/* Status Summary Bar */}
          <FadeIn delay={0.05}>
            <StatusSummaryBar />
          </FadeIn>

          {/* Claims Pipeline */}
          <FadeIn delay={0.07}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-muted-foreground tracking-wide">Claims Pipeline</span>
              </div>
              <ClaimsPipelineWidget />
            </div>
          </FadeIn>

          {/* Quick Actions Panel */}
          <FadeIn delay={0.09}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-muted-foreground tracking-wide">Quick Actions</span>
              </div>
              <QuickActionsPanel />
            </div>
          </FadeIn>

          {/* Quick Stats Overview */}
          <FadeIn delay={0.02}>
            <QuickStatsWidget />
          </FadeIn>

          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <FadeIn delay={0.05}>
              <StatsCard
                title="Total Claims"
                value={data.totalClaims}
                subtitle="All time claims processed"
                icon={FileText}
                trend="up"
                trendLabel="+12%"
                borderColor="border-l-4 border-l-primary/30"
              />
            </FadeIn>
            <FadeIn delay={0.07}>
              <StatsCard
                title="Claims Today"
                value={data.claimsToday}
                subtitle="New claims received today"
                icon={Calendar}
                trend="up"
                trendLabel="+3"
                borderColor="border-l-4 border-l-sky-400/50"
              />
            </FadeIn>
            <FadeIn delay={0.09}>
              <StatsCard
                title="Pending Review"
                value={data.manualReviewPending}
                subtitle="Awaiting manual review"
                icon={Clock}
                borderColor="border-l-4 border-l-amber-400/50"
              />
            </FadeIn>
            <FadeIn delay={0.11}>
              <StatsCard
                title="Avg Confidence"
                value={data.averageConfidenceScore}
                confidenceValue={data.averageConfidenceScore}
                subtitle="AI classification accuracy"
                icon={TrendingUp}
                borderColor="border-l-4 border-l-emerald-400/50"
              />
            </FadeIn>
            {/* SLA Compliance Card */}
            <FadeIn delay={0.13}>
              <Card className="py-6 card-shine card-hover card-lift hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/30 h-full card-enter card-depth-2 hover-lift-sm card-float">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-muted-foreground">
                    SLA Compliance
                  </CardTitle>
                  <div className="flex items-center justify-center size-11 rounded-xl bg-gradient-to-br from-primary/8 to-accent/5">
                    <ShieldCheck className="size-5 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <SLACircularProgress value={data.slaCompliance} size={80} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-muted-foreground">
                        Target: 2h
                      </span>
                    </div>
                    {data.overdueClaims > 0 ? (
                      <div className="flex items-center gap-1 mt-1.5">
                        <AlertTriangle className="size-4 text-red-500" />
                        <span className="text-sm text-red-600 font-medium">
                          {data.overdueClaims} overdue
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-emerald-600 font-medium mt-1.5">
                        On track
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </FadeIn>
          </div>

          {/* Status Overview Cards — Quick-filter by status */}
          <FadeIn delay={0.06}>
            <StatusOverviewCards />
          </FadeIn>

          {/* Enhanced Claims Statistics Panel */}
          <FadeIn delay={0.12}>
            <ClaimsStatisticsPanel />
          </FadeIn>

          {/* Recent Claims Table Widget */}
          <FadeIn delay={0.14}>
            <RecentClaimsTableWidget />
          </FadeIn>

          {/* Row 2: Charts (3-column) */}
          <FadeIn delay={0.15}>
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3 scroll-reveal">
            {/* Claims by Status */}
            <Card className="py-6 card-shine chart-card hover-scale card-depth-2">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold gradient-heading text-shadow-sm">Claims by Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="chart-container-modern">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-50" />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 13,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-popover)',
                        color: 'var(--color-popover-foreground)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        backdropFilter: 'blur(8px)',
                      }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                      formatter={(value: number) => [value, 'Claims']}
                      labelFormatter={(label: string) =>
                        getStatusLabel(label)
                      }
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={`status-cell-${entry.status}`} fill={STATUS_FILL_MAP[entry.status] || '#64748B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Claims by Type */}
            <Card className="py-6 card-shine chart-card hover-scale card-depth-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold gradient-heading text-shadow-sm">Claims by Type</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="type"
                    >
                      {typeChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        fontSize: 13,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-popover)',
                        color: 'var(--color-popover-foreground)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        backdropFilter: 'blur(8px)',
                      }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                      formatter={(value: number) => [value, 'Claims']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  {typeChartData.map((item, index) => (
                    <div key={item.type} className="flex items-center gap-1 text-xs">
                      <div
                        className="size-2 rounded-sm"
                        style={{
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span className="text-muted-foreground">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Claims Trend (Last 30 Days) */}
            <Card className="py-6 card-shine chart-card hover-scale card-depth-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold gradient-heading text-shadow-sm">
                    Claims Trend (30d)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-50" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: string) => {
                        const d = new Date(value)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 13,
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-popover)',
                        color: 'var(--color-popover-foreground)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        backdropFilter: 'blur(8px)',
                      }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                      formatter={(value: number) => [value, 'Claims']}
                    />
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--color-primary)', r: 3 }}
                      activeDot={{ r: 5, fill: 'var(--color-primary)' }}
                      fill="url(#trendGradient)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          </FadeIn>

          {/* AI Performance Analytics Widget */}
          <FadeIn delay={0.17}>
            <AIPerformanceWidget />
          </FadeIn>

          {/* Print Queue Analytics Widget */}
          <FadeIn delay={0.19}>
            <PrintQueueAnalytics />
          </FadeIn>

          {/* Claim Response Time Tracker Widget */}
          <FadeIn delay={0.21}>
            <ResponseTimeTracker />
          </FadeIn>

          {/* Weekly Summary Widget */}
          <FadeIn delay={0.23}>
            <WeeklySummaryWidget />
          </FadeIn>

          {/* Row 3: Recent Claims + Activity Feed + Insurance Distribution */}
          <FadeIn delay={0.18}>
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-3 scroll-reveal">
            {/* Recent Claims */}
            <Card className="py-6 card-enter stagger-1 hover-scale">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Recent Claims</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[350px] scroll-shadow-y">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-border hover:bg-transparent table-header-modern">
                        <TableHead>Claim #</TableHead>
                        <TableHead className="hidden sm:table-cell">Client</TableHead>
                        <TableHead className="hidden md:table-cell">Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Company</TableHead>
                        <TableHead className="hidden lg:table-cell">Confidence</TableHead>
                        <TableHead className="hidden xl:table-cell">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="table-stripe">
                      {(data.recentClaims || []).map((claim) => (
                        <TableRow
                          key={claim.id}
                          className="group hover:bg-primary/5 transition-colors cursor-pointer table-row-animate"
                          onClick={() => handleClaimClick(claim.id)}
                        >
                          <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {claim.claimNumber}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {claim.clientName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {claim.claimType}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={claim.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {claim.insuranceCompany?.name || 'N/A'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <ConfidenceBar value={claim.confidenceScore} />
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">
                            {formatDate(claim.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="py-6 card-enter stagger-2 hover-scale">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[350px] scroll-shadow-y">
                  <div className="space-y-3">
                    {activityData?.activities && activityData.activities.length > 0 ? (
                      (activityData.activities || []).map((item) => {
                        const statusDot =
                          item.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : item.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        return (
                          <div key={item.id} className="flex items-start gap-3">
                            <div className={`mt-1.5 size-2 rounded-full shrink-0 ${statusDot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.claimNumber ? `${item.claimNumber}` : ''}
                                {item.clientName ? ` — ${item.clientName}` : ''}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {formatDate(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No recent activity
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Insurance Distribution */}
            <Card className="py-6 card-enter stagger-3 hover-scale">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Insurance Distribution
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(data.topInsuranceCompanies || []).length > 0 ? (data.topInsuranceCompanies || []).map((company, index) => {
                    const maxCount = Math.max(
                      1,
                      ...(data.topInsuranceCompanies || []).map((c) => c.count)
                    )
                    const width = (company.count / maxCount) * 100
                    return (
                      <div key={company.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {company.name}
                          </span>
                          <Badge variant="secondary" className="text-xs font-medium h-5 px-1.5">
                            {company.count}
                          </Badge>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 progress-bar"
                            style={{
                              width: `${width}%`,
                              backgroundColor:
                                INSURANCE_COLORS[index % INSURANCE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    )
                  }) : null}
                </div>
              </CardContent>
            </Card>
          </div>
          </FadeIn>

          {/* Insurance Performance Scorecard */}
          <FadeIn delay={0.21}>
            <InsuranceScorecardWidget />
          </FadeIn>

          {/* Row 4: Aging Alert + Performance Metrics + High Priority */}
          <FadeIn delay={0.2}>
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
            {/* Aging Claims Alert */}
            <AgingAlertCard />

            {/* Performance Metrics */}
            <Card className="py-6 card-shine card-hover card-enter stagger-1">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Performance Metrics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-sky-100 dark:bg-sky-950/50">
                      <Timer className="size-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{data.avgProcessingTime}m</p>
                      <p className="text-xs text-muted-foreground">Avg Processing Time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                      <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{data.weeklyChange >= 0 ? '+' : ''}{data.weeklyChange}%</p>
                      <p className="text-xs text-muted-foreground">Weekly Change</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-violet-100 dark:bg-violet-950/50">
                      <ClipboardList className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{data.claimsThisWeek}</p>
                      <p className="text-xs text-muted-foreground">This Week</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all metric-card border border-transparent hover:border-border/50">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-amber-100 dark:bg-amber-950/50">
                      <Calendar className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{data.claimsLastWeek}</p>
                      <p className="text-xs text-muted-foreground">Last Week</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High Priority Claims */}
            <Card className="py-6 card-shine card-hover card-enter stagger-2 scroll-shadow-top">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-5 text-red-500" />
                    <CardTitle className="text-base font-semibold">High Priority Claims</CardTitle>
                  </div>
                  <Badge variant={data.highPriorityClaims.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                    {data.highPriorityClaims.length} items
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {(data.highPriorityClaims || []).length > 0 ? (
                      (data.highPriorityClaims || []).map((claim) => (
                        <div
                          key={claim.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer group"
                          onClick={() => handleClaimClick(claim.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-foreground group-hover:text-red-600 transition-colors truncate">
                              {claim.claimNumber}
                            </p>
                            <p className="text-base text-muted-foreground truncate">
                              {claim.clientName} — {claim.claimType}
                            </p>
                          </div>
                          <StatusBadge status={claim.status} />
                          <span className="text-sm text-muted-foreground hidden sm:inline">
                            {claim.confidenceScore}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No high priority claims</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          </FadeIn>

          {/* Activity Feed Widget */}
          <ActivityFeedWidget />

          {/* Performance Analytics */}
          <FadeIn delay={0.21}>
            <PerformanceAnalytics />
          </FadeIn>

          {/* Claims Statistics Panel */}
          <ClaimsStatsPanel />

          {/* Row 5: Claims Analytics + Insurance Company Comparison Chart */}
          <FadeIn delay={0.22}>
            <ClaimsAnalyticsWidget />
          </FadeIn>

          <FadeIn delay={0.24}>
            <InsuranceComparisonChart />
          </FadeIn>

          {/* Row 6: Claims by Status Breakdown */}
          <FadeIn delay={0.25}>
          <Card className="py-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Claims by Status Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const totalClaims = Object.values(data.claimsByStatus).reduce((sum: number, count) => sum + (count as number), 0)
                  const statusConfig: { key: string; label: string; barColor: string; textColor: string }[] = [
                    { key: 'NEW', label: 'New', barColor: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400' },
                    { key: 'PROCESSING', label: 'Processing', barColor: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400' },
                    { key: 'COMPLETED', label: 'Completed', barColor: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400' },
                    { key: 'MANUAL_REVIEW', label: 'Manual Review', barColor: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400' },
                    { key: 'FAILED', label: 'Failed', barColor: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400' },
                    { key: 'PENDING_REVIEW', label: 'Pending Review', barColor: 'bg-violet-500', textColor: 'text-violet-700 dark:text-violet-400' },
                  ]
                  return statusConfig.map((sc) => {
                    const count = (data.claimsByStatus[sc.key] as number) || 0
                    if (count === 0) return null
                    const percentage = totalClaims > 0 ? ((count / totalClaims) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={sc.key} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground w-32 shrink-0">{sc.label}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 progress-bar ${sc.barColor}`}
                            style={{ width: `${(count / Math.max(totalClaims, 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-base font-semibold text-foreground w-10 text-right">{count}</span>
                        <span className={`text-sm font-medium w-14 text-right ${sc.textColor}`}>{percentage}%</span>
                      </div>
                    )
                  }).filter(Boolean)
                })()}
              </div>
            </CardContent>
          </Card>
          </FadeIn>

          {/* Row 6: Claims Velocity, Aging & Processing Analytics */}
          <FadeIn delay={0.26}>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {/* Claim Aging Widget */}
            <FadeIn delay={0.27}>
              <ClaimsAgingWidget />
            </FadeIn>

            {/* Claim Velocity - Daily Trend Analysis */}
            <Card className="py-6 card-shine hover-scale card-enter stagger-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">Claim Velocity</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {data.claimsPerHourToday}/hr today
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.dailyClaimsTrend.slice(-14)}>
                    <defs>
                      <linearGradient id="velGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: string) => {
                        const d = new Date(value)
                        return `${d.getDate()}/${d.getMonth() + 1}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        padding: '8px 12px',
                        borderRadius: '12px',
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-popover)',
                        color: 'var(--color-popover-foreground)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        backdropFilter: 'blur(8px)',
                      }}
                      itemStyle={{ color: 'var(--color-foreground)' }}
                      labelStyle={{ color: 'var(--color-foreground)' }}
                      formatter={(value: number) => [value, 'Claims']}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#velGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 2, stroke: 'var(--color-background)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-foreground">{data.claimsThisWeek}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">This Week</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-foreground">{data.claimsLastWeek}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Last Week</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold text-foreground">{data.claimsThisMonth}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Processing Insights */}
            <Card className="py-6 card-shine hover-scale card-enter stagger-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Processing Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Avg Processing Time */}
                  <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-border/80 transition-colors">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-sky-100 dark:bg-sky-950/50">
                      <Timer className="size-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Average Processing Time</p>
                      <p className="text-xs text-muted-foreground">Time from creation to completion</p>
                    </div>
                    <span className="text-2xl font-bold text-foreground">{data.avgProcessingTime}m</span>
                  </div>

                  {/* Fastest Processing */}
                  {data.fastestProcessingTime > 0 && (
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-border/80 transition-colors">
                      <div className="flex items-center justify-center size-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                        <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Fastest Processing</p>
                        <p className="text-xs text-muted-foreground">Quickest claim completed</p>
                      </div>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.fastestProcessingTime}m</span>
                    </div>
                  )}

                  {/* Documents Printed */}
                  <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-border/80 transition-colors">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-violet-100 dark:bg-violet-950/50">
                      <Printer className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Documents Printed</p>
                      <p className="text-xs text-muted-foreground">{data.docsPrintedToday} printed today</p>
                    </div>
                    <span className="text-2xl font-bold text-foreground">{data.documentsPrinted}</span>
                  </div>

                  {/* Weekly Change */}
                  <div className="flex items-center gap-4 p-3 rounded-lg border hover:border-border/80 transition-colors">
                    <div className="flex items-center justify-center size-11 rounded-lg bg-amber-100 dark:bg-amber-950/50">
                      <TrendingUp className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Weekly Volume Change</p>
                      <p className="text-xs text-muted-foreground">Compared to previous week</p>
                    </div>
                    <span className={`text-2xl font-bold ${data.weeklyChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {data.weeklyChange >= 0 ? '+' : ''}{data.weeklyChange}%
                    </span>
                  </div>
              </div>
            </CardContent>
          </Card>
          </div>
          </FadeIn>

          {/* Claims Aging Report Widget */}
          <FadeIn delay={0.20}>
            <AgingReportWidget />
          </FadeIn>

          {/* Row 7: Insurance Breakdown + Claim Aging Report */}
          <FadeIn delay={0.28}>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <InsuranceBreakdownWidget />

          <Card className="py-6 card-hover">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Hourglass className="size-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Claim Aging Report</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b-2 border-border hover:bg-transparent">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">0-1 day</span>
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-[10px] font-medium">1-3 days</span>
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                        <span className="inline-block px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 text-[10px] font-medium">3-7 days</span>
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                        <span className="inline-block px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-[10px] font-medium">7+ days</span>
                      </TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData ? (
                      Object.entries(agingData.aging).map(([status, { brackets }]) => {
                        const total = brackets.reduce((sum, b) => sum + b.count, 0)
                        if (total === 0) return null
                        return (
                          <TableRow key={status} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <StatusBadge status={status} />
                            </TableCell>
                            {brackets.map((bracket) => (
                              <TableCell key={bracket.label} className="text-center">
                                <span
                                  className={`inline-flex items-center justify-center min-w-[36px] h-7 rounded-md text-sm font-semibold ${
                                    bracket.count === 0
                                      ? 'text-muted-foreground/40'
                                      : bracket.maxHours <= 24
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                                      : bracket.maxHours <= 72
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                                      : bracket.maxHours <= 168
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                                  }`}
                                >
                                  {bracket.count}
                                </span>
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold text-foreground">
                              {total}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Loading aging data...
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </div>
          </FadeIn>

          {/* Row 8: Deep Analytics Section */}
          <AnalyticsSection refreshKey={refreshKey} />
        </>
      ) : null}
    </div>
  )
}

// ── Analytics Section ────────────────────────────────────────────────────────────

interface AnalyticsData {
  avgProcessingByStatus: { status: string; avgHours: number }[]
  claimsByInsurance: { name: string; total: number; byStatus: Record<string, number> }[]
  claimTypeDistribution: { date: string; types: Record<string, number> }[]
  topClients: { name: string; count: number; percentage: number }[]
  processingEfficiency: number
  totalCompleted: number
  completedWithin2h: number
  velocityData: { date: string; count: number }[]
  claimTypeOverTime: { date: string; [key: string]: number }[]
  statusSummary: { status: string; count: number; percentage: number }[]
  totalActiveClaims: number
  pendingReviews: number
  documentsPrintedToday: number
  avgConfidence: number
  totalClaims: number
}

const tooltipStyle = {
  fontSize: 12,
  padding: '8px 12px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

const efficiencyColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

const clientColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function AnalyticsSection({ refreshKey }: { refreshKey: number }) {
  const [expanded, setExpanded] = useState(false)

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['claims-analytics', refreshKey],
    queryFn: () => fetch('/api/claims/analytics').then((r) => r.json()),
    retry: 2,
    retryDelay: 1000,
  })

  const efficiencyChartData = analytics
    ? [
        { name: 'Within 2h', value: analytics.completedWithin2h, fill: efficiencyColors[0] },
        { name: 'Over 2h', value: Math.max(0, analytics.totalCompleted - analytics.completedWithin2h), fill: efficiencyColors[1] },
      ]
    : []

  const statusBarData = analytics?.avgProcessingByStatus || []

  return (
    <FadeIn delay={0.15}>
      <div className="space-y-4">
        {/* Toggle Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-primary/8 to-accent/5">
              <PieChartIcon className="size-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-semibold text-foreground">Deep Analytics</h3>
              <p className="text-xs text-muted-foreground">Processing efficiency, top clients, and velocity insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Advanced</Badge>
            {expanded ? (
              <ChevronUp className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </button>

        {/* Analytics Content */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {analyticsLoading ? (
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="py-5"><Skeleton className="h-[280px] w-full rounded-lg" /></Card>
              ))}
            </div>
          ) : analytics ? (
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {/* Processing Efficiency Donut */}
              <Card className="py-6 card-shine">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Processing Efficiency</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={efficiencyChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={0}
                      >
                        {efficiencyChartData.map((entry, index) => (
                          <Cell key={`eff-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-2">
                    <p className="text-2xl font-bold text-foreground">{analytics.processingEfficiency}%</p>
                    <p className="text-xs text-muted-foreground">completed within 2 hours</p>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="size-2 rounded-sm" style={{ backgroundColor: efficiencyColors[0] }} />
                        <span>{analytics.completedWithin2h} fast</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="size-2 rounded-sm" style={{ backgroundColor: efficiencyColors[1] }} />
                        <span>{analytics.totalCompleted - analytics.completedWithin2h} slow</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Clients */}
              <Card className="py-6 card-shine">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Top Clients</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.topClients.map((client, index) => (
                      <div key={client.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                            {client.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold">
                            {client.count}
                          </Badge>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${client.percentage}%`,
                              backgroundColor: clientColors[index % clientColors.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Avg Processing by Status (Horizontal Bar) */}
              <Card className="py-6 card-shine">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Avg Time by Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={statusBarData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        unit="h"
                      />
                      <YAxis
                        type="category"
                        dataKey="status"
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                        tickFormatter={(v: string) => getStatusLabel(v).slice(0, 10)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'var(--color-foreground)' }}
                        labelStyle={{ color: 'var(--color-foreground)' }}
                        formatter={(value: number) => [`${value}h`, 'Avg Hours']}
                        labelFormatter={(label: string) => getStatusLabel(label)}
                      />
                      <Bar dataKey="avgHours" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {statusBarData.map((entry) => (
                          <Cell key={`avg-${entry.status}`} fill={STATUS_FILL_MAP[entry.status] || '#64748B'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Velocity Sparkline */}
              <Card className="py-6 card-shine">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">14-Day Velocity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={analytics.velocityData}>
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'var(--color-foreground)' }}
                        labelStyle={{ color: 'var(--color-foreground)' }}
                        formatter={(value: number) => [value, 'Claims']}
                        labelFormatter={(v: string) => {
                          const d = new Date(v)
                          return `${d.getDate()}/${d.getMonth() + 1}`
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--color-primary)' }}
                        fill="url(#sparkGrad)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-center p-1.5 rounded-md bg-muted/30">
                      <p className="text-sm font-bold text-foreground">
                        {analytics.velocityData.slice(-7).reduce((s, d) => s + d.count, 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Last 7 days</p>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-muted/30">
                      <p className="text-sm font-bold text-foreground">
                        {analytics.velocityData.reduce((s, d) => s + d.count, 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Last 14 days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </FadeIn>
  )
}
