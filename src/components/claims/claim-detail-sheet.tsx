'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateClaimData } from '@/lib/query-utils'
import {
  Mail,
  Phone,
  Car,
  Building2,
  FileText,
  Clock,
  Brain,
  FolderOpen,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Copy,
  CheckCircle2,
  Loader2,
  FileSearch,
  FolderPlus,
  Printer,
  ClipboardCheck,
  Send,
  Check,
  CheckCircle,
  MessageSquare,
  Upload,
  User,
  CalendarDays,
  Info,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FadeIn } from '@/components/ui/motion'
import { ClaimActivityTimeline } from '@/components/claims/claim-activity-timeline'
import { toast } from 'sonner'
import {
  getStatusColor,
  getStatusLabel,
  getConfidenceColor,
  getConfidenceBg,
  formatRelativeTime,
  formatDate,
  formatProcessingStage,
} from '@/lib/helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ClaimDetailSheetProps {
  claimId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Processing Stages for Stepper ──────────────────────────────────────────

const statusStages = [
  { key: 'RECEIVED', label: 'Received' },
  { key: 'CLASSIFIED', label: 'Classified' },
  { key: 'EXTRACTED', label: 'Extracted' },
  { key: 'FOLDER_CREATED', label: 'Folder Created' },
  { key: 'PRINTED', label: 'Printed' },
  { key: 'COMPLETED', label: 'Completed' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStageIndex(claim: Claim): number {
  if (claim.status === 'COMPLETED') return statusStages.length - 1
  const idx = statusStages.findIndex((s) => s.key === claim.processingStage)
  return idx >= 0 ? idx : 0
}

function daysSince(dateStr: string): number {
  const now = new Date()
  const created = new Date(dateStr)
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)))
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`${getStatusColor(status)} text-xs font-medium`}>
      {getStatusLabel(status)}
    </Badge>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SheetSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32 font-mono" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      <Separator />
      <div className="px-6 py-2">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
      </div>
      <Separator />
      <div className="flex-1 px-6 py-4 space-y-4">
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Status Progress Bar ─────────────────────────────────────────────────────

function StatusProgressBar({ claim }: { claim: Claim }) {
  const currentIndex = getStageIndex(claim)
  const progressPct = ((currentIndex + 1) / statusStages.length) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Status Progress
        </p>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
          {currentIndex + 1}/{statusStages.length}
        </Badge>
      </div>
      <div className="flex items-center gap-0">
        {statusStages.map((stage, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <React.Fragment key={stage.key}>
              {index > 0 && (
                <div className="flex-1 h-0.5">
                  <div
                    className={`h-full transition-colors duration-500 ${
                      index <= currentIndex ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`flex items-center justify-center size-6 sm:size-7 rounded-full border-2 shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20'
                      : 'bg-muted border-border text-muted-foreground/40'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    <div className="size-2 rounded-full bg-current" />
                  )}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] leading-tight text-center max-w-[48px] sm:max-w-[60px] truncate ${
                    isCurrent
                      ? 'font-semibold text-primary'
                      : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground/40'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      <Progress value={progressPct} className="h-1.5" />
    </div>
  )
}

// ─── Key Info Card ────────────────────────────────────────────────────────────

function KeyInfoCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string
  value: string
  icon: React.ElementType
  colorClass?: string
}) {
  return (
    <Card className="card-shine card-hover">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`size-7 rounded-md flex items-center justify-center ${colorClass || 'bg-primary/10'}`}>
            <Icon className="size-3.5 text-current" />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

// ─── Info Field ───────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground/50'}`}>
        {value || '\u2014'}
      </span>
    </div>
  )
}

// ─── Detail Section ───────────────────────────────────────────────────────────

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-md bg-muted/60 flex items-center justify-center">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {title}
        </h4>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ claim }: { claim: Claim }) {
  const days = daysSince(claim.createdAt)

  return (
    <div className="space-y-5">
      {/* Status Progress */}
      <FadeIn delay={0.05}>
        <StatusProgressBar claim={claim} />
      </FadeIn>

      {/* Key Info Cards 2x2 */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 gap-3">
          <KeyInfoCard
            title="Insurance Co."
            value={claim.insuranceCompany?.name || 'N/A'}
            icon={Building2}
            colorClass="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
          />
          <KeyInfoCard
            title="Claim Type"
            value={claim.claimType}
            icon={FileText}
            colorClass="bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"
          />
          <KeyInfoCard
            title="Confidence"
            value={`${claim.confidenceScore}%`}
            icon={Shield}
            colorClass={
              claim.confidenceScore >= 80
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : claim.confidenceScore >= 60
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
            }
          />
          <KeyInfoCard
            title="Stage"
            value={formatProcessingStage(claim.processingStage)}
            icon={ClipboardCheck}
            colorClass="bg-primary/10 text-primary"
          />
        </div>
      </FadeIn>

      {/* AI Classification */}
      <FadeIn delay={0.15}>
        <Card className="card-shine">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Brain className="size-3.5" />
              AI Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Predicted Class</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {claim.aiClassification || 'Not classified'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getConfidenceBg(claim.aiClassificationConfidence)}`}
                      style={{ width: `${claim.aiClassificationConfidence}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${getConfidenceColor(claim.aiClassificationConfidence)}`}>
                    {claim.aiClassificationConfidence}%
                  </span>
                </div>
              </div>
              {claim.verifiedByUser && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                  <CheckCircle2 className="size-2.5 mr-0.5" />
                  Verified by User
                </Badge>
              )}
              {claim.aiHintsUsed && (
                <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                  <Info className="size-3" />
                  AI reasoning: {claim.aiHintsUsed}
                </p>
              )}
              {claim.claimType && claim.aiClassification && claim.claimType !== claim.aiClassification && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium">Alternatives:</span> {claim.aiClassification} (AI suggested), {claim.claimType} (current)
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Quick Stats */}
      <FadeIn delay={0.2}>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days Since Created</p>
              <p className="text-sm font-semibold text-foreground">{days}d</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
            <Paperclip className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attachments</p>
              <p className="text-sm font-semibold text-foreground">{claim.attachmentsCount}</p>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

// ─── Details Tab ──────────────────────────────────────────────────────────────

function DetailsTab({ claim }: { claim: Claim }) {
  return (
    <div className="space-y-5">
      {/* Client Info */}
      <FadeIn delay={0.05}>
        <DetailSection title="Client Information" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pl-1">
            <InfoField label="Client Name" value={claim.clientName} />
            <InfoField label="Email" value={claim.contactEmail} />
            <InfoField label="Phone" value={claim.contactNumber} />
          </div>
        </DetailSection>
      </FadeIn>

      <Separator />

      {/* Claim Info */}
      <FadeIn delay={0.1}>
        <DetailSection title="Claim Information" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pl-1">
            <InfoField label="Claim Type" value={claim.claimType} />
            <InfoField label="Status" value={getStatusLabel(claim.status)} />
            <InfoField label="Processing Stage" value={formatProcessingStage(claim.processingStage)} />
            <InfoField label="Excess Amount" value={claim.excessAmount} />
            <InfoField label="Special Instructions" value={claim.specialInstructions} />
          </div>
        </DetailSection>
      </FadeIn>

      {/* Vehicle Info (Motor) */}
      {claim.claimType === 'Motor' && (
        <>
          <Separator />
          <FadeIn delay={0.12}>
            <DetailSection title="Vehicle Information" icon={Car}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pl-1">
                <InfoField label="Make" value={claim.vehicleMake} />
                <InfoField label="Model" value={claim.vehicleModel} />
                <InfoField label="Year" value={claim.vehicleYear} />
                <InfoField label="Registration" value={claim.vehicleRegistration} />
              </div>
            </DetailSection>
          </FadeIn>
        </>
      )}

      {/* Property Info (Building) */}
      {claim.claimType === 'Building' && (
        <>
          <Separator />
          <FadeIn delay={0.12}>
            <DetailSection title="Property Information" icon={Building2}>
              <div className="pl-1">
                <InfoField label="Property Address" value={claim.propertyAddress} />
              </div>
            </DetailSection>
          </FadeIn>
        </>
      )}

      <Separator />

      {/* Folder Path */}
      <FadeIn delay={0.14}>
        <DetailSection title="File Location" icon={FolderOpen}>
          {claim.folderPath ? (
            <div className="flex items-center gap-2 pl-1">
              <code className="flex-1 text-xs text-foreground bg-muted/40 rounded-md px-3 py-2 font-mono truncate">
                {claim.folderPath}
              </code>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(claim.folderPath || '')
                      toast.success('Folder path copied')
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy path</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pl-1">No folder path assigned</p>
          )}
        </DetailSection>
      </FadeIn>

      {/* Timestamps */}
      <Separator />
      <FadeIn delay={0.16}>
        <DetailSection title="Timestamps" icon={Clock}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pl-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</span>
              <span className="text-sm text-foreground">{formatDate(claim.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Updated</span>
              <span className="text-sm text-foreground">{formatDate(claim.updatedAt)}</span>
            </div>
            {claim.processedAt && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Processed</span>
                <span className="text-sm text-foreground">{formatDate(claim.processedAt)}</span>
              </div>
            )}
          </div>
        </DetailSection>
      </FadeIn>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab({ claim }: { claim: Claim }) {
  const { data, isLoading } = useQuery({
    queryKey: ['claim-documents', claim.id],
    queryFn: () =>
      fetch(`/api/claims/${claim.id}/process`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to fetch')
          return r.json()
        })
        .catch(() => ({ items: [] })),
    retry: 1,
    enabled: !!claim.id,
  })

  const items = (data?.items || []) as Array<{
    id: string
    fileName: string
    printStatus: string
    createdAt: string
  }>

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <FadeIn delay={0.05}>
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed"
          onClick={() => toast.info('Feature coming soon')}
        >
          <Upload className="size-4" />
          Upload Document
        </Button>
      </FadeIn>

      <Separator />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Upload className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No documents attached</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px]">
              Documents will appear here when they are processed from the claim email or uploaded manually.
            </p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {items.length} document{items.length !== 1 ? 's' : ''}
            </p>
            {items.map((item) => {
              const statusColor: Record<string, string> = {
                QUEUED: 'text-amber-600 dark:text-amber-400',
                PRINTING: 'text-blue-600 dark:text-blue-400',
                COMPLETED: 'text-emerald-600 dark:text-emerald-400',
                FAILED: 'text-red-600 dark:text-red-400',
              }
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors card-hover">
                  <div className="flex items-center justify-center size-10 rounded-lg bg-muted/50">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('en-ZA', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold ${statusColor[item.printStatus] || 'text-muted-foreground'}`}>
                    {item.printStatus}
                  </span>
                </div>
              )
            })}
          </div>
        </FadeIn>
      )}
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ claim }: { claim: Claim }) {
  const queryClient = useQueryClient()
  const [noteText, setNoteText] = useState('')

  const { data: notesData, isLoading: notesLoading, refetch: refetchNotes } = useQuery({
    queryKey: ['claim-notes', claim.id],
    queryFn: () =>
      fetch(`/api/claims/${claim.id}/notes`).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch notes')
        return r.json()
      }),
    enabled: !!claim.id,
    retry: 2,
    retryDelay: 1000,
  })

  const notes = (notesData?.notes || []) as Array<{
    id: string
    text: string
    type: string
    timestamp: string
    pinned: boolean
  }>

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      fetch(`/api/claims/${claim.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'General' }),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to add note')
        return r.json()
      }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      refetchNotes()
      setNoteText('')
      toast.success('Note added successfully')
    },
    onError: () => {
      toast.error('Failed to add note')
    },
  })

  const handleAddNote = useCallback(() => {
    if (!noteText.trim()) return
    addNoteMutation.mutate(noteText.trim())
  }, [noteText, addNoteMutation])

  return (
    <div className="space-y-4">
      {/* Note Input */}
      <FadeIn delay={0.05}>
        <div className="space-y-2">
          <Textarea
            className="min-h-[80px] resize-none"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleAddNote()
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={addNoteMutation.isPending || !noteText.trim()}
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <MessageSquare className="size-3.5 mr-1" />
              )}
              Add Note
            </Button>
          </div>
        </div>
      </FadeIn>

      <Separator />

      {/* Notes List */}
      {notesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="size-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Add a note above to keep track of important details about this claim.
            </p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1}>
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-lg border p-3 ${
                  note.pinned ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="size-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(note.timestamp)}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1.5 bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800"
                  >
                    <User className="size-2 mr-0.5" />
                    by User
                  </Badge>
                  {note.pinned && (
                    <span className="text-amber-500" title="Pinned">
                      <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.828 3.684l1.95-1.95a3.5 3.5 0 114.95 4.95l-1.95 1.95a.5.5 0 01-.708 0l-3.34-3.34a.5.5 0 010-.708z" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClaimDetailSheet({ claimId, open, onOpenChange }: ClaimDetailSheetProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch claim data
  const { data: claim, isLoading, isError } = useQuery<Claim>({
    queryKey: ['claim-detail-sheet', claimId],
    queryFn: () =>
      fetch(`/api/claims/${claimId}`).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch claim')
        return r.json()
      }),
    enabled: !!claimId && open,
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000,
  })

  // Reset tab when sheet closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setActiveTab('overview')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  // Mark Complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/claims/${claimId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      }).then((r) => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      queryClient.invalidateQueries({ queryKey: ['claim-detail-sheet', claimId] })
      toast.success('Claim marked as completed')
    },
    onError: () => {
      toast.error('Failed to update claim status')
    },
  })

  // Request Review mutation
  const requestReviewMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/claims/${claimId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'MANUAL_REVIEW' }),
      }).then((r) => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      queryClient.invalidateQueries({ queryKey: ['claim-detail-sheet', claimId] })
      toast.success('Claim sent for review')
    },
    onError: () => {
      toast.error('Failed to request review')
    },
  })

  // Quick action handlers
  const handleMarkComplete = useCallback(() => {
    markCompleteMutation.mutate()
  }, [markCompleteMutation])

  const handleRequestReview = useCallback(() => {
    requestReviewMutation.mutate()
  }, [requestReviewMutation])

  const handlePrintDocuments = useCallback(() => {
    toast.info('Feature coming soon')
  }, [])

  const handleAddNote = useCallback(() => {
    setActiveTab('notes')
  }, [])

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b">
          {isLoading ? (
            <div className="px-6 pt-6 pb-4 space-y-2">
              <Skeleton className="h-6 w-32 font-mono" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : claim ? (
            <FadeIn>
              <SheetHeader className="px-6 pt-6 pb-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <SheetTitle className="font-mono text-lg text-foreground tracking-tight">
                    {claim.claimNumber}
                  </SheetTitle>
                  <StatusBadge status={claim.status} />
                  <span className="text-sm font-normal text-muted-foreground">
                    {claim.clientName}
                  </span>
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  {claim.insuranceCompany
                    ? `${claim.insuranceCompany.name} \u2022 `
                    : ''}
                  {claim.claimType} claim
                  {claim.needsAttention && (
                    <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                      <AlertTriangle className="size-2.5 mr-0.5" />
                      Needs Attention
                    </Badge>
                  )}
                </SheetDescription>
              </SheetHeader>

              {/* Quick Actions Row */}
              <div className="flex items-center gap-2 px-6 pt-4 pb-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      onClick={handleMarkComplete}
                      disabled={markCompleteMutation.isPending || claim.status === 'COMPLETED'}
                    >
                      {markCompleteMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span className="hidden sm:inline">Mark Complete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark this claim as completed</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={handleRequestReview}
                      disabled={requestReviewMutation.isPending || claim.status === 'MANUAL_REVIEW'}
                    >
                      {requestReviewMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                      <span className="hidden sm:inline">Request Review</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send claim for manual review</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={handlePrintDocuments}
                    >
                      <Printer className="size-3.5" />
                      <span className="hidden sm:inline">Print Documents</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print claim documents</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/30"
                      onClick={handleAddNote}
                    >
                      <MessageSquare className="size-3.5 text-sky-600 dark:text-sky-400" />
                      <span className="hidden sm:inline">Add Note</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Jump to notes tab</TooltipContent>
                </Tooltip>
              </div>
            </FadeIn>
          ) : null}
        </div>

        {/* ── Tabs Navigation ── */}
        {claim && !isLoading && (
          <div className="shrink-0 border-b px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start bg-transparent p-0 h-auto border-0 rounded-none">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Documents
                  {claim.attachmentsCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                      {claim.attachmentsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Activity
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Notes
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-100px)] scrollbar-thin">
          {isLoading ? (
            <SheetSkeleton />
          ) : isError || !claim ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Unable to load claim</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                The claim may have been deleted or the server is unavailable.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['claim-detail-sheet', claimId] })
                }}
              >
                <Loader2 className="size-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="px-6 py-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab claim={claim} />
                </TabsContent>
                <TabsContent value="details" className="mt-0">
                  <DetailsTab claim={claim} />
                </TabsContent>
                <TabsContent value="documents" className="mt-0">
                  <DocumentsTab claim={claim} />
                </TabsContent>
                <TabsContent value="activity" className="mt-0">
                  <ClaimActivityTimeline claimId={claim.id} />
                </TabsContent>
                <TabsContent value="notes" className="mt-0">
                  <NotesTab claim={claim} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
