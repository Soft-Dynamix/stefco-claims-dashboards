'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Star, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type QuickFilterType = 'urgent' | 'recent' | 'stale' | 'highValue' | 'watchlist' | 'needsAttention' | 'verified'

interface QuickFilterChipProps {
  id: QuickFilterType
  icon: React.ElementType
  label: string
  description: string
  count: number
  active: boolean
  onClick: () => void
  chipColor: string
  activeColor: string
}

function QuickFilterChip({ id, icon: Icon, label, count, active, onClick, chipColor, activeColor }: QuickFilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer border select-none ${
        active
          ? `${activeColor} shadow-sm ring-1 ring-offset-1 ring-current/20`
          : `${chipColor} hover:opacity-80`
      }`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
      {count > 0 && (
        <span className={`tabular-nums ${active ? 'font-bold' : 'font-semibold opacity-70'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

interface QuickFilterBarProps {
  activeFilter: QuickFilterType | null
  onFilterChange: (filter: QuickFilterType | null) => void
}

export function QuickFilterBar({ activeFilter, onFilterChange }: QuickFilterBarProps) {
  const { data: counts, isLoading } = useQuery<{
    urgent: number
    recent: number
    stale: number
    highValue: number
    needsAttention: number
    verified: number
  }>({
    queryKey: ['quick-counts'],
    queryFn: () => fetch('/api/claims/quick-counts').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  })

  const handleToggle = (filter: QuickFilterType) => {
    if (activeFilter === filter) {
      onFilterChange(null)
    } else {
      onFilterChange(filter)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
    )
  }

  const watchlistCount = (() => {
    if (typeof window === 'undefined') return 0
    try {
      const stored = localStorage.getItem('stefco-starred-claims')
      return stored ? JSON.parse(stored).length : 0
    } catch {
      return 0
    }
  })()

  const filters: { id: QuickFilterType; icon: React.ElementType; label: string; description: string; count: number; chipColor: string; activeColor: string }[] = [
    {
      id: 'needsAttention',
      icon: AlertCircle,
      label: 'Needs Attention',
      description: 'Flagged for manual review',
      count: counts?.needsAttention ?? 0,
      chipColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
      activeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700',
    },
    {
      id: 'verified',
      icon: CheckCircle2,
      label: 'Verified',
      description: 'Verified by user',
      count: counts?.verified ?? 0,
      chipColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
      activeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700',
    },
    {
      id: 'urgent',
      icon: AlertTriangle,
      label: 'Urgent',
      description: 'Low confidence (< 60%)',
      count: counts?.urgent ?? 0,
      chipColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
      activeColor: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-700',
    },
    {
      id: 'recent',
      icon: Clock,
      label: 'Recent',
      description: 'Created in last 7 days',
      count: counts?.recent ?? 0,
      chipColor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
      activeColor: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700',
    },
    {
      id: 'stale',
      icon: Clock,
      label: 'Stale',
      description: 'No activity for 30+ days',
      count: counts?.stale ?? 0,
      chipColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
      activeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700',
    },
    {
      id: 'highValue',
      icon: DollarSign,
      label: 'High Value',
      description: 'Excess > R50,000',
      count: counts?.highValue ?? 0,
      chipColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
      activeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700',
    },
    {
      id: 'watchlist',
      icon: Star,
      label: 'Watchlist',
      description: 'Starred/favorite claims',
      count: watchlistCount,
      chipColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
      activeColor: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-700',
    },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground tracking-wide mr-0.5">Quick Filters</span>
      {filters.map((filter) => (
        <Tooltip key={filter.id}>
          <TooltipTrigger asChild>
            <div>
              <QuickFilterChip
                {...filter}
                active={activeFilter === filter.id}
                onClick={() => handleToggle(filter.id)}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{filter.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      {activeFilter && (
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
          Filtered
        </Badge>
      )}
    </div>
  )
}
