'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useClaimsStore } from '@/store/claims-store'
import {
  GitBranch,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Loader2,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Stage Definitions ─────────────────────────────────────────────────────────
// Maps to processingStage values in Prisma schema + COMPLETED status
const WORKFLOW_STAGES = [
  {
    key: 'RECEIVED',
    label: 'Email Received',
    shortLabel: 'Received',
    description: 'Incoming claim email received and parsed',
    color: '#0ea5e9',       // sky blue
    bgColor: 'bg-sky-500',
    bgLight: 'bg-sky-100 dark:bg-sky-950/30',
    textColor: 'text-sky-700 dark:text-sky-400',
    borderLight: 'border-sky-200 dark:border-sky-800',
  },
  {
    key: 'CLASSIFIED',
    label: 'AI Classified',
    shortLabel: 'Classified',
    description: 'AI classifies the claim type and priority',
    color: '#8b5cf6',       // violet
    bgColor: 'bg-violet-500',
    bgLight: 'bg-violet-100 dark:bg-violet-950/30',
    textColor: 'text-violet-700 dark:text-violet-400',
    borderLight: 'border-violet-200 dark:border-violet-800',
  },
  {
    key: 'EXTRACTED',
    label: 'Data Extracted',
    shortLabel: 'Extracted',
    description: 'AI extracts structured claim data',
    color: '#f59e0b',       // amber
    bgColor: 'bg-amber-500',
    bgLight: 'bg-amber-100 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-400',
    borderLight: 'border-amber-200 dark:border-amber-800',
  },
  {
    key: 'FOLDER_CREATED',
    label: 'Folder Created',
    shortLabel: 'Folder',
    description: 'Insurance folder structure created',
    color: '#10b981',       // emerald
    bgColor: 'bg-emerald-500',
    bgLight: 'bg-emerald-100 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    borderLight: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    key: 'DOCUMENTS_SAVED',
    label: 'Documents Saved',
    shortLabel: 'Docs',
    description: 'Extracted documents saved to claim folder',
    color: '#14b8a6',       // teal
    bgColor: 'bg-teal-500',
    bgLight: 'bg-teal-100 dark:bg-teal-950/30',
    textColor: 'text-teal-700 dark:text-teal-400',
    borderLight: 'border-teal-200 dark:border-teal-800',
  },
  {
    key: 'PRINTED',
    label: 'Print Queued',
    shortLabel: 'Print',
    description: 'Documents queued for printing',
    color: '#f97316',       // orange
    bgColor: 'bg-orange-500',
    bgLight: 'bg-orange-100 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    borderLight: 'border-orange-200 dark:border-orange-800',
  },
  {
    key: 'LOGGED',
    label: 'Audit Logged',
    shortLabel: 'Logged',
    description: 'Processing steps recorded in audit trail',
    color: '#ec4899',       // pink
    bgColor: 'bg-pink-500',
    bgLight: 'bg-pink-100 dark:bg-pink-950/30',
    textColor: 'text-pink-700 dark:text-pink-400',
    borderLight: 'border-pink-200 dark:border-pink-800',
  },
  {
    key: 'RESPONDED',
    label: 'Reply Sent',
    shortLabel: 'Replied',
    description: 'Acknowledgment email sent to client',
    color: '#06b6d4',       // cyan
    bgColor: 'bg-cyan-500',
    bgLight: 'bg-cyan-100 dark:bg-cyan-950/30',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    borderLight: 'border-cyan-200 dark:border-cyan-800',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    shortLabel: 'Done',
    description: 'Claim fully processed and completed',
    color: '#22c55e',       // green
    bgColor: 'bg-green-500',
    bgLight: 'bg-green-100 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderLight: 'border-green-200 dark:border-green-800',
  },
] as const

interface ClaimItem {
  id: string
  claimNumber: string
  processingStage: string
  status: string
}

interface ClaimsResponse {
  claims: ClaimItem[]
  total: number
}

// ─── Stage Row Component ────────────────────────────────────────────────────────

function StageRow({
  stage,
  count,
  maxCount,
  totalClaims,
  isBottleneck,
  isCompleted,
  index,
}: {
  stage: typeof WORKFLOW_STAGES[number]
  count: number
  maxCount: number
  totalClaims: number
  isBottleneck: boolean
  isCompleted: boolean
  index: number
}) {
  const percentage = totalClaims > 0 ? ((count / totalClaims) * 100) : 0
  const barWidth = maxCount > 0 ? ((count / maxCount) * 100) : 0

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-default ${
              isBottleneck
                ? 'bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40'
                : isCompleted
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-800/30'
                  : 'hover:bg-muted/50 border border-transparent'
            }`}
          >
            {/* Stage number */}
            <span className="text-[10px] font-mono text-muted-foreground/60 w-4 text-right shrink-0">
              {index + 1}
            </span>

            {/* Color indicator dot */}
            <div
              className="size-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background transition-transform group-hover:scale-125"
              style={{ backgroundColor: stage.color, '--tw-ring-color': stage.color } as React.CSSProperties}
            />

            {/* Stage label */}
            <span className="text-xs font-medium text-foreground min-w-[90px] sm:min-w-[110px] truncate">
              {stage.label}
            </span>

            {/* Progress bar */}
            <div className="flex-1 h-5 bg-muted/60 rounded-md overflow-hidden relative min-w-[80px]">
              <div
                className="h-full rounded-md transition-all duration-700 ease-out flex items-center"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: stage.color,
                  opacity: isCompleted ? 1 : 0.85,
                }}
              >
                {barWidth > 18 && (
                  <span className="text-[10px] font-semibold text-white px-2 truncate drop-shadow-sm">
                    {count}
                  </span>
                )}
              </div>
              {barWidth <= 18 && count > 0 && (
                <span className={`absolute inset-0 flex items-center px-2 text-[10px] font-semibold ${stage.textColor}`}>
                  {count}
                </span>
              )}
            </div>

            {/* Percentage */}
            <span className={`text-[11px] font-medium tabular-nums min-w-[40px] text-right shrink-0 ${
              percentage > 30 ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {percentage.toFixed(1)}%
            </span>

            {/* Count badge */}
            <Badge
              variant={isBottleneck ? 'destructive' : 'secondary'}
              className={`text-[10px] h-5 min-w-[28px] justify-center shrink-0 ${
                isBottleneck ? '' : isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : ''
              }`}
            >
              {count}
            </Badge>

            {/* Bottleneck indicator */}
            {isBottleneck && (
              <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 shrink-0 gap-0.5">
                <AlertTriangle className="size-2.5" />
                Bottleneck
              </Badge>
            )}

            {/* Completed glow */}
            {isCompleted && (
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="text-xs max-w-[220px]"
        >
          <p className="font-semibold">{stage.label}</p>
          <p className="text-muted-foreground mt-0.5">{stage.description}</p>
          <p className="mt-1">
            <span className="font-medium">{count}</span> claim{count !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
          </p>
          {isBottleneck && (
            <p className="text-amber-600 dark:text-amber-400 mt-0.5">
              Potential bottleneck — highest claim volume at this stage
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Conversion Funnel Row ─────────────────────────────────────────────────────

function ConversionArrow({
  fromCount,
  toCount,
  fromLabel,
  toLabel,
}: {
  fromCount: number
  toCount: number
  fromLabel: string
  toLabel: string
}) {
  const rate = fromCount > 0 ? ((toCount / fromCount) * 100) : 0
  const isDrop = rate < 80 && rate > 0
  const isSevereDrop = rate < 50 && rate > 0

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <TrendingDown className={`size-3 ${isSevereDrop ? 'text-red-500' : isDrop ? 'text-amber-500' : 'text-emerald-500'} ${fromCount === 0 || toCount > fromCount ? 'rotate-180' : ''}`} />
              <span className={`text-[10px] font-medium tabular-nums ${
                isSevereDrop ? 'text-red-600 dark:text-red-400' :
                isDrop ? 'text-amber-600 dark:text-amber-400' :
                'text-emerald-600 dark:text-emerald-400'
              }`}>
                {fromCount === 0 && toCount === 0 ? '—' :
                 fromCount === 0 ? '∞' :
                 `${rate.toFixed(0)}%`}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          <p>Conversion: {fromLabel} → {toLabel}</p>
          <p className="text-muted-foreground">
            {fromCount} → {toCount} claim{toCount !== 1 ? 's' : ''} ({rate.toFixed(1)}%)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <Card className="py-5 rounded-xl card-enter">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-64 mt-1" />
      </CardHeader>
      <CardContent className="space-y-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
        <div className="h-px my-2" />
        <Skeleton className="h-6 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function WorkflowStageChart() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  const { data, isLoading, error } = useQuery<ClaimsResponse>({
    queryKey: ['workflow-stage-chart', refreshKey],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed to fetch claims')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  // Compute stage distribution and analytics
  const analytics = useMemo(() => {
    const claims = data?.claims || []
    const totalClaims = claims.length

    // Count claims at each stage
    const stageCounts: Record<string, number> = {}
    WORKFLOW_STAGES.forEach((s) => {
      stageCounts[s.key] = 0
    })

    claims.forEach((claim) => {
      // Map processingStage to stage key
      const stage = claim.processingStage
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++
      }
      // Also count COMPLETED status as completed stage
      if (claim.status === 'COMPLETED' && claim.processingStage !== 'COMPLETED') {
        stageCounts['COMPLETED']++
      }
    })

    // Max count for bar scaling
    const maxCount = Math.max(...Object.values(stageCounts), 1)

    // Find bottleneck (stage with highest count, excluding COMPLETED)
    let bottleneckKey: string | null = null
    let bottleneckCount = 0
    WORKFLOW_STAGES.forEach((s) => {
      if (s.key !== 'COMPLETED' && stageCounts[s.key] > bottleneckCount) {
        bottleneckCount = stageCounts[s.key]
        bottleneckKey = s.key
      }
    })

    // Calculate cumulative flow (claims that have reached each stage or beyond)
    // A claim "reached" a stage if it's at that stage or any later stage
    const stageKeys = WORKFLOW_STAGES.map((s) => s.key)
    const cumulativeCounts: Record<string, number> = {}
    stageKeys.forEach((key, idx) => {
      cumulativeCounts[key] = 0
      for (let i = idx; i < stageKeys.length; i++) {
        cumulativeCounts[key] += stageCounts[stageKeys[i]]
      }
    })

    // Conversion rates between consecutive stages
    const conversions: Array<{
      from: string
      to: string
      fromLabel: string
      toLabel: string
      fromCount: number
      toCount: number
      rate: number
    }> = []
    for (let i = 0; i < stageKeys.length - 1; i++) {
      const fromKey = stageKeys[i]
      const toKey = stageKeys[i + 1]
      const fromTotal = cumulativeCounts[fromKey]
      const toTotal = cumulativeCounts[toKey]
      const rate = fromTotal > 0 ? (toTotal / fromTotal) * 100 : 0
      conversions.push({
        from: fromKey,
        to: toKey,
        fromLabel: WORKFLOW_STAGES[i].shortLabel,
        toLabel: WORKFLOW_STAGES[i + 1].shortLabel,
        fromCount: fromTotal,
        toCount: toTotal,
        rate,
      })
    }

    // Average conversion rate
    const avgConversion = conversions.length > 0
      ? conversions.reduce((sum, c) => sum + c.rate, 0) / conversions.length
      : 0

    // Pipeline throughput: claims that reached the last active stage
    const completedCount = stageCounts['COMPLETED'] || 0
    const pipelineCompletionRate = totalClaims > 0 ? (completedCount / totalClaims) * 100 : 0

    return {
      stageCounts,
      maxCount,
      bottleneckKey,
      totalClaims,
      conversions,
      avgConversion,
      pipelineCompletionRate,
      completedCount,
    }
  }, [data])

  if (isLoading) return <ChartSkeleton />

  if (error || !data) {
    return (
      <Card className="py-5 rounded-xl card-enter">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Activity className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Unable to load workflow data</p>
        </CardContent>
      </Card>
    )
  }

  if (analytics.totalClaims === 0) {
    return (
      <Card className="py-5 rounded-xl card-enter">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Workflow Pipeline</CardTitle>
          </div>
          <CardDescription>Claims distribution across processing stages</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <GitBranch className="size-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No claims to visualize yet</p>
          <p className="text-xs text-muted-foreground/60">
            Claims will appear here once they enter the pipeline
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-5 rounded-xl card-enter card-shine card-lift overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <GitBranch className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Workflow Pipeline</CardTitle>
              <CardDescription className="mt-0.5">
                Claims distribution across {WORKFLOW_STAGES.length} processing stages
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {analytics.totalClaims} claims
            </Badge>
            {analytics.bottleneckKey && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 gap-1">
                <AlertTriangle className="size-3" />
                Bottleneck
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-0.5">
        {/* ─── Stage Progression Bars ─── */}
        <div className="space-y-0.5">
          {WORKFLOW_STAGES.map((stage, index) => (
            <React.Fragment key={stage.key}>
              <StageRow
                stage={stage}
                count={analytics.stageCounts[stage.key]}
                maxCount={analytics.maxCount}
                totalClaims={analytics.totalClaims}
                isBottleneck={analytics.bottleneckKey === stage.key}
                isCompleted={stage.key === 'COMPLETED'}
                index={index}
              />
              {/* Conversion arrows between stages */}
              {index < WORKFLOW_STAGES.length - 1 && (
                <ConversionArrow
                  fromCount={analytics.conversions[index]?.fromCount || 0}
                  toCount={analytics.conversions[index]?.toCount || 0}
                  fromLabel={analytics.conversions[index]?.fromLabel || ''}
                  toLabel={analytics.conversions[index]?.toLabel || ''}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ─── Summary Stats ─── */}
        <div className="h-px bg-border my-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pipeline Completion */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${
              analytics.pipelineCompletionRate >= 70
                ? 'bg-emerald-100 dark:bg-emerald-950/30'
                : analytics.pipelineCompletionRate >= 40
                  ? 'bg-amber-100 dark:bg-amber-950/30'
                  : 'bg-red-100 dark:bg-red-950/30'
            }`}>
              <CheckCircle2 className={`size-4 ${
                analytics.pipelineCompletionRate >= 70
                  ? 'text-emerald-600'
                  : analytics.pipelineCompletionRate >= 40
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {analytics.pipelineCompletionRate.toFixed(0)}%
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Completion Rate</p>
            </div>
          </div>

          {/* Avg Conversion */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${
              analytics.avgConversion >= 80
                ? 'bg-sky-100 dark:bg-sky-950/30'
                : analytics.avgConversion >= 60
                  ? 'bg-amber-100 dark:bg-amber-950/30'
                  : 'bg-red-100 dark:bg-red-950/30'
            }`}>
              <TrendingDown className={`size-4 ${
                analytics.avgConversion >= 80
                  ? 'text-sky-600 rotate-180'
                  : analytics.avgConversion >= 60
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {analytics.avgConversion.toFixed(0)}%
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Avg Stage Conversion</p>
            </div>
          </div>

          {/* Completed */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/10">
            <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 shrink-0">
              <CheckCircle2 className="size-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {analytics.completedCount}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Claims Completed</p>
            </div>
          </div>
        </div>

        {/* ─── Color Legend ─── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2 border-t border-border/50">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stages:</span>
          {WORKFLOW_STAGES.map((stage) => (
            <div key={stage.key} className="flex items-center gap-1">
              <div
                className="size-2 rounded-sm"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[10px] text-muted-foreground">{stage.shortLabel}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
