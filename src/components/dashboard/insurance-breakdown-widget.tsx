'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'

interface CompanyData {
  name: string
  total: number
  active: number
  completed: number
}

export function InsuranceBreakdownWidget() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  const { data: analytics, isLoading } = useQuery<{
    claimsByCompany: CompanyData[]
    totalClaims: number
  }>({
    queryKey: ['claims-analytics', refreshKey],
    queryFn: () => fetch('/api/claims/analytics').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    retryDelay: 1000,
  })

  const companies = (analytics?.claimsByCompany || []).slice(0, 8)
  const totalClaims = analytics?.totalClaims || 0
  const maxTotal = companies.length > 0 ? Math.max(...companies.map((c) => c.total)) : 1

  return (
    <Card className="py-6 card-shine card-lift">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Insurance Breakdown</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs font-medium h-5">
            {totalClaims} claims
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : companies.length > 0 ? (
          <div className="space-y-4">
            {companies.map((company) => {
              const totalWidth = (company.total / maxTotal) * 100
              const activeWidth = company.total > 0 ? (company.active / company.total) * 100 : 0

              return (
                <div
                  key={company.name}
                  className="group rounded-lg p-2 -mx-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground truncate max-w-[60%]">
                      {company.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {company.active} active
                      </span>
                      <Badge variant="secondary" className="text-xs font-semibold h-5 px-1.5">
                        {company.total}
                      </Badge>
                    </div>
                  </div>

                  {/* Bar: background for total, foreground for active */}
                  <div className="h-3 bg-primary/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/50 rounded-full transition-all duration-700 ease-out progress-bar"
                      style={{ width: `${totalWidth}%` }}
                    >
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${activeWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex items-center gap-4 pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-sm bg-primary/50" />
                <span className="text-[11px] text-muted-foreground">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-sm bg-primary" />
                <span className="text-[11px] text-muted-foreground">Active</span>
              </div>
              <span className="text-[11px] text-muted-foreground ml-auto">
                Showing top {companies.length} of {(analytics?.claimsByCompany || []).length} companies
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Building2 className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No company data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
