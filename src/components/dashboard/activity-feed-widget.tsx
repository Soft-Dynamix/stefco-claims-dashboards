'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Mail, FileText, Printer, Settings, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/ui/motion'
import { useClaimsStore } from '@/store/claims-store'
import { formatRelativeTime } from '@/lib/helpers'

interface ActivityItem {
  id: string
  action: string
  details: string | null
  status: string
  claimNumber: string | null
  clientName: string | null
  createdAt: string
}

function getActivityIcon(action: string) {
  const lower = action.toLowerCase()
  if (lower.includes('email') || lower.includes('mail') || lower.includes('reply'))
    return { icon: Mail, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-950/50' }
  if (lower.includes('print') || lower.includes('queue'))
    return { icon: Printer, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950/50' }
  if (lower.includes('config') || lower.includes('setting') || lower.includes('system'))
    return { icon: Settings, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/50' }
  return { icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/50' }
}

function formatActionText(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-3.5 w-40 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0 mt-0.5" />
        </div>
      ))}
    </div>
  )
}

export function ActivityFeedWidget() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const refreshKey = useClaimsStore((s) => s.refreshKey)

  const { data, isLoading } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['activity-feed-widget', refreshKey],
    queryFn: () => fetch('/api/activity-feed').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const activities = data?.activities?.slice(0, 8) || []

  return (
    <FadeIn delay={0.65}>
      <Card className="py-5 card-shine card-hover">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity className="size-5 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Live Activity Feed</CardTitle>
              {/* Green pulsing live indicator */}
              <span className="flex items-center gap-1.5 ml-1">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Live
                </span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-primary hover:text-primary hover:bg-primary/5"
              onClick={() => setActiveTab('audit')}
            >
              View All
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ActivitySkeleton />
          ) : activities.length > 0 ? (
            <div className="space-y-1">
              {activities.map((item, index) => {
                const { icon: ActivityIcon, color, bg } = getActivityIcon(item.action)
                const statusDot =
                  item.status === 'SUCCESS'
                    ? 'bg-emerald-500'
                    : item.status === 'WARNING'
                    ? 'bg-amber-500'
                    : 'bg-red-500'

                return (
                  <div
                    key={item.id}
                    className="card-enter flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`flex items-center justify-center size-8 rounded-lg ${bg} shrink-0`}>
                      <ActivityIcon className={`size-3.5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {formatActionText(item.action)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.claimNumber || ''}
                        {item.clientName ? ` — ${item.clientName}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      <div className={`size-1.5 rounded-full ${statusDot}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground/50">
              <Activity className="size-8 mb-2 opacity-40" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}
