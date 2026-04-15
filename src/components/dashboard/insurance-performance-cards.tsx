'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  TrendingUp,
  Timer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getConfidenceColor, getConfidenceBg, formatRelativeTime } from '@/lib/helpers'

interface InsuranceCompany {
  id: string
  name: string
  folderName: string
  isActive: boolean
  updatedAt: string
  _count: { claims: number }
}

interface ClaimSummary {
  claims: {
    id: string
    status: string
    confidenceScore: number
    createdAt: string
    processedAt: string | null
    updatedAt: string
    insuranceCompanyId: string | null
  }[]
  total: number
}

const statusBadges: Record<string, { label: string; color: string }> = {
  NEW: { label: 'New', color: 'bg-sky-500' },
  PROCESSING: { label: 'Proc', color: 'bg-amber-500' },
  COMPLETED: { label: 'Done', color: 'bg-emerald-500' },
  MANUAL_REVIEW: { label: 'Review', color: 'bg-orange-500' },
  FAILED: { label: 'Fail', color: 'bg-red-500' },
  PENDING_REVIEW: { label: 'Pend', color: 'bg-violet-500' },
}

function PerformanceCardSkeleton() {
  return (
    <Card className="overflow-hidden card-enter">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="size-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-16 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  )
}

function ConfidenceProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getConfidenceBg(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${getConfidenceColor(value)}`}>{value}%</span>
    </div>
  )
}

export function InsurancePerformanceCards() {
  const { data: companiesData, isLoading: companiesLoading } = useQuery<{
    companies: InsuranceCompany[]
  }>({
    queryKey: ['insurance-companies-perf'],
    queryFn: () =>
      fetch('/api/insurance').then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      }),
    staleTime: 60000,
    retry: 2,
  })

  const { data: claimsData, isLoading: claimsLoading } = useQuery<ClaimSummary>({
    queryKey: ['claims-insurance-perf'],
    queryFn: () =>
      fetch('/api/claims?limit=200').then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      }),
    staleTime: 60000,
    retry: 2,
  })

  const companyStats = useMemo(() => {
    const companies = companiesData?.companies || []
    const claims = claimsData?.claims || []

    return companies.map((company) => {
      const companyClaims = claims.filter((c) => c.insuranceCompanyId === company.id)
      const avgConfidence =
        companyClaims.length > 0
          ? Math.round(companyClaims.reduce((s, c) => s + c.confidenceScore, 0) / companyClaims.length)
          : 0

      const processed = companyClaims.filter((c) => c.processedAt && c.createdAt)
      const avgHours =
        processed.length > 0
          ? Math.round(
              processed.reduce((s, c) => {
                return (
                  s +
                  Math.max(
                    1,
                    (new Date(c.processedAt!).getTime() - new Date(c.createdAt).getTime()) /
                      (1000 * 60 * 60)
                  )
                )
              }, 0) / processed.length
            )
          : 0

      const byStatus: Record<string, number> = {}
      companyClaims.forEach((c) => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1
      })

      const lastActivity =
        companyClaims.length > 0
          ? new Date(
              Math.max(...companyClaims.map((c) => new Date(c.updatedAt).getTime()))
            )
          : null

      return {
        ...company,
        avgConfidence,
        avgProcessingHours: avgHours,
        totalClaims: companyClaims.length,
        byStatus,
        lastActivity,
      }
    })
  }, [companiesData, claimsData])

  if (companiesLoading || claimsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <PerformanceCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-[600px]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companyStats.map((company) => {
          const initial = company.name.charAt(0).toUpperCase()
          const completedCount = company.byStatus['COMPLETED'] || 0
          const processingCount = company.byStatus['PROCESSING'] || 0
          const failedCount = company.byStatus['FAILED'] || 0
          const total = company.totalClaims

          return (
            <Card
              key={company.id}
              className={`overflow-hidden card-enter card-interactive transition-all duration-200 ${
                !company.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* Top gradient bar */}
              <div className="h-1 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/10 shrink-0">
                    <span className="text-lg font-bold text-primary">{initial}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {company.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {total} claims
                      </Badge>
                      {!company.isActive && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Avg Confidence */}
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BarChart3 className="size-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground">Avg Confidence</span>
                    </div>
                    {company.totalClaims > 0 ? (
                      <ConfidenceProgressBar value={company.avgConfidence} />
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>

                  {/* Avg Processing */}
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Timer className="size-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground">Avg Processing</span>
                    </div>
                    {company.avgProcessingHours > 0 ? (
                      <p className="text-lg font-bold text-foreground">
                        {company.avgProcessingHours > 24
                          ? `${(company.avgProcessingHours / 24).toFixed(1)}d`
                          : `${company.avgProcessingHours}h`}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>
                </div>

                {/* Status Breakdown */}
                {total > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Status Breakdown
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(company.byStatus)
                        .sort(([, a], [, b]) => b - a)
                        .map(([status, count]) => {
                          const cfg = statusBadges[status]
                          return (
                            <div
                              key={status}
                              className="flex items-center gap-1.5 text-xs rounded-md bg-muted/50 px-2 py-1"
                            >
                              <div className={`size-2 rounded-full ${cfg?.color || 'bg-gray-400'}`} />
                              <span className="text-muted-foreground font-medium">{count}</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Last Activity */}
                {company.lastActivity && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
                    <Clock className="size-3 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/60">
                      Last activity: {formatRelativeTime(company.lastActivity.toISOString())}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </ScrollArea>
  )
}
