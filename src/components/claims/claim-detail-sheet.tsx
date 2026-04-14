'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FadeIn } from '@/components/ui/motion'
import { ClaimActivityTimeline } from '@/components/claims/claim-activity-timeline'
import { ClaimNotesTimeline } from '@/components/claims/claim-notes-timeline'
import { toast } from 'sonner'
import {
  getStatusColor,
  getStatusLabel,
  getConfidenceColor,
  getConfidenceBg,
  formatRelativeTime,
  formatDate,
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

// ─── Confidence Ring ─────────────────────────────────────────────────────────

function ConfidenceRing({ value, size = 64 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const strokeColor = value >= 80 ? '#059669' : value >= 60 ? '#D97706' : '#DC2626'
  const colorClass = getConfidenceColor(value)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={`absolute text-sm font-bold ${colorClass}`}>
        {value}%
      </span>
    </div>
  )
}

// ─── Info Card ────────────────────────────────────────────────────────────────

function InfoCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`glass-card card-depth-2 ${className || ''}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Icon className="size-3.5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {children}
      </CardContent>
    </Card>
  )
}

// ─── Info Field ───────────────────────────────────────────────────────────────

function InfoField({ label, value, quality }: { label: string; value: string | null | undefined; quality?: 'good' | 'warn' | 'missing' }) {
  const qualityColor = quality === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : quality === 'warn'
    ? 'text-amber-600 dark:text-amber-400'
    : quality === 'missing'
    ? 'text-red-400 dark:text-red-400'
    : 'text-foreground'

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-sm ${value ? qualityColor : 'text-muted-foreground/50'}`}>
        {value || '\u2014'}
      </span>
    </div>
  )
}

// ─── Expandable Card ─────────────────────────────────────────────────────────

function ExpandableCard({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card className="glass-card card-depth-2 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <FadeIn>
          <CardContent className="px-4 pb-4 pt-0">
            {children}
          </CardContent>
        </FadeIn>
      )}
    </Card>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`${getStatusColor(status)} text-xs font-medium`}>
      {getStatusLabel(status)}
    </Badge>
  )
}

// ─── Processing Stages ───────────────────────────────────────────────────────

const processingStages = [
  { key: 'RECEIVED', label: 'Received', icon: Mail },
  { key: 'CLASSIFIED', label: 'Classified', icon: Brain },
  { key: 'EXTRACTED', label: 'Extracted', icon: FileSearch },
  { key: 'FOLDER_CREATED', label: 'Folder Created', icon: FolderPlus },
  { key: 'DOCUMENTS_SAVED', label: 'Docs Saved', icon: FileText },
  { key: 'PRINTED', label: 'Printed', icon: Printer },
  { key: 'LOGGED', label: 'Logged', icon: ClipboardCheck },
  { key: 'RESPONDED', label: 'Responded', icon: Send },
]

function ProcessingStageIndicator({ currentStage }: { currentStage: string }) {
  const currentIndex = processingStages.findIndex((s) => s.key === currentStage)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Processing Stage
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {processingStages.map((stage, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const Icon = stage.icon

          return (
            <Tooltip key={stage.key}>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    isCompleted
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground/50 border border-transparent'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <Icon className="size-3" />
                  )}
                  <span className="hidden sm:inline">{stage.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" avoidCollisions>
                <p>{stage.label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / processingStages.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">
          {currentIndex + 1}/{processingStages.length}
        </span>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SheetSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="px-6 pt-6 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-32 font-mono" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
      <Separator />
      {/* Tabs skeleton */}
      <div className="px-6 py-2">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
      </div>
      <Separator />
      {/* Content skeleton */}
      <div className="flex-1 px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ claim }: { claim: Claim }) {
  const isMotor = claim.claimType === 'Motor'

  // Data quality helpers
  const emailQuality = claim.contactEmail ? 'good' : undefined
  const phoneQuality = claim.contactNumber ? 'good' : 'missing'
  const excessQuality = claim.excessAmount ? 'good' : 'missing'

  return (
    <div className="space-y-4">
      {/* Processing Stage */}
      <FadeIn delay={0.05}>
        <InfoCard title="Processing" icon={ClipboardCheck}>
          <ProcessingStageIndicator currentStage={claim.processingStage} />
        </InfoCard>
      </FadeIn>

      {/* Contact Info */}
      <FadeIn delay={0.1}>
        <InfoCard title="Contact Information" icon={Phone}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoField label="Email" value={claim.contactEmail} quality={emailQuality} />
            <InfoField label="Phone" value={claim.contactNumber} quality={phoneQuality} />
          </div>
        </InfoCard>
      </FadeIn>

      {/* Vehicle Details (Motor only) */}
      {isMotor && (
        <FadeIn delay={0.12}>
          <InfoCard title="Vehicle Details" icon={Car}>
            <div className="grid grid-cols-2 gap-3">
              <InfoField label="Make" value={claim.vehicleMake} quality={claim.vehicleMake ? 'good' : 'missing'} />
              <InfoField label="Model" value={claim.vehicleModel} quality={claim.vehicleModel ? 'good' : 'missing'} />
              <InfoField label="Year" value={claim.vehicleYear} quality={claim.vehicleYear ? 'good' : 'missing'} />
              <InfoField label="Registration" value={claim.vehicleRegistration} quality={claim.vehicleRegistration ? 'good' : 'missing'} />
            </div>
          </InfoCard>
        </FadeIn>
      )}

      {/* Claim Info */}
      <FadeIn delay={0.14}>
        <InfoCard title="Claim Details" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoField label="Claim Type" value={claim.claimType} />
            <InfoField label="Excess Amount" value={claim.excessAmount} quality={excessQuality} />
            <InfoField label="Insurance Company" value={claim.insuranceCompany?.name} />
            <InfoField label="Attachments" value={claim.attachmentsCount > 0 ? `${claim.attachmentsCount} file(s)` : 'None'} />
          </div>
        </InfoCard>
      </FadeIn>

      {/* Incident Description */}
      <FadeIn delay={0.16}>
        <ExpandableCard title="Incident Description" icon={AlertTriangle} defaultOpen={!!claim.incidentDescription}>
          {claim.incidentDescription ? (
            <p className="text-sm text-foreground leading-relaxed">
              {claim.incidentDescription}
            </p>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <AlertTriangle className="size-3.5 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No incident description recorded</p>
            </div>
          )}
        </ExpandableCard>
      </FadeIn>

      {/* Special Instructions */}
      {claim.specialInstructions && (
        <FadeIn delay={0.18}>
          <ExpandableCard title="Special Instructions" icon={AlertTriangle} defaultOpen>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {claim.specialInstructions}
            </p>
          </ExpandableCard>
        </FadeIn>
      )}

      {/* Folder Path */}
      {claim.folderPath && (
        <FadeIn delay={0.19}>
          <div className="flex items-center gap-2 px-1 py-2">
            <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Folder:</span>
            <span className="text-xs text-foreground font-mono truncate">{claim.folderPath}</span>
            <button
              className="ml-auto shrink-0 p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(claim.folderPath || '')
                toast.success('Folder path copied')
              }}
              title="Copy path"
            >
              <Copy className="size-3 text-muted-foreground" />
            </button>
          </div>
        </FadeIn>
      )}

      {/* AI Classification Info */}
      <FadeIn delay={0.2}>
        <InfoCard title="AI Classification" icon={Brain}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Classification Decision</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {claim.aiClassification || 'Not classified'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="size-3" />
              <span>Overall confidence: {claim.confidenceScore}%</span>
              {claim.verifiedByUser && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800 ml-auto">
                  <CheckCircle2 className="size-2.5 mr-0.5" />
                  Verified
                </Badge>
              )}
            </div>
            {claim.aiHintsUsed && (
              <p className="text-xs text-muted-foreground italic">
                AI hints: {claim.aiHintsUsed}
              </p>
            )}
          </div>
        </InfoCard>
      </FadeIn>

      {/* Timestamps */}
      <FadeIn delay={0.22}>
        <InfoCard title="Timestamps" icon={Clock}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Created</span>
              <span className="text-sm text-foreground">{formatRelativeTime(claim.createdAt)}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(claim.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Updated</span>
              <span className="text-sm text-foreground">{formatRelativeTime(claim.updatedAt)}</span>
              <span className="text-[10px] text-muted-foreground">{formatDate(claim.updatedAt)}</span>
            </div>
            {claim.processedAt && (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Processed</span>
                <span className="text-sm text-foreground">{formatDate(claim.processedAt)}</span>
              </div>
            )}
          </div>
        </InfoCard>
      </FadeIn>
    </div>
  )
}

// ─── Documents Placeholder Tab ────────────────────────────────────────────────

function DocumentsTab({ claim }: { claim: Claim }) {
  return (
    <div className="space-y-4">
      {claim.attachmentsCount > 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
          <Paperclip className="size-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {claim.attachmentsCount} attachment{claim.attachmentsCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Documents attached to this claim from the original email
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Paperclip className="size-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[240px]">
            Documents will appear here when they are processed from the claim email or uploaded manually.
          </p>
        </div>
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

  // Reset tab when claim changes via onOpenChange
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setActiveTab('overview')
    }
    onOpenChange(nextOpen)
  }

  // Quick process mutations
  const processMutation = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      fetch(`/api/claims/${claimId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (data) => {
      invalidateClaimData(queryClient)
      queryClient.invalidateQueries({ queryKey: ['claim-detail-sheet', claimId] })
      toast.success(data.message || 'Action completed')
    },
    onError: (err: Error) => {
      toast.error(`Failed: ${err.message}`)
    },
  })

  const quickActions = [
    { id: 'classify', label: 'Classify', icon: Brain },
    { id: 'extract', label: 'Extract', icon: FileSearch },
    { id: 'create_folder', label: 'Folder', icon: FolderPlus },
    { id: 'log', label: 'Log', icon: ClipboardCheck },
  ]

  if (!open) return null

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
        {/* ── Header ── */}
        <div className="shrink-0 border-b">
          {isLoading ? (
            <div className="px-6 pt-6 pb-4 space-y-2">
              <Skeleton className="h-6 w-32 font-mono" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : claim ? (
            <FadeIn>
              <SheetHeader className="px-6 pt-6 pb-0 space-y-3">
                <div className="flex items-start justify-between pr-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <SheetTitle className="font-mono text-lg text-foreground tracking-tight">
                      {claim.claimNumber}
                    </SheetTitle>
                    <StatusBadge status={claim.status} />
                  </div>
                </div>
                <SheetDescription className="text-sm text-foreground/80">
                  {claim.clientName}
                </SheetDescription>
                <div className="flex items-center gap-4 pb-3">
                  {/* Confidence Ring */}
                  <ConfidenceRing value={claim.confidenceScore} size={52} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {claim.insuranceCompany && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          <Building2 className="size-2.5 mr-0.5" />
                          {claim.insuranceCompany.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        <Shield className="size-2.5 mr-0.5" />
                        {claim.claimType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatRelativeTime(claim.createdAt)}
                      </span>
                      {claim.updatedAt !== claim.createdAt && (
                        <span className="flex items-center gap-1">
                          Updated {formatRelativeTime(claim.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>
            </FadeIn>
          ) : (
            <div className="px-6 pt-6 pb-4">
              <p className="text-sm text-red-500">Failed to load claim data</p>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
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
                  value="timeline"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Timeline
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-2"
                >
                  Documents
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto">
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
                <TabsContent value="timeline" className="mt-0">
                  <ClaimActivityTimeline claimId={claim.id} />
                </TabsContent>
                <TabsContent value="notes" className="mt-0">
                  <ClaimNotesTimeline claimId={claim.id} />
                </TabsContent>
                <TabsContent value="documents" className="mt-0">
                  <DocumentsTab claim={claim} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {claim && !isLoading && (
          <SheetFooter className="shrink-0 border-t bg-background px-6 py-3 flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => processMutation.mutate({ action: action.id })}
                        disabled={processMutation.isPending}
                      >
                        {processMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Icon className="size-3" />
                        )}
                        <span className="hidden sm:inline">{action.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" avoidCollisions>
                      <p>{action.label}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                const w = window.open(`/api/claims/${claim.id}/pdf`, '_blank')
                if (!w) toast.error('Pop-up blocked')
              }}
            >
              <FileText className="size-3" />
              PDF
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
