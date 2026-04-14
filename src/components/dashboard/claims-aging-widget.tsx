'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, TrendingDown, CheckCircle2, Hourglass } from 'lucide-react'

const BUCKET_STYLES: Record<string, { color: string; bg: string; barBg: string }> = {
  '0-7 days': {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-950/50',
    barBg: 'bg-emerald-500/20',
  },
  '8-30 days': {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/50',
    barBg: 'bg-amber-500/20',
  },
  '31-60 days': {
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950/50',
    barBg: 'bg-orange-500/20',
  },
  '61-90 days': {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/50',
    barBg: 'bg-red-500/20',
  },
  '90+ days': {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-200 dark:bg-red-950/50',
    barBg: 'bg-red-500/30',
  },
}

const BUCKET_ICONS: Record<string, React.ElementType> = {
  '0-7 days': CheckCircle2,
  '8-30 days': Clock,
  '31-60 days': TrendingDown,
  '61-90 days': AlertTriangle,
  '90+ days': AlertTriangle,
}

interface AgingBucket {
  label: string
  count: number
  avgConfidence: number
  statuses: Record<string, number>
}

export function ClaimsAgingWidget() {
  const { data, isLoading } = useQuery<{
    buckets: AgingBucket[]
    summary: { totalAged: number; avgAge: number; criticalCount: number }
  }>({
    queryKey: ['claims-aging-widget'],
    queryFn: () => fetch('/api/claims/aging').then(r => {
      if (!r.ok) throw new Error('Request failed')
      return r.json()
    }),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const buckets = data?.buckets || []
  const summary = data?.summary
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
  const maxCount = Math.max(...buckets.map(b => b.count), 1)

  return (
    <Card className="py-4 card-shine card-hover hover:shadow-md transition-shadow duration-200 h-full card-enter">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Hourglass className="size-4 text-muted-foreground" />
            Claims Aging
            <Badge variant="secondary" className="text-[10px]">
              {totalCount} total
            </Badge>
          </CardTitle>
          {summary && summary.criticalCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
              {summary.criticalCount} critical
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 bg-muted/50 rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const styles = BUCKET_STYLES[bucket.label] || BUCKET_STYLES['0-7 days']
              const Icon = BUCKET_ICONS[bucket.label] || Clock
              const percentage = (bucket.count / maxCount) * 100
              return (
                <div key={bucket.label} className="flex items-center gap-3">
                  <div className={`flex items-center justify-center size-5 rounded shrink-0 ${styles.bg}`}>
                    <Icon className={`size-3 ${styles.color}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-20 shrink-0">{bucket.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${styles.barBg} flex items-center`}
                      style={{ width: `${Math.max(percentage, bucket.count > 0 ? 15 : 0)}%` }}
                    >
                      {bucket.count > 0 && (
                        <span className="text-[10px] font-semibold text-foreground px-1.5">{bucket.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {summary && (
              <div className="flex items-center justify-between pt-2 mt-1 border-t">
                <span className="text-[11px] text-muted-foreground">Avg age</span>
                <span className="text-xs font-semibold text-foreground">{summary.avgAge} days</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
