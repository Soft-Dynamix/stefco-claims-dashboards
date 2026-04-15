'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BrainCircuit,
  Check,
  Edit3,
  Flag,
  SkipForward,
  Download,
  ChevronDown,
  ChevronUp,
  Bot,
  AlertTriangle,
  Sparkles,
  Inbox,
  CheckCircle2,
  Clock,
  RefreshCw,
  Mail,
  FileText,
} from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { FadeIn } from '@/components/ui/motion'
import { getConfidenceColor, formatCurrency, formatProcessingStage } from '@/lib/helpers'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DailyReviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ClaimReviewItem {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  senderEmail: string | null
  emailSubject: string | null
  confidenceScore: number
  aiDecision: string | null
  aiReasoning: string | null
  aiConfidenceBreakdown: string | null
  processingStage: string
  excessAmount: string | null
  insuranceCompany: { id: string; name: string; folderName: string } | null
  reviewedAt: string | null
  reviewAction: string | null
  needsAttention: boolean
  createdAt: string
}

interface CorrectionField {
  field: string
  originalValue: string
  correctedValue: string
}

type FilterTab = 'all' | 'needs_review' | 'low_confidence' | 'accepted' | 'corrected' | 'flagged'

interface DailyReviewResponse {
  claims: ClaimReviewItem[]
  summary: {
    total: number
    reviewed: number
    unreviewed: number
    avgConfidence: number
    filterCounts: Record<string, number>
  }
  date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayFormatted(): string {
  return new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getConfidenceBadgeClass(score: number): string {
  if (score >= 75) return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
  if (score >= 50) return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
  return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
}

function getReviewBorderClass(action: string | null): string {
  switch (action) {
    case 'accepted': return 'border-l-4 border-l-emerald-500'
    case 'corrected': return 'border-l-4 border-l-amber-500'
    case 'flagged_for_review': return 'border-l-4 border-l-red-500'
    default: return ''
  }
}

function getDecisionLabel(decision: string | null): string {
  if (!decision) return 'Pending'
  return decision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseConfidenceBreakdown(breakdown: string | null): { classification: number; extraction: number; overall: number } {
  if (!breakdown) return { classification: 0, extraction: 0, overall: 0 }
  try {
    const p = JSON.parse(breakdown)
    return { classification: p.classification || 0, extraction: p.extraction || 0, overall: p.overall || 0 }
  } catch {
    return { classification: 0, extraction: 0, overall: 0 }
  }
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const w = Math.max(0, Math.min(100, value))
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`w-8 text-right font-medium ${getConfidenceColor(value)}`}>{value}%</span>
    </div>
  )
}

function ReviewSkeletonCard() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Separator />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Separator />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </Card>
  )
}

// ─── EmailReviewCard ──────────────────────────────────────────────────────────

function EmailReviewCard({
  item,
  index,
  onAccept,
  onCorrect,
  onFlag,
  onSkip,
  isSubmitting,
}: {
  item: ClaimReviewItem
  index: number
  onAccept: (id: string) => void
  onCorrect: (id: string, corrections: CorrectionField[]) => void
  onFlag: (id: string) => void
  onSkip: (id: string) => void
  isSubmitting: boolean
}) {
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const breakdown = parseConfidenceBreakdown(item.aiConfidenceBreakdown)
  const isReviewed = item.reviewAction !== null

  const editableFields = useMemo(() => [
    { key: 'clientName', label: 'Client', value: item.clientName },
    { key: 'claimType', label: 'Type', value: item.claimType },
    { key: 'excessAmount', label: 'Excess', value: item.excessAmount || '—' },
    { key: 'processingStage', label: 'Stage', value: formatProcessingStage(item.processingStage) },
  ], [item.clientName, item.claimType, item.excessAmount, item.processingStage])

  const handleSaveCorrect = useCallback(() => {
    const correctionFields: CorrectionField[] = []
    for (const [key, newValue] of Object.entries(corrections)) {
      const field = editableFields.find((f) => f.key === key)
      if (field && newValue && newValue !== field.value) {
        correctionFields.push({
          field: key,
          originalValue: field.value === '—' ? '' : field.value,
          correctedValue: newValue,
        })
      }
    }
    if (correctionFields.length > 0) {
      onCorrect(item.id, correctionFields)
      setIsCorrecting(false)
      setCorrections({})
    } else {
      toast.info('No changes detected. Modify a field first.')
    }
  }, [corrections, editableFields, item.id, onCorrect])

  const actionBadge = useMemo(() => {
    switch (item.reviewAction) {
      case 'accepted':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><Check className="size-3 mr-1" />Accepted</Badge>
      case 'corrected':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><Edit3 className="size-3 mr-1" />Corrected</Badge>
      case 'flagged_for_review':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800"><Flag className="size-3 mr-1" />Flagged</Badge>
      case 'skipped':
        return <Badge variant="outline" className="text-muted-foreground"><SkipForward className="size-3 mr-1" />Skipped</Badge>
      default:
        return null
    }
  }, [item.reviewAction])

  return (
    <FadeIn delay={Math.min(index * 0.03, 0.4)}>
      <Card className={`card-hover transition-all duration-200 ${getReviewBorderClass(item.reviewAction)} ${isReviewed ? 'opacity-80' : 'ring-1 ring-primary/10'}`}>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: AI Badge + Claim Number + Review Status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge className={`gap-1 shrink-0 border ${getConfidenceBadgeClass(item.confidenceScore)}`}>
                <Bot className="size-3" />
                {item.confidenceScore}%
              </Badge>
              <span className="font-semibold text-sm truncate font-mono">{item.claimNumber}</span>
            </div>
            {actionBadge}
          </div>

          {/* Row 2: Claim Type + Insurance Company */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="text-xs h-5">{item.claimType}</Badge>
            {item.insuranceCompany && (
              <>
                <span className="text-border">→</span>
                <span className="font-medium text-foreground text-xs">{item.insuranceCompany.name}</span>
              </>
            )}
          </div>

          <Separator />

          {/* Row 3: Email Info */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 shrink-0 text-sky-500" />
              <span className="truncate text-xs">{item.senderEmail || 'No sender email'}</span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <FileText className="size-3.5 shrink-0 mt-0.5 text-sky-500" />
              <span className="text-xs leading-relaxed">{item.emailSubject || 'No subject'}</span>
            </div>
          </div>

          <Separator />

          {/* Row 4: AI Decision & Reasoning */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="size-3.5 text-violet-500" />
              <span className="text-xs font-medium text-muted-foreground">AI Decision:</span>
              <Badge variant="outline" className="text-[10px] font-mono">{getDecisionLabel(item.aiDecision)}</Badge>
              {item.processingStage && (
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="size-2.5 mr-0.5" />
                  {formatProcessingStage(item.processingStage)}
                </Badge>
              )}
            </div>
            {item.aiReasoning && (
              <p className="text-[11px] text-muted-foreground pl-5.5 italic bg-muted/30 rounded-md px-2.5 py-1.5 leading-relaxed">
                &ldquo;{item.aiReasoning}&rdquo;
              </p>
            )}
          </div>

          {/* Row 5: Confidence Breakdown */}
          {(breakdown.classification || breakdown.extraction || breakdown.overall) > 0 && (
            <div className="space-y-1.5 bg-muted/20 rounded-lg p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Confidence Breakdown</span>
              <ConfidenceBar value={breakdown.classification} label="Classification" />
              <ConfidenceBar value={breakdown.extraction} label="Extraction" />
              <ConfidenceBar value={breakdown.overall} label="Overall" />
            </div>
          )}

          <Separator />

          {/* Row 6: Extracted Data */}
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Extracted Data{isCorrecting ? ' — edit below' : ''}
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {editableFields.map((field) => (
                <div key={field.key}>
                  {isCorrecting ? (
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-muted-foreground">{field.label}</label>
                      <Input
                        className="h-7 text-xs"
                        defaultValue={field.value === '—' ? '' : field.value}
                        onChange={(e) => setCorrections((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.value === '—' ? 'Enter value...' : field.value}
                      />
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-muted-foreground shrink-0">{field.label}:</span>
                      <span className="text-xs font-medium truncate">{field.value}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Row 7: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isCorrecting ? (
              <>
                <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCorrect} disabled={isSubmitting}>
                  <Check className="size-3.5 mr-1" />Save Corrections
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setIsCorrecting(false); setCorrections({}) }} disabled={isSubmitting}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30" onClick={() => onAccept(item.id)} disabled={isSubmitting || isReviewed}>
                        <Check className="size-3.5 mr-1" />Accept
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Confirm AI extraction is correct</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/30" onClick={() => { setIsCorrecting(true); setCorrections({}) }} disabled={isSubmitting || isReviewed}>
                        <Edit3 className="size-3.5 mr-1" />Correct
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit extracted fields and create learning patterns</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30" onClick={() => onFlag(item.id)} disabled={isSubmitting || isReviewed}>
                        <Flag className="size-3.5 mr-1" />Flag
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Flag for manual follow-up</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => onSkip(item.id)} disabled={isSubmitting || isReviewed}>
                        <SkipForward className="size-3.5 mr-1" />Skip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Skip, review later</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DailyEmailReview({ open, onOpenChange }: DailyReviewProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('needs_review')
  const [insightsExpanded, setInsightsExpanded] = useState(false)

  // ── Data Fetching ──

  const { data, isLoading, isError, refetch } = useQuery<DailyReviewResponse>({
    queryKey: ['review-daily', activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/review/daily?filter=${activeTab}`)
      if (!res.ok) throw new Error('Failed to fetch daily review')
      return res.json()
    },
    staleTime: 10000,
    refetchInterval: 30000,
    enabled: open,
  })

  const { data: statsData } = useQuery({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const res = await fetch('/api/review/stats')
      if (!res.ok) throw new Error('Failed to fetch review stats')
      return res.json()
    },
    staleTime: 15000,
    refetchInterval: 60000,
    enabled: open,
  })

  // ── Feedback Mutation ──

  const feedbackMutation = useMutation({
    mutationFn: async (params: { claimId: string; action: string; corrections?: CorrectionField[] }) => {
      const res = await fetch('/api/review/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error('Failed to submit feedback')
      return res.json()
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['review-daily'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })

      switch (response.action) {
        case 'accepted':
          toast.success(`✅ ${response.message}`)
          break
        case 'corrected':
          toast.success(`✏️ ${response.message}`)
          break
        case 'flagged_for_review':
          toast.warning(`🚩 ${response.message}`)
          break
        case 'skipped':
          toast.info(`⏭️ ${response.message}`)
          break
      }
    },
    onError: () => {
      toast.error('Failed to submit feedback. Please try again.')
    },
  })

  // ── Handlers ──

  const handleAccept = useCallback((claimId: string) => {
    feedbackMutation.mutate({ claimId, action: 'accepted' })
  }, [feedbackMutation])

  const handleCorrect = useCallback((claimId: string, corrections: CorrectionField[]) => {
    feedbackMutation.mutate({ claimId, action: 'corrected', corrections })
  }, [feedbackMutation])

  const handleFlag = useCallback((claimId: string) => {
    feedbackMutation.mutate({ claimId, action: 'flagged_for_review' })
  }, [feedbackMutation])

  const handleSkip = useCallback((claimId: string) => {
    feedbackMutation.mutate({ claimId, action: 'skipped' })
  }, [feedbackMutation])

  const handleAcceptAll = useCallback(() => {
    const claims = data?.claims
    if (!claims) return
    const unreviewed = claims.filter((c) => c.reviewAction === null)
    if (unreviewed.length === 0) {
      toast.info('No unreviewed items to accept')
      return
    }
    for (const claim of unreviewed) {
      feedbackMutation.mutate({ claimId: claim.id, action: 'accepted' })
    }
    toast.success(`✅ Accepting ${unreviewed.length} claims...`)
  }, [data, feedbackMutation])

  const handleExportReport = useCallback(() => {
    const claims = data?.claims
    const summary = data?.summary
    if (!claims || !summary) return

    const lines: string[] = [
      `Daily Email Review Report — ${getTodayFormatted()}`,
      `${'═'.repeat(60)}`,
      '',
      'Summary:',
      `  Total items: ${summary.total}`,
      `  Reviewed: ${summary.reviewed}`,
      `  Unreviewed: ${summary.unreviewed}`,
      `  Average AI Confidence: ${summary.avgConfidence}%`,
      '',
      `${'═'.repeat(60)}`,
      '',
    ]

    for (const claim of claims) {
      lines.push(`${claim.claimNumber}`)
      lines.push(`   Client: ${claim.clientName}`)
      lines.push(`   Type: ${claim.claimType} → ${claim.insuranceCompany?.name || 'Unknown'}`)
      lines.push(`   Confidence: ${claim.confidenceScore}% | Decision: ${claim.aiDecision || 'N/A'}`)
      lines.push(`   Review: ${claim.reviewAction || 'Not reviewed'}`)
      lines.push('')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-review-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Review report exported')
  }, [data])

  // ── Computed ──

  const claims = data?.claims || []
  const summary = data?.summary
  const reviewPercent = summary && summary.total > 0 ? Math.round((summary.reviewed / summary.total) * 100) : 0
  const progressColor = reviewPercent >= 75 ? 'bg-emerald-500' : reviewPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'

  const filterTabs: Array<{ key: FilterTab; label: string; icon: React.ReactNode; shortLabel: string }> = useMemo(() => [
    { key: 'all', label: 'All', shortLabel: 'All', icon: <Inbox className="size-3.5" /> },
    { key: 'needs_review', label: 'Needs Review', shortLabel: 'Review', icon: <Clock className="size-3.5" /> },
    { key: 'low_confidence', label: 'Low Confidence', shortLabel: 'Low', icon: <AlertTriangle className="size-3.5" /> },
    { key: 'accepted', label: 'Accepted', shortLabel: 'OK', icon: <CheckCircle2 className="size-3.5" /> },
    { key: 'corrected', label: 'Corrected', shortLabel: 'Fix', icon: <Edit3 className="size-3.5" /> },
    { key: 'flagged', label: 'Flagged', shortLabel: 'Flag', icon: <Flag className="size-3.5" /> },
  ], [])

  // ── Render ──

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[700px] lg:w-[800px] p-0 flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <SheetHeader className="p-4 pb-3 space-y-3 border-b shrink-0 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-start justify-between pr-6">
            <div className="space-y-1">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <BrainCircuit className="size-5 text-primary" />
                </div>
                Daily Email Review
              </SheetTitle>
              <SheetDescription className="text-xs">
                {getTodayFormatted()} — Review &amp; train the AI
              </SheetDescription>
            </div>
          </div>

          {/* Summary Stats Row */}
          {summary && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <Inbox className="size-3" />{summary.total} items
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                <CheckCircle2 className="size-3" />{summary.reviewed} reviewed
              </Badge>
              <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
                <Clock className="size-3" />{summary.unreviewed} left
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Bot className="size-3" />{summary.avgConfidence}% avg confidence
              </Badge>
            </div>
          )}
        </SheetHeader>

        {/* ── Filter Tabs ── */}
        <div className="px-4 pt-3 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            {filterTabs.map((tab) => {
              const count = summary?.filterCounts?.[tab.key] ?? 0
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {count > 0 && (
                    <span className={`ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-bold px-1 ${
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Review Progress Bar ── */}
        {summary && summary.total > 0 && (
          <div className="px-4 py-2.5 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {summary.reviewed} of {summary.total} reviewed
              </span>
              <span className={`font-semibold ${getConfidenceColor(reviewPercent)}`}>
                {reviewPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
                style={{ width: `${reviewPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {reviewPercent === 100
                ? '🎉 All items reviewed! Great job.'
                : reviewPercent >= 75
                  ? 'Almost done — keep going!'
                  : reviewPercent >= 50
                    ? 'Good progress. Review remaining items to help the AI learn.'
                    : 'Review items to train the AI and improve future accuracy.'}
            </p>
          </div>
        )}

        <Separator />

        {/* ── Items List (Scrollable) ── */}
        <div className="flex-1 overflow-y-auto scrollbar-glass px-4 py-3 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              <ReviewSkeletonCard />
              <ReviewSkeletonCard />
              <ReviewSkeletonCard />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="rounded-full bg-red-100 dark:bg-red-950/50 p-4">
                <AlertTriangle className="size-8 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">Failed to load review data</h3>
                <p className="text-xs text-muted-foreground">Something went wrong. Please try again.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="size-3.5" />Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && claims.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="rounded-full bg-muted p-5">
                {activeTab === 'needs_review' ? (
                  <CheckCircle2 className="size-10 text-emerald-500" />
                ) : (
                  <Inbox className="size-10 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">
                  {activeTab === 'needs_review' ? 'All caught up!' : 'No items match this filter'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                  {activeTab === 'needs_review'
                    ? 'All items have been reviewed. Come back later or check other filters.'
                    : 'Try selecting a different filter tab above.'}
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isError && claims.length > 0 && (
            claims.map((item, index) => (
              <EmailReviewCard
                key={item.id}
                item={item}
                index={index}
                onAccept={handleAccept}
                onCorrect={handleCorrect}
                onFlag={handleFlag}
                onSkip={handleSkip}
                isSubmitting={feedbackMutation.isPending}
              />
            ))
          )}
        </div>

        {/* ── Learning Insights (Collapsible) ── */}
        {statsData?.learning?.totalPatterns > 0 && (
          <div className="shrink-0 border-t">
            <button
              onClick={() => setInsightsExpanded(!insightsExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-violet-500" />
                {statsData.learning.totalPatterns} learning pattern{statsData.learning.totalPatterns !== 1 ? 's' : ''} helping AI improve
              </span>
              {insightsExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {insightsExpanded && (
              <FadeIn>
                <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto scrollbar-glass">
                  {statsData.learning.recentPatterns?.length > 0 ? (
                    statsData.learning.recentPatterns.map((p: { id: string; fieldName: string; senderDomain: string; confidence: number; correctionCount: number }) => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                        <span className="shrink-0">🔄</span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{p.fieldName}</span>
                          <span className="text-muted-foreground"> for </span>
                          <span className="font-mono text-[11px]">{p.senderDomain}</span>
                          <Badge variant="outline" className="ml-1.5 text-[10px] h-4 px-1">
                            {p.confidence}% · {p.correctionCount}x
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">No recent patterns to show.</p>
                  )}

                  {statsData.weekly?.topCorrectedFields?.length > 0 && (
                    <div className="pt-1 border-t mt-1">
                      <span className="text-[10px] text-muted-foreground">Most corrected this week: </span>
                      <span className="text-xs">
                        {statsData.weekly.topCorrectedFields.slice(0, 3).map((f: { fieldName: string; count: number }) => `${f.fieldName} (${f.count})`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </FadeIn>
            )}
          </div>
        )}

        {/* ── Quick Actions Bar (Sticky bottom) ── */}
        <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 flex-1"
                  disabled={!summary || summary.unreviewed === 0}
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  Accept All ({summary?.unreviewed || 0})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Accept all unreviewed items?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will confirm all {summary?.unreviewed || 0} unreviewed claims as correct.
                    The AI extraction data will be confirmed without changes. This helps build the learning dataset.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAcceptAll} className="bg-emerald-600 hover:bg-emerald-700">
                    Accept All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs flex-1"
              onClick={() => {
                onOpenChange(false)
                toast.success(`Review session complete! ${summary?.reviewed || 0} of ${summary?.total || 0} items reviewed.`)
              }}
            >
              <Check className="size-3.5 mr-1.5" />
              Done
            </Button>

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs"
                    onClick={handleExportReport}
                    disabled={!claims || claims.length === 0}
                  >
                    <Download className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export review report</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
            ⚡ The workflow continues automatically — review at your pace.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
