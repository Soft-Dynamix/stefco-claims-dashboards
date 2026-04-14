'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Timer,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/lib/helpers'

// ── Types ───────────────────────────────────────────────────────────────────────

interface PrintQueueItem {
  id: string
  claimId: string | null
  fileName: string
  filePath: string | null
  printStatus: string
  pages: number | null
  createdAt: string
  printedAt: string | null
  error: string | null
  claim: { claimNumber: string } | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  QUEUED: '#0ea5e9',     // sky
  PRINTING: '#f59e0b',   // amber
  COMPLETED: '#10b981',  // emerald
  FAILED: '#ef4444',     // red
}

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  PRINTING: 'Printing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

const STATUS_BG_CLASSES: Record<string, string> = {
  QUEUED: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  PRINTING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
}

const TOOLTIP_STYLE = {
  fontSize: 13,
  padding: '10px 14px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accentColor,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  accentColor: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover-scale transition-shadow hover:shadow-sm">
      <div className={`flex items-center justify-center size-10 rounded-lg ${accentColor} shrink-0`}>
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function PrintStatusDonut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <div className="text-center">
          <Printer className="size-8 mx-auto opacity-30 mb-2" />
          <p className="text-sm">No print jobs yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--color-foreground)' }}
            labelStyle={{ color: 'var(--color-foreground)' }}
            formatter={(value: number) => [value, 'Jobs']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
      </div>
    </div>
  )
}

function PrintVolumeBarChart({ items }: { items: PrintQueueItem[] }) {
  const chartData = useMemo(() => {
    const dayMap: Record<string, { queued: number; printing: number; completed: number; failed: number }> = {}
    for (const item of items) {
      const dateKey = new Date(item.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
      if (!dayMap[dateKey]) dayMap[dateKey] = { queued: 0, printing: 0, completed: 0, failed: 0 }
      const status = item.printStatus.toLowerCase() as 'queued' | 'printing' | 'completed' | 'failed'
      if (status in dayMap[dateKey]) {
        dayMap[dateKey][status]++
      }
    }
    // Return last 7 days max, sorted by creation
    return Object.entries(dayMap)
      .sort(([a], [b]) => {
        const dA = items.find(i => new Date(i.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) === a)
        const dB = items.find(i => new Date(i.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) === b)
        if (!dA || !dB) return 0
        return new Date(dA.createdAt).getTime() - new Date(dB.createdAt).getTime()
      })
      .slice(-7)
      .map(([date, counts]) => ({ date, ...counts }))
  }, [items])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <p className="text-sm">No data available</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" className="opacity-40" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          itemStyle={{ color: 'var(--color-foreground)' }}
          labelStyle={{ color: 'var(--color-foreground)' }}
          formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
        />
        <Bar dataKey="completed" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={14} name="Completed" />
        <Bar dataKey="queued" fill="#0ea5e9" radius={[2, 2, 0, 0]} maxBarSize={14} name="Queued" />
        <Bar dataKey="printing" fill="#f59e0b" radius={[2, 2, 0, 0]} maxBarSize={14} name="Printing" />
        <Bar dataKey="failed" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={14} name="Failed" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function RecentFailures({ items }: { items: PrintQueueItem[] }) {
  const failures = useMemo(() => {
    return items
      .filter(i => i.printStatus === 'FAILED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [items])

  if (failures.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <div className="text-center">
          <CheckCircle2 className="size-5 mx-auto opacity-30 mb-1.5" />
          <p className="text-xs">No recent failures</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
      {failures.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2.5 p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100/50 dark:border-red-900/30"
        >
          <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {item.claim?.claimNumber && (
                <span className="text-[11px] font-mono font-semibold text-foreground">
                  {item.claim.claimNumber}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={item.fileName}>
                {item.fileName}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {item.error && (
                <span className="text-[10px] text-red-600 dark:text-red-400 truncate">
                  {item.error}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60 shrink-0">
                {formatDate(item.createdAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <Card className="card-enter">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-5 w-44" />
        </div>
        <Skeleton className="h-3 w-56 mt-1" />
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Metrics row skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[240px] rounded-xl" />
          <Skeleton className="h-[240px] rounded-xl" />
        </div>
        {/* Failures skeleton */}
        <Skeleton className="h-[100px] rounded-lg" />
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PrintQueueAnalytics() {
  const { data: rawData, isLoading } = useQuery<{ printQueueItems: PrintQueueItem[] }>({
    queryKey: ['print-queue-analytics'],
    queryFn: () =>
      fetch('/api/print-queue?limit=100').then((r) => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      }),
    staleTime: 30000,
    retry: 2,
    retryDelay: 1000,
  })

  const items = rawData?.printQueueItems || []

  // ── Derived Metrics ──────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = items.length
    const queued = items.filter(i => i.printStatus === 'QUEUED').length
    const printing = items.filter(i => i.printStatus === 'PRINTING').length
    const completed = items.filter(i => i.printStatus === 'COMPLETED').length
    const failed = items.filter(i => i.printStatus === 'FAILED').length
    const completedToday = items.filter(i => i.printStatus === 'COMPLETED' && i.printedAt && isToday(i.printedAt)).length

    // Simulated average queue time: base 3.2m + small variation
    const avgQueueTime = 3.2 + (completed * 0.08)

    // Completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, queued, printing, completed, failed, completedToday, avgQueueTime, completionRate }
  }, [items])

  // ── Donut Data ──────────────────────────────────────────────────────────

  const donutData = useMemo(() => {
    return [
      { name: 'Queued', value: metrics.queued, color: STATUS_COLORS.QUEUED },
      { name: 'Printing', value: metrics.printing, color: STATUS_COLORS.PRINTING },
      { name: 'Completed', value: metrics.completed, color: STATUS_COLORS.COMPLETED },
      { name: 'Failed', value: metrics.failed, color: STATUS_COLORS.FAILED },
    ].filter(d => d.value > 0)
  }, [metrics])

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  return (
    <Card className="card-shine card-hover card-enter">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
              <Printer className="size-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">Print Queue Analytics</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Print job status distribution and performance metrics
              </CardDescription>
            </div>
          </div>
          {metrics.total > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {metrics.total} jobs
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Key Metrics Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Printer}
            label="Total Print Jobs"
            value={metrics.total}
            accentColor="bg-primary/10 text-primary"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Completed Today"
            value={metrics.completedToday}
            sub={`${metrics.completed} all time`}
            accentColor="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
          />
          <MetricCard
            icon={AlertCircle}
            label="Failed Jobs"
            value={metrics.failed}
            sub={metrics.failed > 0 ? 'Needs attention' : 'All good'}
            accentColor="bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
          />
          <MetricCard
            icon={Timer}
            label="Avg Queue Time"
            value={`${metrics.avgQueueTime.toFixed(1)}m`}
            sub="Simulated estimate"
            accentColor="bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* ── Completion Rate Bar ─────────────────────────────────────────── */}
        {metrics.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Completion Rate</span>
              <span className="font-semibold text-foreground">{metrics.completionRate}%</span>
            </div>
            <Progress
              value={metrics.completionRate}
              className="h-2"
            />
          </div>
        )}

        <Separator />

        {/* ── Charts Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Status Distribution Donut */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="size-3.5 text-muted-foreground" />
              Status Distribution
            </h3>
            <PrintStatusDonut data={donutData} />
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Print Volume Trend */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Loader2 className="size-3.5 text-muted-foreground" />
              Print Volume by Day
            </h3>
            <PrintVolumeBarChart items={items} />
          </div>
        </div>

        <Separator />

        {/* ── Recent Print Failures ──────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="size-3.5 text-red-500" />
            Recent Print Failures
            {metrics.failed > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">
                {metrics.failed}
              </Badge>
            )}
          </h3>
          <RecentFailures items={items} />
        </div>
      </CardContent>
    </Card>
  )
}
