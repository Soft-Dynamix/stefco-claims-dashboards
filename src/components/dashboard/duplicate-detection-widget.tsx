'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Users,
  Copy,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip as ShTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
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
}

interface DuplicatePair {
  claimA: ClaimItem
  claimB: ClaimItem
  clientName: string
  claimType: string
  matchReason: string
  confidence: 'high' | 'medium' | 'low'
  daysApart: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DATE_PROXIMITY_DAYS = 7

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay
}

// ── Risk Gauge Component ───────────────────────────────────────────────────────

function RiskGauge({
  value,
  size = 110,
  strokeWidth = 8,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference - (clamped / 100) * circumference

  const color =
    clamped <= 5
      ? '#059669'
      : clamped <= 15
        ? '#D97706'
        : '#DC2626'

  const textColor =
    clamped <= 5
      ? 'text-emerald-600 dark:text-emerald-400'
      : clamped <= 15
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

  const label =
    clamped <= 5 ? 'Low' : clamped <= 15 ? 'Medium' : 'High'

  const labelColor =
    clamped <= 5
      ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
      : clamped <= 15
        ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ overflow: 'visible' }}>
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
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className={`absolute text-xl font-bold ${textColor}`}>
        {Math.round(clamped)}%
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
          <Skeleton className="h-5 w-48" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top row: gauge + stats */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-4 p-4 rounded-xl bg-muted/20">
            <Skeleton className="h-4 w-28" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
          <div className="space-y-3 p-4 rounded-xl bg-muted/20">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 text-center">
                  <Skeleton className="h-8 w-12 mx-auto rounded" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Duplicate list skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Skeleton className="size-8 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Confidence Badge ───────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: {
      label: 'High',
      className: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
    },
    medium: {
      label: 'Med',
      className: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    },
    low: {
      label: 'Low',
      className: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
    },
  }
  const { label, className } = config[confidence]
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold px-1.5 py-0 ${className}`}>
      {label}
    </Badge>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export function DuplicateDetectionWidget() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  const {
    data: claimsData,
    isLoading,
    error,
    refetch,
  } = useQuery<{
    claims: ClaimItem[]
    total: number
  }>({
    queryKey: ['duplicate-detection', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to load claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const claims = claimsData?.claims || []

  // ── Duplicate Detection Logic ──────────────────────────────────────────────

  const { duplicates, riskScore, highConfidenceCount, mostDuplicatedClient } = useMemo(() => {
    const groups = new Map<string, ClaimItem[]>()

    // Group by (clientName + claimType)
    for (const claim of claims) {
      const key = `${(claim.clientName || '').toLowerCase().trim()}::${(claim.claimType || '').toLowerCase().trim()}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(claim)
    }

    const pairs: DuplicatePair[] = []
    const clientDupCount = new Map<string, number>()

    for (const [, group] of groups) {
      if (group.length < 2) continue

      // Sort by createdAt for consistent pairing
      const sorted = [...group].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const claimA = sorted[i]
          const claimB = sorted[j]
          const days = daysBetween(claimA.createdAt, claimB.createdAt)

          if (days <= DATE_PROXIMITY_DAYS) {
            const exactClientMatch = claimA.clientName.toLowerCase() === claimB.clientName.toLowerCase()
            const exactTypeMatch = claimA.claimType.toLowerCase() === claimB.claimType.toLowerCase()

            let confidence: 'high' | 'medium' | 'low'
            let matchReason: string

            if (exactClientMatch && exactTypeMatch && days <= 2) {
              confidence = 'high'
              matchReason = `Same client & type, ${days <= 1 ? 'same day' : `${Math.round(days)}d apart`}`
            } else if (exactClientMatch && exactTypeMatch) {
              confidence = 'medium'
              matchReason = `Same client & type, ${Math.round(days)}d apart`
            } else {
              confidence = 'low'
              matchReason = `Similar name & type, ${Math.round(days)}d apart`
            }

            pairs.push({
              claimA,
              claimB,
              clientName: claimA.clientName,
              claimType: claimA.claimType,
              matchReason,
              confidence,
              daysApart: days,
            })

            // Track duplicated client counts
            const name = claimA.clientName
            clientDupCount.set(name, (clientDupCount.get(name) || 0) + 1)
          }
        }
      }
    }

    // Sort by confidence priority then by days apart
    const priority = { high: 0, medium: 1, low: 2 }
    pairs.sort((a, b) => {
      const diff = priority[a.confidence] - priority[b.confidence]
      if (diff !== 0) return diff
      return a.daysApart - b.daysApart
    })

    const totalClaims = claims.length || 1
    const uniqueInvolved = new Set<string>()
    for (const p of pairs) {
      uniqueInvolved.add(p.claimA.id)
      uniqueInvolved.add(p.claimB.id)
    }
    const riskScore = Math.round((uniqueInvolved.size / totalClaims) * 100)

    const highConfidenceCount = pairs.filter((p) => p.confidence === 'high').length

    // Most duplicated client
    let mostDuplicatedClient = { name: '—', count: 0 }
    for (const [name, count] of clientDupCount) {
      if (count > mostDuplicatedClient.count) {
        mostDuplicatedClient = { name, count }
      }
    }

    return {
      duplicates: pairs,
      riskScore,
      highConfidenceCount,
      mostDuplicatedClient,
    }
  }, [claims])

  const totalDuplicates = duplicates.length

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) return <WidgetSkeleton />

  if (error) {
    return (
      <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertTriangle className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Failed to load duplicate detection data</p>
          <button
            onClick={() => refetch()}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    )
  }

  const riskLabel =
    riskScore <= 5
      ? 'Low'
      : riskScore <= 15
        ? 'Medium'
        : 'High'

  const riskLabelColor =
    riskScore <= 5
      ? 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
      : riskScore <= 15
        ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'

  const riskBgColor =
    riskScore <= 5
      ? 'bg-emerald-50 dark:bg-emerald-950/30'
      : riskScore <= 15
        ? 'bg-amber-50 dark:bg-amber-950/30'
        : 'bg-red-50 dark:bg-red-950/30'

  return (
    <Card className="py-6 card-shine card-enter hover-scale card-depth-1">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-violet-100 dark:bg-violet-950/50">
              <Copy className="size-4.5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Claims Duplicate Detection
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Based on {claims.length} claims scanned for duplicates
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-xs font-medium gap-1 px-2 py-0.5 ${riskLabelColor}`}
          >
            <Shield className="size-3" />
            {riskLabel} Risk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Section: Risk Gauge + Duplicate Stats Row */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Duplicate Risk Score */}
          <div className="p-5 rounded-xl bg-muted/30 border border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Duplicate Risk Score
              </h3>
            </div>

            <div className="flex items-center gap-5">
              <RiskGauge value={riskScore} size={110} strokeWidth={8} />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg font-bold ${
                      riskScore <= 5
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : riskScore <= 15
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {riskScore}%
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${riskLabelColor}`}
                  >
                    {riskLabel}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {totalDuplicates} potential duplicate{totalDuplicates !== 1 ? 's' : ''} found
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {riskScore <= 5 ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Within acceptable range
                      </span>
                    </>
                  ) : riskScore <= 15 ? (
                    <>
                      <AlertTriangle className="size-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        Review recommended
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3.5 text-red-500" />
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                        Action required
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{claims.length}</span> claims analyzed
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>Within {DATE_PROXIMITY_DAYS}-day window</span>
            </div>
          </div>

          {/* Duplicate Stats Row */}
          <div className="p-5 rounded-xl bg-muted/30 border border-border/40 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Duplicate Statistics
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Total Potential Duplicates */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-background/60 border border-border/30">
                <span className="text-2xl font-bold text-foreground tracking-tight">
                  {totalDuplicates}
                </span>
                <span className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wide">
                  Potential Duplicates
                </span>
              </div>

              {/* High Confidence Matches */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-200/40 dark:border-red-800/30">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400 tracking-tight">
                    {highConfidenceCount}
                  </span>
                  {highConfidenceCount > 0 && (
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-red-500" />
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-red-600/80 dark:text-red-400/80 text-center font-medium uppercase tracking-wide">
                  High Confidence
                </span>
              </div>

              {/* Most Duplicated Client */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-background/60 border border-border/30">
                <div className="flex items-center gap-1">
                  <Users className="size-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground tracking-tight truncate max-w-[60px]" title={mostDuplicatedClient.name}>
                    {mostDuplicatedClient.count > 0
                      ? mostDuplicatedClient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      : '—'}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground text-center font-medium uppercase tracking-wide leading-tight">
                  {mostDuplicatedClient.count > 0
                    ? mostDuplicatedClient.name.split(' ')[0]
                    : 'No client'}
                </span>
                {mostDuplicatedClient.count > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {mostDuplicatedClient.count} pair{mostDuplicatedClient.count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {totalDuplicates > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Risk Level</span>
                  <span
                    className={`font-semibold ${
                      riskScore <= 5
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : riskScore <= 15
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {riskLabel}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, riskScore * 5)}
                  className={`h-2 ${
                    riskScore <= 5
                      ? '[&>div]:bg-emerald-500'
                      : riskScore <= 15
                        ? '[&>div]:bg-amber-500'
                        : '[&>div]:bg-red-500'
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Potential Duplicates List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Copy className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Potential Duplicates
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <ShTooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Info className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Criteria</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  <p>Claims are flagged when they share the same client name and claim type within a {DATE_PROXIMITY_DAYS}-day window.</p>
                  <p className="text-muted-foreground mt-1">
                    High: ≤2 days &bull; Medium: ≤7 days &bull; Low: partial match
                  </p>
                </TooltipContent>
              </ShTooltip>
              <Badge variant="secondary" className="text-[10px] px-1.5">
                Max 8 shown
              </Badge>
            </div>
          </div>

          {duplicates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CheckCircle2 className="size-8 text-emerald-500/50" />
              <p className="text-sm mt-2 font-medium">No duplicates detected</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                All claims appear to be unique
              </p>
            </div>
          ) : (
            <div className="scroll-shadow-top max-h-[360px] overflow-y-auto custom-scrollbar space-y-2 rounded-lg">
              {duplicates.slice(0, 8).map((dup, index) => (
                <div
                  key={`${dup.claimA.id}-${dup.claimB.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    dup.confidence === 'high'
                      ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200/40 dark:border-red-800/30 hover:bg-red-50/80 dark:hover:bg-red-950/30'
                      : dup.confidence === 'medium'
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/40 dark:border-amber-800/30 hover:bg-amber-50/80 dark:hover:bg-amber-950/30'
                        : 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-200/40 dark:border-sky-800/30 hover:bg-sky-50/80 dark:hover:bg-sky-950/30'
                  }`}
                >
                  {/* Index */}
                  <span className="text-[10px] text-muted-foreground font-mono w-4 text-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Claim pair info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {dup.claimA.claimNumber}
                      </span>
                      <span className="text-[10px] text-muted-foreground">×</span>
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {dup.claimB.claimNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {dup.clientName}
                      </span>
                      <Separator orientation="vertical" className="h-3" />
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-medium">
                        {dup.claimType}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                      {dup.matchReason}
                    </p>
                  </div>

                  {/* Confidence */}
                  <ConfidenceBadge confidence={dup.confidence} />
                </div>
              ))}

              {duplicates.length > 8 && (
                <div className="text-center py-2">
                  <span className="text-xs text-muted-foreground">
                    +{duplicates.length - 8} more potential duplicate{duplicates.length - 8 > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
