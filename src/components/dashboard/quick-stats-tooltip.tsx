'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  Activity,
  CheckCircle2,
  Brain,
  AlertTriangle,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { FadeIn } from '@/components/ui/motion'
import { useClaimsStore } from '@/store/claims-store'

// ─── Sparkline mini bars (reuse existing pattern) ─────────────────────────
function SparklineBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-sm transition-all duration-300 ${color}`}
          style={{ height: `${Math.max(2, (v / max) * 14)}px` }}
        />
      ))}
    </div>
  )
}

// ─── Animated number hook ─────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  React.useEffect(() => {
    if (prevRef.current === target) return
    const start = prevRef.current
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (target - start) * eased)
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  React.useEffect(() => {
    prevRef.current = target
    setDisplay(target)
    // Only reset on mount
  }, [target])

  return display
}

// ─── Mini stat card ───────────────────────────────────────────────────────
interface MiniStatCard {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
  iconColor: string
  iconBg: string
  sparkColor: string
  sparkBase: number
  sparkVariance: number
}

function MiniStatCardItem({ card }: { card: MiniStatCard }) {
  const animatedValue = useAnimatedNumber(card.value)
  const Icon = card.icon

  const sparkValues = React.useMemo(() => {
    return [0.6, 0.8, 0.7, 0.9, 1.0].map((m) =>
      Math.round(Math.max(1, card.sparkBase * m + (Math.random() - 0.5) * card.sparkVariance))
    )
  }, [card.sparkBase, card.sparkVariance])

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors card-enter">
      <div className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${card.iconBg}`}>
        <Icon className={`size-4 ${card.iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight tabular-nums text-foreground">
          {animatedValue}{card.suffix ?? ''}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[10px] text-muted-foreground leading-tight truncate">{card.label}</p>
          <SparklineBars values={sparkValues} color={card.sparkColor} />
        </div>
      </div>
    </div>
  )
}

// ─── Main Quick Stats Tooltip component ───────────────────────────────────
export function QuickStatsTooltip() {
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setOpen(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    // Small delay to allow moving mouse into popover
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 200)
  }, [])

  const handlePopoverMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handlePopoverMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 200)
  }, [])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const { data, isLoading } = useQuery<{
    totalClaims: number
    claimsToday: number
    averageConfidenceScore: number
    manualReviewPending: number
    overdueClaims: number
    claimsByStatus: Record<string, number>
  }>({
    queryKey: ['quick-stats-tooltip'],
    queryFn: () => fetch('/api/dashboard').then((r) => {
      if (!r.ok) return null
      return r.json()
    }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  })

  // Derive active claims from status breakdown
  const activeClaims = React.useMemo(() => {
    if (!data?.claimsByStatus) return 0
    return Object.entries(data.claimsByStatus)
      .filter(([status]) => !['COMPLETED', 'FAILED'].includes(status))
      .reduce((sum, [, count]) => sum + count, 0)
  }, [data])

  const handleViewDashboard = useCallback(() => {
    setOpen(false)
    setActiveTab('dashboard')
  }, [setActiveTab])

  const statCards: MiniStatCard[] = React.useMemo(() => [
    {
      icon: FileText,
      label: 'Total Claims',
      value: data?.totalClaims ?? 0,
      iconColor: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
      sparkColor: 'bg-sky-400',
      sparkBase: data?.totalClaims ?? 0,
      sparkVariance: 10,
    },
    {
      icon: Activity,
      label: 'Active Claims',
      value: activeClaims,
      iconColor: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-100 dark:bg-violet-950/50',
      sparkColor: 'bg-violet-400',
      sparkBase: activeClaims,
      sparkVariance: 5,
    },
    {
      icon: CheckCircle2,
      label: 'Completed Today',
      value: data?.claimsToday ?? 0,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
      sparkColor: 'bg-emerald-400',
      sparkBase: data?.claimsToday ?? 0,
      sparkVariance: 3,
    },
    {
      icon: Brain,
      label: 'Avg Confidence',
      value: data?.averageConfidenceScore ?? 0,
      suffix: '%',
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      sparkColor: 'bg-primary/60',
      sparkBase: data?.averageConfidenceScore ?? 0,
      sparkVariance: 8,
    },
    {
      icon: AlertTriangle,
      label: 'Needs Attention',
      value: data?.manualReviewPending ?? 0,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
      sparkColor: 'bg-amber-400',
      sparkBase: data?.manualReviewPending ?? 0,
      sparkVariance: 3,
    },
    {
      icon: Clock,
      label: 'Overdue',
      value: data?.overdueClaims ?? 0,
      iconColor: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-950/50',
      sparkColor: 'bg-red-400',
      sparkBase: data?.overdueClaims ?? 0,
      sparkVariance: 2,
    },
  ], [data, activeClaims])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => {
            setOpen(false)
            setActiveTab('dashboard')
          }}
          className="inline-flex items-center justify-center size-9 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
          aria-label="Quick Stats"
        >
          <FileText className="size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[320px] p-0 overflow-hidden glass-card card-depth-1"
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <FadeIn delay={0}>
          {/* Header */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                <FileText className="size-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Quick Stats</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Live claims overview</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] text-muted-foreground font-medium">Live</span>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Stats Grid */}
          <div className="px-3 py-3">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <Skeleton className="size-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {statCards.map((card) => (
                  <MiniStatCardItem key={card.label} card={card} />
                ))}
              </div>
            )}
          </div>

          <Separator className="opacity-50" />

          {/* Footer */}
          <div className="px-3 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md cursor-pointer"
              onClick={handleViewDashboard}
            >
              <span className="flex items-center gap-1.5">
                {isLoading && <Loader2 className="size-3 animate-spin" />}
                View Dashboard
              </span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </FadeIn>
      </PopoverContent>
    </Popover>
  )
}
