'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  Trophy,
  Medal,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ── Types ──────────────────────────────────────────────────────────────────

interface ClaimRecord {
  id: string
  status: string
  confidenceScore: number
  createdAt: string
  updatedAt: string
  insuranceCompany: {
    id: string
    name: string
    folderName: string
  } | null
}

interface CompanyMetrics {
  name: string
  totalClaims: number
  completedClaims: number
  completionRate: number
  avgConfidence: number
  avgProcessingTimeMin: number
  failedClaims: number
  performanceScore: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-sky-500 dark:bg-sky-600',
  'bg-emerald-500 dark:bg-emerald-600',
  'bg-amber-500 dark:bg-amber-600',
  'bg-violet-500 dark:bg-violet-600',
  'bg-teal-500 dark:bg-teal-600',
  'bg-rose-500 dark:bg-rose-600',
  'bg-orange-500 dark:bg-orange-600',
  'bg-cyan-500 dark:bg-cyan-600',
  'bg-pink-500 dark:bg-pink-600',
  'bg-lime-500 dark:bg-lime-600',
]

const RANK_STYLES: Record<number, { ring: string; bg: string; badge: string; icon: React.ElementType }> = {
  1: {
    ring: 'ring-2 ring-amber-400 dark:ring-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    badge: 'badge-glow-warning',
    icon: Trophy,
  },
  2: {
    ring: 'ring-2 ring-gray-300 dark:ring-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    badge: '',
    icon: Medal,
  },
  3: {
    ring: 'ring-2 ring-orange-400 dark:bg-orange-700 dark:ring-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    badge: '',
    icon: Award,
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getConfidenceColor(value: number): string {
  if (value >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (value >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getConfidenceBgColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500'
  if (value >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function getPerformanceColor(score: number): string {
  if (score >= 80) return '#059669'
  if (score >= 60) return '#D97706'
  if (score >= 40) return '#EA580C'
  return '#DC2626'
}

function getPerformanceTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// ── Circular Progress Ring ─────────────────────────────────────────────────

function CircularProgressRing({
  value,
  size = 44,
  strokeWidth = 3.5,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = getPerformanceColor(value)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span
        className={`absolute text-[10px] font-bold ${getPerformanceTextColor(value)}`}
      >
        {Math.round(value)}
      </span>
    </div>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────

function ScorecardSkeleton() {
  return (
    <Card className="glass-card card-depth-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-56 mb-1" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="size-10 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function InsuranceScorecardWidget() {
  const { data, isLoading, isError } = useQuery<{ claims: ClaimRecord[]; total: number }>({
    queryKey: ['insurance-scorecard-claims'],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to fetch claims')
        return r.json()
      }),
    staleTime: 60_000,
    retry: 2,
    retryDelay: 1000,
  })

  const rankedCompanies = useMemo<CompanyMetrics[]>(() => {
    if (!data?.claims?.length) return []

    const map = new Map<string, {
      total: number
      completed: number
      failed: number
      confidenceSum: number
      processingTimesMin: number[]
    }>()

    for (const claim of data.claims) {
      const company = claim.insuranceCompany?.name || 'Unknown'
      if (!map.has(company)) {
        map.set(company, {
          total: 0,
          completed: 0,
          failed: 0,
          confidenceSum: 0,
          processingTimesMin: [],
        })
      }
      const entry = map.get(company)!
      entry.total += 1
      entry.confidenceSum += claim.confidenceScore

      if (claim.status === 'COMPLETED') {
        entry.completed += 1
        const created = new Date(claim.createdAt).getTime()
        const updated = new Date(claim.updatedAt).getTime()
        const diffMin = (updated - created) / 60000
        if (diffMin > 0) {
          entry.processingTimesMin.push(diffMin)
        }
      }

      if (claim.status === 'FAILED') {
        entry.failed += 1
      }
    }

    const results: CompanyMetrics[] = []
    for (const [name, entry] of map.entries()) {
      const completionRate = entry.total > 0 ? (entry.completed / entry.total) * 100 : 0
      const avgConfidence = entry.total > 0 ? entry.confidenceSum / entry.total : 0

      // Speed score: faster processing = higher score. 0 min = 100, 120+ min = 0
      const avgProcessingMin = entry.processingTimesMin.length > 0
        ? entry.processingTimesMin.reduce((a, b) => a + b, 0) / entry.processingTimesMin.length
        : 0
      const speedScore = Math.max(0, Math.min(100, 100 - (avgProcessingMin / 120) * 100))

      // Weighted performance: 40% completion + 30% confidence + 30% speed
      const performanceScore =
        completionRate * 0.4 +
        avgConfidence * 0.3 +
        speedScore * 0.3

      results.push({
        name,
        totalClaims: entry.total,
        completedClaims: entry.completed,
        completionRate,
        avgConfidence,
        avgProcessingTimeMin: avgProcessingMin,
        failedClaims: entry.failed,
        performanceScore,
      })
    }

    // Sort by performance score descending
    results.sort((a, b) => b.performanceScore - a.performanceScore)
    return results
  }, [data])

  if (isLoading) return <ScorecardSkeleton />

  if (isError || !data) {
    return (
      <Card className="glass-card card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="size-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Unable to load insurance scorecard</p>
          <p className="text-xs mt-1">Check your connection and try again</p>
        </CardContent>
      </Card>
    )
  }

  if (rankedCompanies.length === 0) {
    return (
      <Card className="glass-card card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Building2 className="size-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">No insurance data available</p>
          <p className="text-xs mt-1">Claims data will populate this scorecard</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card card-depth-1 card-enter">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
              <Building2 className="size-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Insurance Performance Scorecard
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Ranked by weighted performance (completion, confidence, speed)
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs font-medium h-5 px-2">
            {rankedCompanies.length} companies
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Table Header (desktop) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-8 text-center">#</span>
            <span className="w-10" />
            <span className="flex-1 min-w-0">Company</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-16 text-center cursor-default">Claims</span>
              </TooltipTrigger>
              <TooltipContent>Total claims count</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-20 text-center cursor-default">Completion</span>
              </TooltipTrigger>
              <TooltipContent>Completed claims / Total claims</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-20 text-center cursor-default">Confidence</span>
              </TooltipTrigger>
              <TooltipContent>Average AI confidence score</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-20 text-center cursor-default">Avg Speed</span>
              </TooltipTrigger>
              <TooltipContent>Average processing time (completed claims)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-14 text-center cursor-default">Score</span>
              </TooltipTrigger>
              <TooltipContent>40% completion + 30% confidence + 30% speed</TooltipContent>
            </Tooltip>
          </div>

          {rankedCompanies.map((company, index) => {
            const rank = index + 1
            const rankStyle = RANK_STYLES[rank]
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length]
            const firstLetter = company.name.charAt(0).toUpperCase()

            return (
              <div
                key={company.name}
                className={`
                  flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl transition-all
                  hover:bg-muted/50 group table-row-animate
                  ${rankStyle?.bg || ''}
                `}
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {rankStyle ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center justify-center size-8 rounded-full ${rankStyle.ring} bg-background`}>
                          <rankStyle.icon className={`size-4 ${rank <= 1 ? 'text-amber-500' : rank <= 2 ? 'text-gray-400 dark:text-gray-300' : 'text-orange-500'}`} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {rank === 1 ? '🥇 1st Place' : rank === 2 ? '🥈 2nd Place' : '🥉 3rd Place'}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground w-full text-center">
                      {rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 flex-shrink-0 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                  {firstLetter}
                </div>

                {/* Company name + badges (mobile & desktop) */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {company.name}
                  </span>
                  {/* Mobile-only compact info */}
                  <div className="flex md:hidden items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {company.totalClaims}
                    </Badge>
                    <span className={getConfidenceColor(company.avgConfidence)}>
                      {Math.round(company.avgConfidence)}%
                    </span>
                    {company.failedClaims > 0 && (
                      <span className="text-red-500">
                        {company.failedClaims} fail
                      </span>
                    )}
                  </div>
                </div>

                {/* Total Claims (desktop) */}
                <div className="hidden md:flex w-16 justify-center">
                  <Badge variant="secondary" className="text-xs font-medium h-6 px-2">
                    {company.totalClaims}
                  </Badge>
                </div>

                {/* Completion Rate (desktop) */}
                <div className="hidden md:flex flex-col items-center w-20 gap-1">
                  <span className={`text-xs font-semibold ${getConfidenceColor(company.completionRate)}`}>
                    {company.completionRate.toFixed(1)}%
                  </span>
                  <Progress
                    value={company.completionRate}
                    className="h-1.5 w-16 [&>div]:bg-emerald-500"
                  />
                </div>

                {/* Avg Confidence (desktop) */}
                <div className="hidden md:flex flex-col items-center w-20 gap-1">
                  <span className={`text-xs font-semibold ${getConfidenceColor(company.avgConfidence)}`}>
                    {Math.round(company.avgConfidence)}%
                  </span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getConfidenceBgColor(company.avgConfidence)}`}
                      style={{ width: `${company.avgConfidence}%` }}
                    />
                  </div>
                </div>

                {/* Avg Speed (desktop) */}
                <div className="hidden md:flex items-center w-20 justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span className="font-medium">
                          {company.completedClaims > 0
                            ? formatMinutes(company.avgProcessingTimeMin)
                            : 'N/A'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {company.completedClaims > 0
                        ? `Avg processing time across ${company.completedClaims} completed claim(s)`
                        : 'No completed claims yet'}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Performance Score Ring */}
                <div className="w-14 flex-shrink-0 flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-default">
                        <CircularProgressRing value={company.performanceScore} size={44} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">Performance: {Math.round(company.performanceScore)}/100</span>
                        <span className="text-muted-foreground">Completion: {company.completionRate.toFixed(0)}% &times; 0.4</span>
                        <span className="text-muted-foreground">Confidence: {Math.round(company.avgConfidence)}% &times; 0.3</span>
                        <span className="text-muted-foreground">Speed: {company.completedClaims > 0 ? Math.round(Math.max(0, Math.min(100, 100 - (company.avgProcessingTimeMin / 120) * 100))) : 0}% &times; 0.3</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-emerald-500" />
            <span>Confidence &ge;80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-amber-500" />
            <span>60&ndash;79%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-red-500" />
            <span>&lt;60%</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3 text-amber-500" />
            <span>Top performer</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <span>Score = 0.4&times;Completion + 0.3&times;Confidence + 0.3&times;Speed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
