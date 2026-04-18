'use client'

import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BrainCircuit,
  Database,
  Target,
  Globe,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  Zap,
  Eye,
  EyeOff,
  Mail,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/motion'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface KBEntry {
  id: string
  senderDomain: string
  senderEmail: string | null
  subject: string
  bodySnippet: string | null
  originalClassification: string
  correctedClassification: string | null
  confidence: number
  reasoning: string | null
  keywords: string | null
  isCorrected: boolean
  source: string
  isActive: boolean
  referenceCount: number
  createdAt: string
  updatedAt: string
}

interface SenderPattern {
  id: string
  senderDomain: string
  totalEmails: number
  newClaimCount: number
  followUpCount: number
  missingInfoCount: number
  ignoreCount: number
  otherCount: number
  correctedCount: number
  accuracyRate: number
  avgConfidence: number
  newClaimIndicators: string[]
  followUpIndicators: string[]
  classificationHints: Record<string, string>
}

interface KBStats {
  totalEntries: number
  accuracyRate: number
  uniqueDomains: number
  correctedEntries: number
  activeEntries: number
}

// ─── Classification badge config ─────────────────────────────────────────────────

const CLASSIFICATION_COLORS: Record<string, string> = {
  NEW_CLAIM: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  MISSING_INFO: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  IGNORE: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  OTHER: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
}

const SOURCE_COLORS: Record<string, string> = {
  auto: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  corrected: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  manual: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
}

const CLASSIFICATION_BAR_COLORS: Record<string, string> = {
  NEW_CLAIM: 'bg-emerald-500',
  MISSING_INFO: 'bg-amber-500',
  IGNORE: 'bg-red-500',
  OTHER: 'bg-sky-500',
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function KnowledgeBaseView() {
  const queryClient = useQueryClient()

  // Filter state
  const [search, setSearch] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [activeFilter, setActiveFilter] = useState('true')
  const [page, setPage] = useState(1)
  const limit = 20

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    senderDomain: '',
    subject: '',
    bodySnippet: '',
    classification: 'NEW_CLAIM',
    confidence: 80,
    reasoning: '',
    keywords: '',
  })

  // Collapsible sections
  const [patternsExpanded, setPatternsExpanded] = useState(false)
  const [infoExpanded, setInfoExpanded] = useState(false)

  // Build query params
  const queryParams = useMemo(() => ({
    page,
    limit,
    search,
    classification: classificationFilter,
    source: sourceFilter,
    activeOnly: activeFilter,
    includePatterns: 'true',
  }), [page, limit, search, classificationFilter, sourceFilter, activeFilter])

  // Fetch knowledge base data
  const { data, isLoading, isError, refetch } = useQuery<{
    entries: KBEntry[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
    stats: KBStats
    senderPatterns: SenderPattern[]
  }>({
    queryKey: ['knowledge-base', queryParams],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v) params.set(k, String(v))
      })
      return fetch(`/api/knowledge-base?${params}`).then((r) => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      })
    },
    staleTime: 30000,
  })

  const entries = data?.entries || []
  const pagination = data?.pagination
  const stats = data?.stats
  const senderPatterns = data?.senderPatterns || []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (form: typeof addForm) => {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error || 'Failed to create entry')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      toast.success('Entry added to knowledge base')
      setAddDialogOpen(false)
      setAddForm({ senderDomain: '', subject: '', bodySnippet: '', classification: 'NEW_CLAIM', confidence: 80, reasoning: '', keywords: '' })
    },
    onError: (err) => toast.error('Failed to add entry', { description: err.message }),
  })

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch('/api/knowledge-base', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      toast.success('Entry updated')
    },
    onError: (err) => toast.error('Failed to update entry', { description: err.message }),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge-base?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      toast.success('Entry deleted')
    },
    onError: (err) => toast.error('Failed to delete entry', { description: err.message }),
  })

  // ─── Render Helpers ─────────────────────────────────────────────────────────

  const renderClassificationBadge = (cls: string) => {
    const colorClass = CLASSIFICATION_COLORS[cls] || 'bg-muted text-muted-foreground border-border'
    return (
      <Badge variant="secondary" className={`text-[10px] ${colorClass}`}>
        {cls.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const renderSourceBadge = (source: string) => {
    const colorClass = SOURCE_COLORS[source] || 'bg-muted text-muted-foreground border-border'
    return (
      <Badge variant="secondary" className={`text-[10px] ${colorClass}`}>
        {source === 'auto' ? 'Auto' : source === 'corrected' ? 'Corrected' : source === 'manual' ? 'Manual' : source}
      </Badge>
    )
  }

  const confidenceColor = (c: number) => {
    if (c >= 80) return 'bg-emerald-500'
    if (c >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const confidenceTextColor = (c: number) => {
    if (c >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (c >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  // ─── Loading Skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        {/* Header skeleton */}
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        {/* Filter bar */}
        <Skeleton className="h-10 w-full rounded-lg" />
        {/* Table skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10">
          <BrainCircuit className="size-6 text-red-500" />
        </div>
        <p className="text-sm text-muted-foreground">Failed to load knowledge base data.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ─── A. Header Section ─────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <BrainCircuit className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI Classification Knowledge Base</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Strategic database that improves email classification accuracy over time
        </p>
      </div>

      {/* ─── Stats Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: stats?.totalEntries ?? 0, icon: Database, color: 'text-primary' },
          { label: 'Accuracy Rate', value: `${stats?.accuracyRate ?? 100}%`, icon: Target, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Sender Domains', value: stats?.uniqueDomains ?? 0, icon: Globe, color: 'text-sky-500' },
          { label: 'Corrected Entries', value: stats?.correctedEntries ?? 0, icon: Pencil, color: 'text-amber-600 dark:text-amber-400' },
        ].map((item) => (
          <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors card-hover">
            <div className="flex items-center justify-center size-8 rounded-lg bg-muted/50 shrink-0">
              <item.icon className={`size-4 ${item.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── B. Filter/Search Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search subject or body..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8 h-9 text-sm input-glow"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={classificationFilter} onValueChange={(v) => { setClassificationFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Classification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Classifications</SelectItem>
              <SelectItem value="NEW_CLAIM">New Claim</SelectItem>
              <SelectItem value="MISSING_INFO">Missing Info</SelectItem>
              <SelectItem value="IGNORE">Ignore</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="corrected">Corrected</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active Only</SelectItem>
              <SelectItem value="false">All Entries</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => refetch()}
          >
            <RefreshCw className="size-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─── C. Knowledge Base Table ───────────────────────────────────────── */}
      <Card className="card-enter">
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex items-center justify-center size-12 rounded-full bg-muted/50">
                <Database className="size-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                No entries yet. The knowledge base will grow as emails are classified.
              </p>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs mt-1">
                    <Plus className="size-3.5" /> Add Manual Entry
                  </Button>
                </DialogTrigger>
                {renderAddDialog()}
              </Dialog>
            </div>
          ) : (
            <>
              <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header-modern">
                      <TableHead className="text-[10px] uppercase tracking-wider">Subject</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hidden lg:table-cell">Sender Domain</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Original</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hidden md:table-cell">Corrected</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hidden sm:table-cell">Confidence</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider hidden xl:table-cell">Source</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Active</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id} className="table-row-animate">
                        {/* Subject */}
                        <TableCell className="max-w-[200px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs font-medium text-foreground truncate block cursor-default">
                                {entry.subject.length > 60 ? `${entry.subject.slice(0, 60)}...` : entry.subject}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-md">
                              <p className="text-xs">{entry.subject}</p>
                              {entry.bodySnippet && (
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">{entry.bodySnippet}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {/* Sender Domain */}
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Mail className="size-2.5" />
                            {entry.senderDomain}
                          </Badge>
                        </TableCell>
                        {/* Original Classification */}
                        <TableCell>{renderClassificationBadge(entry.originalClassification)}</TableCell>
                        {/* Corrected */}
                        <TableCell className="hidden md:table-cell">
                          {entry.correctedClassification ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground line-through">{entry.originalClassification.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-muted-foreground">→</span>
                              {renderClassificationBadge(entry.correctedClassification)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {/* Confidence */}
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <Progress value={entry.confidence} className="h-1.5 w-14 flex-shrink-0">
                              <div className={`h-full rounded-full ${confidenceColor(entry.confidence)}`} style={{ width: `${entry.confidence}%` }} />
                            </Progress>
                            <span className={`text-[10px] font-medium tabular-nums ${confidenceTextColor(entry.confidence)}`}>
                              {entry.confidence}%
                            </span>
                          </div>
                        </TableCell>
                        {/* Source */}
                        <TableCell className="hidden xl:table-cell">{renderSourceBadge(entry.source)}</TableCell>
                        {/* Active Toggle */}
                        <TableCell>
                          <Switch
                            checked={entry.isActive}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: entry.id, isActive: checked })}
                            disabled={toggleMutation.isPending}
                            className="scale-75"
                          />
                        </TableCell>
                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete entry</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {pagination.page} / {pagination.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Entry Button (when entries exist) ─────────────────────────── */}
      {entries.length > 0 && (
        <div className="flex justify-end">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="size-3.5" /> Add Manual Entry
              </Button>
            </DialogTrigger>
            {renderAddDialog()}
          </Dialog>
        </div>
      )}

      {/* ─── E. Sender Patterns Section (Collapsible) ─────────────────────── */}
      <Card className="card-enter">
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => setPatternsExpanded(!patternsExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 text-left group hover:bg-muted/30 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              {patternsExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              )}
              <Globe className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Learned Sender Patterns</span>
              {senderPatterns.length > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {senderPatterns.length} domains
                </Badge>
              )}
            </div>
          </button>

          {patternsExpanded && (
            <div className="px-4 pb-4 animate-in fade-in duration-200">
              <Separator className="mb-4" />
              {senderPatterns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <div className="flex items-center justify-center size-10 rounded-full bg-muted/50">
                    <Globe className="size-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No sender patterns learned yet.</p>
                  <p className="text-xs text-muted-foreground">Patterns emerge as more emails are processed.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {senderPatterns.map((pattern) => {
                    const total = pattern.totalEmails || 1
                    const newClaimPct = Math.round((pattern.newClaimCount / total) * 100)
                    const followUpPct = Math.round((pattern.followUpCount / total) * 100)
                    const missingPct = Math.round((pattern.missingInfoCount / total) * 100)
                    const ignorePct = Math.round((pattern.ignoreCount / total) * 100)
                    const otherPct = Math.round((pattern.otherCount / total) * 100)

                    const indicators = [
                      ...(pattern.newClaimIndicators || []).slice(0, 3),
                      ...(pattern.followUpIndicators || []).slice(0, 2),
                    ]

                    return (
                      <div key={pattern.id} className="p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors card-hover">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 shrink-0">
                            <Mail className="size-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{pattern.senderDomain}</p>
                            <p className="text-[10px] text-muted-foreground">{pattern.totalEmails} emails processed</p>
                          </div>
                        </div>

                        {/* Stacked bar */}
                        <div className="flex rounded-full overflow-hidden h-2 mb-2">
                          {newClaimPct > 0 && <div className={CLASSIFICATION_BAR_COLORS.NEW_CLAIM} style={{ width: `${newClaimPct}%` }} />}
                          {followUpPct > 0 && <div className={CLASSIFICATION_BAR_COLORS.MISSING_INFO} style={{ width: `${followUpPct}%` }} />}
                          {missingPct > 0 && <div className="bg-amber-400" style={{ width: `${missingPct}%` }} />}
                          {ignorePct > 0 && <div className={CLASSIFICATION_BAR_COLORS.IGNORE} style={{ width: `${ignorePct}%` }} />}
                          {otherPct > 0 && <div className={CLASSIFICATION_BAR_COLORS.OTHER} style={{ width: `${otherPct}%` }} />}
                        </div>

                        {/* Mini stats */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Accuracy</span>
                            <span className={`text-[10px] font-medium tabular-nums ${pattern.accuracyRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pattern.accuracyRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                              {Math.round(pattern.accuracyRate)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Avg Conf</span>
                            <span className="text-[10px] font-medium tabular-nums text-foreground">
                              {Math.round(pattern.avgConfidence)}%
                            </span>
                          </div>
                        </div>

                        {/* Indicator phrases */}
                        {indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {indicators.slice(0, 4).map((phrase, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[9px] bg-muted/50">
                                {typeof phrase === 'string' ? phrase : JSON.stringify(phrase)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── F. How It Works Info Card (Collapsible) ───────────────────────── */}
      <Card className="card-enter">
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => setInfoExpanded(!infoExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 text-left group hover:bg-muted/30 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              {infoExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              )}
              <Info className="size-4 text-amber-500" />
              <span className="text-sm font-medium text-foreground">How the Knowledge Base Works</span>
            </div>
          </button>

          {infoExpanded && (
            <div className="px-4 pb-4 animate-in fade-in duration-200">
              <Separator className="mb-4" />
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 shrink-0">
                    <Zap className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">1. Email Classified</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      When an email arrives, the AI classifies it (New Claim, Follow-Up, Ignore, etc.) with a confidence score.
                    </p>
                  </div>
                </div>
                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded-full bg-emerald-500/10 shrink-0">
                    <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">2. Saved to Knowledge Base</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Each classification is saved as an entry with subject, sender domain, classification, confidence, and reasoning.
                    </p>
                  </div>
                </div>
                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-8 rounded-full bg-sky-500/10 shrink-0">
                    <TrendingUp className="size-4 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">3. Used as Examples for Future Emails</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Similar entries are injected into future AI prompts as few-shot examples to improve classification accuracy.
                    </p>
                  </div>
                </div>
                {/* Note */}
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <Eye className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Correcting entries improves accuracy faster.</span> When you correct a classification, the system learns from the correction and updates sender patterns automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add Manual Entry Dialog ───────────────────────────────────────── */}
      {entries.length > 0 && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <span className="sr-only">Add Manual Entry</span>
          </DialogTrigger>
          {renderAddDialog()}
        </Dialog>
      )}
    </div>
  )

  // ─── Add Entry Dialog Renderer ─────────────────────────────────────────────
  function renderAddDialog() {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            Add Manual Knowledge Entry
          </DialogTitle>
          <DialogDescription>
            Add a manually classified email to the knowledge base as a training example.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="kb-sender-domain">Sender Domain *</Label>
            <Input
              id="kb-sender-domain"
              placeholder="e.g., santam.co.za"
              value={addForm.senderDomain}
              onChange={(e) => setAddForm((prev) => ({ ...prev, senderDomain: e.target.value }))}
              className="input-glow"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-subject">Subject *</Label>
            <Input
              id="kb-subject"
              placeholder="Email subject line"
              value={addForm.subject}
              onChange={(e) => setAddForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="input-glow"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-body-snippet">Body Snippet</Label>
            <Textarea
              id="kb-body-snippet"
              placeholder="First few lines of the email body (optional)"
              value={addForm.bodySnippet}
              onChange={(e) => setAddForm((prev) => ({ ...prev, bodySnippet: e.target.value }))}
              className="input-glow min-h-[60px]"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Classification *</Label>
              <Select
                value={addForm.classification}
                onValueChange={(v) => setAddForm((prev) => ({ ...prev, classification: v }))}
              >
                <SelectTrigger className="input-glow">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW_CLAIM">New Claim</SelectItem>
                  <SelectItem value="MISSING_INFO">Missing Info</SelectItem>
                  <SelectItem value="IGNORE">Ignore</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Confidence: {addForm.confidence}%</Label>
              <Slider
                value={[addForm.confidence]}
                onValueChange={([v]) => setAddForm((prev) => ({ ...prev, confidence: v }))}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-reasoning">Reasoning</Label>
            <Textarea
              id="kb-reasoning"
              placeholder="Why this classification was chosen (optional)"
              value={addForm.reasoning}
              onChange={(e) => setAddForm((prev) => ({ ...prev, reasoning: e.target.value }))}
              className="input-glow min-h-[60px]"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kb-keywords">Keywords</Label>
            <Input
              id="kb-keywords"
              placeholder="Comma-separated: claim, motor, assessment"
              value={addForm.keywords}
              onChange={(e) => setAddForm((prev) => ({ ...prev, keywords: e.target.value }))}
              className="input-glow"
            />
            <p className="text-[10px] text-muted-foreground">Separate keywords with commas</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate(addForm)}
            disabled={createMutation.isPending || !addForm.senderDomain || !addForm.subject}
            className="gap-1.5"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                Save Entry
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }
}
