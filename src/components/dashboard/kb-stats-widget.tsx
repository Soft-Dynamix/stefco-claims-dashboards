'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BrainCircuit,
  Database,
  Target,
  Globe,
  Pencil,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FadeIn } from '@/components/ui/motion'
import { useClaimsStore } from '@/store/claims-store'
import { formatDistanceToNow } from 'date-fns'

// ── Types ───────────────────────────────────────────────────────────────────────

interface KBStats {
  totalExamples: number
  accuracyRate: number
  senderDomains: number
  correctionsMade: number
  classificationDistribution: { classification: string; count: number }[]
  recentEntries: {
    id: string
    subject: string
    classification: string
    senderDomain: string
    source: string
    isCorrected: boolean
    createdAt: string
  }[]
}

// ── Classification colors ──────────────────────────────────────────────────────

const CLASSIFICATION_COLORS: Record<string, string> = {
  NEW_CLAIM: '#10b981',
  MISSING_INFO: '#f59e0b',
  IGNORE: '#ef4444',
  OTHER: '#0ea5e9',
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  NEW_CLAIM: 'New Claim',
  MISSING_INFO: 'Missing Info',
  IGNORE: 'Ignore',
  OTHER: 'Other',
}

const CLASSIFICATION_BADGE_CLASSES: Record<string, string> = {
  NEW_CLAIM: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  MISSING_INFO: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  IGNORE: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  OTHER: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function getClassBadgeClass(cls: string) {
  return CLASSIFICATION_BADGE_CLASSES[cls] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
}

function getClassLabel(cls: string) {
  return CLASSIFICATION_LABELS[cls] || cls.replace(/_/g, ' ')
}

// ── Donut center label ─────────────────────────────────────────────────────────

interface CenterLabelProps {
  total: number
}

function CenterLabel({ total }: CenterLabelProps) {
  return (
    <text
      x="50%"
      y="50%"
      textAnchor="middle"
      dominantBaseline="central"
      fill="var(--color-foreground)"
      fontSize={22}
      fontWeight={700}
    >
      {total}
    </text>
  )
}

// ── Custom Pie Tooltip ─────────────────────────────────────────────────────────

function PieTooltipContent({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { classification: string } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">
        {getClassLabel(entry.payload.classification)}
      </p>
      <p className="text-muted-foreground">
        {entry.value} {entry.value === 1 ? 'entry' : 'entries'}
      </p>
    </div>
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function KBSkeleton() {
  return (
    <Card className="card-shine card-enter card-depth-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48 mt-1" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-3">
              <Skeleton className="size-6 w-6 rounded-md mb-2" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-32 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        {/* Recent entries skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function KBEmptyState() {
  return (
    <Card className="card-shine card-enter card-depth-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-violet-100 dark:bg-violet-950/60">
            <BrainCircuit className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold leading-tight">Knowledge Base</CardTitle>
            <CardDescription className="text-xs mt-0.5">AI Classification Intelligence</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="relative mb-4">
            <BrainCircuit className="size-14 text-muted-foreground/30" />
            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-violet-400" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Knowledge base is empty
          </p>
          <p className="text-xs text-muted-foreground/70 mb-0.5">
            Classify emails to start building intelligence
          </p>
          <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
            <Sparkles className="size-3" />
            The system learns from every classification
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────────

export function KBStatsWidget() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const { data, isLoading, error, refetch } = useQuery<KBStats>({
    queryKey: ['kb-stats'],
    queryFn: () =>
      fetch('/api/knowledge-base?stats=true').then((r) => {
        if (!r.ok) throw new Error('Failed to load knowledge base stats')
        return r.json()
      }),
    staleTime: 60_000,
    retry: 2,
    retryDelay: 1000,
  })

  const stats = data

  // Pie chart data
  const pieData = useMemo(() => {
    if (!stats) return []
    return stats.classificationDistribution.map((d) => ({
      classification: d.classification,
      count: d.count,
    }))
  }, [stats])

  const totalEntries = stats?.totalExamples ?? 0

  // Accuracy color logic
  const accuracyColor = stats
    ? stats.accuracyRate >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : stats.accuracyRate >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground'

  const accuracyBg = stats
    ? stats.accuracyRate >= 80
      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
      : stats.accuracyRate >= 60
        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
    : 'bg-muted/50 border-border'

  if (isLoading) return <KBSkeleton />

  if (error) {
    return (
      <Card className="card-shine card-enter card-depth-1">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Failed to load knowledge base stats
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!stats || totalEntries === 0) return <KBEmptyState />

  return (
    <Card className="card-shine card-hover card-enter card-depth-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-violet-100 dark:bg-violet-950/60">
              <BrainCircuit className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Knowledge Base
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                AI Classification Intelligence
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-primary gap-1 h-7 px-2"
            onClick={() => setActiveTab('config')}
          >
            Manage
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Stat Cards (2x2) ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Examples */}
          <ShadcnTooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 hover:shadow-sm transition-shadow cursor-default bg-primary/5 dark:bg-primary/5 border-primary/15">
                <Database className="size-5 text-primary mb-1.5" />
                <p className="text-2xl font-bold text-foreground tracking-tight">
                  {stats.totalExamples}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total Examples
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Total classified email entries in the knowledge base</p>
            </TooltipContent>
          </ShadcnTooltip>

          {/* Accuracy Rate */}
          <ShadcnTooltip>
            <TooltipTrigger asChild>
              <div className={`rounded-lg border p-3 hover:shadow-sm transition-shadow cursor-default ${accuracyBg}`}>
                <Target className={`size-5 mb-1.5 ${accuracyColor}`} />
                <p className={`text-2xl font-bold tracking-tight ${accuracyColor}`}>
                  {stats.accuracyRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Accuracy Rate
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {stats.accuracyRate >= 80
                  ? 'Excellent — AI classifications are highly accurate'
                  : stats.accuracyRate >= 60
                    ? 'Good — Room for improvement with more corrections'
                    : 'Needs attention — Consider reviewing recent classifications'}
              </p>
            </TooltipContent>
          </ShadcnTooltip>

          {/* Sender Domains */}
          <ShadcnTooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 hover:shadow-sm transition-shadow cursor-default bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800">
                <Globe className="size-5 text-sky-600 dark:text-sky-400 mb-1.5" />
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-300 tracking-tight">
                  {stats.senderDomains}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sender Domains
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Unique email domains the system has learned from</p>
            </TooltipContent>
          </ShadcnTooltip>

          {/* Corrections Made */}
          <ShadcnTooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 hover:shadow-sm transition-shadow cursor-default bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800">
                <Pencil className="size-5 text-amber-600 dark:text-amber-400 mb-1.5" />
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tracking-tight">
                  {stats.correctionsMade}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Corrections Made
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Entries where the AI classification was manually corrected</p>
            </TooltipContent>
          </ShadcnTooltip>
        </div>

        {/* ── Classification Distribution (Donut Chart) ────────────── */}
        {pieData.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground tracking-wide mb-3">
              Classification Distribution
            </h4>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="classification"
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.classification}
                          fill={CLASSIFICATION_COLORS[entry.classification] || '#64748B'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-foreground">{totalEntries}</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-1.5">
                {pieData.map((entry) => (
                  <div key={entry.classification} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: CLASSIFICATION_COLORS[entry.classification] || '#64748B' }}
                      />
                      <span className="text-muted-foreground">
                        {getClassLabel(entry.classification)}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">
                      {entry.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Recent Learning ──────────────────────────────────────── */}
        {stats.recentEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground tracking-wide mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3" />
              Recent Learning
            </h4>
            <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
              {stats.recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate" title={entry.subject}>
                      {entry.subject.length > 40 ? `${entry.subject.slice(0, 40)}…` : entry.subject}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {entry.senderDomain}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${getClassBadgeClass(entry.classification)}`}>
                      {getClassLabel(entry.classification)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 h-5 ${
                        entry.source === 'corrected'
                          ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      }`}
                    >
                      {entry.source === 'corrected' ? 'corrected' : 'auto'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap hidden sm:inline">
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })
                        } catch {
                          return ''
                        }
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
