'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardList,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Bot,
  User,
  ListChecks,
  CheckCircle2,
  BarChart3,
  AlertOctagon,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useClaimsStore } from '@/store/claims-store'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'
import { AgingReportWidget } from '@/components/dashboard/aging-report-widget'

interface AuditLog {
  id: string
  claimId: string | null
  action: string
  details: string | null
  status: string
  processedBy: string | null
  createdAt: string
  claim: { claimNumber: string; clientName: string } | null
}

interface Summary {
  totalEntries: number
  successCount: number
  warningCount: number
  errorCount: number
  successRate: number
}

const statusStyles: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800',
}

const statusIcons: Record<string, React.ElementType> = {
  SUCCESS: CheckCircle,
  WARNING: AlertTriangle,
  ERROR: XCircle,
}

const statusDotColors: Record<string, string> = {
  SUCCESS: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  ERROR: 'bg-red-500',
}

function useLastUpdated(dataUpdatedAt?: number) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])
  void tick
  if (!dataUpdatedAt) return '—'
  const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function AuditView() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [claimIdFilter, setClaimIdFilter] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (claimIdFilter) params.set('search', claimIdFilter)

      const response = await fetch(`/api/audit-logs/export?${params.toString()}`)
      if (!response.ok) {
        toast.error('Failed to export audit logs')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      link.href = url
      link.download = `audit_logs_export_${dateStr}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Audit logs exported successfully')
    } catch {
      toast.error('Failed to export audit logs')
    } finally {
      setIsExporting(false)
    }
  }, [statusFilter, claimIdFilter])

  const { data: rawData, isLoading, dataUpdatedAt } = useQuery<{
    auditLogs: AuditLog[]
    summary: Summary
  }>({
    queryKey: ['audit-logs', statusFilter, claimIdFilter, refreshKey],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (claimIdFilter) params.set('claimId', claimIdFilter)
      return fetch(`/api/audit-logs?${params}`).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
    },
    refetchInterval: 30000,
    staleTime: 5000,
    retry: 3,
    retryDelay: 2000,
  })
  const logs = rawData?.auditLogs
  const summary = rawData?.summary
  const lastUpdatedText = useLastUpdated(dataUpdatedAt)

  return (
    <div className="space-y-4">
      {/* Aging Analysis */}
      <AgingReportWidget />

      {/* Filter Bar */}
      <Card className="py-4 card-enter stagger-1">
        <CardContent className="gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter by claim ID..."
                className="pl-8"
                value={claimIdFilter}
                onChange={(e) => setClaimIdFilter(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="gap-1.5 btn-press"
            >
              <Download className={`size-3.5 ${isExporting ? 'animate-spin' : ''}`} />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            {(statusFilter !== 'ALL' || claimIdFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL')
                  setClaimIdFilter('')
                }}
              >
                Clear Filters
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground ml-auto">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Live</span>
              <span className="text-[10px]">·</span>
              <span className="text-[10px]">Updated {lastUpdatedText}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="py-3 px-4 card-enter stagger-1 hover-scale">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted/60 shrink-0">
                <ListChecks className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground leading-tight">
                  {summary.totalEntries}
                </p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </Card>
          <Card className="py-3 px-4 card-enter stagger-2 hover-scale">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-50 shrink-0">
                <CheckCircle2 className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground leading-tight">
                  {summary.successRate}%
                </p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </Card>
          <Card className="py-3 px-4 card-enter stagger-3 hover-scale">
            <div className="flex items-center gap-2.5">
              <div className={`flex items-center justify-center size-8 rounded-lg shrink-0 ${
                summary.errorCount > 0 ? 'bg-red-50' : 'bg-muted/60'
              }`}>
                <AlertOctagon className={`size-4 ${
                  summary.errorCount > 0 ? 'text-red-600' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <p className={`text-lg font-semibold leading-tight ${
                  summary.errorCount > 0 ? 'text-red-600' : 'text-foreground'
                }`}>
                  {summary.errorCount}
                </p>
                <p className="text-xs text-muted-foreground">Error Count</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Logs Timeline */}
      <Card className="py-5 card-enter stagger-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Audit Logs</CardTitle>
            {logs && (
              <Badge variant="secondary" className="ml-2">
                {logs.length} entries
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {logs.map((log, index) => {
                  const StatusIcon = statusIcons[log.status] || Clock
                  const dotColor = statusDotColors[log.status] || 'bg-gray-500'
                  const isLast = index === logs.length - 1

                  return (
                    <div key={log.id} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`size-3 rounded-full shrink-0 mt-1.5 ${dotColor}`} />
                        {!isLast && (
                          <div className="w-px flex-1 bg-border" />
                        )}
                      </div>

                      {/* Log entry */}
                      <div
                        className={`flex-1 p-3 rounded-lg border hover:bg-muted/20 transition-colors ${
                          log.status === 'ERROR'
                            ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                            : log.status === 'WARNING'
                            ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusIcon className={`size-4 ${
                            log.status === 'SUCCESS'
                              ? 'text-emerald-600'
                              : log.status === 'WARNING'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`} />
                          <span className="text-sm font-medium text-foreground">
                            {log.action}
                          </span>
                          <Badge
                            variant="outline"
                            className={`${statusStyles[log.status]} text-xs ${log.status === 'SUCCESS' ? 'badge-glow-success' : log.status === 'ERROR' ? 'badge-glow-error' : log.status === 'WARNING' ? 'badge-glow-warning' : ''}`}
                          >
                            {log.status}
                          </Badge>
                          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                            {log.processedBy === 'AUTO' ? (
                              <Bot className="size-3" />
                            ) : (
                              <User className="size-3" />
                            )}
                            {log.processedBy || 'SYSTEM'}
                          </div>
                        </div>

                        {log.details && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {log.details}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(log.createdAt)}
                          </span>
                          {log.claim && (
                            <span>
                              Claim: <span className="font-medium text-foreground">{log.claim.claimNumber}</span>
                              {' — '}
                              {log.claim.clientName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center size-14 rounded-full bg-muted/50">
                <ClipboardList className="size-7 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No audit logs found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(statusFilter !== 'ALL' || claimIdFilter) ? 'No logs match your current filters. Try adjusting your search criteria.' : 'Audit log entries will appear here as claims are processed.'}
                </p>
              </div>
              {(statusFilter !== 'ALL' || claimIdFilter) && (
                <Button variant="outline" size="sm" className="mt-1 btn-press" onClick={() => { setStatusFilter('ALL'); setClaimIdFilter('') }}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
