'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface InsuranceComparisonData {
  company: string
  totalClaims: number
  statusBreakdown: {
    NEW: number
    PROCESSING: number
    MANUAL_REVIEW: number
    COMPLETED: number
  }
  avgConfidence: number
}

interface ChartRow {
  company: string
  totalClaims: number
  NEW: number
  PROCESSING: number
  MANUAL_REVIEW: number
  COMPLETED: number
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#0ea5e9',       // sky
  PROCESSING: '#f59e0b', // amber
  MANUAL_REVIEW: '#f97316', // orange
  COMPLETED: '#10b981',  // emerald
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  MANUAL_REVIEW: 'Manual Review',
  COMPLETED: 'Completed',
}

const tooltipStyle = {
  fontSize: 13,
  padding: '10px 14px',
  borderRadius: '12px',
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: ChartRow }>; label?: string }) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0]?.payload as ChartRow | undefined
  if (!data) return null

  return (
    <div
      className="rounded-xl border p-3 shadow-lg"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-popover)',
        color: 'var(--color-popover-foreground)',
      }}
    >
      <p className="font-semibold text-sm mb-2">{label}</p>
      <div className="space-y-1">
        {Object.entries(STATUS_LABELS).map(([key, label]) => {
          const value = data[key]
          if (!value) return null
          return (
            <div key={key} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: STATUS_COLORS[key] }}
                />
                <span className="text-muted-foreground">{label}</span>
              </div>
              <span className="font-medium">{value}</span>
            </div>
          )
        })}
        <div className="border-t border-border/50 pt-1 mt-1 flex items-center justify-between text-xs font-semibold">
          <span>Total</span>
          <span>{data.totalClaims}</span>
        </div>
      </div>
    </div>
  )
}

export function InsuranceComparisonChart() {
  const { data, isLoading } = useQuery<InsuranceComparisonData[]>({
    queryKey: ['insurance-comparison'],
    queryFn: () =>
      fetch('/api/insurance/comparison').then((r) => {
        if (!r.ok) throw new Error('Failed to load insurance comparison')
        return r.json()
      }),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
  })

  const chartData: ChartRow[] = React.useMemo(() => {
    if (!data) return []
    // Take top 8 companies for readability
    return data.slice(0, 8).map((item) => ({
      company: item.company,
      totalClaims: item.totalClaims,
      NEW: item.statusBreakdown.NEW,
      PROCESSING: item.statusBreakdown.PROCESSING,
      MANUAL_REVIEW: item.statusBreakdown.MANUAL_REVIEW,
      COMPLETED: item.statusBreakdown.COMPLETED,
    }))
  }, [data])

  const maxTotal = React.useMemo(() => {
    if (!chartData.length) return 0
    return Math.max(...chartData.map((d) => d.totalClaims))
  }, [chartData])

  return (
    <Card className="card-enter stagger-2 chart-card hover-scale py-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Insurance Company Comparison
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[320px]">
            <p className="text-sm text-muted-foreground">
              No insurance company data available
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  className="opacity-50"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  width={120}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--color-muted-foreground)',
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="NEW" stackId="a" fill={STATUS_COLORS.NEW} radius={[0, 0, 0, 0]} maxBarSize={24}>
                  {chartData.map((_, index) => (
                    <Cell key={`new-${index}`} />
                  ))}
                </Bar>
                <Bar dataKey="PROCESSING" stackId="a" fill={STATUS_COLORS.PROCESSING} radius={[0, 0, 0, 0]} maxBarSize={24}>
                  {chartData.map((_, index) => (
                    <Cell key={`proc-${index}`} />
                  ))}
                </Bar>
                <Bar dataKey="MANUAL_REVIEW" stackId="a" fill={STATUS_COLORS.MANUAL_REVIEW} radius={[0, 0, 0, 0]} maxBarSize={24}>
                  {chartData.map((_, index) => (
                    <Cell key={`mr-${index}`} />
                  ))}
                </Bar>
                <Bar dataKey="COMPLETED" stackId="a" fill={STATUS_COLORS.COMPLETED} radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {chartData.map((_, index) => (
                    <Cell key={`comp-${index}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: STATUS_COLORS[key] }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
