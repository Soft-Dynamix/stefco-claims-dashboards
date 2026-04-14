'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateClaimData } from '@/lib/query-utils'
import {
  X,
  User,
  Tag,
  Building2,
  Mail,
  Phone,
  CalendarDays,
  FolderOpen,
  Brain,
  Cpu,
  MapPin,
  Car,
  FileText,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Printer,
  Trash2,
  Play,
  Eye,
  Paperclip,
  FileDown,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Activity,
  GitBranch,
  ScanSearch,
  Hash,
  Users,
  Sparkles,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useClaimsStore } from '@/store/claims-store'
import {
  getStatusColor,
  getStatusLabel,
  getConfidenceColor,
  getConfidenceBg,
  formatCurrency,
  formatProcessingStage,
  getStageColor,
  formatDate,
  formatShortDate,
} from '@/lib/helpers'
import { ClaimStatusTimeline } from '@/components/claims/claim-status-timeline'
import { ClaimNotesTimeline } from '@/components/claims/claim-notes-timeline'
import { toast } from 'sonner'

interface Claim {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  senderEmail: string | null
  emailSubject: string | null
  contactNumber: string | null
  contactEmail: string | null
  incidentDescription: string | null
  excessAmount: string | null
  specialInstructions: string | null
  folderPath: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleYear: string | null
  vehicleRegistration: string | null
  propertyAddress: string | null
  attachmentsCount: number
  documentsPrinted: boolean
  confidenceScore: number
  aiClassification: string | null
  aiClassificationConfidence: number
  processingStage: string
  notes: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
  insuranceCompanyId: string | null
  insuranceCompany: { id: string; name: string } | null
  needsAttention: boolean
  verifiedByUser: boolean
  aiHintsUsed: string | null
  aiDecision: string | null
  aiReasoning: string | null
  aiConfidenceBreakdown: string | null
  aiAlternatives: string | null
}

function ConfidenceBar({ score }: { score: number }) {
  const [animatedWidth, setAnimatedWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getConfidenceBg(score)}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${getConfidenceColor(score)}`}>
        {score}%
      </span>
    </div>
  )
}

function InfoField({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-2.5 py-2 ${className}`}>
      <div className="flex items-center justify-center size-8 rounded-lg bg-muted/60 shrink-0 mt-0.5">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm text-foreground leading-snug break-words">
          {value || <span className="text-muted-foreground/50">—</span>}
        </p>
      </div>
    </div>
  )
}

function ExpandableSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left py-2 group cursor-pointer"
      >
        <div className="flex items-center justify-center size-8 rounded-lg bg-muted/60 shrink-0">
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
            {label}
          </p>
          <p className="text-xs text-primary font-medium">
            {isOpen ? 'Collapse' : 'Expand'}
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="ml-10 mt-1 mb-2 p-3 rounded-lg bg-muted/20 border text-sm text-foreground leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Separator />
      <div className="flex-1 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-start gap-2.5 py-2">
              <Skeleton className="size-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function safeJsonParse<T>(str: string | null, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str) as T
  } catch {
    return fallback
  }
}

const decisionConfig: Record<string, { label: string; className: string }> = {
  auto_classify: {
    label: 'Auto Classified',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  needs_review: {
    label: 'Needs Review',
    className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  manual_review: {
    label: 'Manual Review',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  },
}

function getDecisionBadge(decision: string | null) {
  if (!decision) {
    return {
      label: 'Legacy',
      className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    }
  }
  return decisionConfig[decision] || {
    label: decision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  }
}

function MiniConfidenceBar({ label, score }: { label: string; score: number }) {
  const [animatedWidth, setAnimatedWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(score), 150)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(score)}`}>{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getConfidenceBg(score)}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
    </div>
  )
}

function AlternativesList({ alternatives }: { alternatives: Array<{ class: string; score: number }> }) {
  return (
    <div className="space-y-2.5">
      {alternatives.map((alt, idx) => {
        const pct = Math.round(alt.score * 100)
        return (
          <AlternativeItem key={alt.class} altClass={alt.class} score={pct} delay={idx} />
        )
      })}
    </div>
  )
}

function AlternativeItem({ altClass, score, delay }: { altClass: string; score: number; delay: number }) {
  const [animatedWidth, setAnimatedWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(score), 150 + delay * 100)
    return () => clearTimeout(timer)
  }, [score, delay])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{altClass}</span>
        <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(score)}`}>
          {score}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getConfidenceBg(score)}`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
    </div>
  )
}

function AIAnalysisTab({ claim }: { claim: Claim }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['claim-predictions', claim.id],
    queryFn: () =>
      fetch(`/api/claims/${claim.id}/predictions`).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch predictions')
        return r.json()
      }),
    retry: 1,
  })

  const prediction = data?.prediction || null
  const entities = data?.entities || null

  // Parse claim-level AI fields
  const decisionBadge = getDecisionBadge(claim.aiDecision)
  const confidenceBreakdown = safeJsonParse<{ classification?: number; extraction?: number; overall?: number }>(claim.aiConfidenceBreakdown, {})
  const alternatives = safeJsonParse<Array<{ class: string; score: number }>>(claim.aiAlternatives, [])

  // Keyword color palette (warm tones, no indigo/blue)
  const keywordColors = [
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
    'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
    'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300',
    'bg-pink-100 text-pink-800 dark:bg-pink-950/50 dark:text-pink-300',
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 1. Decision Badge */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-7 rounded-lg bg-muted/60">
            <Brain className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Decision</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`${decisionBadge.className} text-xs font-semibold px-3 py-1`}>
            {decisionBadge.label}
          </Badge>
          {prediction?.predictedClass && (
            <span className="text-xs text-muted-foreground">
              Predicted: <span className="font-medium text-foreground">{prediction.predictedClass}</span>
              {prediction.confidence != null && (
                <span className={`ml-1 ${getConfidenceColor(Math.round(prediction.confidence * 100))}`}>
                  ({Math.round(prediction.confidence * 100)}%)
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 2. AI Reasoning */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-7 rounded-lg bg-muted/60">
            <Lightbulb className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Reasoning</p>
        </div>
        <div className="rounded-lg bg-muted/30 border p-3">
          <p className="text-sm text-foreground leading-relaxed">
            {claim.aiReasoning || (prediction?.reasoning) || 'No reasoning available.'}
          </p>
        </div>
        {prediction?.decisionReasoning && (
          <div className="mt-2 rounded-lg bg-muted/20 border border-dashed p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Decision Reasoning</p>
            <p className="text-sm text-foreground leading-relaxed">{prediction.decisionReasoning}</p>
          </div>
        )}
      </div>

      {/* 3. Confidence Breakdown */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-7 rounded-lg bg-muted/60">
            <Activity className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Confidence Breakdown</p>
        </div>
        <div className="space-y-3">
          <MiniConfidenceBar
            label="Classification"
            score={confidenceBreakdown.classification ?? claim.aiClassificationConfidence ?? 0}
          />
          <MiniConfidenceBar
            label="Extraction"
            score={confidenceBreakdown.extraction ?? 0}
          />
          <MiniConfidenceBar
            label="Overall"
            score={confidenceBreakdown.overall ?? claim.confidenceScore ?? 0}
          />
        </div>
        {Object.keys(confidenceBreakdown).length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">No detailed breakdown available — showing aggregate scores.</p>
        )}
      </div>

      {/* 4. Alternatives */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-7 rounded-lg bg-muted/60">
            <GitBranch className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Alternative Classifications</p>
        </div>
        {alternatives.length > 0 ? (
          <AlternativesList alternatives={alternatives} />
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-lg bg-muted/20">
            <GitBranch className="size-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No alternative classifications recorded.</p>
          </div>
        )}
      </div>

      {/* 5. Extracted Signals */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center size-7 rounded-lg bg-muted/60">
            <ScanSearch className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Extracted Signals</p>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-600 dark:text-red-400">Failed to load extracted signals.</p>
          </div>
        ) : !entities ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 rounded-lg bg-muted/20">
            <ScanSearch className="size-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No extracted signals available.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Possible Claim Number */}
            {entities.possibleClaimNumber && (
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center size-6 rounded-md bg-muted/60 shrink-0 mt-0.5">
                  <Hash className="size-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Claim Number</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{entities.possibleClaimNumber}</p>
                </div>
              </div>
            )}

            {/* Person Names */}
            {entities.personNames && Array.isArray(entities.personNames) && entities.personNames.length > 0 && (
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center size-6 rounded-md bg-muted/60 shrink-0 mt-0.5">
                  <Users className="size-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Person Names</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {entities.personNames.map((name: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs font-medium">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Dates */}
            {entities.dates && Array.isArray(entities.dates) && entities.dates.length > 0 && (
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center size-6 rounded-md bg-muted/60 shrink-0 mt-0.5">
                  <CalendarDays className="size-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dates</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {entities.dates.map((date: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs font-medium">
                        {date}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Keywords */}
            {entities.keywords && Array.isArray(entities.keywords) && entities.keywords.length > 0 && (
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center size-6 rounded-md bg-muted/60 shrink-0 mt-0.5">
                  <Sparkles className="size-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Keywords</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {entities.keywords.map((keyword: string, i: number) => (
                      <Badge
                        key={i}
                        className={`text-xs font-medium border-0 ${keywordColors[i % keywordColors.length]}`}
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* No signals at all */}
            {!entities.possibleClaimNumber &&
              !(entities.personNames && Array.isArray(entities.personNames) && entities.personNames.length > 0) &&
              !(entities.dates && Array.isArray(entities.dates) && entities.dates.length > 0) &&
              !(entities.keywords && Array.isArray(entities.keywords) && entities.keywords.length > 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No signals extracted for this claim.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PrintQueueList({ claimId, attachmentsCount }: { claimId: string; attachmentsCount: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['print-queue', claimId],
    queryFn: () =>
      fetch(`/api/claims/${claimId}/process`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to fetch')
          return r.json()
        })
        .catch(() => ({ items: [] })),
    retry: 1,
  })

  const items = (data?.items || []) as Array<{
    id: string
    fileName: string
    printStatus: string
    createdAt: string
  }>

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border bg-muted/20">
        <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center">
          <Paperclip className="size-6 text-muted-foreground/50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {attachmentsCount} Attachment{attachmentsCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {attachmentsCount > 0
              ? 'Attachments detected from email — listed below'
              : 'No attachments recorded for this claim'}
          </p>
        </div>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    QUEUED: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    PRINTING: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    COMPLETED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    FAILED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {items.length} Document{items.length !== 1 ? 's' : ''} in Print Queue
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
        >
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
            {item.createdAt && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[item.printStatus] || 'text-muted-foreground bg-muted'}`}>
            {item.printStatus}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ClaimDetailPanel() {
  const selectedClaimId = useClaimsStore((s) => s.selectedClaimId)
  const setSelectedClaimId = useClaimsStore((s) => s.setSelectedClaimId)
  const queryClient = useQueryClient()

  const open = !!selectedClaimId

  const { data, isLoading, error } = useQuery<{ claim: Claim }>({
    queryKey: ['claim-detail', selectedClaimId],
    queryFn: () =>
      fetch(`/api/claims/${selectedClaimId}`).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch claim')
        return r.json()
      }),
    enabled: !!selectedClaimId,
    retry: 2,
    retryDelay: 1000,
  })

  const claim = data?.claim || null

  const processMutation = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      fetch(`/api/claims/${claim?.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (res) => {
      invalidateClaimData(queryClient)
      toast.success(res.message || 'Claim processed successfully')
    },
    onError: (err: Error) => {
      toast.error(`Failed to process claim: ${err.message}`)
    },
  })

  const markReviewMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/claims/${claim?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING_REVIEW' }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      toast.success('Claim marked for review')
    },
    onError: () => {
      toast.error('Failed to update claim status')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/claims/${claim?.id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      toast.success('Claim deleted successfully')
      setSelectedClaimId(null)
    },
    onError: () => {
      toast.error('Failed to delete claim')
    },
  })

  const handleSheetOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedClaimId(null)
      }
    },
    [setSelectedClaimId]
  )

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [corrections, setCorrections] = useState({
    clientName: '',
    claimType: '',
    contactNumber: '',
    contactEmail: '',
    incidentDescription: '',
    excessAmount: '',
  })

  const feedbackMutation = useMutation({
    mutationFn: (params: { feedbackType: string; fieldName?: string; originalValue?: string; correctedValue?: string; fieldUpdates?: Record<string, string> }) =>
      fetch(`/api/claims/${claim?.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => {
        if (!r.ok) throw new Error('Feedback submission failed')
        return r.json()
      }),
    onSuccess: (res) => {
      invalidateClaimData(queryClient)
      toast.success(res.message || 'Feedback submitted successfully')
      setIssueDialogOpen(false)
    },
    onError: (err: Error) => {
      toast.error(`Failed to submit feedback: ${err.message}`)
    },
  })

  const handleDownloadPdf = useCallback(async () => {
    if (!claim) return
    setIsDownloadingPdf(true)
    try {
      const response = await fetch(`/api/claims/${claim.id}/pdf`)
      if (!response.ok) throw new Error('Failed to generate PDF')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `STF-${claim.claimNumber}_Claim_Report.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded successfully')
    } catch {
      toast.error('Failed to download PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }, [claim])

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 overflow-hidden flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Claim Details</SheetTitle>
          <SheetDescription>View and manage claim details</SheetDescription>
        </SheetHeader>

        {isLoading && <PanelSkeleton />}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="size-5 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground">Failed to load claim</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['claim-detail'] })
              }}
            >
              Try Again
            </Button>
          </div>
        )}

        {claim && !isLoading && (
          <>
            {/* Header Section */}
            <div className="p-6 pb-4 gradient-border border-b card-enter">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap mb-2">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">
                      {claim.claimNumber}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`${getStatusColor(claim.status)} text-xs font-semibold`}
                    >
                      {getStatusLabel(claim.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {claim.clientName}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        AI Confidence
                      </span>
                      <ConfidenceBar score={claim.confidenceScore} />
                    </div>
                  </div>

                  {/* Low Confidence Attention Banner */}
                  {claim.needsAttention && !claim.verifiedByUser && (
                    <div className="mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>Low confidence — Please review when possible</span>
                    </div>
                  )}

                  {/* Verified Badge */}
                  {claim.verifiedByUser && (
                    <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Verified by user — Data confirmed correct</span>
                    </div>
                  )}

                  {/* AI Hints Indicator */}
                  {claim.aiHintsUsed && (
                    <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Brain className="size-3" />
                      <span>AI boosted by {claim.aiHintsUsed} learning pattern{Number(claim.aiHintsUsed) !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-0 card-enter">
                {/* Info Grid */}
                <div className="glass-card rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Claim Information
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <InfoField icon={User} label="Client Name" value={claim.clientName} />
                    <InfoField
                      icon={Tag}
                      label="Claim Type"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          {claim.claimType}
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {claim.attachmentsCount} file{claim.attachmentsCount !== 1 ? 's' : ''}
                          </Badge>
                        </span>
                      }
                    />
                    <InfoField
                      icon={Building2}
                      label="Insurance Company"
                      value={claim.insuranceCompany?.name}
                    />
                    <InfoField icon={Mail} label="Email Subject" value={claim.emailSubject} />
                    <InfoField
                      icon={Mail}
                      label="Sender Email"
                      value={
                        claim.senderEmail ? (
                          <a
                            href={`mailto:${claim.senderEmail}`}
                            className="text-primary hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {claim.senderEmail}
                          </a>
                        ) : null
                      }
                    />
                    <InfoField
                      icon={Phone}
                      label="Contact Number"
                      value={
                        claim.contactNumber ? (
                          <a
                            href={`tel:${claim.contactNumber}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {claim.contactNumber}
                          </a>
                        ) : null
                      }
                    />
                    <InfoField
                      icon={Mail}
                      label="Contact Email"
                      value={
                        claim.contactEmail ? (
                          <a
                            href={`mailto:${claim.contactEmail}`}
                            className="text-primary hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {claim.contactEmail}
                          </a>
                        ) : null
                      }
                    />
                    <InfoField
                      icon={CalendarDays}
                      label="Created Date"
                      value={formatDate(claim.createdAt)}
                    />
                    <InfoField
                      icon={CalendarDays}
                      label="Processed Date"
                      value={claim.processedAt ? formatDate(claim.processedAt) : undefined}
                    />
                    <InfoField
                      icon={FolderOpen}
                      label="Folder Path"
                      value={claim.folderPath}
                      className="sm:col-span-2"
                    />
                    <InfoField
                      icon={Brain}
                      label="AI Classification"
                      value={
                        claim.aiClassification ? (
                          <span className="inline-flex items-center gap-1.5">
                            {claim.aiClassification}
                            <span className={`text-xs font-medium ${getConfidenceColor(claim.aiClassificationConfidence)}`}>
                              ({claim.aiClassificationConfidence}%)
                            </span>
                          </span>
                        ) : undefined
                      }
                    />
                    <InfoField
                      icon={Cpu}
                      label="Processing Stage"
                      value={
                        <span className={`inline-flex items-center gap-1.5 ${getStageColor(claim.processingStage)}`}>
                          <span className="size-2 rounded-full bg-current shrink-0" />
                          {formatProcessingStage(claim.processingStage)}
                        </span>
                      }
                    />
                    <InfoField
                      icon={DollarSign}
                      label="Excess Amount"
                      value={
                        claim.excessAmount
                          ? formatCurrency(claim.excessAmount)
                          : undefined
                      }
                    />
                  </div>

                  {/* Special Instructions (expandable) */}
                  {claim.specialInstructions && (
                    <>
                      <Separator className="my-3" />
                      <ExpandableSection label="Special Instructions">
                        {claim.specialInstructions}
                      </ExpandableSection>
                    </>
                  )}

                  {/* Vehicle Details (Motor claims only) */}
                  {claim.claimType === 'Motor' && (
                    (claim.vehicleMake || claim.vehicleModel || claim.vehicleYear || claim.vehicleRegistration) ? (
                      <>
                        <Separator className="my-3" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Car className="size-3.5" />
                          Vehicle Details
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                          <InfoField icon={Car} label="Make" value={claim.vehicleMake} />
                          <InfoField icon={Car} label="Model" value={claim.vehicleModel} />
                          <InfoField icon={CalendarDays} label="Year" value={claim.vehicleYear} />
                          <InfoField icon={Tag} label="Registration" value={claim.vehicleRegistration} />
                        </div>
                      </>
                    ) : null
                  )}

                  {/* Property Details (Property claims only) */}
                  {claim.claimType === 'Building' && claim.propertyAddress && (
                    <>
                      <Separator className="my-3" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        Property Details
                      </p>
                      <InfoField
                        icon={MapPin}
                        label="Property Address"
                        value={claim.propertyAddress}
                        className="sm:col-span-2"
                      />
                    </>
                  )}
                </div>

                {/* Tabs Section */}
                <Tabs defaultValue="timeline" className="w-full">
                  <TabsList className="w-full justify-start bg-muted/40 rounded-lg p-1 h-10">
                    <TabsTrigger
                      value="timeline"
                      className="text-xs flex-1 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Clock className="size-3.5 mr-1.5" />
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger
                      value="notes"
                      className="text-xs flex-1 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <FileText className="size-3.5 mr-1.5" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger
                      value="documents"
                      className="text-xs flex-1 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Paperclip className="size-3.5 mr-1.5" />
                      Documents
                    </TabsTrigger>
                    <TabsTrigger
                      value="ai-analysis"
                      className="text-xs flex-1 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Brain className="size-3.5 mr-1.5" />
                      AI Analysis
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4">
                    <ClaimStatusTimeline claimId={claim.id} />
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <ClaimNotesTimeline claimId={claim.id} />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-4">
                    <PrintQueueList claimId={claim.id} attachmentsCount={claim.attachmentsCount} />
                  </TabsContent>

                  <TabsContent value="ai-analysis" className="mt-4">
                    <AIAnalysisTab claim={claim} />
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            {/* Sticky Action Bar */}
            <div className="border-t bg-background p-4 mt-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Looks Good button — only when not verified */}
                {!claim.verifiedByUser && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() =>
                      feedbackMutation.mutate({ feedbackType: 'confirmed_correct' })
                    }
                    disabled={feedbackMutation.isPending}
                  >
                    {feedbackMutation.isPending && feedbackMutation.variables?.feedbackType === 'confirmed_correct' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    Looks Good
                  </Button>
                )}

                {/* Report Issue button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-300"
                  onClick={() => {
                    setCorrections({
                      clientName: claim.clientName || '',
                      claimType: claim.claimType || '',
                      contactNumber: claim.contactNumber || '',
                      contactEmail: claim.contactEmail || '',
                      incidentDescription: claim.incidentDescription || '',
                      excessAmount: claim.excessAmount || '',
                    })
                    setIssueDialogOpen(true)
                  }}
                >
                  <AlertTriangle className="size-3.5" />
                  Report Issue
                </Button>

                <Button
                  size="sm"
                  className="gap-1.5 btn-shine"
                  onClick={() => processMutation.mutate({ action: 'process' })}
                  disabled={processMutation.isPending}
                >
                  <Play className="size-3.5" />
                  Process
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => markReviewMutation.mutate()}
                  disabled={markReviewMutation.isPending}
                >
                  <Eye className="size-3.5" />
                  Mark for Review
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileDown className="size-3.5" />
                  )}
                  {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePrint}
                >
                  <Printer className="size-3.5" />
                  Print
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 ml-auto"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Claim {claim.claimNumber}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will soft-delete this claim. The claim status will be set to Failed and
                        the action will be recorded in the audit log. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Claim
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Issue Report Dialog */}
            <AlertDialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
              <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Report Issue with Claim {claim.claimNumber}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Help the system learn — correct any inaccurate fields below.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="correct-clientName" className="text-xs font-medium">Client Name</Label>
                    <Input
                      id="correct-clientName"
                      value={corrections.clientName}
                      onChange={(e) => setCorrections((prev) => ({ ...prev, clientName: e.target.value }))}
                      placeholder="Enter correct client name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-claimType" className="text-xs font-medium">Claim Type</Label>
                    <Select
                      value={corrections.claimType}
                      onValueChange={(value) => setCorrections((prev) => ({ ...prev, claimType: value }))}
                    >
                      <SelectTrigger id="correct-claimType">
                        <SelectValue placeholder="Select claim type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Motor">Motor</SelectItem>
                        <SelectItem value="Building">Building</SelectItem>
                        <SelectItem value="Marine">Marine</SelectItem>
                        <SelectItem value="Agricultural">Agricultural</SelectItem>
                        <SelectItem value="Household">Household</SelectItem>
                        <SelectItem value="Liability">Liability</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-contactNumber" className="text-xs font-medium">Contact Number</Label>
                    <Input
                      id="correct-contactNumber"
                      value={corrections.contactNumber}
                      onChange={(e) => setCorrections((prev) => ({ ...prev, contactNumber: e.target.value }))}
                      placeholder="Enter correct contact number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-contactEmail" className="text-xs font-medium">Contact Email</Label>
                    <Input
                      id="correct-contactEmail"
                      type="email"
                      value={corrections.contactEmail}
                      onChange={(e) => setCorrections((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="Enter correct contact email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-incidentDescription" className="text-xs font-medium">Incident Description</Label>
                    <Textarea
                      id="correct-incidentDescription"
                      value={corrections.incidentDescription}
                      onChange={(e) => setCorrections((prev) => ({ ...prev, incidentDescription: e.target.value }))}
                      placeholder="Enter correct incident description"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-excessAmount" className="text-xs font-medium">Excess Amount</Label>
                    <Input
                      id="correct-excessAmount"
                      value={corrections.excessAmount}
                      onChange={(e) => setCorrections((prev) => ({ ...prev, excessAmount: e.target.value }))}
                      placeholder="Enter correct excess amount"
                    />
                  </div>
                </div>

                <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                  <AlertDialogCancel disabled={feedbackMutation.isPending}>Cancel</AlertDialogCancel>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      feedbackMutation.mutate({ feedbackType: 'flagged_incorrect' })
                    }
                    disabled={feedbackMutation.isPending}
                  >
                    {feedbackMutation.isPending && feedbackMutation.variables?.feedbackType === 'flagged_incorrect' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                    Just Flag for Review
                  </Button>
                  <Button
                    className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() => {
                      const fieldUpdates: Record<string, string> = {}
                      const originalValues: Record<string, string> = {
                        clientName: claim.clientName || '',
                        claimType: claim.claimType || '',
                        contactNumber: claim.contactNumber || '',
                        contactEmail: claim.contactEmail || '',
                        incidentDescription: claim.incidentDescription || '',
                        excessAmount: claim.excessAmount || '',
                      }
                      for (const [key, value] of Object.entries(corrections)) {
                        if (value !== originalValues[key] && value.trim() !== '') {
                          fieldUpdates[key] = value
                        }
                      }
                      if (Object.keys(fieldUpdates).length > 0) {
                        feedbackMutation.mutate({
                          feedbackType: 'field_corrected',
                          fieldUpdates,
                        })
                      } else {
                        toast.info('No changes detected — no corrections submitted')
                        setIssueDialogOpen(false)
                      }
                    }}
                    disabled={feedbackMutation.isPending}
                  >
                    {feedbackMutation.isPending && feedbackMutation.variables?.feedbackType === 'field_corrected' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Submit Corrections
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
