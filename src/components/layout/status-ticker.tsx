'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, useEffect, useRef } from 'react'
import { formatRelativeTime } from '@/lib/helpers'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActivityItem {
  id: string
  action: string
  details: string | null
  status: string
  claimNumber: string | null
  clientName: string | null
  createdAt: string
}

interface QuickCounts {
  urgent: number
  recent: number
  stale: number
  highValue: number
  needsAttention: number
  verified: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function actionToTickerMessage(item: ActivityItem): string {
  const claimRef = item.claimNumber || 'Unknown claim'
  const timeStr = formatRelativeTime(item.createdAt)
  const action = item.action.toLowerCase().replace(/_/g, ' ')

  if (action.includes('email received') || action.includes('claim created')) {
    return `New claim ${claimRef} received ${timeStr}`
  }
  if (action.includes('classified') || action.includes('classification')) {
    return `${claimRef} classified by AI ${timeStr}`
  }
  if (action.includes('status change') || action.includes('moved')) {
    const newStatus = item.details?.match(/to\s+([\w_]+)/i)?.[1]?.replace(/_/g, ' ')
    return newStatus
      ? `${claimRef} moved to ${newStatus} ${timeStr}`
      : `${claimRef} status updated ${timeStr}`
  }
  if (action.includes('print') || action.includes('document')) {
    return `Document queued for ${claimRef} ${timeStr}`
  }
  if (action.includes('note')) {
    return `Note added to ${claimRef} ${timeStr}`
  }
  if (action.includes('review') || action.includes('verified')) {
    return `${claimRef} reviewed ${timeStr}`
  }

  return `${claimRef} — ${action} ${timeStr}`
}

function countsToTickerMessages(counts: QuickCounts): string[] {
  const messages: string[] = []
  if (counts.needsAttention > 0) {
    messages.push(`${counts.needsAttention} claim${counts.needsAttention !== 1 ? 's' : ''} need attention`)
  }
  if (counts.urgent > 0) {
    messages.push(`${counts.urgent} urgent claim${counts.urgent !== 1 ? 's' : ''} (low confidence)`)
  }
  if (counts.stale > 0) {
    messages.push(`${counts.stale} stale claim${counts.stale !== 1 ? 's' : ''} (30d+ inactive)`)
  }
  if (counts.recent > 0) {
    messages.push(`${counts.recent} new claim${counts.recent !== 1 ? 's' : ''} this week`)
  }
  if (counts.verified > 0) {
    messages.push(`${counts.verified} verified claim${counts.verified !== 1 ? 's' : ''}`)
  }
  return messages
}

// ─── Component ────────────────────────────────────────────────────────────────
export function StatusTicker() {
  // Fetch activity feed
  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['ticker-activity'],
    queryFn: () => fetch('/api/activity-feed?limit=5').then((r) => {
      if (!r.ok) return { activities: [] }
      return r.json()
    }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })

  // Fetch quick counts
  const { data: countsData } = useQuery<QuickCounts>({
    queryKey: ['ticker-quick-counts'],
    queryFn: () => fetch('/api/claims/quick-counts').then((r) => {
      if (!r.ok) return null
      return r.json()
    }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  })

  // Build ticker messages
  const messages = useMemo(() => {
    const msgs: string[] = []

    // Activity-based messages
    const activities = activityData?.activities ?? []
    for (const item of activities.slice(0, 4)) {
      msgs.push(actionToTickerMessage(item))
    }

    // Count-based summary messages
    if (countsData) {
      msgs.push(...countsToTickerMessages(countsData))
    }

    // Fallback message if no data
    if (msgs.length === 0) {
      msgs.push('Stefco Claims Dashboard — Operational')
    }

    return msgs
  }, [activityData, countsData])

  const innerRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(30)

  // Calculate animation duration based on content width
  useEffect(() => {
    if (innerRef.current) {
      const contentWidth = innerRef.current.scrollWidth / 2
      const pixelsPerSecond = 60 // comfortable reading speed
      const calcDuration = Math.max(contentWidth / pixelsPerSecond, 15)
      setDuration(calcDuration)
    }
  }, [messages])

  return (
    <div
      className="hidden sm:block relative h-8 w-full overflow-hidden border-b border-primary/5 bg-primary/[0.03] dark:bg-primary/[0.05] backdrop-blur-sm"
      style={{
        borderLeft: '3px solid oklch(0.72 0.12 165 / 60%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)',
        maskImage: 'linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)',
      }}
      role="marquee"
      aria-label="Claim activity ticker"
    >
      {/* Scrolling content */}
      <div className="flex items-center h-full">
        <div
          ref={innerRef}
          className="ticker-scroll flex items-center text-xs text-muted-foreground"
          style={{
            animationDuration: `${duration}s`,
          }}
        >
          {messages.map((msg, i) => (
            <span key={`a-${i}`} className="inline-flex items-center shrink-0">
              {i > 0 && (
                <span className="mx-4 text-primary/40 select-none" aria-hidden="true">•</span>
              )}
              <span className="whitespace-nowrap">{msg}</span>
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {messages.map((msg, i) => (
            <span key={`b-${i}`} className="inline-flex items-center shrink-0">
              <span className="mx-4 text-primary/40 select-none" aria-hidden="true">•</span>
              <span className="whitespace-nowrap">{msg}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
