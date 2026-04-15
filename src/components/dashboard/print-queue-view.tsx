'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  File,
  FileImage,
  Search,
  X,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useClaimsStore } from '@/store/claims-store'
import { formatDate } from '@/lib/helpers'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/motion'
import { PrintQueueAnalytics } from '@/components/dashboard/print-queue-analytics'

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

const printStatusStyles: Record<string, string> = {
  QUEUED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 border-sky-200 px-2 py-0.5',
  PRINTING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 border-amber-200 px-2 py-0.5',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 border-emerald-200 px-2 py-0.5',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 border-red-200 px-2 py-0.5',
}

const printStatusLabels: Record<string, string> = {
  QUEUED: 'Queued',
  PRINTING: 'Printing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function FileIcon({ fileName }: { fileName: string }) {
  const ext = getFileExtension(fileName)
  if (ext === 'pdf') {
    return <FileText className="size-4 shrink-0 text-red-500" />
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <FileImage className="size-4 shrink-0 text-emerald-500" />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" />
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

export function PrintQueueView() {
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchText, setSearchText] = useState('')

  const { data: rawData, isLoading, dataUpdatedAt } = useQuery<{ printQueueItems: PrintQueueItem[] }>({
    queryKey: ['print-queue', statusFilter, refreshKey],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      return fetch(`/api/print-queue?${params}`).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
    },
    refetchInterval: 30000,
    staleTime: 5000,
    retry: 3,
    retryDelay: 2000,
  })
  const items = rawData?.printQueueItems
  const lastUpdatedText = useLastUpdated(dataUpdatedAt)

  const filteredItems = useMemo(() => {
    if (!items) return []
    if (!searchText.trim()) return items
    const search = searchText.toLowerCase()
    return items.filter(
      (item) =>
        item.fileName.toLowerCase().includes(search) ||
        (item.claim?.claimNumber || '').toLowerCase().includes(search)
    )
  }, [items, searchText])

  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/print-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', id }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/print-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', id }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
  })

  const counts = useMemo(() => {
    const all = rawData?.printQueueItems || []
    return {
      total: all.length,
      queued: all.filter((i) => i.printStatus === 'QUEUED').length,
      printing: all.filter((i) => i.printStatus === 'PRINTING').length,
      completed: all.filter((i) => i.printStatus === 'COMPLETED').length,
      failed: all.filter((i) => i.printStatus === 'FAILED').length,
    }
  }, [rawData])

  const handlePrintAll = () => {
    const queuedItems = items?.filter((i) => i.printStatus === 'QUEUED') || []
    queuedItems.forEach((item) => {
      completeMutation.mutate(item.id)
    })
  }

  const handleRetryAll = () => {
    const failedItems = items?.filter((i) => i.printStatus === 'FAILED') || []
    failedItems.forEach((item) => {
      retryMutation.mutate(item.id)
    })
  }

  const markAllPrintedMutation = useMutation({
    mutationFn: () =>
      fetch('/api/print-queue/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_printed' }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      toast.success(data.message || 'All pending items marked as printed')
    },
    onError: () => {
      toast.error('Failed to mark items as printed')
    },
  })

  const clearCompletedMutation = useMutation({
    mutationFn: () =>
      fetch('/api/print-queue/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_completed' }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] })
      toast.success(data.message || 'Completed items cleared')
    },
    onError: () => {
      toast.error('Failed to clear completed items')
    },
  })

  return (
    <div className="space-y-4">
      {/* Print Queue Analytics Widget */}
      <FadeIn delay={0.05}>
        <PrintQueueAnalytics />
      </FadeIn>

      {/* Summary Stats Bar */}
      {!isLoading && items && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-800/30 card-enter stagger-1 hover-scale">
            <Clock className="size-4 text-sky-600 dark:text-sky-400" />
            <div>
              <p className="text-lg font-bold text-foreground">{counts.queued}</p>
              <p className="text-[11px] text-muted-foreground">Queued</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 card-enter stagger-2 hover-scale">
            <Loader2 className="size-4 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-lg font-bold text-foreground">{counts.printing}</p>
              <p className="text-[11px] text-muted-foreground">Printing</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 card-enter stagger-3 hover-scale">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-lg font-bold text-foreground">{counts.completed}</p>
              <p className="text-[11px] text-muted-foreground">Completed</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 card-enter stagger-4 hover-scale">
            <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-lg font-bold text-foreground">{counts.failed}</p>
              <p className="text-[11px] text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <Card className="py-4 card-enter stagger-1">
        <CardContent className="gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Printer className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filter by Status:</span>
            </div>
            <div className="relative flex-1 max-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search files or claims..."
                className="pl-8 h-9 bg-background"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchText('')}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All ({counts.total})</SelectItem>
                <SelectItem value="QUEUED">Queued ({counts.queued})</SelectItem>
                <SelectItem value="PRINTING">Printing ({counts.printing})</SelectItem>
                <SelectItem value="COMPLETED">Completed ({counts.completed})</SelectItem>
                <SelectItem value="FAILED">Failed ({counts.failed})</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
              {(counts.queued > 0 || counts.printing > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllPrintedMutation.mutate()}
                  disabled={markAllPrintedMutation.isPending}
                  className="gap-1.5 btn-press"
                >
                  <Printer className="size-3.5" />
                  Mark All Pending Printed
                </Button>
              )}
              {counts.completed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearCompletedMutation.mutate()}
                  disabled={clearCompletedMutation.isPending}
                  className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 btn-press"
                >
                  <Trash2 className="size-3.5" />
                  Clear Completed ({counts.completed})
                </Button>
              )}
              {counts.queued > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrintAll} className="gap-1.5 btn-press">
                  <Printer className="size-3.5" />
                  Print All ({counts.queued})
                </Button>
              )}
              {counts.failed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryAll}
                  className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 btn-press"
                >
                  <RotateCcw className="size-3.5" />
                  Retry All ({counts.failed})
                </Button>
              )}
              {items && (
                <Badge variant="secondary">
                  {items.length} items
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="py-5 card-enter stagger-2">
        <CardHeader>
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Print Queue</CardTitle>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground ml-2">
              <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Live</span>
              <span className="text-[10px]">·</span>
              <span className="text-[10px]">Updated {lastUpdatedText}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[80px] hidden sm:block" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-[40px] hidden md:block" />
                  <Skeleton className="h-4 w-[60px] ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredItems && filteredItems.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead>File Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Claim #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Pages</TableHead>
                    <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                    <TableHead className="hidden xl:table-cell">Printed At</TableHead>
                    <TableHead className="hidden lg:table-cell">Error</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={
                      item.printStatus === 'QUEUED'
                        ? 'bg-sky-50/50 dark:bg-sky-950/20'
                        : item.printStatus === 'FAILED'
                          ? 'bg-red-50/50 dark:bg-red-950/20'
                          : item.printStatus === 'COMPLETED'
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                            : 'even:bg-muted/30'
                    }>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <FileIcon fileName={item.fileName} />
                          <span className="truncate max-w-[200px]" title={item.fileName}>
                            {item.fileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {item.claim?.claimNumber || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${printStatusStyles[item.printStatus]} text-xs font-medium ${item.printStatus === 'PRINTING' ? 'badge-glow-warning print-progress' : item.printStatus === 'COMPLETED' ? 'badge-glow-success' : item.printStatus === 'FAILED' ? 'badge-glow-error' : ''}`}
                        >
                          {printStatusLabels[item.printStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.pages || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">
                        {item.printedAt ? formatDate(item.printedAt) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {item.error ? (
                          <span className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="size-3" />
                            {item.error}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.printStatus === 'FAILED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs h-7"
                              onClick={() => retryMutation.mutate(item.id)}
                              disabled={retryMutation.isPending}
                            >
                              <RotateCcw className="size-3" />
                              Retry
                            </Button>
                          )}
                          {item.printStatus !== 'COMPLETED' && item.printStatus !== 'FAILED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs h-7"
                              onClick={() => completeMutation.mutate(item.id)}
                              disabled={completeMutation.isPending}
                            >
                              <CheckCircle2 className="size-3" />
                              Done
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Printer className="size-7" />
              </div>
              <p className="empty-state-title">No print queue items</p>
              <p className="empty-state-description">
                {searchText ? 'No items match your current search. Try a different term.' : statusFilter !== 'ALL' ? `No ${printStatusLabels[statusFilter]?.toLowerCase() || ''} items in the queue.` : 'New print jobs will appear here when claims are processed.'}
              </p>
              {(searchText || statusFilter !== 'ALL') && (
                <Button variant="outline" size="sm" className="mt-1 btn-press" onClick={() => { setSearchText(''); setStatusFilter('ALL') }}>
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
