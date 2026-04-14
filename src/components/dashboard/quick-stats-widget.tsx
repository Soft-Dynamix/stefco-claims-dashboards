'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  FileText,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Brain,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FadeIn } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ──
interface DashboardData {
  totalClaims: number
  claimsToday: number
  claimsByStatus: Record<string, number>
  averageConfidenceScore: number
  manualReviewPending: number
  overdueClaims: number
  weeklyChange: number
}

interface StatConfig {
  id: string
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  value: number
  suffix?: string
  trend?: { direction: 'up' | 'down'; value: string }
  borderColor: string
  glowClass?: string
  pulseClass?: string
  tooltipText: string
  isCritical?: boolean
  isConfidence?: boolean
}

// ── Animated Number Hook ──
function useAnimatedNumber(target: number, duration = 900) {
  const [display, setDisplay] = useState(0)
  const prevDisplayRef = React.useRef(0)

  useEffect(() => {
    const startVal = prevDisplayRef.current

    const startTime = Date.now()
    const animateStep = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextVal = Math.round(startVal + (target - startVal) * eased)
      setDisplay(nextVal)

      if (progress < 1) {
        requestAnimationFrame(animateStep)
      } else {
        prevDisplayRef.current = target
      }
    }

    requestAnimationFrame(animateStep)
  }, [target, duration])

  return display
}

// ── Circular Ring Indicator ──
function ConfidenceRing({ value }: { value: number }) {
  const size = 36
  const strokeWidth = 3
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  const color =
    value >= 80
      ? '#10b981'
      : value >= 60
        ? '#f59e0b'
        : '#ef4444'

  return (
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
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  )
}

// ── Auto Refresh Timer ──
function RefreshTimer({ lastUpdated }: { lastUpdated: number | undefined }) {
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-ZA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--'

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw className="size-3 animate-spin opacity-60" />
      <span>Auto-refresh in {countdown}s</span>
      <span className="text-border">·</span>
      <span>{timeStr}</span>
    </div>
  )
}

// ── Skeleton ──
function WidgetSkeleton() {
  return (
    <Card className="glass-card card-depth-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-muted/20 border border-border/40"
            >
              <Skeleton className="size-8 rounded-full mb-2" />
              <Skeleton className="h-6 w-14 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Individual Mini Stat Card ──
function MiniStatCard({ config, index }: { config: StatConfig; index: number }) {
  const Icon = config.icon
  const animatedValue = useAnimatedNumber(config.value, 900)

  return (
    <FadeIn delay={0.02 + index * 0.05}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`
                relative flex flex-col gap-2 p-3 sm:p-4 rounded-xl
                border border-border/40 bg-card/60 backdrop-blur-sm
                card-hover-lift cursor-default
                transition-all duration-200
                hover:border-border/80 hover:bg-card/80
                ${config.isCritical ? 'animate-pulse-subtle' : ''}
                ${config.glowClass || ''}
              `}
              style={{
                borderBottomWidth: 2,
                borderBottomColor:
                  config.id === 'total'
                    ? 'var(--color-primary)'
                    : config.id === 'active'
                      ? '#0ea5e9'
                      : config.id === 'completed'
                        ? '#10b981'
                        : config.id === 'confidence'
                          ? '#8b5cf6'
                          : config.id === 'attention'
                            ? '#f59e0b'
                            : '#ef4444',
              }}
            >
              {/* Icon */}
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center justify-center size-8 rounded-full ${config.iconBg} transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className={`size-4 ${config.iconColor}`} />
                </div>
                {config.trend && (
                  <span
                    className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                      config.trend.direction === 'up'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {config.trend.direction === 'up' ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {config.trend.value}
                  </span>
                )}
              </div>

              {/* Value */}
              <div className="flex items-center gap-1.5">
                {config.isConfidence ? (
                  <div className="relative flex items-center justify-center">
                    <ConfidenceRing value={config.value} />
                    <span className="absolute text-[11px] font-bold text-foreground">
                      {animatedValue}
                    </span>
                  </div>
                ) : (
                  <span
                    className={`text-xl sm:text-2xl font-bold tracking-tight text-foreground stat-animate ${
                      config.isCritical && config.value > 0
                        ? 'text-red-600 dark:text-red-400'
                        : ''
                    }`}
                  >
                    {animatedValue.toLocaleString()}
                    {config.suffix && (
                      <span className="text-sm font-medium text-muted-foreground ml-0.5">
                        {config.suffix}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                {config.label}
              </span>

              {/* Pulse dot for critical cards */}
              {config.pulseClass && config.value > 0 && (
                <span className="absolute top-2.5 right-2.5">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                  </span>
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            {config.tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </FadeIn>
  )
}

// ── Main Component ──
export function QuickStatsWidget() {
  const { data, isLoading, dataUpdatedAt } = useQuery<DashboardData>({
    queryKey: ['quick-stats'],
    queryFn: () =>
      fetch('/api/dashboard').then((r) => {
        if (!r.ok) throw new Error('Failed to load dashboard')
        return r.json()
      }),
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  if (isLoading || !data) return <WidgetSkeleton />

  // ── Derive Stats ──
  const activeClaims =
    (data.claimsByStatus['NEW'] || 0) +
    (data.claimsByStatus['PROCESSING'] || 0) +
    (data.claimsByStatus['MANUAL_REVIEW'] || 0) +
    (data.claimsByStatus['PENDING_REVIEW'] || 0)

  const needsAttention =
    (data.claimsByStatus['MANUAL_REVIEW'] || 0) +
    (data.claimsByStatus['PENDING_REVIEW'] || 0) +
    (data.claimsByStatus['FAILED'] || 0)

  const completedToday =
    data.claimsByStatus['COMPLETED'] || 0

  // Trend direction for total claims (weeklyChange)
  const totalTrend = data.weeklyChange
    ? {
        direction: (data.weeklyChange >= 0 ? 'up' : 'down') as 'up' | 'down',
        value: `${Math.abs(data.weeklyChange)}%`,
      }
    : undefined

  const stats: StatConfig[] = [
    {
      id: 'total',
      label: 'Total Claims',
      icon: FileText,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      value: data.totalClaims,
      trend: totalTrend,
      borderColor: 'border-l-primary/50',
      tooltipText: `Total claims in selected period. ${totalTrend ? `${totalTrend.direction === 'up' ? 'Up' : 'Down'} ${totalTrend.value} vs last week` : ''}`,
    },
    {
      id: 'active',
      label: 'Active Claims',
      icon: Loader2,
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
      iconColor: 'text-sky-600 dark:text-sky-400',
      value: activeClaims,
      suffix: 'open',
      borderColor: 'border-l-sky-400/50',
      tooltipText: `Currently active: New (${data.claimsByStatus['NEW'] || 0}), Processing (${data.claimsByStatus['PROCESSING'] || 0}), Manual Review (${data.claimsByStatus['MANUAL_REVIEW'] || 0}), Pending Review (${data.claimsByStatus['PENDING_REVIEW'] || 0})`,
    },
    {
      id: 'completed',
      label: 'Completed Today',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      value: completedToday,
      trend:
        completedToday > 0
          ? { direction: 'up' as const, value: `${completedToday}` }
          : undefined,
      borderColor: 'border-l-emerald-400/50',
      tooltipText: `Claims completed today. Overall ${data.totalClaims} total claims processed.`,
    },
    {
      id: 'confidence',
      label: 'Avg Confidence',
      icon: Brain,
      iconBg: 'bg-purple-100 dark:bg-purple-950/50',
      iconColor: 'text-purple-600 dark:text-purple-400',
      value: data.averageConfidenceScore,
      isConfidence: true,
      borderColor: 'border-l-purple-400/50',
      tooltipText: `Average AI confidence score across all claims: ${data.averageConfidenceScore}%. ${data.averageConfidenceScore >= 80 ? 'Good classification quality.' : 'Consider reviewing low-confidence claims.'}`,
    },
    {
      id: 'attention',
      label: 'Needs Attention',
      icon: AlertTriangle,
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      value: needsAttention,
      borderColor: 'border-l-amber-400/50',
      isCritical: needsAttention > 0,
      pulseClass: 'pulse-attention',
      tooltipText: `${needsAttention} claims need attention: ${data.claimsByStatus['MANUAL_REVIEW'] || 0} manual review, ${data.claimsByStatus['PENDING_REVIEW'] || 0} pending, ${data.claimsByStatus['FAILED'] || 0} failed.`,
    },
    {
      id: 'overdue',
      label: 'Overdue Claims',
      icon: AlertCircle,
      iconBg: 'bg-red-100 dark:bg-red-950/50',
      iconColor: 'text-red-600 dark:text-red-400',
      value: data.overdueClaims,
      borderColor: 'border-l-red-400/50',
      isCritical: data.overdueClaims > 0,
      glowClass: data.overdueClaims > 0 ? 'shadow-red-500/5 shadow-md' : '',
      tooltipText: `${data.overdueClaims} claims have exceeded the 2-hour SLA processing threshold and require immediate attention.`,
    },
  ]

  return (
    <Card className="glass-card card-depth-2 overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <Activity className="size-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Quick Overview
            </h3>
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 font-medium"
            >
              Live
            </Badge>
          </div>
          <RefreshTimer lastUpdated={dataUpdatedAt} />
        </div>

        {/* Stats Grid: 6 cols on lg, 3 cols on md, 2 cols on sm, 1 on xs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat, index) => (
            <MiniStatCard key={stat.id} config={stat} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
