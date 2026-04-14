'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Eye, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'
import { getStatusColor, getStatusLabel } from '@/lib/helpers'

interface AgingSummaryCounts {
  critical: number
  warning: number
  normal: number
  recent: number
  totalOverdue: number
}

interface OverdueClaim {
  id: string
  claimNumber: string
  clientName: string
  daysOverdue: number
  status: string
}

interface AgingSummaryData {
  counts: AgingSummaryCounts
  overdue: OverdueClaim[]
}

const SEVERITY_CONFIG: {
  key: keyof AgingSummaryCounts
  label: string
  colorClass: string
  dotClass: string
}[] = [
  {
    key: 'critical',
    label: 'Critical',
    colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    dotClass: 'bg-red-500',
  },
  {
    key: 'warning',
    label: 'Warning',
    colorClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'normal',
    label: 'Normal',
    colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800',
    dotClass: 'bg-yellow-500',
  },
  {
    key: 'recent',
    label: 'Recent',
    colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
]

export function AgingAlertCard() {
  const setSelectedClaimId = useClaimsStore((s) => s.setSelectedClaimId)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const { data, isLoading } = useQuery<AgingSummaryData>({
    queryKey: ['aging-summary'],
    queryFn: () =>
      fetch('/api/claims/aging-summary').then((r) => {
        if (!r.ok) throw new Error('Failed to load aging summary')
        return r.json()
      }),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
  })

  const handleClaimClick = (claimId: string) => {
    setSelectedClaimId(claimId)
    setActiveTab('claims')
  }

  const handleViewAll = () => {
    setActiveTab('claims')
  }

  const counts = data?.counts
  const overdue = data?.overdue || []

  return (
    <Card className="card-enter stagger-1 card-hover card-lift hover:shadow-md transition-shadow duration-200 h-full overflow-hidden border-l-4 border-l-red-500/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-9 rounded-lg bg-red-100 dark:bg-red-950/50">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-base font-semibold">
              Aging Claims Alert
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleViewAll}
          >
            <Eye className="size-3.5" />
            View All
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-32" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7 flex-1" />
              ))}
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            {/* Total overdue large number */}
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-foreground tracking-tight">
                  {counts?.totalOverdue ?? 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  overdue claims
                </span>
              </div>
              {counts && counts.critical > 0 && (
                <Badge
                  className="text-[10px] font-medium px-1.5 h-5 bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                >
                  {counts.critical} critical
                </Badge>
              )}
            </div>

            {/* Severity badges */}
            <div className="flex flex-wrap gap-2">
              {SEVERITY_CONFIG.map((severity) => (
                <div
                  key={severity.key}
                  className="flex items-center gap-1.5"
                >
                  <div className={`size-2 rounded-full ${severity.dotClass}`} />
                  <span className="text-xs text-muted-foreground">
                    {severity.label}:
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {counts?.[severity.key] ?? 0}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* Top 3 most overdue claims */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Most Overdue
              </p>
              {overdue.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <Clock className="size-4" />
                    <span>No overdue claims</span>
                  </div>
                </div>
              ) : (
                overdue.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group border border-transparent hover:border-border/50"
                    onClick={() => handleClaimClick(claim.id)}
                  >
                    <div
                      className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${
                        claim.daysOverdue >= 7
                          ? 'bg-red-100 dark:bg-red-950/50'
                          : claim.daysOverdue >= 3
                          ? 'bg-amber-100 dark:bg-amber-950/50'
                          : 'bg-yellow-100 dark:bg-yellow-950/50'
                      }`}
                    >
                      <Clock
                        className={`size-4 ${
                          claim.daysOverdue >= 7
                            ? 'text-red-600 dark:text-red-400'
                            : claim.daysOverdue >= 3
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {claim.clientName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(claim.status)} text-[10px] px-1 h-4 shrink-0`}
                        >
                          {getStatusLabel(claim.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {claim.claimNumber}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          claim.daysOverdue >= 7
                            ? 'text-red-600 dark:text-red-400'
                            : claim.daysOverdue >= 3
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {claim.daysOverdue}d
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        overdue
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
