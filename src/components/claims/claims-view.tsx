'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateClaimData, invalidateAllAppData } from '@/lib/query-utils'
import {
  Search,
  Filter,
  X,
  Eye,
  Trash2,
  Calendar,
  MoreHorizontal,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Brain,
  FileDown,
  FolderPlus,
  Save,
  Printer,
  Send,
  RotateCcw,
  Plus,
  Download,
  CheckSquare,
  Square,
  ListChecks,
  Check,
  Mail,
  FileSearch,
  Building2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  ArrowUpDown,
  Pencil,
  Copy,
  MessageSquarePlus,
  Clock,
  ChevronDown,
  LayoutGrid,
  List,
  AlertTriangle,
  CalendarClock,
  Star,
  DollarSign,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { FadeIn } from '@/components/ui/motion'
import { ErrorRetry } from '@/components/ui/error-retry'
import { useClaimsStore } from '@/store/claims-store'
import {
  getStatusColor,
  getStatusLabel,
  getConfidenceColor,
  getConfidenceBg,
  formatDate,
} from '@/lib/helpers'
import { ClaimsKanban } from '@/components/claims/claims-kanban'
import { ClaimDetailPanel } from '@/components/claims/claim-detail-panel'
import { ClaimNotesTimeline } from '@/components/claims/claim-notes-timeline'
import { ClaimStatusTimeline } from '@/components/claims/claim-status-timeline'
import { ClaimActivityTimeline } from '@/components/claims/claim-activity-timeline'
import { ClaimDetailSheet } from '@/components/claims/claim-detail-sheet'
import { QuickFilterBar, type QuickFilterType } from '@/components/claims/quick-filter-bar'
import { PrintClaimButton } from '@/components/claims/print-claim-dialog'
import { toast } from 'sonner'

const statuses = ['ALL', 'NEW', 'PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'PENDING_REVIEW']
const claimTypes = ['ALL', 'Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability']

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
  auditLogs?: {
    id: string
    action: string
    details: string | null
    status: string
    processedBy: string | null
    createdAt: string
  }[]
  printQueueItems?: {
    id: string
    fileName: string
    printStatus: string
    printedAt: string | null
    createdAt: string
  }[]
}

interface ClaimsResponse {
  claims: Claim[]
  total: number
  page: number
  totalPages: number
}

interface InsuranceCompany {
  id: string
  name: string
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`${getStatusColor(status)} text-xs font-medium`}>
      {getStatusLabel(status)}
    </Badge>
  )
}

const quickStatuses = ['NEW', 'PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'PENDING_REVIEW']

function StatusDropdownBadge({ claimId, status }: { claimId: string; status: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      fetch(`/api/claims/${claimId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (_data, newStatus) => {
      invalidateClaimData(queryClient)
      toast.success(`Status updated to ${getStatusLabel(newStatus)}`)
      setOpen(false)
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 cursor-pointer group rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          <Badge
            variant="outline"
            className={`${getStatusColor(status)} text-xs font-medium transition-all group-hover:opacity-80`}
          >
            {getStatusLabel(status)}
          </Badge>
          <ChevronDown className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {quickStatuses.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={(e) => {
              e.stopPropagation()
              if (s !== status) {
                updateStatusMutation.mutate(s)
              }
            }}
            className={s === status ? 'bg-muted font-medium' : ''}
          >
            <Badge variant="outline" className={`${getStatusColor(s)} text-[10px] mr-2`}>
              {getStatusLabel(s)}
            </Badge>
            {s === status && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ConfidenceBadge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getConfidenceBg(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${getConfidenceColor(score)}`}>
        {score}%
      </span>
    </div>
  )
}

const processingStages = [
  { key: 'RECEIVED', label: 'Received', icon: Mail },
  { key: 'CLASSIFIED', label: 'Classified', icon: Brain },
  { key: 'EXTRACTED', label: 'Extracted', icon: FileSearch },
  { key: 'FOLDER_CREATED', label: 'Folder Created', icon: Building2 },
  { key: 'DOCUMENTS_SAVED', label: 'Docs Saved', icon: FolderPlus },
  { key: 'PRINTED', label: 'Printed', icon: Printer },
  { key: 'LOGGED', label: 'Logged', icon: ClipboardCheck },
  { key: 'RESPONDED', label: 'Responded', icon: Send },
]

function ProcessingTimeline({ currentStage }: { currentStage: string }) {
  const currentIndex = processingStages.findIndex((s) => s.key === currentStage)

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Processing Progress
      </p>
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {processingStages.map((stage, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex
          const Icon = stage.icon

          return (
            <React.Fragment key={stage.key}>
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={`h-0.5 w-4 sm:w-6 shrink-0 transition-colors ${
                    index <= currentIndex
                      ? 'bg-primary'
                      : 'bg-border'
                  }`}
                />
              )}
              {/* Stage node */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`flex items-center justify-center size-7 sm:size-8 rounded-full border-2 shrink-0 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary ring-2 ring-primary/20'
                      : 'bg-muted border-border text-muted-foreground/50'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3.5 sm:size-4" strokeWidth={3} />
                  ) : (
                    <Icon className="size-3 sm:size-3.5" />
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-xs leading-tight text-center max-w-[56px] sm:max-w-[72px] truncate ${
                    isCurrent
                      ? 'font-semibold text-primary'
                      : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground/50'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function ClaimDocumentsList({ claimId, attachmentsCount }: { claimId: string; attachmentsCount: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['claim-documents', claimId],
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
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
        <Paperclip className="size-5 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          {attachmentsCount > 0
            ? `${attachmentsCount} attachment${attachmentsCount !== 1 ? 's' : ''} detected from email`
            : 'No attachments recorded for this claim'}
        </p>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    QUEUED: 'text-amber-600 dark:text-amber-400',
    PRINTING: 'text-blue-600 dark:text-blue-400',
    COMPLETED: 'text-emerald-600 dark:text-emerald-400',
    FAILED: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
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
      ))}
    </div>
  )
}

function ClaimDetailDialog({
  claim,
  open,
  onOpenChange,
}: {
  claim: Claim | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [activeDetailTab, setActiveDetailTab] = useState('overview')
  const [localNotes, setLocalNotes] = useState(claim?.notes || '')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteType, setNewNoteType] = useState('General')

  React.useEffect(() => {
    if (claim) {
      setLocalNotes(claim.notes || '')
      setIsEditing(false)
      setEditData({})
      setNewNoteText('')
      setNewNoteType('General')
    }
  }, [claim])

  // Fetch rich notes from API
  const { data: richNotesData, refetch: refetchNotes } = useQuery({
    queryKey: ['claim-notes', claim?.id],
    queryFn: () => fetch(`/api/claims/${claim?.id}/notes`).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    enabled: !!claim?.id,
    retry: 2,
    retryDelay: 1000,
  })

  const richNotes = richNotesData?.notes || []

  const noteTypeColors: Record<string, string> = {
    General: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
    'Follow-up': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    Decision: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    'Document Request': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
    Internal: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
  }

  const processMutation = useMutation({
    mutationFn: ({ action, notes }: { action: string; notes?: string }) =>
      fetch(`/api/claims/${claim?.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (data) => {
      invalidateAllAppData(queryClient)
      toast.success(data.message || `Claim processed: ${data.processingStage || 'success'}`)
      if (data.claim?.status === 'COMPLETED' || data.claim?.status === 'FAILED') {
        onOpenChange(false)
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to process claim: ${err.message}`)
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: ({ content, type }: { content: string; type: string }) =>
      fetch(`/api/claims/${claim?.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      refetchNotes()
    },
  })

  const togglePinMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/claims/${claim?.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      refetchNotes()
    },
  })

  const handleAddNote = () => {
    if (!newNoteText.trim()) return
    addNoteMutation.mutate({ content: newNoteText.trim(), type: newNoteType }, {
      onSuccess: () => {
        setNewNoteText('')
        toast.success('Note added successfully')
      },
      onError: () => {
        toast.error('Failed to add note')
      },
    })
  }

  const saveNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      fetch(`/api/claims/${claim?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
    },
  })

  const saveClaimMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch(`/api/claims/${claim?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      toast.success(`Claim ${claim?.claimNumber} updated successfully`)
      invalidateClaimData(queryClient)
      setIsEditing(false)
      setEditData({})
    },
    onError: () => {
      toast.error('Failed to update claim')
    },
  })

  const handleEditToggle = () => {
    if (isEditing) {
      setIsEditing(false)
      setEditData({})
    } else {
      setIsEditing(true)
      if (claim) {
        setEditData({
          clientName: claim.clientName,
          claimType: claim.claimType,
          status: claim.status,
          contactNumber: claim.contactNumber || '',
          contactEmail: claim.contactEmail || '',
          excessAmount: claim.excessAmount || '',
          specialInstructions: claim.specialInstructions || '',
        })
      }
    }
  }

  const handleSaveChanges = () => {
    if (!claim) return
    saveClaimMutation.mutate(editData)
  }

  const updateEditField = (key: string, value: string) => {
    setEditData((prev) => ({ ...prev, [key]: value }))
  }

  if (!claim) return null

  const fields: { label: string; value: string | null | undefined; editable?: boolean; editKey?: string }[] = [
    { label: 'Claim Number', value: claim.claimNumber },
    { label: 'Client Name', value: claim.clientName, editable: true, editKey: 'clientName' },
    { label: 'Insurance Company', value: claim.insuranceCompany?.name },
    { label: 'Claim Type', value: claim.claimType, editable: true, editKey: 'claimType' },
    { label: 'Status', value: getStatusLabel(claim.status), editable: true, editKey: 'status' },
    { label: 'Processing Stage', value: claim.processingStage },
    { label: 'Sender Email', value: claim.senderEmail },
    { label: 'Email Subject', value: claim.emailSubject },
    { label: 'Contact Number', value: claim.contactNumber, editable: true, editKey: 'contactNumber' },
    { label: 'Contact Email', value: claim.contactEmail, editable: true, editKey: 'contactEmail' },
    { label: 'Excess Amount', value: claim.excessAmount, editable: true, editKey: 'excessAmount' },
    { label: 'Special Instructions', value: claim.specialInstructions, editable: true, editKey: 'specialInstructions' },
    { label: 'Folder Path', value: claim.folderPath },
    { label: 'AI Classification', value: claim.aiClassification },
    { label: 'Classification Confidence', value: `${claim.aiClassificationConfidence}%` },
    { label: 'Created At', value: formatDate(claim.createdAt) },
    { label: 'Processed At', value: claim.processedAt ? formatDate(claim.processedAt) : null },
  ]

  const actions = [
    { id: 'classify', label: 'Classify', icon: Brain },
    { id: 'extract', label: 'Extract Data', icon: FileDown },
    { id: 'create_folder', label: 'Create Folder', icon: FolderPlus },
    { id: 'save_documents', label: 'Save Documents', icon: Save },
    { id: 'print', label: 'Print', icon: Printer },
    { id: 'log', label: 'Log to System', icon: ClipboardCheck },
    { id: 'respond', label: 'Send Reply', icon: Send },
    { id: 'approve', label: 'Approve', icon: Check },
    { id: 'reject', label: 'Reject', icon: AlertTriangle },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="shrink-0 bg-background border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{claim.claimNumber}</span>
              <StatusBadge status={claim.status} />
              {richNotes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                  {richNotes.length} note{richNotes.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {isEditing && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border border-amber-200">
                  Editing
                </Badge>
              )}
              <span className="text-sm font-normal text-muted-foreground">
                {claim.clientName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 ml-auto"
                onClick={handleEditToggle}
              >
                <Pencil className="size-3.5" />
              </Button>
            </DialogTitle>
          </DialogHeader>
        </div>

        <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 border-b px-6">
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Overview
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Email
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              {claim.claimType === 'Motor' ? 'Vehicle Details' : 'Property Details'}
            </TabsTrigger>
            <TabsTrigger value="attachments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Attachments
            </TabsTrigger>
            <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Documents
            </TabsTrigger>
            <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Notes
              {richNotes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/20">
                  {richNotes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="print" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Print History
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
        <TabsContent value="overview" className="pt-4 px-6">
            {/* Processing Timeline */}
            <ProcessingTimeline currentStage={claim.processingStage} />
            <Separator className="my-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {field.label}
                  </span>
                  <span className="text-sm text-foreground">
                    {field.value || '—'}
                  </span>
                </div>
              ))}
            </div>

            {claim.incidentDescription && (
              <>
                <Separator className="my-4" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Incident Description
                  </span>
                  <p className="text-sm text-foreground mt-1">
                    {claim.incidentDescription}
                  </p>
                </div>
              </>
            )}

            <Separator className="my-4" />

            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Notes
              </span>
              <ScrollArea className="max-h-[240px] mt-2">
                <div className="space-y-2">
                  {richNotes.length > 0 ? (
                    richNotes.map((note) => (
                      <div key={note.id} className={`flex items-start gap-3 p-2.5 rounded-lg ${note.pinned ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20'}`}>
                        <div className="mt-0.5 size-2 rounded-full shrink-0 bg-primary/50" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-2.5" />
                              {new Date(note.timestamp).toLocaleString('en-ZA', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                            <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${noteTypeColors[note.type] || ''}`}>
                              {note.type}
                            </Badge>
                            {note.pinned && (
                              <span className="text-amber-500" title="Pinned">
                                <svg className="size-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.828 3.684l1.95-1.95a3.5 3.5 0 114.95 4.95l-1.95 1.95a.5.5 0 01-.708 0l-3.34-3.34a.5.5 0 010-.708l-.707-.707 1.95-1.95a1.5 1.5 0 112.12 2.122l-1.95 1.95a.5.5 0 01-.708 0L9.12 5.758a.5.5 0 010-.708l.707-.707z" /></svg>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-0.5">{note.text}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePinMutation.mutate(note.id)
                          }}
                          className={`shrink-0 p-1 rounded hover:bg-muted/80 transition-colors ${note.pinned ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                          title={note.pinned ? 'Unpin note' : 'Pin note'}
                        >
                          <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.828 3.684l1.95-1.95a3.5 3.5 0 114.95 4.95l-1.95 1.95a.5.5 0 01-.708 0l-3.34-3.34a.5.5 0 010-.708l-.707-.707 1.95-1.95a1.5 1.5 0 112.12 2.122l-1.95 1.95a.5.5 0 01-.708 0L9.12 5.758a.5.5 0 010-.708l.707-.707z" /></svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-3">No notes yet.</p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <div className="flex gap-1">
                    {['General', 'Follow-up', 'Decision', 'Document Request', 'Internal'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewNoteType(type)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                          newNoteType === type
                            ? noteTypeColors[type] + ' ring-1 ring-offset-1 ring-current'
                            : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Textarea
                    className="min-h-[60px] flex-1"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add a note..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddNote()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={addNoteMutation.isPending || !newNoteText.trim()}
                  >
                    <MessageSquarePlus className="size-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="email" className="pt-4 px-6">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Incoming Email</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">From:</span>
                    <p className="font-medium">{claim.senderEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">To:</span>
                    <p className="font-medium">claims@stefco-assess.co.za</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Subject:</span>
                    <p className="font-medium">{claim.emailSubject || 'No Subject'}</p>
                  </div>
                </div>
                <Separator />
                <div className="bg-background rounded-lg p-4 text-sm text-muted-foreground min-h-[120px]">
                  <p>Good day,</p>
                  <p className="mt-2">I would like to submit a claim for the above-referenced incident. Please find attached all relevant documentation including photos of the damage, the claim form, and the insurance policy schedule.</p>
                  <p className="mt-2">Should you require any additional information, please do not hesitate to contact me.</p>
                  <p className="mt-2">Kind regards,<br />{claim.clientName}<br />{claim.contactNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="pt-4 px-6">
            {claim.claimType === 'Motor' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { label: 'Vehicle Make', value: claim.vehicleMake },
                  { label: 'Vehicle Model', value: claim.vehicleModel },
                  { label: 'Vehicle Year', value: claim.vehicleYear },
                  { label: 'Registration', value: claim.vehicleRegistration },
                ].map((field) => (
                  <div key={field.label} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {field.label}
                    </span>
                    <span className="text-sm text-foreground">
                      {field.value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : claim.claimType === 'Building' ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Property Address
                </span>
                <span className="text-sm text-foreground">
                  {claim.propertyAddress || '—'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No specific details available for this claim type.
              </p>
            )}
          </TabsContent>

          <TabsContent value="attachments" className="pt-4 px-6">
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
              <Paperclip className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {claim.attachmentsCount} attachment(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Documents attached to this claim
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="pt-4 px-6">
            <ClaimDocumentsList claimId={claim.id} attachmentsCount={claim.attachmentsCount} />
          </TabsContent>

          <TabsContent value="notes" className="pt-4 px-6">
            <ClaimNotesTimeline claimId={claim.id} />
          </TabsContent>

          <TabsContent value="audit" className="pt-4 px-6">
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {claim.auditLogs && claim.auditLogs.length > 0 ? (
                  claim.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div
                        className={`mt-0.5 size-2 rounded-full shrink-0 ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : log.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {log.action}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.processedBy || 'SYSTEM'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.details}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No audit logs for this claim.
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline" className="pt-4 px-6">
            <div className="rounded-lg border bg-muted/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Full Claim Timeline</span>
                <span className="text-xs text-muted-foreground ml-auto">Complete history of this claim</span>
              </div>
              <ClaimActivityTimeline claimId={claim.id} />
            </div>
          </TabsContent>

          <TabsContent value="print" className="pt-4 px-6">
            <ScrollArea className="max-h-[300px]">
              {claim.printQueueItems && claim.printQueueItems.length > 0 ? (
                <div className="space-y-3">
                  {claim.printQueueItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <Printer className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={item.printStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No print history for this claim.
                </p>
              )}
            </ScrollArea>
          </TabsContent>
        </div>
        </Tabs>

        <div className="shrink-0 bg-background border-t px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => processMutation.mutate({ action: action.id })}
                    disabled={processMutation.isPending}
                  >
                    <Icon className="size-3.5" />
                    {action.label}
                  </Button>
                )
              })}
              <Separator orientation="vertical" className="h-6 mx-1" />
              <PrintClaimButton claimId={claim.id} claimNumber={claim.claimNumber} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const btn = document.querySelector<HTMLButtonElement>('[data-pdf-btn]')
                  if (btn) btn.disabled = true
                  const w = window.open(`/api/claims/${claim.id}/pdf`, '_blank')
                  if (w) {
                    w.addEventListener('load', () => {
                      const btn = document.querySelector<HTMLButtonElement>('[data-pdf-btn]')
                      if (btn) btn.disabled = false
                    })
                    setTimeout(() => {
                      const btn = document.querySelector<HTMLButtonElement>('[data-pdf-btn]')
                      if (btn) btn.disabled = false
                    }, 5000)
                  } else {
                    const btn = document.querySelector<HTMLButtonElement>('[data-pdf-btn]')
                    if (btn) btn.disabled = false
                  }
                }}
                data-pdf-btn
              >
                <FileText className="size-3.5" />
                Download PDF
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!window.confirm(`Are you sure you want to delete claim ${claim.claimNumber}? This action cannot be undone.`)) return
                fetch(`/api/claims/${claim.id}`, { method: 'DELETE' })
                  .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
                  .then((res) => {
                    if (res.error) {
                      toast.error(res.error)
                      return
                    }
                    toast.success(`Claim ${claim.claimNumber} deleted successfully`)
                    invalidateClaimData(queryClient)
                    onOpenChange(false)
                  })
                  .catch(() => toast.error('Failed to delete claim'))
              }}
            >
              <Trash2 className="size-3.5" />
              Delete Claim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NewClaimDialog({
  open,
  onOpenChange,
  insuranceCompanies,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  insuranceCompanies: InsuranceCompany[]
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    claimNumber: '',
    clientName: '',
    claimType: '',
    insuranceCompanyId: '',
    status: 'NEW',
    contactNumber: '',
    contactEmail: '',
    incidentDescription: '',
    excessAmount: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setFormData({
      claimNumber: '',
      clientName: '',
      claimType: '',
      insuranceCompanyId: '',
      status: 'NEW',
      contactNumber: '',
      contactEmail: '',
      incidentDescription: '',
      excessAmount: '',
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.claimNumber.trim() || !formData.clientName.trim() || !formData.claimType) {
      toast.error('Please fill in all required fields (Claim Number, Client Name, Claim Type)')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        claimNumber: formData.claimNumber.trim(),
        clientName: formData.clientName.trim(),
        claimType: formData.claimType,
        status: formData.status,
      }

      if (formData.insuranceCompanyId) {
        payload.insuranceCompanyId = formData.insuranceCompanyId
      }
      if (formData.contactNumber.trim()) {
        payload.contactNumber = formData.contactNumber.trim()
      }
      if (formData.contactEmail.trim()) {
        payload.contactEmail = formData.contactEmail.trim()
      }
      if (formData.incidentDescription.trim()) {
        payload.incidentDescription = formData.incidentDescription.trim()
      }
      if (formData.excessAmount.trim()) {
        payload.excessAmount = formData.excessAmount.trim()
      }

      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create claim')
        return
      }

      toast.success(`Claim ${formData.claimNumber} created successfully`)
      invalidateClaimData(queryClient)
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, queryClient, onOpenChange, resetForm])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5" />
            New Claim
          </DialogTitle>
          <DialogDescription>
            Create a new claim manually. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
        {/* Claim Templates */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="size-3" />
            Quick Templates
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, claimType: 'Motor', excessAmount: '2500' }))}
              className={`group flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all duration-200 cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm btn-press ${
                formData.claimType === 'Motor' && formData.excessAmount === '2500'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                  : 'border-border bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-950/50 dark:to-sky-950/30 group-hover:scale-110 transition-transform">
                <svg className="size-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M12 17h.01M16 17h.01M3 11l1.5-5A2 2 0 016.4 4h11.2a2 2 0 011.9 1.4L21 11M3 11v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 11h18" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">Motor Vehicle</span>
              <span className="text-[10px] text-muted-foreground">Excess: R2,500</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, claimType: 'Building', excessAmount: '1500' }))}
              className={`group flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all duration-200 cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm btn-press ${
                formData.claimType === 'Building' && formData.excessAmount === '1500'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                  : 'border-border bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/50 dark:to-emerald-950/30 group-hover:scale-110 transition-transform">
                <svg className="size-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5h4v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">Property Damage</span>
              <span className="text-[10px] text-muted-foreground">Excess: R1,500</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, claimType: 'Household', excessAmount: '500' }))}
              className={`group flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all duration-200 cursor-pointer hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm btn-press ${
                formData.claimType === 'Household' && formData.excessAmount === '500'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                  : 'border-border bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/50 dark:to-amber-950/30 group-hover:scale-110 transition-transform">
                <svg className="size-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-foreground leading-tight">Glass Replacement</span>
              <span className="text-[10px] text-muted-foreground">Excess: R500</span>
            </button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="claimNumber">
                Claim Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="claimNumber"
                placeholder="e.g. STF-2024-001"
                value={formData.claimNumber}
                onChange={(e) => setFormData({ ...formData, claimNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="clientName"
                placeholder="e.g. John van der Merwe"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="claimType">
                Claim Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.claimType}
                onValueChange={(v) => setFormData({ ...formData, claimType: v })}
              >
                <SelectTrigger id="claimType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {claimTypes.filter((t) => t !== 'ALL').map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceCompany">Insurance Company</Label>
              <Select
                value={formData.insuranceCompanyId}
                onValueChange={(v) => setFormData({ ...formData, insuranceCompanyId: v })}
              >
                <SelectTrigger id="insuranceCompany">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(insuranceCompanies) && insuranceCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.filter((s) => s !== 'ALL').map((s) => (
                    <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excessAmount">Excess Amount</Label>
              <Input
                id="excessAmount"
                placeholder="e.g. R2,500.00"
                value={formData.excessAmount}
                onChange={(e) => setFormData({ ...formData, excessAmount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input
                id="contactNumber"
                placeholder="+27 82 123 4567"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="client@example.co.za"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incidentDescription">Incident Description</Label>
            <Textarea
              id="incidentDescription"
              className="min-h-[100px]"
              placeholder="Describe the incident..."
              value={formData.incidentDescription}
              onChange={(e) => setFormData({ ...formData, incidentDescription: e.target.value })}
            />
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onOpenChange(false)
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="btn-press hover:bg-primary/90">
            {isSubmitting ? 'Creating...' : 'Create Claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useLastUpdated(dataUpdatedAt?: number) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(id)
  }, [])
  // tick is referenced to ensure re-render on interval; suppressed intentionally
  void tick
  if (!dataUpdatedAt) return '—'
  const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function ClaimsView() {
  const filters = useClaimsStore((s) => s.filters)
  const setFilter = useClaimsStore((s) => s.setFilter)
  const clearFilters = useClaimsStore((s) => s.clearFilters)
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>([])
  const selectedClaimId = useClaimsStore((s) => s.selectedClaimId)
  const setSelectedClaimId = useClaimsStore((s) => s.setSelectedClaimId)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sheetClaimId, setSheetClaimId] = useState<string | null>(null)
  const showNewClaimDialog = useClaimsStore((s) => s.showNewClaimDialog)
  const setShowNewClaimDialog = useClaimsStore((s) => s.setShowNewClaimDialog)
  const [newClaimOpen, setNewClaimOpen] = useState(false)

  // Sync store → local state so dashboard "New Claim" button auto-opens dialog
  React.useEffect(() => {
    if (showNewClaimDialog) {
      setNewClaimOpen(true)
      setShowNewClaimDialog(false)
    }
  }, [showNewClaimDialog, setShowNewClaimDialog])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('stefco-claims-view-mode') as 'table' | 'kanban') || 'table'
    }
    return 'table'
  })

  const handleViewModeChange = (mode: 'table' | 'kanban') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('stefco-claims-view-mode', mode)
    }
  }

  const [localStatus, setLocalStatus] = useState(filters.status || 'ALL')
  const [localType, setLocalType] = useState(filters.claimType || 'ALL')
  const [localCompany, setLocalCompany] = useState(filters.insuranceCompany || 'ALL')
  const [localSearch, setLocalSearch] = useState(filters.search || '')
  const [localDateFrom, setLocalDateFrom] = useState('')
  const [localDateTo, setLocalDateTo] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterType | null>(null)

  const datePresets = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
  ]

  const applyDatePreset = useCallback((preset: string) => {
    setDatePreset(preset)
    const now = new Date()
    let from = ''
    let to = ''
    switch (preset) {
      case 'today': {
        from = now.toISOString().split('T')[0]
        to = from
        break
      }
      case 'week': {
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        from = monday.toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        break
      }
      case 'month': {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        break
      }
      case '30': {
        const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        from = d.toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        break
      }
      case '90': {
        const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        from = d.toISOString().split('T')[0]
        to = now.toISOString().split('T')[0]
        break
      }
      default: {
        from = ''
        to = ''
        break
      }
    }
    setLocalDateFrom(from)
    setLocalDateTo(to)
    setPage(1)
  }, [])

  const queryClient = useQueryClient()

  const { data: insuranceData } = useQuery<{ companies: InsuranceCompany[] }>({
    queryKey: ['insurance-companies'],
    queryFn: () => fetch('/api/insurance').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    retryDelay: 1000,
  })
  const insuranceCompanies = insuranceData?.companies

  const { data, isLoading, error, dataUpdatedAt, refetch: refetchClaims } = useQuery<ClaimsResponse>({
    queryKey: ['claims', page, localStatus, localType, localSearch, localCompany, localDateFrom, localDateTo, activeQuickFilter, refreshKey],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (localStatus !== 'ALL') params.set('status', localStatus)
      if (localType !== 'ALL') params.set('claimType', localType)
      if (localSearch) params.set('search', localSearch)
      if (localCompany !== 'ALL') params.set('insuranceCompany', localCompany)
      if (localDateFrom) params.set('dateFrom', localDateFrom)
      if (localDateTo) params.set('dateTo', localDateTo)
      // Apply quick filter params
      if (activeQuickFilter === 'urgent') params.set('confidenceMax', '60')
      if (activeQuickFilter === 'recent') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        params.set('dateFrom', sevenDaysAgo)
      }
      if (activeQuickFilter === 'stale') params.set('staleDays', '30')
      if (activeQuickFilter === 'watchlist') {
        try {
          const stored = localStorage.getItem('stefco-starred-claims')
          if (stored) {
            const ids = JSON.parse(stored)
            if (Array.isArray(ids) && ids.length > 0) {
              params.set('claimIds', ids.join(','))
            }
          }
        } catch { /* ignore */ }
      }
      if (activeQuickFilter === 'needsAttention') params.set('needsAttention', 'true')
      if (activeQuickFilter === 'verified') params.set('verifiedByUser', 'true')
      return fetch(`/api/claims?${params}`).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
    },
    refetchInterval: 30000,
    staleTime: 5000,
    retry: 3,
    retryDelay: 2000,
  })

  const lastUpdatedText = useLastUpdated(dataUpdatedAt)

  const handleSearch = (value: string) => {
    setLocalSearch(value)
    setFilter('search', value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setLocalStatus(value)
    setFilter('status', value)
    setPage(1)
  }

  const handleTypeChange = (value: string) => {
    setLocalType(value)
    setFilter('claimType', value)
    setPage(1)
  }

  const handleCompanyChange = (value: string) => {
    setLocalCompany(value)
    setFilter('insuranceCompany', value)
    setPage(1)
  }

  const handleClearFilters = () => {
    setLocalStatus('ALL')
    setLocalType('ALL')
    setLocalCompany('ALL')
    setLocalSearch('')
    setLocalDateFrom('')
    setLocalDateTo('')
    setDatePreset('all')
    clearFilters()
    setPage(1)
  }

  const handleClaimClick = useCallback((claim: Claim) => {
    setSelectedClaim(claim)
    setDetailOpen(true)
    setSelectedClaimId(claim.id)
  }, [setSelectedClaimId])

  const handleClaimSheetOpen = useCallback((claim: Claim) => {
    setSheetClaimId(claim.id)
  }, [])

  // Keyboard shortcut: D when a claim is selected opens sheet
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'd' || e.key === 'D') {
        // Only trigger if not typing in an input
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (!selectedClaim && !selectedClaimId) return
        // Open sheet for the selected claim
        const id = sheetClaimId || selectedClaimId || selectedClaim?.id
        if (id) {
          e.preventDefault()
          setSheetClaimId(id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClaim, selectedClaimId, sheetClaimId])

  // Export CSV handler
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', 'csv')
      if (localStatus !== 'ALL') params.set('status', localStatus)
      if (localType !== 'ALL') params.set('claimType', localType)
      if (localSearch) params.set('search', localSearch)
      if (localCompany !== 'ALL') params.set('insuranceCompany', localCompany)
      if (localDateFrom) params.set('dateFrom', localDateFrom)
      if (localDateTo) params.set('dateTo', localDateTo)

      const response = await fetch(`/api/claims/export?${params.toString()}`)
      if (!response.ok) {
        toast.error('Failed to export CSV')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      link.href = url
      link.download = `claims_export_${dateStr}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch {
      toast.error('Failed to export CSV')
    } finally {
      setIsExporting(false)
    }
  }, [localStatus, localType, localSearch, localCompany, localDateFrom, localDateTo])

  // Export PDF handler
  const [isPdfExporting, setIsPdfExporting] = useState(false)

  const handleExportPdf = useCallback(async () => {
    setIsPdfExporting(true)
    try {
      const params = new URLSearchParams()
      if (localStatus !== 'ALL') params.set('status', localStatus)
      if (localType !== 'ALL') params.set('claimType', localType)
      if (localSearch) params.set('search', localSearch)
      if (localCompany !== 'ALL') params.set('insuranceCompany', localCompany)
      if (localDateFrom) params.set('dateFrom', localDateFrom)
      if (localDateTo) params.set('dateTo', localDateTo)

      const response = await fetch(`/api/claims/pdf-report?${params.toString()}`)
      if (!response.ok) {
        toast.error('Failed to export PDF report')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      link.href = url
      link.download = `STF-Claims_Summary_${dateStr}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF report exported successfully')
    } catch {
      toast.error('Failed to export PDF report')
    } finally {
      setIsPdfExporting(false)
    }
  }, [localStatus, localType, localSearch, localCompany, localDateFrom, localDateTo])

  // Checkbox handlers
  const toggleSelectAll = useCallback(() => {
    const claims = data?.claims || []
    if (selectedIds.size === claims.length && claims.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(claims.map((c) => c.id)))
    }
  }, [data?.claims, selectedIds.size])

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Bulk action handler
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('PROCESSING')

  const handleBulkStatusChange = useCallback(async () => {
    if (selectedIds.size === 0 || !bulkStatus) return
    setBulkActionLoading(true)

    try {
      let successCount = 0
      let failCount = 0

      const promises = Array.from(selectedIds).map(async (id) => {
        try {
          const res = await fetch(`/api/claims/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: bulkStatus }),
          })
          if (res.ok) successCount++
          else failCount++
        } catch {
          failCount++
        }
      })

      await Promise.all(promises)

      invalidateAllAppData(queryClient)
      setSelectedIds(new Set())

      if (failCount === 0) {
        toast.success(`${successCount} claim(s) status updated to ${getStatusLabel(bulkStatus)}`)
      } else {
        toast.warning(`${successCount} updated, ${failCount} failed`)
      }
    } catch {
      toast.error('Bulk status change failed')
    } finally {
      setBulkActionLoading(false)
    }
  }, [selectedIds, bulkStatus, queryClient])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} claim(s)? This action cannot be undone.`)) return

    setBulkActionLoading(true)

    try {
      let successCount = 0
      let failCount = 0

      const promises = Array.from(selectedIds).map(async (id) => {
        try {
          const res = await fetch(`/api/claims/${id}`, { method: 'DELETE' })
          if (res.ok) successCount++
          else failCount++
        } catch {
          failCount++
        }
      })

      await Promise.all(promises)

      invalidateAllAppData(queryClient)
      setSelectedIds(new Set())

      if (failCount === 0) {
        toast.success(`${successCount} claim(s) deleted successfully`)
      } else {
        toast.warning(`${successCount} deleted, ${failCount} failed`)
      }
    } catch {
      toast.error('Bulk delete failed')
    } finally {
      setBulkActionLoading(false)
    }
  }, [selectedIds, queryClient])

  const columns: ColumnDef<Claim>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => {
          const claims = data?.claims || []
          const allSelected = claims.length > 0 && selectedIds.size === claims.length
          const someSelected = selectedIds.size > 0 && selectedIds.size < claims.length
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSelectAll()
              }}
              className="flex items-center justify-center"
              aria-label="Select all"
            >
              {allSelected ? (
                <CheckSquare className="size-4 text-primary" />
              ) : someSelected ? (
                <div className="relative">
                  <Square className="size-4 text-muted-foreground" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-2 rounded-sm bg-primary/60" />
                  </div>
                </div>
              ) : (
                <Square className="size-4 text-muted-foreground" />
              )}
            </button>
          )
        },
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleSelectRow(row.original.id)
            }}
            className="flex items-center justify-center"
            aria-label={`Select ${row.original.claimNumber}`}
          >
            {selectedIds.has(row.original.id) ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
          </button>
        ),
        size: 40,
        maxSize: 40,
      },
      {
        accessorKey: 'claimNumber',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Claim #
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const claim = row.original
          return (
            <div className="flex items-center gap-1.5 min-w-0">
              {claim.needsAttention && !claim.verifiedByUser && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Needs Attention
                  </TooltipContent>
                </Tooltip>
              )}
              {claim.verifiedByUser && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Verified
                  </TooltipContent>
                </Tooltip>
              )}
              {claim.aiHintsUsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Brain className="size-3 shrink-0 text-primary/50" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    AI learning patterns applied
                  </TooltipContent>
                </Tooltip>
              )}
              <span className="font-medium text-foreground table-cell-truncate">
                {claim.claimNumber}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'clientName',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Client
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="hidden sm:table-cell table-cell-truncate">{row.getValue('clientName')}</span>
        ),
      },
      {
        accessorKey: 'claimType',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Type
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="hidden md:table-cell">{row.getValue('claimType')}</span>
        ),
      },
      {
        accessorKey: 'status',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <StatusDropdownBadge
            claimId={row.original.id}
            status={row.getValue('status')}
          />
        ),
      },
      {
        accessorKey: 'insuranceCompany',
        header: 'Insurance Co.',
        cell: ({ row }) => (
          <span className="text-muted-foreground hidden lg:table-cell">
            {row.original.insuranceCompany?.name || 'N/A'}
          </span>
        ),
      },
      {
        accessorKey: 'attachmentsCount',
        header: 'Docs',
        cell: ({ row }) => (
          <span className="hidden xl:table-cell text-muted-foreground flex items-center gap-1">
            <Paperclip className="size-3" />
            {row.getValue('attachmentsCount')}
          </span>
        ),
      },
      {
        accessorKey: 'confidenceScore',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Confidence
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="hidden lg:table-cell">
            <ConfidenceBadge score={row.getValue('confidenceScore')} />
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        enableSorting: true,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date
            <ArrowUpDown className="ml-1 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs hidden xl:table-cell table-cell-truncate">
            {formatDate(row.getValue('createdAt'))}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleClaimClick(row.original)}>
                <Eye className="size-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  fetch(`/api/claims/${row.original.id}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'classify' }),
                  })
                }}
              >
                <Brain className="size-4" />
                Classify
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  fetch(`/api/claims/${row.original.id}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'extract' }),
                  })
                }}
              >
                <FileDown className="size-4" />
                Extract Data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  const original = row.original
                  const duplicateData: Record<string, unknown> = {
                    claimNumber: `${original.claimNumber}-COPY`,
                    clientName: original.clientName,
                    claimType: original.claimType,
                    status: 'NEW',
                    senderEmail: original.senderEmail,
                    emailSubject: original.emailSubject,
                    contactNumber: original.contactNumber,
                    contactEmail: original.contactEmail,
                    incidentDescription: original.incidentDescription,
                    excessAmount: original.excessAmount,
                    specialInstructions: original.specialInstructions,
                    vehicleMake: original.vehicleMake,
                    vehicleModel: original.vehicleModel,
                    vehicleYear: original.vehicleYear,
                    vehicleRegistration: original.vehicleRegistration,
                    propertyAddress: original.propertyAddress,
                    notes: original.notes,
                  }
                  if (original.insuranceCompanyId) {
                    duplicateData.insuranceCompanyId = original.insuranceCompanyId
                  }
                  fetch('/api/claims', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(duplicateData),
                  })
                    .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
                    .then((res) => {
                      if (res.error) {
                        toast.error(res.error)
                        return
                      }
                      toast.success(`Claim ${original.claimNumber} duplicated as ${duplicateData.claimNumber}`)
                      invalidateClaimData(queryClient)
                    })
                    .catch(() => toast.error('Failed to duplicate claim'))
                }}
              >
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleClaimClick, data?.claims, selectedIds, toggleSelectAll, toggleSelectRow]
  )

  const table = useReactTable({
    data: data?.claims || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  })

  const hasActiveFilters =
    localStatus !== 'ALL' ||
    localType !== 'ALL' ||
    localCompany !== 'ALL' ||
    localSearch !== '' ||
    localDateFrom !== '' ||
    localDateTo !== '' ||
    activeQuickFilter !== null

  return (
    <div className="space-y-4">
      {/* Quick Filter Chips */}
      <div className="card-enter stagger-0">
        <QuickFilterBar
          activeFilter={activeQuickFilter}
          onFilterChange={(filter) => {
            setActiveQuickFilter(filter)
            setPage(1)
          }}
        />
      </div>

      {/* Filter Bar */}
      <Card className="py-4 card-enter stagger-1 card-lift">
        <CardContent className="gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by claim # or client name..."
                className="pl-8 modern-input"
                value={localSearch}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <Select value={localStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="size-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'ALL' ? 'All Statuses' : getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={localType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {claimTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === 'ALL' ? 'All Types' : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={localCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies</SelectItem>
                {Array.isArray(insuranceCompanies) && insuranceCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1 flex-wrap">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={datePreset === preset.value ? 'default' : 'ghost'}
                    size="sm"
                    className={`text-[11px] h-7 px-2 btn-press ${datePreset === preset.value ? '' : 'text-muted-foreground'}`}
                    onClick={() => applyDatePreset(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter action buttons row */}
          <div className="flex items-center gap-2 mt-1">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-1.5">
                <X className="size-3.5" />
                Clear
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Live</span>
                <span className="text-[10px]">·</span>
                <span className="text-[10px]">Updated {lastUpdatedText}</span>
              </div>
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className={`gap-1 h-7 px-2 text-xs ${viewMode === 'table' ? '' : 'text-muted-foreground'}`}
                  onClick={() => handleViewModeChange('table')}
                >
                  <List className="size-3.5" />
                  Table
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className={`gap-1 h-7 px-2 text-xs ${viewMode === 'kanban' ? '' : 'text-muted-foreground'}`}
                  onClick={() => handleViewModeChange('kanban')}
                >
                  <LayoutGrid className="size-3.5" />
                  Board
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="gap-1.5"
                disabled={isExporting}
              >
                <Download className={`size-3.5 ${isExporting ? 'animate-spin' : ''}`} />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="gap-1.5"
                disabled={isPdfExporting}
              >
                <FileDown className={`size-3.5 ${isPdfExporting ? 'animate-spin' : ''}`} />
                {isPdfExporting ? 'Generating...' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table or Kanban */}
      {viewMode === 'kanban' ? (
        <ClaimsKanban onClaimClick={handleClaimClick} />
      ) : (
      <FadeIn delay={0.1}>
      <Card className="py-4 card-enter stagger-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                Claims
                {data && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({data.total} total)
                  </span>
                )}
              </CardTitle>
              {selectedIds.size > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedIds.size} selected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setNewClaimOpen(true)}
                className="gap-1.5 btn-press hover:bg-primary/90 btn-primary-glow"
              >
                <Plus className="size-3.5" />
                New Claim
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {selectedIds.size} claim(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Set status..." />
                </SelectTrigger>
                <SelectContent>
                  {statuses.filter((s) => s !== 'ALL').map((s) => (
                    <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleBulkStatusChange}
                disabled={bulkActionLoading}
              >
                <Check className="size-3" />
                Apply
              </Button>
              <Separator orientation="vertical" className="h-5" />
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkActionLoading}
            >
              <X className="size-4" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        )}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-[140px]" />
                  <Skeleton className="h-4 w-[100px] hidden sm:block" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-[80px] ml-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorRetry
              message="Failed to load claims. Please check your connection and try again."
              onRetry={() => refetchClaims()}
            />
          ) : (
            <>
              <div className="table-container table-sticky-first-col table-modern table-row-hover-highlight overflow-x-auto scrollbar-fancy">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="border-b-2 border-border hover:bg-transparent">
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} style={header.getSize() !== 150 ? { width: header.getSize() } : undefined}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length > 0 ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-primary/5 transition-colors hover-scale row-highlight"
                          onClick={(e) => {
                            if (e.shiftKey) {
                              e.preventDefault()
                              handleClaimSheetOpen(row.original)
                            } else {
                              handleClaimClick(row.original)
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <RotateCcw className="size-8 text-muted-foreground/50" />
                            <p className="text-muted-foreground">
                              No claims found matching your filters.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page >= data.totalPages}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </FadeIn>
      )}

      <ClaimDetailDialog
        claim={selectedClaim}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedClaimId(null)
        }}
      />

      <ClaimDetailSheet
        claimId={sheetClaimId || ''}
        open={!!sheetClaimId}
        onOpenChange={(open) => {
          if (!open) setSheetClaimId(null)
        }}
      />

      <ClaimDetailPanel />

      <NewClaimDialog
        open={newClaimOpen}
        onOpenChange={setNewClaimOpen}
        insuranceCompanies={insuranceCompanies || []}
      />
    </div>
  )
}
