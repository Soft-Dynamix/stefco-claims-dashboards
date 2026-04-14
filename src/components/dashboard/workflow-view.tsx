'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateClaimData, invalidateConfigData } from '@/lib/query-utils'
import { FadeIn } from '@/components/ui/motion'
import {
  Mail,
  Brain,
  FileSearch,
  Building2,
  FolderPlus,
  FolderOpen,
  FileDown,
  Printer,
  Send,
  ChevronRight,
  Zap,
  Server,
  Cpu,
  CheckCircle2,
  Activity,
  X,
  FileText,
  User,
  Settings2,
  RefreshCw,
  Loader2,
  Sparkles,
  RotateCcw,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  Pencil,
  Plus,
  Wifi,
  WifiOff,
  Inbox,
  AlertTriangle,
  Ban,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { useClaimsStore } from '@/store/claims-store'
import { getConfidenceColor, formatRelativeTime } from '@/lib/helpers'
import { toast } from 'sonner'
import { WorkflowStageChart } from '@/components/dashboard/workflow-stage-chart'

// ─── Pipeline Execution Action Config ──────────────────────────────────────────

const PIPELINE_ACTION_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  email_received: { icon: Mail, label: 'Email Received', color: 'sky' },
  ai_classification: { icon: Brain, label: 'AI Classification', color: 'violet' },
  data_extraction: { icon: FileSearch, label: 'Data Extraction', color: 'amber' },
  insurance_mapping: { icon: Building2, label: 'Insurance Mapping', color: 'emerald' },
  folder_path_generated: { icon: FolderOpen, label: 'Folder Created', color: 'teal' },
  duplicate_detected: { icon: AlertTriangle, label: 'Duplicate', color: 'orange' },
  email_processing_error: { icon: XCircle, label: 'Error', color: 'rose' },
  imap_poll: { icon: RefreshCw, label: 'IMAP Poll', color: 'slate' },
  email_ignored: { icon: Ban, label: 'Ignored', color: 'slate' },
}

// ─── Pipeline Diagnostics Component ──────────────────────────────────────────

interface DiagnosticCheck {
  label: string
  status: 'healthy' | 'warning' | 'error' | 'info'
  message: string
}

function PipelineDiagnostics({
  stageCounts,
  totalClaims,
  avgConfidence,
  errorLogs,
  warningLogs,
  imapConfigured,
  imapConnected,
}: {
  stageCounts: Record<string, number>
  totalClaims: number
  avgConfidence: number
  errorLogs: Array<{ details?: string; createdAt: string }>
  warningLogs: Array<{ details?: string; createdAt: string }>
  imapConfigured: boolean
  imapConnected: boolean
}) {
  const checks: DiagnosticCheck[] = []

  // 1. IMAP Connection Check
  if (!imapConfigured) {
    checks.push({ label: 'IMAP Email Connection', status: 'error', message: 'IMAP is not configured. Email polling will not work until IMAP credentials are set up in Settings.' })
  } else if (!imapConnected) {
    checks.push({ label: 'IMAP Email Connection', status: 'error', message: 'IMAP is configured but the connection is failing. Check credentials and network.' })
  } else {
    checks.push({ label: 'IMAP Email Connection', status: 'healthy', message: 'IMAP is connected and ready to receive emails.' })
  }

  // 2. Claims Processing Check
  const stuckAtReceived = stageCounts['RECEIVED'] || 0
  const stuckAtExtracted = stageCounts['EXTRACTED'] || 0
  const totalStuck = stuckAtReceived + stuckAtExtracted
  if (totalStuck > 0 && totalClaims > 0) {
    checks.push({ label: 'Pipeline Stage Progression', status: 'warning', message: `${totalStuck} claim(s) stuck at early stages (${stuckAtReceived} at Received, ${stuckAtExtracted} at Extracted). These may be from before the pipeline fix.` })
  } else if (totalClaims === 0) {
    checks.push({ label: 'Pipeline Stage Progression', status: 'info', message: 'No claims processed yet. Process a test email to verify the pipeline.' })
  } else {
    checks.push({ label: 'Pipeline Stage Progression', status: 'healthy', message: 'All claims are advancing through pipeline stages correctly.' })
  }

  // 3. AI Confidence Check
  if (avgConfidence > 0 && avgConfidence < 60) {
    checks.push({ label: 'AI Extraction Confidence', status: 'warning', message: `Average confidence is ${avgConfidence}%. Claims below threshold may need manual review.` })
  } else if (avgConfidence > 0) {
    checks.push({ label: 'AI Extraction Confidence', status: 'healthy', message: `Average confidence is ${avgConfidence}%. AI extraction is performing well.` })
  } else {
    checks.push({ label: 'AI Extraction Confidence', status: 'info', message: 'No confidence data available yet.' })
  }

  // 4. Error Log Check
  if (errorLogs.length > 0) {
    const recentError = errorLogs[0]
    checks.push({ label: 'Pipeline Errors', status: 'error', message: `${errorLogs.length} error(s) found. Most recent: "${(recentError.details || '').slice(0, 100)}..."` })
  } else {
    checks.push({ label: 'Pipeline Errors', status: 'healthy', message: 'No pipeline errors detected. All processing completed successfully.' })
  }

  // 5. Warning Check
  if (warningLogs.length > 3) {
    checks.push({ label: 'Pipeline Warnings', status: 'warning', message: `${warningLogs.length} warnings in the pipeline. Review Audit Logs for details.` })
  } else if (warningLogs.length > 0) {
    checks.push({ label: 'Pipeline Warnings', status: 'info', message: `${warningLogs.length} warning(s) — typically non-critical issues like duplicate detection or low confidence.` })
  } else {
    checks.push({ label: 'Pipeline Warnings', status: 'healthy', message: 'No warnings detected.' })
  }

  const statusStyles: Record<string, { icon: React.ElementType; bg: string; text: string; border: string }> = {
    healthy: { icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/40' },
    error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-900/40' },
    info: { icon: Activity, bg: 'bg-sky-50 dark:bg-sky-950/20', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900/40' },
  }

  const healthyCount = checks.filter((c) => c.status === 'healthy').length
  const totalCount = checks.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
        <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${healthyCount === totalCount ? 'bg-emerald-100 dark:bg-emerald-950/50' : healthyCount >= totalCount - 1 ? 'bg-amber-100 dark:bg-amber-950/50' : 'bg-red-100 dark:bg-red-950/50'}`}>
          {healthyCount === totalCount ? (
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          ) : healthyCount >= totalCount - 1 ? (
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <XCircle className="size-5 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {healthyCount === totalCount ? 'All Systems Operational' : healthyCount >= totalCount - 1 ? 'Minor Issues Detected' : 'Attention Required'}
          </p>
          <p className="text-xs text-muted-foreground">{healthyCount} of {totalCount} checks passing</p>
        </div>
        <Badge variant={healthyCount === totalCount ? 'default' : 'outline'} className={`text-xs ${healthyCount === totalCount ? 'bg-emerald-600' : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'}`}>
          {healthyCount}/{totalCount}
        </Badge>
      </div>

      <div className="space-y-2">
        {checks.map((check) => {
          const styles = statusStyles[check.status]
          const StatusIcon = styles.icon
          return (
            <div key={check.label} className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
              <StatusIcon className={`size-4 shrink-0 mt-0.5 ${styles.text}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{check.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.message}</p>
              </div>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${styles.border} ${styles.text}`}>
                {check.status.toUpperCase()}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Static Stage Definitions (fallback when API unavailable) ──────────────────

const DEFAULT_STAGES: WorkflowStageConfig[] = [
  { stageKey: 'RECEIVED', label: 'Email Received', description: 'Incoming claim email is received and parsed', icon: 'Mail', color: 'sky', sortOrder: 0, isEnabled: true, config: '{}' },
  { stageKey: 'CLASSIFIED', label: 'AI Classification', description: 'AI classifies the email as new claim or ignore', icon: 'Brain', color: 'violet', sortOrder: 1, isEnabled: true, config: '{}' },
  { stageKey: 'EXTRACTED', label: 'Data Extraction', description: 'AI extracts claim details from email content', icon: 'FileSearch', color: 'amber', sortOrder: 2, isEnabled: true, config: '{}' },
  { stageKey: 'FOLDER_CREATED', label: 'Insurance Mapping', description: 'Maps claim to insurance company and creates folder', icon: 'Building2', color: 'emerald', sortOrder: 3, isEnabled: true, config: '{}' },
  { stageKey: 'DOCUMENTS_SAVED', label: 'Document Handling', description: 'Saves extracted documents to the claim folder', icon: 'FolderPlus', color: 'teal', sortOrder: 4, isEnabled: true, config: '{}' },
  { stageKey: 'PRINTED', label: 'Print Coordination', description: 'Queues documents for printing during business hours', icon: 'Printer', color: 'orange', sortOrder: 5, isEnabled: true, config: '{}' },
  { stageKey: 'LOGGED', label: 'Audit Logging', description: 'Records all processing steps in audit trail', icon: 'FileDown', color: 'slate', sortOrder: 6, isEnabled: true, config: '{}' },
  { stageKey: 'RESPONDED', label: 'Auto Response', description: 'Sends acknowledgment email to the sender', icon: 'Send', color: 'emerald', sortOrder: 7, isEnabled: true, config: '{}' },
]

const ICON_MAP: Record<string, React.ElementType> = {
  Mail, Brain, FileSearch, Building2, FolderPlus, FileDown, Printer, Send,
  Zap, Server, Cpu, Activity, CheckCircle2, FileText, Settings2,
  Sparkles, ArrowRight,
}

const COLOR_MAP: Record<string, { text: string; bg: string; ring: string }> = {
  sky: { text: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', ring: 'ring-sky-400' },
  violet: { text: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', ring: 'ring-violet-400' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', ring: 'ring-amber-400' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', ring: 'ring-emerald-400' },
  teal: { text: 'text-teal-600', bg: 'bg-teal-50 border-teal-200', ring: 'ring-teal-400' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', ring: 'ring-orange-400' },
  slate: { text: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', ring: 'ring-slate-400' },
  rose: { text: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', ring: 'ring-rose-400' },
}

const aiProviders = [
  { name: 'Google Gemini 2.5 Flash', role: 'Primary', icon: 'Zap', status: 'active', description: 'Best quality for extraction and classification. Free tier: 15 RPM, 1,500 RPD.' },
  { name: 'Groq (Llama 3.3 70B)', role: 'Fallback 1', icon: 'Server', status: 'standby', description: 'Ultra-fast inference on dedicated LPU hardware. ~131k tokens/day free.' },
  { name: 'OpenRouter Free Models', role: 'Fallback 2', icon: 'Activity', status: 'standby', description: '29 free models from multiple providers. Auto-selects available model.' },
  { name: 'Ollama (Llama 3.2 3B)', role: 'Local Fallback', icon: 'Cpu', status: 'standby', description: 'Local inference, no internet needed. Lower quality but always available.' },
]

interface ClaimItem {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  confidenceScore: number
  processingStage: string
}

interface ClaimsResponse {
  claims: ClaimItem[]
  total: number
}

interface WorkflowStageConfig {
  id?: string
  stageKey: string
  label: string
  description: string
  icon: string
  color: string
  sortOrder: number
  isEnabled: boolean
  config: string
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StageCard({
  stageKey,
  label,
  description,
  icon,
  color,
  count,
  isEnabled,
  isSelected,
  onClick,
}: {
  stageKey: string; label: string; description: string; icon: string; color: string
  count: number; isEnabled: boolean; isSelected: boolean; onClick: () => void
}) {
  const Icon = ICON_MAP[icon] || Activity
  const colorConfig = COLOR_MAP[color] || COLOR_MAP.slate

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center text-center gap-2 p-3 rounded-xl transition-all duration-200 cursor-pointer card-hover hover:shadow-md ${
        !isEnabled ? 'opacity-40 grayscale' : ''
      } ${
        isSelected
          ? `ring-2 ${colorConfig.ring} shadow-md`
          : 'hover:bg-muted/50'
      }`}
      aria-label={`View claims at ${label} stage (${count} claims)`}
    >
      <div
        className={`flex items-center justify-center size-12 rounded-xl border ${colorConfig.bg} transition-transform duration-200 ${
          isSelected ? 'scale-110' : ''
        }`}
      >
        <Icon className={`size-5 ${colorConfig.text}`} />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
      <p className="text-xs text-muted-foreground leading-tight max-w-[140px]">
        {description}
      </p>
      <Badge variant="secondary" className="mt-1">
        {count} claims
      </Badge>
      {!isEnabled && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground mt-0.5">
          Disabled
        </Badge>
      )}
    </button>
  )
}

function StageDetailPanel({
  stageKey,
  label,
  description,
  icon,
  color,
  claims,
  onClose,
}: {
  stageKey: string; label: string; description: string; icon: string; color: string
  claims: ClaimItem[]; onClose: () => void
}) {
  const Icon = ICON_MAP[icon] || Activity
  const colorConfig = COLOR_MAP[color] || COLOR_MAP.slate

  return (
    <Card className="overflow-hidden rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center size-10 rounded-lg border ${colorConfig.bg}`}>
              <Icon className={`size-5 ${colorConfig.text}`} />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {label}
                <Badge variant="secondary" className="text-xs">
                  {claims.length} claims
                </Badge>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        {claims.length > 0 ? (
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Claim #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider hidden md:table-cell text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                        {claim.claimNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        {claim.clientName}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">{claim.claimType}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <span className={`text-xs font-medium ${getConfidenceColor(claim.confidenceScore)}`}>
                        {claim.confidenceScore}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <FileText className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No claims at this stage</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Edit Stage Dialog ──────────────────────────────────────────────────────────

function EditStageDialog({
  stage,
  open,
  onOpenChange,
  onSave,
}: {
  stage: WorkflowStageConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { label: string; description: string; icon: string; color: string }) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('')

  React.useEffect(() => {
    if (stage) {
      setLabel(stage.label)
      setDescription(stage.description)
      setIcon(stage.icon)
      setColor(stage.color)
    }
  }, [stage])

  if (!stage) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" />
            Edit Stage: {stage.label}
          </DialogTitle>
          <DialogDescription>Modify the workflow stage configuration</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Stage Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Email Received" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this stage does..." />
          </div>
          <div className="space-y-2">
            <Label>Icon Name (Lucide)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g., Mail, Brain, FileSearch" />
          </div>
          <div className="space-y-2">
            <Label>Color Theme</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(COLOR_MAP).map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`flex items-center justify-center h-8 rounded-md border text-xs font-medium transition-all ${
                    color === c ? `${COLOR_MAP[c].bg} ${COLOR_MAP[c].text} ring-2 ${COLOR_MAP[c].ring}` : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave({ label, description, icon, color }); onOpenChange(false) }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Audit Log Type ──────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  action: string
  details?: string
  status: string
  createdAt: string
  claimId?: string
  claim?: { claimNumber?: string; clientName?: string }
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function WorkflowView() {
  const queryClient = useQueryClient()
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [editStage, setEditStage] = useState<WorkflowStageConfig | null>(null)
  const [stages, setStages] = useState<WorkflowStageConfig[]>(DEFAULT_STAGES)
  const [isApiMode, setIsApiMode] = useState(false)

  // Fetch live IMAP email poll status
  const imapQuery = useQuery<{
    configured: boolean
    last_poll: string | null
    last_poll_count: number
    last_poll_error: string | null
    connection: { status: string; error: string | null }
  }>({
    queryKey: ['imap-status'],
    queryFn: () => fetch('/api/email-poll/status').then((r) => r.json()),
    refetchInterval: 30000,
    retry: 1,
    staleTime: 15000,
  })

  // Poll Now mutation
  const pollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email-poll', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Poll failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Poll complete: ${data.processed} email(s) processed, ${data.failed} failed`)
      invalidateConfigData(queryClient)
      invalidateClaimData(queryClient)
    },
    onError: (err) => {
      toast.error(`Poll failed: ${err.message}`)
    },
  })

  // Fetch claims for stage counts
  const { data, isLoading } = useQuery<ClaimsResponse>({
    queryKey: ['claims-all-stages', refreshKey],
    queryFn: () => fetch('/api/claims?limit=999').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 3,
    retryDelay: 2000,
  })

  // Fetch audit logs + claims for pipeline analytics
  const analyticsQuery = useQuery({
    queryKey: ['workflow-analytics', refreshKey],
    queryFn: async () => {
      const [auditRes, claimsRes] = await Promise.all([
        fetch('/api/audit-logs?limit=100'),
        fetch('/api/claims?limit=999'),
      ])
      const auditData = await auditRes.json()
      const claimsData = await claimsRes.json()
      return { auditLogs: auditData.auditLogs || [], claims: claimsData.claims || [] }
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })

  // Fetch recent pipeline execution events
  const pipelineQuery = useQuery<{ auditLogs: AuditLogEntry[] }>({
    queryKey: ['workflow-pipeline-executions', refreshKey],
    queryFn: async () => {
      const res = await fetch('/api/audit-logs?limit=30&action=email_received,ai_classification,data_extraction,insurance_mapping,folder_path_generated,duplicate_detected,email_processing_error,imap_poll,email_ignored')
      const data = await res.json()
      return { auditLogs: data.auditLogs || [] }
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })

  // Computed analytics metrics
  const analyticsMetrics = React.useMemo(() => {
    const logs = analyticsQuery.data?.auditLogs || []
    const claims = analyticsQuery.data?.claims || []

    const totalEmailsProcessed = logs.filter((l: AuditLogEntry) => l.action === 'email_received').length
    const claimsCreated = logs.filter((l: AuditLogEntry) => l.action === 'data_extraction' && l.status === 'SUCCESS').length
    const autoClassified = logs.filter((l: AuditLogEntry) => l.action === 'ai_classification' && l.status === 'SUCCESS').length
    const avgConfidence = claims.length > 0
      ? Math.round(claims.reduce((sum: number, c: { confidenceScore: number }) => sum + (c.confidenceScore || 0), 0) / claims.length)
      : 0
    const pipelineSuccessRate = logs.length > 0
      ? Math.round((logs.filter((l: AuditLogEntry) => l.status === 'SUCCESS').length / logs.length) * 100)
      : 0
    const manualReviewCount = claims.filter((c: { status: string }) => c.status === 'MANUAL_REVIEW').length

    return { totalEmailsProcessed, claimsCreated, autoClassified, avgConfidence, pipelineSuccessRate, manualReviewCount }
  }, [analyticsQuery.data])

  // Fetch workflow stages from API (with fallback to static)
  const { data: apiStages } = useQuery<{ stages: WorkflowStageConfig[] }>({
    queryKey: ['workflow-stages'],
    queryFn: () => fetch('/api/workflow').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    staleTime: 60000,
    retry: 2,
    retryDelay: 1000,
  })

  React.useEffect(() => {
    if (apiStages?.stages && apiStages.stages.length > 0) {
      setStages(apiStages.stages)
      setIsApiMode(true)
    }
  }, [apiStages])

  const enabledStages = stages.filter((s) => s.isEnabled)

  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    stages.forEach((s) => { counts[s.stageKey] = 0 })
    if (data?.claims) {
      data.claims.forEach((claim) => {
        if (counts[claim.processingStage] !== undefined) {
          counts[claim.processingStage]++
        }
      })
    }
    return counts
  }, [data, stages])

  const selectedStageData = React.useMemo(() => {
    if (!selectedStage) return null
    return stages.find((s) => s.stageKey === selectedStage) || null
  }, [selectedStage, stages])

  const selectedClaims = React.useMemo(() => {
    if (!selectedStage || !data?.claims) return []
    return data.claims.filter((c) => c.processingStage === selectedStage)
  }, [selectedStage, data])

  const toggleStage = useCallback(async (stage: WorkflowStageConfig) => {
    if (!stage.id || !isApiMode) {
      // Local-only toggle
      setStages((prev) =>
        prev.map((s) => s.stageKey === stage.stageKey ? { ...s, isEnabled: !s.isEnabled } : s)
      )
      toast.success(`${stage.label} ${!stage.isEnabled ? 'enabled' : 'disabled'}`)
      return
    }
    try {
      const res = await fetch('/api/workflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stage.id, isEnabled: !stage.isEnabled }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['workflow-stages'] })
        toast.success(`${stage.label} ${!stage.isEnabled ? 'enabled' : 'disabled'}`)
      }
    } catch {
      toast.error('Failed to update stage')
    }
  }, [isApiMode, queryClient])

  const handleSaveStage = useCallback(async (stageKey: string, updates: { label: string; description: string; icon: string; color: string }) => {
    if (isApiMode) {
      const stage = stages.find((s) => s.stageKey === stageKey)
      if (stage?.id) {
        try {
          const res = await fetch('/api/workflow', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: stage.id, ...updates }),
          })
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ['workflow-stages'] })
            toast.success('Stage updated')
          }
        } catch { toast.error('Failed to update stage') }
      }
    } else {
      setStages((prev) => prev.map((s) => s.stageKey === stageKey ? { ...s, ...updates } : s))
      toast.success('Stage updated')
    }
    setEditStage(null)
  }, [isApiMode, stages, queryClient])

  const handleResetDefaults = useCallback(async () => {
    setStages(DEFAULT_STAGES)
    toast.success('Workflow reset to defaults')
    if (isApiMode) {
      try {
        // Re-init from API
        await fetch('/api/workflow/init', { method: 'POST' })
        queryClient.invalidateQueries({ queryKey: ['workflow-stages'] })
      } catch { /* silent */ }
    }
  }, [isApiMode, queryClient])

  return (
    <div className="space-y-6">
      {/* ─── Workflow Stage Heatmap ─── */}
      <FadeIn delay={0.05}>
        <WorkflowStageChart />
      </FadeIn>

      {/* ─── Pipeline Visualization ─── */}
      <Card className="py-5 rounded-xl card-enter stagger-1 card-lift">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Workflow Pipeline</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {enabledStages.length} active
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleResetDefaults}>
                <RotateCcw className="size-3" />
                Reset
              </Button>
            </div>
          </div>
          <CardDescription>
            Claims processing stages from email receipt to auto-response. Click a stage to view claims.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DEFAULT_STAGES.map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Desktop: Flow grid */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-4 gap-4">
                  {enabledStages.map((stage) => (
                    <StageCard
                      key={stage.stageKey}
                      stageKey={stage.stageKey}
                      label={stage.label}
                      description={stage.description}
                      icon={stage.icon}
                      color={stage.color}
                      count={stageCounts[stage.stageKey] || 0}
                      isEnabled={stage.isEnabled}
                      isSelected={selectedStage === stage.stageKey}
                      onClick={() => setSelectedStage((prev) => (prev === stage.stageKey ? null : stage.stageKey))}
                    />
                  ))}
                </div>
                {/* Flow arrows */}
                <div className="grid grid-cols-8 gap-4 mt-4 px-4">
                  {enabledStages.slice(0, -1).map((_, i) => (
                    <div key={i} className="flex items-center justify-center">
                      <ChevronRight className="size-5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: Vertical flow */}
              <div className="lg:hidden space-y-2">
                {enabledStages.map((stage, index) => {
                  const Icon = ICON_MAP[stage.icon] || Activity
                  const colorConfig = COLOR_MAP[stage.color] || COLOR_MAP.slate
                  const isSelected = selectedStage === stage.stageKey
                  return (
                    <React.Fragment key={stage.stageKey}>
                      <button
                        onClick={() => setSelectedStage((prev) => (prev === stage.stageKey ? null : stage.stageKey))}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                          isSelected ? `ring-2 ${colorConfig.ring} shadow-sm` : 'bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div className={`flex items-center justify-center size-10 rounded-lg border ${colorConfig.bg} shrink-0`}>
                          <Icon className={`size-4 ${colorConfig.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">{stage.label}</h4>
                            <Badge variant="secondary" className="text-xs">{stageCounts[stage.stageKey] || 0}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
                        </div>
                      </button>
                      {index < enabledStages.length - 1 && (
                        <div className="flex justify-center">
                          <ChevronRight className="size-4 text-muted-foreground/40 rotate-90" />
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stage Detail Panel */}
      {selectedStage && selectedStageData && (
        <FadeIn delay={0.1}>
        <StageDetailPanel
          stageKey={selectedStageData.stageKey}
          label={selectedStageData.label}
          description={selectedStageData.description}
          icon={selectedStageData.icon}
          color={selectedStageData.color}
          claims={selectedClaims}
          onClose={() => setSelectedStage(null)}
        />
        </FadeIn>
      )}

      {/* ─── Pipeline Analytics ─── */}
      <FadeIn delay={0.1}>
      <Card className="py-5 shadow-sm rounded-xl card-lift">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Pipeline Analytics</CardTitle>
              <Badge variant="outline" className="text-[10px]">Live</Badge>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => analyticsQuery.refetch()}>
              {analyticsQuery.isFetching ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Refresh
            </Button>
          </div>
          <CardDescription>
            Real-time processing metrics computed from audit logs and claims data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Total Emails Processed */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-center size-9 rounded-lg bg-sky-50 shrink-0">
                  <Mail className="size-4 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.totalEmailsProcessed}</p>
                  <p className="text-xs text-muted-foreground">Emails Processed</p>
                </div>
              </div>

              {/* Claims Created */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-center size-9 rounded-lg bg-amber-50 shrink-0">
                  <FileSearch className="size-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.claimsCreated}</p>
                  <p className="text-xs text-muted-foreground">Claims Created</p>
                </div>
              </div>

              {/* Auto-Classified */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-center size-9 rounded-lg bg-violet-50 shrink-0">
                  <Brain className="size-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.autoClassified}</p>
                  <p className="text-xs text-muted-foreground">Auto-Classified</p>
                </div>
              </div>

              {/* Average AI Confidence */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-50 shrink-0">
                  <Sparkles className="size-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.avgConfidence}<span className="text-sm font-medium text-muted-foreground">%</span></p>
                  <p className="text-xs text-muted-foreground">Avg AI Confidence</p>
                </div>
              </div>

              {/* Pipeline Success Rate */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className={`flex items-center justify-center size-9 rounded-lg shrink-0 ${analyticsMetrics.pipelineSuccessRate >= 80 ? 'bg-emerald-50' : analyticsMetrics.pipelineSuccessRate >= 50 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                  <CheckCircle2 className={`size-4 ${analyticsMetrics.pipelineSuccessRate >= 80 ? 'text-emerald-600' : analyticsMetrics.pipelineSuccessRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.pipelineSuccessRate}<span className="text-sm font-medium text-muted-foreground">%</span></p>
                  <p className="text-xs text-muted-foreground">Pipeline Success Rate</p>
                </div>
              </div>

              {/* Requires Manual Review */}
              <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-center size-9 rounded-lg bg-orange-50 shrink-0">
                  <AlertTriangle className="size-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{analyticsMetrics.manualReviewCount}</p>
                  <p className="text-xs text-muted-foreground">Requires Manual Review</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </FadeIn>

      {/* ─── Recent Pipeline Executions ─── */}
      <FadeIn delay={0.15}>
      <Card className="py-5 shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Recent Pipeline Executions</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {pipelineQuery.data?.auditLogs?.length || 0} events
              </Badge>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => pipelineQuery.refetch()}>
              {pipelineQuery.isFetching ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Refresh
            </Button>
          </div>
          <CardDescription>
            Real-time feed of workflow execution events from the processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pipelineQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : pipelineQuery.data?.auditLogs && pipelineQuery.data.auditLogs.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {pipelineQuery.data.auditLogs.map((log) => {
                const actionConfig = PIPELINE_ACTION_CONFIG[log.action] || { icon: Activity, label: log.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), color: 'slate' }
                const Icon = actionConfig.icon
                const colorConfig = COLOR_MAP[actionConfig.color] || COLOR_MAP.slate

                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    {/* Stage Icon + Label */}
                    <div className={`flex items-center justify-center size-8 rounded-lg border ${colorConfig.bg} shrink-0`}>
                      <Icon className={`size-3.5 ${colorConfig.text}`} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 min-w-[140px]">
                      <Badge variant="outline" className={`text-[10px] font-medium whitespace-nowrap ${colorConfig.bg} ${colorConfig.text} border-current/20`}>
                        {actionConfig.label}
                      </Badge>
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {log.details ? (log.details.length > 80 ? `${log.details.slice(0, 80)}...` : log.details) : '—'}
                      </p>
                    </div>
                    {/* Status */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : log.status === 'WARNING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {log.status}
                    </Badge>
                    {/* Timestamp */}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 w-14 text-right">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pipeline executions recorded yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Events will appear here once emails are processed</p>
            </div>
          )}
        </CardContent>
      </Card>
      </FadeIn>

      {/* ─── Processing Stage Distribution ─── */}
      <FadeIn delay={0.2}>
      <Card className="py-5 shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileDown className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Processing Stage Distribution</CardTitle>
          </div>
          <CardDescription>
            Distribution of claims across processing stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: enabledStages.length }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {enabledStages.map((stage) => {
                const count = stageCounts[stage.stageKey] || 0
                const maxCount = Math.max(...Object.values(stageCounts), 1)
                const percentage = (count / maxCount) * 100
                const Icon = ICON_MAP[stage.icon] || Activity
                const colorConfig = COLOR_MAP[stage.color] || COLOR_MAP.slate

                return (
                  <div key={stage.stageKey} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-40 shrink-0">
                      <Icon className={`size-3.5 ${colorConfig.text}`} />
                      <span className="text-xs font-medium text-foreground truncate">{stage.label}</span>
                    </div>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md transition-all duration-500 ${colorConfig.bg} border ${colorConfig.text} border-opacity-20`}
                        style={{ width: `${percentage}%`, minWidth: count > 0 ? '24px' : '0px' }}
                      >
                        {count > 0 && (
                          <span className="text-[10px] font-medium text-foreground px-1.5">{count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </FadeIn>

      {/* ─── Workflow Configuration ─── */}
      <Card className="py-5 shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Workflow Configuration</CardTitle>
          </div>
          <CardDescription>
            Enable, disable, and customize workflow stages. Changes are applied immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {stages.map((stage) => {
                const Icon = ICON_MAP[stage.icon] || Activity
                const colorConfig = COLOR_MAP[stage.color] || COLOR_MAP.slate
                return (
                  <div
                    key={stage.stageKey}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      stage.isEnabled ? '' : 'opacity-50 bg-muted/20'
                    }`}
                  >
                    <div className={`flex items-center justify-center size-9 rounded-lg border ${colorConfig.bg} shrink-0`}>
                      <Icon className={`size-4 ${colorConfig.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{stage.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{stage.stageKey}</Badge>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditStage(stage)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Switch
                        checked={stage.isEnabled}
                        onCheckedChange={() => toggleStage(stage)}
                        className="scale-90"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Stage Dialog */}
      <EditStageDialog
        stage={editStage}
        open={!!editStage}
        onOpenChange={(open) => { if (!open) setEditStage(null) }}
        onSave={(updates) => editStage && handleSaveStage(editStage.stageKey, updates)}
      />

      {/* ─── AI Providers ─── */}
      <Card className="py-5 shadow-sm rounded-xl card-enter stagger-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">AI Providers &amp; Fallback Chain</CardTitle>
          </div>
          <CardDescription>
            Multi-provider AI configuration with automatic fallback. When the primary provider fails or is rate-limited, the system automatically tries the next provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aiProviders.map((provider, index) => {
              const Icon = ICON_MAP[provider.icon] || Zap
              const isActive = provider.status === 'active'
              return (
                <div key={provider.name} className="flex items-start gap-3 p-4 rounded-lg border">
                  {/* Connection line */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`size-3 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    {index < aiProviders.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                  </div>
                  <div className="flex items-center justify-center size-10 rounded-xl bg-primary/5 shrink-0">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
                      <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
                        {provider.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className={`size-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <span className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Standby'}</span>
                      {isActive && (
                        <span className="text-[10px] text-emerald-600 ml-2 flex items-center gap-1">
                          <ArrowRight className="size-2.5" />
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Fallback explanation */}
          <div className="mt-4 p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-start gap-2">
              <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How the Fallback Chain Works:</p>
                <p>1. Email classification and data extraction always tries <strong>Gemini</strong> first.</p>
                <p>2. If Gemini returns an error, rate-limit (429), or timeout, the system tries <strong>Groq</strong>.</p>
                <p>3. If Groq fails, <strong>OpenRouter</strong> is tried (auto-selects best free model).</p>
                <p>4. If all cloud providers fail, <strong>Ollama</strong> (local) handles it — no internet needed.</p>
                <p className="mt-1 font-medium text-foreground">This ensures near-zero downtime for AI processing.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── System Status (Live) ─── */}
      <Card className="py-5 shadow-sm rounded-xl card-enter stagger-4 card-lift">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">System Status</CardTitle>
              <Badge variant="outline" className="text-[10px]">Live</Badge>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => {
              imapQuery.refetch()
            }}>
              <RefreshCw className="size-3" />
              Refresh
            </Button>
          </div>
          <CardDescription>Real-time health check of all connected services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
            {/* IMAP Status */}
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <div className={`size-2.5 rounded-full ${imapQuery.data?.configured ? (imapQuery.data?.connection?.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-400'}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">IMAP Email</p>
                <p className="text-xs text-muted-foreground truncate">
                  {imapQuery.isLoading
                    ? 'Checking...'
                    : imapQuery.data?.configured
                      ? imapQuery.data?.connection?.status === 'connected'
                        ? 'Connected'
                        : 'Configured · Error'
                      : 'Not configured'}
                </p>
              </div>
            </div>

            {/* AI Services */}
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <div className="size-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="text-xs font-medium text-foreground">AI Services</p>
                <p className="text-xs text-muted-foreground">Operational · 4 providers</p>
              </div>
            </div>

            {/* Print Queue */}
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <div className="size-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="text-xs font-medium text-foreground">Print Queue</p>
                <p className="text-xs text-muted-foreground">Ready · Business hrs</p>
              </div>
            </div>
          </div>

          {/* IMAP Last Poll Info */}
          {imapQuery.data?.configured && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/5 shrink-0">
                  <Inbox className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Last IMAP Poll</p>
                  <p className="text-xs text-muted-foreground">
                    {imapQuery.data.last_poll
                      ? `${new Date(imapQuery.data.last_poll).toLocaleString('en-ZA')} — ${imapQuery.data.last_poll_count} email(s) processed`
                      : 'No polls yet'}
                    {imapQuery.data.last_poll_error && imapQuery.data.connection?.status === 'error' && (
                      <span className="ml-2 text-red-500">· {imapQuery.data.connection.error}</span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs shrink-0"
                disabled={pollMutation.isPending}
                onClick={() => pollMutation.mutate()}
              >
                {pollMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Poll Now
              </Button>
            </div>
          )}

          {!imapQuery.data?.configured && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg border border-dashed bg-muted/10">
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                IMAP is not configured. Set up <strong>imap_host</strong>, <strong>imap_user</strong>, and <strong>imap_password</strong> in System Config or environment variables to enable email polling.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Pipeline Health Diagnostics ─── */}
      <FadeIn delay={0.25}>
        <Card className="rounded-xl card-enter stagger-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Pipeline Health Check</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => {
                pipelineQuery.refetch()
                imapQuery.refetch()
              }}>
                <RefreshCw className="size-3" />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Automated diagnostics to identify pipeline issues and bottlenecks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Diagnostic checks */}
            <PipelineDiagnostics
              stageCounts={stageCounts}
              totalClaims={data?.claims?.length || 0}
              avgConfidence={analyticsMetrics.avgConfidence}
              errorLogs={pipelineQuery.data?.auditLogs?.filter((l: { status: string }) => l.status === 'ERROR') || []}
              warningLogs={pipelineQuery.data?.auditLogs?.filter((l: { status: string }) => l.status === 'WARNING') || []}
              imapConfigured={!!imapQuery.data?.configured}
              imapConnected={imapQuery.data?.connection?.status === 'connected'}
            />
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
