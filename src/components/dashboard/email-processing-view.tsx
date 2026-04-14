'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Clock,
  Brain,
  Paperclip,
  ChevronRight,
  X,
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderOpen,
  Sparkles,
  User,
  FileText,
  Building2,
  Send,
  Loader2,
  BarChart3,
  ShieldCheck,
  Eye,
  Ban,
  Zap,
  ArrowRight,
  FlaskConical,
  Play,
  Copy,
  CheckSquare,
  Square,
  Archive,
  SkipForward,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  Settings,
  FileSearch,
  Activity,
  Timer,
  RotateCcw,
  Check,
  Globe,
  Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FadeIn } from '@/components/ui/motion'
import { getConfidenceColor, getConfidenceBg, formatDate, formatRelativeTime } from '@/lib/helpers'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CardDescription } from '@/components/ui/card'
import { useClaimsStore } from '@/store/claims-store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SampleEmail {
  id: string
  from: string
  subject: string
  body: string
  attachments: string[]
  receivedAt: string
  classification: 'NEW_CLAIM' | 'IGNORE' | null
  confidence: number | null
  reasoning: string | null
  extractedData: {
    claimNumber?: string | null
    clientName?: string | null
    claimType?: string | null
    insuranceCompany?: string | null
  } | null
  suggestedPath: string | null
  processed: boolean
}

interface ClassifyResult {
  classification: 'NEW_CLAIM' | 'IGNORE'
  confidence: number
  reasoning: string
  extractedData: {
    claimNumber?: string | null
    clientName?: string | null
    claimType?: string | null
    insuranceCompany?: string | null
  } | null
  suggestedPath: string | null
}

// ── Sample Email Data ─────────────────────────────────────────────────────────

const initialEmails: SampleEmail[] = [
  {
    id: '1',
    from: 'assessments@santam.co.za',
    subject: 'New assessment: Mr JP van der Merwe 2023 Toyota Hilux GD-6 STF004891/2026',
    body: 'Good day\n\nPlease find attached new claim appointment for the above referenced matter. Kindly contact the insured within 48 hours.\n\nVehicle details:\n- 2023 Toyota Hilux GD-6\n- Registration: CA 123-456\n- Colour: White\n\nRegards\nSantam Assessments Team',
    attachments: ['claim_form_STF004891.pdf', 'quotation_STF004891.pdf', 'policy_schedule.pdf'],
    receivedAt: '2026-04-08T08:15:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '2',
    from: 'noreply@ominsure.co.za',
    subject: 'APPOINTMENT OF LOSS ADJUSTER - ECLM51901240 - Mrs WCF Koekemoer',
    body: 'NUWE EIS\n\nU appointment vir bogenoemde eis. Beskrywing: Storm damage to roof structure. Beskrywing van skade: Stortreën het dakstruktuur beskadig. Klant versoek dringende assessering.\n\nMev. Koekemoer kan bereik word op 082 345 6789.\n\nMet vriendelike groete\nOMInsure',
    attachments: ['appointment_letter.pdf', 'photos_roof_damage.zip'],
    receivedAt: '2026-04-08T09:30:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '3',
    from: 'john.vanderberg@insurancebrokers.co.za',
    subject: 'Follow-up: RE: Claim CLM2024-0087 - Status update',
    body: 'Hi Stefco Team,\n\nJust following up on the above claim. Has the assessment been completed yet? The client is getting anxious.\n\nPlease provide an update at your earliest convenience.\n\nKind regards,\nJohn van der Berg\nBrokerlink Insurance Brokers',
    attachments: [],
    receivedAt: '2026-04-08T10:05:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '4',
    from: 'promotions@oldmutual.co.za',
    subject: 'Protect your assets with Old Mutual Comprehensive Cover - April 2026',
    body: 'Dear Valued Partner,\n\nWe are excited to announce our new comprehensive insurance products for Q2 2026.\n\nNEW PRODUCTS:\n- Commercial Fleet Cover\n- Business Interruption Insurance\n- Cyber Risk Protection\n\nContact your account manager for more details.\n\nBest regards\nOld Mutual Insure Marketing Team\n\n---\nTo unsubscribe from marketing emails, click here.',
    attachments: ['product_brochure_Q2_2026.pdf'],
    receivedAt: '2026-04-08T10:45:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '5',
    from: 'claims@hollard.co.za',
    subject: 'Nuwe aanstelling: Me. Anri Joubert - 2021 VW Polo STF005102/2026',
    body: 'Good day\n\nNuwe aanstelling vir bogenoemde eis. Beskrywing: Collision damage - rear end impact. Klant versoek om 48-uur kontak te maak.\n\nVoertuig besonderhede:\n- 2021 VW Polo 1.0 TSI\n- Registrasie: GP 789-012\n\nVriendelike groete\nHollard Claims Department',
    attachments: ['claim_form_STF005102.pdf', 'accident_photos.pdf'],
    receivedAt: '2026-04-08T11:20:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '6',
    from: 'ftp@mooirivier.co.za',
    subject: 'FTP Notification: New files uploaded for case MRV-2026-0447',
    body: 'Automated FTP Notification\n\nThe following files have been uploaded to the Mooirivier FTP server:\n\n- /claims/MRV-2026-0447/assessment_report.pdf (1.2 MB)\n- /claims/MRV-2026-0447/photos/ (23 files)\n\nUpload time: 2026-04-08 11:45:00 SAST\n\nThis is an automated message - do not reply.',
    attachments: [],
    receivedAt: '2026-04-08T11:45:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '7',
    from: 'assessments@santam.co.za',
    subject: 'New claim - household contents - STF005203',
    body: 'Please attend to the following household contents claim. Insured reported burglary at premises.\n\nClaim reference: STF005203\n\nKind regards',
    attachments: [],
    receivedAt: '2026-04-08T12:30:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
  {
    id: '8',
    from: 'noreply@outsurance.co.za',
    subject: 'Payment Receipt - Policy #OUS-2024-88912 - R2,450.00',
    body: 'Dear Policy Holder,\n\nThis email serves as confirmation of your premium payment.\n\nPolicy Number: OUS-2024-88912\nAmount: R2,450.00\nPayment Date: 08 April 2026\nPayment Method: Debit Order\n\nThis is an automated email. Please do not reply to this address.\n\nOutsurance',
    attachments: ['receipt_OUS-2024-88912.pdf'],
    receivedAt: '2026-04-08T13:00:00',
    classification: null,
    confidence: null,
    reasoning: null,
    extractedData: null,
    suggestedPath: null,
    processed: false,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDomain(email: string): string {
  return email.split('@')[1] || email
}

function getSenderLabel(email: string): string {
  const domain = getDomain(email)
  const prefix = email.split('@')[0]
  if (prefix === 'noreply') return domain
  if (prefix === 'ftp') return 'Mooirivier FTP'
  if (prefix === 'promotions') return 'OM Marketing'
  return prefix
}

function formatEmailTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)

  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ClassificationBadge({ classification }: { classification: string | null }) {
  if (!classification) {
    return (
      <Badge variant="outline" className="text-xs font-medium bg-muted/50 text-muted-foreground border-dashed">
        <AlertCircle className="size-3 mr-1" />
        Pending
      </Badge>
    )
  }
  if (classification === 'NEW_CLAIM') {
    return (
      <Badge className="text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
        <Sparkles className="size-3 mr-1" />
        New Claim
      </Badge>
    )
  }
  return (
    <Badge className="text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
      <Ban className="size-3 mr-1" />
      Ignore
    </Badge>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getConfidenceBg(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-sm font-semibold min-w-[42px] text-right ${getConfidenceColor(value)}`}>
        {value}%
      </span>
    </div>
  )
}

function EmailRow({
  email,
  isSelected,
  isProcessing,
  isChecked,
  onToggleCheck,
  onClick,
}: {
  email: SampleEmail
  isSelected: boolean
  isProcessing: boolean
  isChecked: boolean
  onToggleCheck: () => void
  onClick: () => void
}) {
  // Processing stage indicators
  const stages = [
    { key: 'received', label: 'Received', done: true },
    { key: 'classified', label: 'Classified', done: email.classification !== null },
    { key: 'extracted', label: 'Extracted', done: email.extractedData !== null },
    { key: 'processed', label: 'Processed', done: email.processed },
  ]
  const currentStage = stages.filter(s => s.done).length

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer text-left group ${
        isSelected
          ? 'bg-primary/8 border border-primary/20'
          : 'hover:bg-muted/40 border border-transparent'
      } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Checkbox for bulk */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck()
        }}
        className="mt-0.5 shrink-0"
      >
        {isChecked ? (
          <CheckSquare className="size-5 text-primary" />
        ) : (
          <Square className="size-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        )}
      </button>
      <div className={`mt-0.5 size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        isSelected
          ? 'bg-primary/15 text-primary'
          : email.processed
          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
      }`}>
        {isProcessing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : email.processed ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <Mail className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">
            {getSenderLabel(email.from)}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatEmailTime(email.receivedAt)}
          </span>
        </div>
        <p className="text-xs text-foreground/80 truncate mb-1">{email.subject}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-mono">
            {getDomain(email.from)}
          </span>
          {email.attachments.length > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Paperclip className="size-2.5" />
              {email.attachments.length}
            </span>
          )}
          <ClassificationBadge classification={email.classification} />
          {/* AI confidence badge */}
          {email.confidence !== null && (
            <span className={`text-[10px] font-semibold ${getConfidenceColor(email.confidence)}`}>
              {email.confidence}%
            </span>
          )}
        </div>
        {/* Processing stage dots */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.key}>
              {idx > 0 && (
                <div className={`w-3 h-px transition-colors ${idx <= currentStage ? 'bg-primary/50' : 'bg-border'}`} />
              )}
              <div className={`size-1.5 rounded-full transition-colors ${
                stage.done ? 'bg-primary' : 'bg-muted-foreground/30'
              }`} />
            </React.Fragment>
          ))}
          <span className="text-[9px] text-muted-foreground ml-1">
            {currentStage}/4 stages
          </span>
        </div>
      </div>
      <ChevronRight className={`size-4 shrink-0 mt-2 transition-colors ${
        isSelected ? 'text-primary' : 'text-muted-foreground/40 group-hover:text-muted-foreground'
      }`} />
    </button>
  )
}

function EmailDetailPanel({
  email,
  isClassifying,
  isProcessing,
  onClassify,
  onMarkProcessed,
  onMarkIgnore,
  onClose,
}: {
  email: SampleEmail
  isClassifying: boolean
  isProcessing: boolean
  onClassify: () => void
  onMarkProcessed: () => void
  onMarkIgnore: () => void
  onClose: () => void
}) {
  const [showBody, setShowBody] = useState(false)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Email Detail</h3>
          <ClassificationBadge classification={email.classification} />
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Raw Email Section */}
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Raw Email
            </h4>
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground">From</span>
                  <p className="text-sm font-medium text-foreground">{email.from}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">To</span>
                  <p className="text-sm font-medium text-foreground">claims@stefco-assess.co.za</p>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Subject</span>
                <p className="text-sm font-medium text-foreground">{email.subject}</p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Received</span>
                <p className="text-sm text-foreground">{formatDate(email.receivedAt)}</p>
              </div>

              {/* Body Preview */}
              <Separator />
              <div>
                <span className="text-[11px] text-muted-foreground">Body</span>
                <pre className={`text-sm text-foreground/80 whitespace-pre-wrap font-sans mt-1 transition-all ${
                  showBody ? '' : 'max-h-24 overflow-hidden relative'
                }`}>
                  {email.body}
                </pre>
                {!showBody && email.body.length > 200 && (
                  <div className="relative -mt-8 h-8 bg-gradient-to-t from-muted/20 to-transparent" />
                )}
                {email.body.length > 200 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs mt-1"
                    onClick={() => setShowBody(!showBody)}
                  >
                    {showBody ? 'Show less' : 'Read more'}
                  </Button>
                )}
              </div>

              {/* Attachments */}
              {email.attachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-[11px] text-muted-foreground mb-2 block">
                      Attachments ({email.attachments.length})
                    </span>
                    <div className="space-y-1.5">
                      {email.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-background/60 hover:bg-background transition-colors">
                          <Paperclip className="size-3 text-muted-foreground" />
                          <span className="text-xs text-foreground truncate">{att}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* AI Classification Result */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Brain className="size-3" />
              AI Classification
            </h4>

            {!email.classification ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                <Brain className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">This email has not been classified yet</p>
                <Button
                  size="sm"
                  onClick={onClassify}
                  disabled={isClassifying}
                  className="gap-2"
                >
                  {isClassifying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {isClassifying ? 'Classifying...' : 'Classify Email'}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                {/* Classification Badge + Confidence */}
                <div className="flex items-center justify-between">
                  <ClassificationBadge classification={email.classification} />
                  {email.confidence !== null && (
                    <span className={`text-sm font-semibold ${getConfidenceColor(email.confidence)}`}>
                      {email.confidence}% confidence
                    </span>
                  )}
                </div>

                {/* Confidence Bar */}
                {email.confidence !== null && (
                  <ConfidenceBar value={email.confidence} />
                )}

                {/* Reasoning */}
                {email.reasoning && (
                  <div>
                    <span className="text-[11px] text-muted-foreground">Reasoning</span>
                    <p className="text-sm text-foreground/80 mt-1">{email.reasoning}</p>
                  </div>
                )}

                {/* Extracted Data */}
                {email.classification === 'NEW_CLAIM' && email.extractedData && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-[11px] text-muted-foreground mb-2 block">
                        Extracted Claim Data
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        {email.extractedData.claimNumber && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                            <FileText className="size-3.5 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="text-[11px] text-muted-foreground">Claim Number</span>
                              <p className="text-sm font-medium text-foreground">{email.extractedData.claimNumber}</p>
                            </div>
                          </div>
                        )}
                        {email.extractedData.clientName && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                            <User className="size-3.5 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="text-[11px] text-muted-foreground">Client Name</span>
                              <p className="text-sm font-medium text-foreground">{email.extractedData.clientName}</p>
                            </div>
                          </div>
                        )}
                        {email.extractedData.claimType && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                            <Zap className="size-3.5 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="text-[11px] text-muted-foreground">Claim Type</span>
                              <p className="text-sm font-medium text-foreground">{email.extractedData.claimType}</p>
                            </div>
                          </div>
                        )}
                        {email.extractedData.insuranceCompany && (
                          <div className="flex items-start gap-2 p-2 rounded-md bg-background/60">
                            <Building2 className="size-3.5 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="text-[11px] text-muted-foreground">Insurance Co.</span>
                              <p className="text-sm font-medium text-foreground">{email.extractedData.insuranceCompany}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Suggested Folder Path */}
                {email.suggestedPath && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <FolderOpen className="size-3" />
                        Suggested Folder Path (§4.5)
                      </span>
                      <code className="block text-xs font-mono text-foreground/70 mt-1 p-2 rounded-md bg-background/60 break-all">
                        {email.suggestedPath}
                      </code>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <Separator />
                <div className="flex items-center gap-2 pt-1">
                  {email.classification === 'NEW_CLAIM' && !email.processed && (
                    <Button
                      size="sm"
                      onClick={onMarkProcessed}
                      disabled={isProcessing}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="size-3.5" />
                      )}
                      {isProcessing ? 'Processing...' : 'Process Claim'}
                    </Button>
                  )}
                  {!email.processed && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onMarkIgnore}
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="size-3.5" />
                      Mark as Ignore
                    </Button>
                  )}
                  {email.processed && (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="size-3 mr-1" />
                      Processed
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scheduler Control Panel ──────────────────────────────────────────────────

const POLL_INTERVAL_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '2min', value: 120 },
  { label: '5min', value: 300 },
  { label: '10min', value: 600 },
  { label: '15min', value: 900 },
  { label: '30min', value: 1800 },
]

function formatUptime(seconds: number | null): string {
  if (!seconds || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function SchedulerControlPanel() {
  const [pollInterval, setPollInterval] = useState<string>('60')
  const [showConfirm, setShowConfirm] = useState<'start' | 'stop' | null>(null)

  // Scheduler status — live polling every 5 seconds
  const schedulerQuery = useQuery({
    queryKey: ['email-scheduler'],
    queryFn: () => fetch('/api/email-poll/scheduler').then((r) => r.json()),
    refetchInterval: 5000,
    staleTime: 3000,
  })

  // SMTP status
  const smtpQuery = useQuery({
    queryKey: ['smtp-status'],
    queryFn: () => fetch('/api/smtp/status').then((r) => r.json()),
    staleTime: 30000,
  })

  // Scheduler control mutation
  const schedulerMutation = useMutation({
    mutationFn: async (body: { action: 'start' | 'stop' | 'restart'; interval?: number }) => {
      const res = await fetch('/api/email-poll/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Scheduler action failed')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === 'start'
          ? 'Auto-polling started'
          : variables.action === 'stop'
          ? 'Auto-polling stopped'
          : 'Scheduler restarted'
      )
      schedulerQuery.refetch()
      setShowConfirm(null)
    },
    onError: (err) => {
      toast.error(`Scheduler error: ${err.message}`)
      setShowConfirm(null)
    },
  })

  // SMTP test mutation
  const smtpTestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/smtp/test', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'SMTP test failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('SMTP connection successful')
      } else {
        toast.error(data.error || 'SMTP test failed')
      }
    },
    onError: (err) => {
      toast.error(`SMTP test failed: ${err.message}`)
    },
  })

  const schedulerData = schedulerQuery.data
  const isRunning = schedulerData?.running === true
  const isPolling = schedulerData?.polling === true

  // Detect if interval has changed from current running state
  const selectedInterval = Number(pollInterval)
  const intervalChanged = isRunning && selectedInterval !== (schedulerData?.interval || 60)

  const handleToggleScheduler = () => {
    if (isRunning) {
      // Stopping — show confirmation
      setShowConfirm('stop')
    } else {
      // Starting
      setShowConfirm('start')
    }
  }

  const confirmAction = () => {
    if (showConfirm === 'start') {
      schedulerMutation.mutate({ action: 'start', interval: selectedInterval })
    } else if (showConfirm === 'stop') {
      schedulerMutation.mutate({ action: 'stop' })
    }
  }

  const handleRestartWithInterval = () => {
    schedulerMutation.mutate({ action: 'restart', interval: selectedInterval })
  }

  return (
    <Card className="overflow-hidden card-enter hover-scale">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Timer className="size-4 text-primary" />
            Scheduler Control Panel
          </CardTitle>
          <Badge
            className={
              isRunning
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700'
            }
          >
            {isRunning ? (
              <>
                <div className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Running
              </>
            ) : (
              <>
                <div className="size-1.5 rounded-full bg-slate-400 mr-1.5" />
                Stopped
              </>
            )}
          </Badge>
        </div>
        <CardDescription>
          Native auto-polling scheduler for automated email fetching
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="auto-polling" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto-polling" className="gap-1.5 text-xs">
              <Activity className="size-3" />
              Auto Polling
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-1.5 text-xs">
              <Send className="size-3" />
              SMTP Settings
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Auto Polling ── */}
          <TabsContent value="auto-polling" className="space-y-4">
            {schedulerQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Status Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                      isRunning
                        ? 'bg-emerald-100 dark:bg-emerald-950/50'
                        : 'bg-slate-100 dark:bg-slate-800/50'
                    }`}>
                      {isRunning ? (
                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="size-5 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {isRunning ? 'Scheduler is Running' : 'Scheduler is Stopped'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRunning
                          ? `${schedulerData?.pollCount ?? 0} polls completed · Uptime: ${formatUptime(schedulerData?.uptime)}`
                          : 'Auto-polling is not active'}
                      </p>
                    </div>
                  </div>

                  {/* Start/Stop Button with Confirmation */}
                  <div className="flex items-center gap-2 shrink-0">
                    {showConfirm && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {showConfirm === 'stop' ? 'Stop scheduler?' : 'Start scheduler?'}
                        </span>
                        <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={confirmAction}>
                          <Check className="size-3" />
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowConfirm(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {!showConfirm && (
                      <Button
                        size="sm"
                        variant={isRunning ? 'outline' : 'default'}
                        className={`h-7 gap-1.5 text-xs ${
                          isRunning
                            ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        onClick={handleToggleScheduler}
                        disabled={schedulerMutation.isPending}
                      >
                        {schedulerMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : isRunning ? (
                          <Square className="size-3.5" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        {isRunning ? 'Stop' : 'Start'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Poll Interval Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-10 rounded-lg shrink-0 bg-primary/5">
                      <Clock className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Poll Interval</p>
                      <p className="text-xs text-muted-foreground">
                        How often the scheduler checks for new emails
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={pollInterval} onValueChange={setPollInterval}>
                      <SelectTrigger className="w-[100px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLL_INTERVAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {intervalChanged && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleRestartWithInterval}
                        disabled={schedulerMutation.isPending}
                      >
                        {schedulerMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        Restart
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Polls</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">{schedulerData?.pollCount ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Last Poll</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                      {schedulerData?.lastPollAt
                        ? formatRelativeTime(new Date(schedulerData.lastPollAt).toISOString())
                        : 'Never'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Next Poll</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                      {schedulerData?.nextPollAt
                        ? formatRelativeTime(new Date(schedulerData.nextPollAt).toISOString())
                        : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</p>
                    <p className="text-sm font-medium mt-0.5 flex items-center gap-1.5">
                      {schedulerData?.lastPollError ? (
                        <span className="text-rose-600 dark:text-rose-400 truncate">
                          <AlertCircle className="size-3 inline mr-0.5 shrink-0" />
                          {schedulerData.lastPollError.length > 20
                            ? schedulerData.lastPollError.substring(0, 20) + '…'
                            : schedulerData.lastPollError}
                        </span>
                      ) : isPolling ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3 inline mr-0.5" />
                          Polling…
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Idle</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Note */}
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Zap className="size-3 text-primary" />
                  Built-in native scheduler — no external services needed. Runs as a background process.
                </p>
              </>
            )}
          </TabsContent>

          {/* ── Tab 2: SMTP Settings ── */}
          <TabsContent value="smtp" className="space-y-4">
            {smtpQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                      smtpQuery.data?.configured
                        ? 'bg-emerald-100 dark:bg-emerald-950/50'
                        : 'bg-slate-100 dark:bg-slate-800/50'
                    }`}>
                      {smtpQuery.data?.configured ? (
                        <Globe className="size-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Server className="size-5 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {smtpQuery.data?.configured ? 'SMTP Configured' : 'SMTP Not Configured'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {smtpQuery.data?.configured
                          ? `${smtpQuery.data?.config?.host}:${smtpQuery.data?.config?.port} — from: ${smtpQuery.data?.config?.fromEmail || smtpQuery.data?.config?.fromName || 'N/A'}`
                          : 'No SMTP settings detected. Configure to enable auto-reply emails.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs shrink-0"
                    onClick={() => smtpTestMutation.mutate()}
                    disabled={smtpTestMutation.isPending || !smtpQuery.data?.configured}
                  >
                    {smtpTestMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="size-3.5" />
                    )}
                    Test Connection
                  </Button>
                </div>

                {smtpQuery.data?.configured && smtpQuery.data?.config && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Host</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                        {smtpQuery.data.config.host || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Port</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {smtpQuery.data.config.port || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">From Name</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                        {smtpQuery.data.config.fromName || '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Secure</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {smtpQuery.data.config.secure ? 'Yes (TLS)' : 'No'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Note */}
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Settings className="size-3 text-primary" />
                  Configure SMTP in Installation Manager → Email Setup
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function StatsCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string
  value: number
  icon: React.ElementType
  colorClass?: string
}) {
  return (
    <Card className="py-4 card-hover h-full card-enter hover-scale">
      <CardContent className="flex items-center gap-3 p-0">
        <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${colorClass || 'bg-primary/5'}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}


// ── Main Component ─────────────────────────────────────────────────────────────

export function EmailProcessingView() {
  const [emails, setEmails] = useState<SampleEmail[]>(initialEmails)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [classifyingId, setClassifyingId] = useState<string | null>(null)
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set())
  const [processingId, setProcessingId] = useState<string | null>(null)
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) || null,
    [emails, selectedEmailId]
  )

  // Stats
  const stats = useMemo(() => {
    const total = emails.length
    const classified = emails.filter((e) => e.classification !== null).length
    const newClaims = emails.filter((e) => e.classification === 'NEW_CLAIM').length
    const ignored = emails.filter((e) => e.classification === 'IGNORE').length
    const pending = emails.filter((e) => e.classification === null).length
    const processed = emails.filter((e) => e.processed).length
    return { total, classified, newClaims, ignored, pending, processed }
  }, [emails])

  // Classify single email
  const classifyMutation = useMutation({
    mutationFn: async (email: SampleEmail): Promise<ClassifyResult> => {
      const res = await fetch('/api/classify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: email.subject,
          body: email.body,
          from: email.from,
        }),
      })
      if (!res.ok) throw new Error('Classification failed')
      return res.json()
    },
  })

  const handleClassifyEmail = useCallback(
    (emailId: string) => {
      const email = emails.find((e) => e.id === emailId)
      if (!email) return

      setClassifyingId(emailId)
      classifyMutation.mutate(email, {
        onSuccess: (result) => {
          setEmails((prev) =>
            prev.map((e) =>
              e.id === emailId
                ? {
                    ...e,
                    classification: result.classification,
                    confidence: result.confidence,
                    reasoning: result.reasoning,
                    extractedData: result.extractedData,
                    suggestedPath: result.suggestedPath,
                  }
                : e
            )
          )
          toast.success(
            result.classification === 'NEW_CLAIM'
              ? 'Email classified as New Claim'
              : 'Email classified as Ignore'
          )
          setClassifyingId(null)
        },
        onError: () => {
          toast.error('Failed to classify email')
          setClassifyingId(null)
        },
      })
    },
    [emails, classifyMutation]
  )

  const handleProcessAll = useCallback(() => {
    const unclassified = emails.filter((e) => e.classification === null)
    if (unclassified.length === 0) {
      toast.info('No unclassified emails to process')
      return
    }

    let delay = 0
    unclassified.forEach((email) => {
      setTimeout(() => {
        handleClassifyEmail(email.id)
      }, delay)
      delay += 600 // Stagger calls
    })

    toast.info(`Processing ${unclassified.length} emails...`)
  }, [emails, handleClassifyEmail])

  const handleMarkProcessed = useCallback(
    async (emailId: string) => {
      const email = emails.find((e) => e.id === emailId)
      if (!email) return

      setProcessingId(emailId)

      try {
        const res = await fetch('/api/process-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: email.from,
            subject: email.subject,
            body: email.body,
            attachments: email.attachments.map((a) => ({ filename: a })),
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Processing failed')
        }

        const result = await res.json()

        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId
              ? {
                  ...e,
                  processed: true,
                  classification: result.classification || e.classification,
                  confidence: result.confidence || e.confidence,
                  extractedData: result.claim
                    ? {
                        claimNumber: result.claim.claimNumber,
                        clientName: result.claim.clientName,
                        claimType: result.claim.claimType,
                        insuranceCompany: result.claim.insuranceCompany?.name,
                      }
                    : e.extractedData,
                  suggestedPath: result.folderPath || e.suggestedPath,
                }
              : e
          )
        )

        toast.success(
          `Claim ${result.claim?.claimNumber} created — ${result.claim?.clientName}`
        )
      } catch (err) {
        toast.error(
          `Failed to process: ${err instanceof Error ? err.message : 'Unknown error'}`
        )
      } finally {
        setProcessingId(null)
        setSelectedEmailId(null)
      }
    },
    [emails]
  )

  const handleMarkIgnore = useCallback(
    (emailId: string) => {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === emailId
            ? { ...e, classification: 'IGNORE', processed: true, reasoning: e.reasoning || 'Manually marked as ignore' }
            : e
        )
      )
      toast.info('Email marked as ignored')
    },
    []
  )

  // ── Chart data ──
  const chartData = useMemo(
    () => [
      { label: 'New Claims', value: stats.newClaims, color: 'bg-emerald-500' },
      { label: 'Ignored', value: stats.ignored, color: 'bg-slate-400' },
      { label: 'Pending', value: stats.pending, color: 'bg-amber-400' },
    ],
    [stats]
  )
  const maxChartValue = Math.max(...chartData.map((d) => d.value), 1)

  // Bulk classify checked emails
  const handleBulkClassify = useCallback(() => {
    const emailsToClassify = emails.filter((e) => checkedEmails.has(e.id) && e.classification === null)
    if (emailsToClassify.length === 0) {
      toast.info('No unclassified checked emails to process')
      return
    }
    let delay = 0
    emailsToClassify.forEach((email) => {
      setTimeout(() => handleClassifyEmail(email.id), delay)
      delay += 600
    })
    toast.info(`Bulk classifying ${emailsToClassify.length} emails...`)
    setCheckedEmails(new Set())
  }, [emails, checkedEmails, handleClassifyEmail])

  const toggleCheck = useCallback((emailId: string) => {
    setCheckedEmails((prev) => {
      const next = new Set(prev)
      if (next.has(emailId)) {
        next.delete(emailId)
      } else {
        next.add(emailId)
      }
      return next
    })
  }, [])

  const toggleAllChecks = useCallback(() => {
    const allPendingIds = emails.filter((e) => e.classification === null).map((e) => e.id)
    if (checkedEmails.size === allPendingIds.length && allPendingIds.length > 0) {
      setCheckedEmails(new Set())
    } else {
      setCheckedEmails(new Set(allPendingIds))
    }
  }, [emails, checkedEmails.size])

  // ── Real IMAP Status ──
  const imapQuery = useQuery({
    queryKey: ['imap-status'],
    queryFn: () => fetch('/api/email-poll/status').then((r) => r.json()),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  // ── Live Pipeline Audit Logs ──
  const auditLogsQuery = useQuery({
    queryKey: ['audit-logs-pipeline'],
    queryFn: () =>
      fetch(
        '/api/audit-logs?limit=50&action=imap_poll,email_received,email_ignored,ai_classification,data_extraction,insurance_mapping,folder_path_generated,duplicate_detected,email_processing_error'
      ).then((r) => r.json()),
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const liveProcessingCount = auditLogsQuery.data?.auditLogs?.length || 0

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
      toast.success(`IMAP Poll: ${data.processed} processed, ${data.failed} failed`)
      imapQuery.refetch()
    },
    onError: (err) => {
      toast.error(`Poll failed: ${err.message}`)
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn delay={0}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Email Processing
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              IMAP email polling &amp; AI-powered classification pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllChecks}
              disabled={stats.pending === 0}
              className="gap-2 text-xs"
            >
              {checkedEmails.size === stats.pending && stats.pending > 0 ? (
                <X className="size-3.5" />
              ) : (
                <CheckSquare className="size-3.5" />
              )}
              {checkedEmails.size > 0 ? `Deselect ${checkedEmails.size}` : `Select All (${stats.pending})`}
            </Button>
            {checkedEmails.size > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleBulkClassify}
                disabled={classifyingId !== null}
                className="gap-2"
              >
                {classifyingId !== null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Bulk Classify ({checkedEmails.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcessAll}
              disabled={stats.pending === 0 || classifyingId !== null}
              className="gap-2"
            >
              {classifyingId !== null ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Process All ({stats.pending})
            </Button>
          </div>
        </div>
      </FadeIn>

      <Separator />

      {/* IMAP Not Configured Warning Banner */}
      {imapQuery.data && !imapQuery.data.configured && (
        <FadeIn delay={0.03}>
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex items-start gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 shrink-0 mt-0.5">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">IMAP Email Not Configured</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Real email polling requires IMAP settings (host, username, password). 
                You can still test AI classification on the sample emails below — click any email and press <strong>"Classify Email"</strong>.
              </p>
              <Button
                size="sm"
                className="mt-2 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                onClick={() => setActiveTab('installer')}
              >
                <Settings className="size-3.5" />
                Open Installation Manager
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* IMAP Configured but Connection Error */}
      {imapQuery.data?.configured && imapQuery.data?.connection?.status === 'error' && (
        <FadeIn delay={0.03}>
          <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 flex items-start gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-red-100 dark:bg-red-900/50 shrink-0 mt-0.5">
              <WifiOff className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">IMAP Connection Failed</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                {imapQuery.data.connection.error || 'Could not connect to your IMAP server. Please check your settings.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5 text-xs"
                onClick={() => setActiveTab('installer')}
              >
                <Settings className="size-3.5" />
                Check IMAP Settings
              </Button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Scheduler Control Panel */}
      <FadeIn delay={0.06}>
        <SchedulerControlPanel />
      </FadeIn>

      {/* Real Email Status Card */}
      <FadeIn delay={0.05}>
        <Card className="overflow-hidden card-enter stagger-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wifi className="size-4 text-muted-foreground" />
                Real Email Status (IMAP)
                {imapQuery.data?.configured ? (
                  <Badge variant={imapQuery.data?.connection?.status === 'connected' ? 'default' : 'outline'} className="text-[10px]">
                    <div className={`size-1.5 rounded-full mr-1 ${imapQuery.data?.connection?.status === 'connected' ? 'bg-emerald-300' : 'bg-amber-400'}`} />
                    {imapQuery.data?.connection?.status === 'connected' ? 'Connected' : 'Error'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Not configured</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => imapQuery.refetch()}
                >
                  <RefreshCw className="size-3" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={pollMutation.isPending || !imapQuery.data?.configured}
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
            </div>
            <CardDescription>
              Connects to your IMAP server to fetch unread emails and process them through the claims pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {imapQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : imapQuery.data?.configured ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Connection Status */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${imapQuery.data?.connection?.status === 'connected' ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-amber-100 dark:bg-amber-950/50'}`}>
                    {imapQuery.data?.connection?.status === 'connected' ? (
                      <Wifi className="size-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <WifiOff className="size-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">IMAP Connection</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {imapQuery.data?.connection?.status === 'connected'
                        ? `Connected to ${imapQuery.data?.config?.host || 'IMAP server'}`
                        : imapQuery.data?.connection?.error || 'Connection failed'}
                    </p>
                  </div>
                </div>

                {/* Last Poll */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-center size-10 rounded-lg shrink-0 bg-primary/5">
                    <Clock className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Last Poll</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {imapQuery.data?.last_poll
                        ? `${new Date(imapQuery.data.last_poll).toLocaleString('en-ZA')} — ${imapQuery.data.last_poll_count} email(s)`
                        : 'Never polled'}
                    </p>
                  </div>
                </div>

                {/* Poll Interval */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-center size-10 rounded-lg shrink-0 bg-muted/50">
                    <Settings className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Poll Interval</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Every {imapQuery.data?.config?.poll_interval || 300}s · Port {imapQuery.data?.config?.port || 993} · {imapQuery.data?.config?.ssl ? 'SSL' : 'Plain'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-dashed bg-muted/10">
                <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">IMAP Not Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To enable real email polling, configure the following in <strong>System Config</strong> or <strong>.env</strong> file:
                  </p>
                  <code className="block text-[11px] font-mono text-foreground/60 mt-2 p-2 rounded bg-muted/30">
                    IMAP_HOST=imap.example.com<br />
                    IMAP_PORT=993<br />
                    IMAP_USER=your@email.com<br />
                    IMAP_PASSWORD=your-password<br />
                    IMAP_SSL=true
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Separator />

      {/* Tabs: Real vs Demo */}
      <FadeIn delay={0.08}>
        <Tabs defaultValue="live" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
            <TabsTrigger value="demo" className="gap-1.5 text-xs">
              <FlaskConical className="size-3" />
              Demo Classification
            </TabsTrigger>
            <TabsTrigger value="real" className="gap-1.5 text-xs">
              <Wifi className="size-3" />
              Real Email Status
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-1.5 text-xs">
              <Activity className="size-3" />
              Live Pipeline
              {liveProcessingCount > 0 && (
                <Badge variant="default" className="ml-1.5 text-[10px]">{liveProcessingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="real">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  IMAP Polling
                </CardTitle>
                <CardDescription>
                  When IMAP is configured, unread emails are fetched, classified by AI, and converted into claims automatically. Click &quot;Poll Now&quot; to trigger a manual fetch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-muted/20 p-6 text-center">
                  <Mail className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">
                    {imapQuery.data?.configured
                      ? 'Real emails from your IMAP inbox are processed here.'
                      : 'Configure IMAP to start receiving real emails.'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The pipeline: Email arrives → IMAP fetch → AI classify → Extract data → Create claim → Audit log
                  </p>
                  {imapQuery.data?.last_poll && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Last poll: <strong>{new Date(imapQuery.data.last_poll).toLocaleString('en-ZA')}</strong> —{' '}
                        {imapQuery.data.last_poll_count} email(s) processed
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demo">

      {/* Section A: Email Inbox Simulator */}
      <FadeIn delay={0.1}>
        <Card className="overflow-hidden card-enter stagger-1">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Inbox className="size-4 text-muted-foreground" />
                Email Inbox
                <Badge variant="secondary" className="text-xs ml-1">{stats.total} emails</Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {stats.pending > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                    {stats.pending} unclassified
                  </Badge>
                )}
                {stats.processed > 0 && (
                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                    {stats.processed} processed
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <ScrollArea className="max-h-[320px]">
              <div className="space-y-1">
                {emails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    isSelected={email.id === selectedEmailId}
                    isProcessing={classifyingId === email.id || processingId === email.id}
                    isChecked={checkedEmails.has(email.id)}
                    onToggleCheck={() => toggleCheck(email.id)}
                    onClick={() => setSelectedEmailId(email.id === selectedEmailId ? null : email.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Section B: Classification Detail Panel (appears when email selected) */}
      {selectedEmail && (
        <FadeIn delay={0.15}>
          <Card className="overflow-hidden card-enter stagger-2">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {/* Left: Raw email - shown in a scrollable area */}
                <div className="min-h-0">
                  <div className="px-4 py-3 border-b bg-muted/20">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="size-3" />
                      Email Preview
                    </h4>
                  </div>
                  <ScrollArea className="max-h-[500px]">
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] text-muted-foreground">From</span>
                          <p className="text-sm font-medium text-foreground">{selectedEmail.from}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">Received</span>
                          <p className="text-sm text-foreground">{formatDate(selectedEmail.receivedAt)}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Subject</span>
                        <p className="text-sm font-medium text-foreground">{selectedEmail.subject}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Body</span>
                        <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans mt-1 p-3 rounded-md bg-muted/20 border">
                          {selectedEmail.body}
                        </pre>
                      </div>
                      {selectedEmail.attachments.length > 0 && (
                        <div>
                          <span className="text-[11px] text-muted-foreground mb-2 block">
                            Attachments ({selectedEmail.attachments.length})
                          </span>
                          <div className="space-y-1.5">
                            {selectedEmail.attachments.map((att, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/10">
                                <Paperclip className="size-3.5 text-muted-foreground" />
                                <span className="text-xs text-foreground truncate">{att}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right: AI Classification */}
                <div className="min-h-0">
                  <EmailDetailPanel
                    email={selectedEmail}
                    isClassifying={classifyingId === selectedEmail.id}
                    isProcessing={processingId === selectedEmail.id}
                    onClassify={() => handleClassifyEmail(selectedEmail.id)}
                    onMarkProcessed={() => handleMarkProcessed(selectedEmail.id)}
                    onMarkIgnore={() => handleMarkIgnore(selectedEmail.id)}
                    onClose={() => setSelectedEmailId(null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Section C: Processing Statistics */}
      <FadeIn delay={0.2}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            Processing Statistics
          </h3>

          {/* 3 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Emails Today"
              value={stats.total}
              icon={Inbox}
              colorClass="bg-primary/5"
            />
            <StatsCard
              title="Classified"
              value={stats.classified}
              icon={Brain}
              colorClass="bg-sky-100 dark:bg-sky-950/50"
            />
            <StatsCard
              title="Pending Review"
              value={stats.pending}
              icon={Clock}
              colorClass="bg-amber-100 dark:bg-amber-950/50"
            />
          </div>

          {/* Mini Bar Chart */}
          <Card className="py-4">
            <CardContent className="space-y-4 p-0">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-6">
                Classification Breakdown
              </h4>
              <div className="px-6 space-y-3">
                {chartData.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground w-24 shrink-0">
                      {item.label}
                    </span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{ width: `${stats.total > 0 ? (item.value / maxChartValue) * 100 : 0}%` }}
                      />
                    </div>
                    <Badge variant="secondary" className="text-xs font-medium min-w-[28px] justify-center">
                      {item.value}
                    </Badge>
                  </div>
                ))}
              </div>
              {stats.total === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No emails to display</p>
              )}
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* Section D: Simulated Inbox */}
      <FadeIn delay={0.25}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Inbox className="size-4 text-muted-foreground" />
            Simulated Inbox
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              Last {Math.min(emails.length, 10)} emails
            </Badge>
          </h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {emails.slice(0, 10).map((email) => (
              <div
                key={email.id}
                className={`rounded-lg border p-4 transition-all hover:border-border/80 group cursor-pointer ${
                  email.processed
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30'
                    : email.classification
                    ? 'bg-muted/20 dark:bg-muted/10'
                    : 'bg-card'
                }`}
                onClick={() => setSelectedEmailId(email.id === selectedEmailId ? null : email.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-muted-foreground truncate">
                        {getSenderLabel(email.from)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatEmailTime(email.receivedAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mb-1">{email.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{email.body.slice(0, 100)}...</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {email.confidence !== null && (
                      <Badge variant="outline" className={`text-[10px] ${getConfidenceBg(email.confidence)} text-white`}>
                        AI: {email.confidence}%
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      {!email.processed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] gap-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!email.classification) {
                              handleClassifyEmail(email.id)
                            } else if (email.classification === 'NEW_CLAIM') {
                              handleMarkProcessed(email.id)
                            }
                          }}
                          disabled={classifyingId === email.id}
                        >
                          {classifyingId === email.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Zap className="size-3" />
                          )}
                          Process
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkIgnore(email.id)
                        }}
                      >
                        <SkipForward className="size-3" />
                        Skip
                      </Button>
                      {email.processed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                          toast.info('Email already archived')
                          }}
                        >
                          <Archive className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Section E: Test Pipeline */}
      <FadeIn delay={0.3}>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            Pipeline Test Lab
            <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400">
              Inline Testing
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Test the full 8-stage processing pipeline with realistic South African insurance emails. Results are created as real claims in the database.
          </p>

          <Card className="overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Select Test Scenario</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <TestPipelineSection />
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      </TabsContent>

          {/* Live Pipeline Tab */}
          <TabsContent value="live">
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="size-4 text-muted-foreground" />
                      Processing Pipeline Events
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => auditLogsQuery.refetch()}
                      >
                        <RefreshCw className={`size-3 ${auditLogsQuery.isFetching ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Real-time view of email processing events from the automation pipeline. Auto-refreshes every 30 seconds.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogsQuery.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !auditLogsQuery.data?.auditLogs?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Inbox className="size-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No processing events yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Events will appear here when emails are processed through the pipeline.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-2">
                        {auditLogsQuery.data.auditLogs.map((log: {
                          id: string
                          action: string
                          details: string
                          status: string
                          createdAt: string
                          claim: { claimNumber: string; clientName: string; claimType: string; status: string } | null
                        }) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                          >
                            {/* Action Icon */}
                            <div className={`mt-0.5 size-8 rounded-lg flex items-center justify-center shrink-0 ${
                              log.status === 'ERROR'
                                ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                                : log.status === 'WARNING'
                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                            }`}>
                              {log.action === 'email_received' || log.action === 'imap_poll' ? (
                                <Mail className="size-3.5" />
                              ) : log.action === 'email_ignored' ? (
                                <Ban className="size-3.5" />
                              ) : log.action === 'ai_classification' ? (
                                <Brain className="size-3.5" />
                              ) : log.action === 'data_extraction' ? (
                                <FileSearch className="size-3.5" />
                              ) : log.action === 'insurance_mapping' ? (
                                <Building2 className="size-3.5" />
                              ) : log.action === 'folder_path_generated' ? (
                                <FolderOpen className="size-3.5" />
                              ) : log.action === 'duplicate_detected' ? (
                                <AlertTriangle className="size-3.5" />
                              ) : log.action === 'email_processing_error' ? (
                                <XCircle className="size-3.5" />
                              ) : (
                                <AlertCircle className="size-3.5" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {log.action.replace(/_/g, ' ')}
                                </Badge>
                                <Badge className={`text-[10px] ${
                                  log.status === 'ERROR'
                                    ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
                                    : log.status === 'WARNING'
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                                }`}>
                                  {log.status}
                                </Badge>
                                {log.claim?.claimNumber && (
                                  <Badge variant="secondary" className="text-[10px] font-mono">
                                    {log.claim.claimNumber}
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                  {formatRelativeTime(log.createdAt)}
                                </span>
                              </div>
                              {log.claim?.clientName && (
                                <p className="text-xs font-medium text-foreground mb-0.5">
                                  {log.claim.clientName}
                                  {log.claim.claimType && (
                                    <span className="text-muted-foreground ml-1.5">· {log.claim.claimType}</span>
                                  )}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {log.details}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
    </Tabs>
    </FadeIn>
    </div>
  )
}

// ── Test Pipeline Section ─────────────────────────────────────────────────────

interface TestScenarioItem {
  id: string
  name: string
  description: string
  expectedClassification: string
  expectedConfidence: number
  attachmentCount: number
}

interface TestPipelineResult {
  classification: string
  confidence: number
  classificationConfidence: number
  extractionConfidence: number
  claim: {
    id: string
    claimNumber: string
    clientName: string
    claimType: string
    status: string
    processingStage: string
    folderPath: string
    insuranceCompany: { id: string; name: string; folderName: string } | null
    confidenceScore: number
  } | null
  folderPath: string
  duplicate: boolean
  requiresReview: boolean
  printQueueItems: Array<{ id: string; fileName: string; filePath: string; printStatus: string }>
}

function TestPipelineSection() {
  const [scenarios, setScenarios] = useState<TestScenarioItem[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('english_claim')
  const [isRunning, setIsRunning] = useState(false)
  const [testResult, setTestResult] = useState<TestPipelineResult | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  // Fetch available scenarios
  React.useEffect(() => {
    fetch('/api/test-pipeline')
      .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
      .then((data) => setScenarios(data.scenarios || []))
      .catch(() => {})
  }, [])

  const runTest = useMutation({
    mutationFn: async (scenarioId: string): Promise<TestPipelineResult> => {
      // First get test data
      const testDataRes = await fetch('/api/test-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId }),
      })
      if (!testDataRes.ok) throw new Error('Failed to load test scenario')
      const testData = await testDataRes.json()

      // Then run through the full pipeline
      const processRes = await fetch('/api/process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: testData.testData.from,
          subject: testData.testData.subject,
          body: testData.testData.body,
          attachments: testData.testData.attachments || [],
        }),
      })
      if (!processRes.ok) {
        const err = await processRes.json()
        throw new Error(err.details || err.error || 'Pipeline failed')
      }
      return processRes.json()
    },
  })

  const handleRunTest = () => {
    setIsRunning(true)
    setTestResult(null)
    runTest.mutate(selectedScenario, {
      onSuccess: (result) => {
        setTestResult(result)
        setIsRunning(false)
        toast.success(result.classification === 'NEW_CLAIM' ? 'Claim processed successfully' : 'Email classified as IGNORE')
      },
      onError: (error) => {
        setIsRunning(false)
        toast.error(`Pipeline error: ${error.message}`)
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Scenario Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelectedScenario(s.id); setTestResult(null) }}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left cursor-pointer ${
              selectedScenario === s.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'hover:bg-muted/30 border-transparent'
            }`}
          >
            <div className={`mt-0.5 size-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border-2 ${
              selectedScenario === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-muted-foreground/30 text-muted-foreground'
            }`}>
              {s.id === 'english_claim' ? 'EN' : s.id === 'afrikaans_claim' ? 'AF' : s.id === 'non_claim' ? 'NO' : s.id === 'motor_claim_detailed' ? 'MT' : s.id === 'building_claim' ? 'BL' : s.id === 'low_confidence' ? 'LC' : '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className={`text-[10px] ${
                  s.expectedClassification === 'NEW_CLAIM'
                    ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                    : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400'
                }`}>
                  {s.expectedClassification}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {s.attachmentCount} att.
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Run Button */}
      <Button
        onClick={handleRunTest}
        disabled={isRunning}
        className="gap-2 w-full sm:w-auto"
      >
        {isRunning ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Running Pipeline...
          </>
        ) : (
          <>
            <Play className="size-4" />
            Run Pipeline Test
          </>
        )}
      </Button>

      {/* Results */}
      {testResult && (
        <div className="space-y-3">
          <Separator />

          {/* Status Banner */}
          <div className={`rounded-lg p-3 flex items-center gap-3 ${
            testResult.classification === 'NEW_CLAIM'
              ? testResult.requiresReview
                ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
              : 'bg-slate-50 border border-slate-200 dark:bg-slate-800/30 dark:border-slate-700'
          }`}>
            <div className={`size-8 rounded-full flex items-center justify-center ${
              testResult.classification === 'NEW_CLAIM'
                ? testResult.requiresReview
                  ? 'bg-amber-100 dark:bg-amber-900/50'
                  : 'bg-emerald-100 dark:bg-emerald-900/50'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              {testResult.classification === 'NEW_CLAIM'
                ? testResult.requiresReview
                  ? <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                  : <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                : <Ban className="size-4 text-slate-500" />
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {testResult.classification === 'NEW_CLAIM'
                  ? testResult.requiresReview
                    ? 'Claim Created — Requires Manual Review'
                    : 'Claim Created — Auto-Processed'
                  : 'Email Ignored'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confidence: {testResult.confidence}% {testResult.duplicate ? '· Duplicate detected' : ''}
              </p>
            </div>
            <ConfidenceBar value={testResult.confidence} />
          </div>

          {/* Claim Details */}
          {testResult.claim && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Claim Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground">Claim Number</span>
                  <p className="text-sm font-mono font-semibold text-foreground">{testResult.claim.claimNumber}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Client Name</span>
                  <p className="text-sm font-medium text-foreground">{testResult.claim.clientName}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Claim Type</span>
                  <p className="text-sm font-medium text-foreground">{testResult.claim.claimType}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Status</span>
                  <p className="text-sm font-medium text-foreground">{testResult.claim.status}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Insurance Co.</span>
                  <p className="text-sm font-medium text-foreground">
                    {testResult.claim.insuranceCompany?.name || 'Not matched'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Processing Stage</span>
                  <p className="text-sm font-medium text-foreground">{testResult.claim.processingStage}</p>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Folder Path</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono text-foreground/70 p-2 rounded-md bg-background/60 break-all flex-1">
                    {testResult.claim.folderPath}
                  </code>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(testResult.claim?.folderPath || '')
                      toast.success('Path copied to clipboard')
                    }
                  }}>
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>
              {testResult.printQueueItems.length > 0 && (
                <div>
                  <span className="text-[11px] text-muted-foreground">Print Queue Items</span>
                  <div className="space-y-1 mt-1">
                    {testResult.printQueueItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-md bg-background/60">
                        <Paperclip className="size-3 text-muted-foreground" />
                        <span className="text-xs text-foreground truncate flex-1">{item.fileName}</span>
                        <Badge variant="outline" className="text-[10px]">{item.printStatus}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw Response Toggle */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {showRaw ? 'Hide' : 'Show'} raw API response
          </button>
          {showRaw && (
            <pre className="text-xs font-mono text-foreground/60 bg-muted/30 p-3 rounded-lg border overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
