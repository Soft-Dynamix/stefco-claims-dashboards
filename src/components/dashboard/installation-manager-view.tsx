'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Brain,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  Info,
  LayoutGrid,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings2,
  Shield,
  Sparkles,
  Stethoscope,
  Wrench,
  XCircle,
} from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/ui/motion'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigField {
  key: string
  label: string
  description: string
  type: 'text' | 'password' | 'email' | 'number' | 'select' | 'switch'
  placeholder: string
  required: boolean
  sensitive: boolean
  options?: { label: string; value: string }[]
  currentValue: string
  maskedValue: string | null
}

interface ConfigGroup {
  id: string
  label: string
  description: string
  icon: string
  fields: ConfigField[]
}

interface SetupData {
  groups: ConfigGroup[]
  setupComplete: boolean
  completionPercent: number
  totalRequired: number
  completedRequired: number
  missingRequiredFields: { key: string; label: string; groupId: string }[]
}

interface HealthData {
  status: string
  timestamp: string
  version: string
  checks: {
    database: { status: string; latency: number | null; error: string | null }
    ai: { configured: boolean; provider: string; keyPreview: string | null }
    imap: { host: string | null; port: string | null; user: string | null; tls: string | null; configured: boolean }
    smtp: { host: string | null; port: string | null; user: string | null; tls: string | null; configured: boolean }
  }
  system: {
    nodeVersion: string
    platform: string
    osRelease: string
    architecture: string
    hostname: string
    cpuCores: number
    cpuModel: string
    memory: { total: number; free: number; used: number; usagePercent: number; totalFormatted: string; freeFormatted: string; usedFormatted: string }
    uptime: { processUptime: number; osUptime: number; processUptimeFormatted: string; osUptimeFormatted: string }
  }
}

interface DiagnosticResult {
  test: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: Record<string, unknown>
}

interface LogsData {
  timestamp: string
  filter: { type: string; limit: number; returnedCount: number }
  summary: { totalEntries: number; successCount: number; warningCount: number; errorCount: number; successRate: string }
  logs: Array<{
    id: string
    action: string
    details: string | null
    status: string
    processedBy: string | null
    claimNumber: string | null
    clientName: string | null
    claimStatus: string | null
    createdAt: string
  }>
}

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Brain, Mail, Send, Settings2, HardDrive,
}

// ─── Common Issues Data ──────────────────────────────────────────────────────

const COMMON_ISSUES = [
  {
    title: 'Docker not running',
    description: 'Docker Desktop is not started or the Docker daemon is unresponsive.',
    steps: ['Open Docker Desktop from the Start Menu', 'Wait for the Docker engine to start', 'Run "docker info" to verify', 'Restart your computer if the issue persists'],
  },
  {
    title: 'Database connection failed',
    description: 'SQLite database cannot be initialized or accessed.',
    steps: ['Check volume mount in docker-compose.yml', 'Verify the data directory exists', 'Check permissions on the data directory', 'Restart: docker compose restart'],
  },
  {
    title: 'IMAP timeout',
    description: 'Cannot connect to the IMAP email server.',
    steps: ['Verify IMAP_HOST and IMAP_PORT settings', 'Test port connectivity with Telnet', 'For Gmail: Use an App Password', 'Check firewall rules for port 993'],
  },
  {
    title: 'SMTP connection failed',
    description: 'Auto-reply emails are not being sent.',
    steps: ['Verify SMTP_HOST, SMTP_PORT, credentials', 'Some providers use port 465 instead of 587', 'Test credentials with an email client', 'Check if your IP is blocked'],
  },
  {
    title: 'AI rate limited',
    description: 'API returns 429 errors due to rate limiting.',
    steps: ['Free tier has limited requests per minute/day', 'System falls back to alternative providers', 'Consider upgrading to a paid plan', 'Reduce email polling frequency'],
  },
  {
    title: 'Port conflicts',
    description: 'Services fail because ports are already in use.',
    steps: ['Dashboard: port 3000', 'Find what is using a port: netstat -ano | findstr :3000', 'Kill the process or change port mapping', 'Restart the application'],
  },
]

// ─── Sub-Components ──────────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'
  const textColorClass = score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Degraded' : 'Critical'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center" style={{ width: 140, height: 140 }}>
        <svg width={140} height={140} className="-rotate-90" style={{ overflow: 'visible' }}>
          <circle cx={70} cy={70} r={radius} fill="none" stroke="currentColor" strokeWidth={10} className="text-muted/30" />
          <circle cx={70} cy={70} r={radius} fill="none" stroke={color} strokeWidth={10} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-3xl font-bold ${textColorClass}`}>{score}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      <Badge variant="outline" className={`${textColorClass} text-xs font-semibold border-current/30`}>{label}</Badge>
    </div>
  )
}

function ServiceStatusCard({ icon: Icon, name, status, detail, iconColorClass }: { icon: React.ElementType; name: string; status: 'online' | 'offline' | 'warning'; detail: string; iconColorClass: string }) {
  const cfg = {
    online: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', label: 'Online' },
    offline: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800', label: 'Offline' },
    warning: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800', label: 'Warning' },
  }[status]

  return (
    <Card className="py-3 card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center size-10 rounded-xl ${iconColorClass} shrink-0`}><Icon className="size-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{name}</p>
              <div className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{detail}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] font-medium shrink-0 ${cfg.badge}`}>{cfg.label}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function DiagnosticCardComp({ name, status, message, fixSteps }: { name: string; status: 'pass' | 'fail' | 'warning'; message: string; fixSteps?: string[] }) {
  const [showFix, setShowFix] = useState(false)
  const icons = { pass: <CheckCircle2 className="size-5 text-emerald-500" />, fail: <XCircle className="size-5 text-red-500" />, warning: <AlertTriangle className="size-5 text-amber-500" /> }
  const borderColors = { pass: 'border-l-emerald-500', fail: 'border-l-red-500', warning: 'border-l-amber-500' }

  return (
    <div className={`rounded-lg border border-l-4 p-4 ${borderColors[status]}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icons[status]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground mt-1">{message}</p>
          {status !== 'pass' && fixSteps && fixSteps.length > 0 && (
            <div className="mt-3">
              {showFix ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Fix Steps:</p>
                  <ol className="space-y-1 ml-4">{fixSteps.map((step, i) => <li key={i} className="text-xs text-muted-foreground list-decimal">{step}</li>)}</ol>
                  <Button variant="ghost" size="sm" className="h-6 text-xs mt-1" onClick={() => setShowFix(false)}>Hide steps</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 mt-1" onClick={() => setShowFix(true)}><Wrench className="size-3" /> Fix</Button>
              )}
            </div>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] font-semibold shrink-0 ${
          status === 'pass' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            : status === 'fail' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }`}>{status === 'pass' ? 'Passed' : status === 'fail' ? 'Failed' : 'Warning'}</Badge>
      </div>
    </div>
  )
}

// ─── Field Renderer for Forms ─────────────────────────────────────────────────

function ConfigFieldInput({
  field,
  value,
  onChange,
  saving,
}: {
  field: ConfigField
  value: string
  onChange: (key: string, value: string) => void
  saving: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)

  if (field.type === 'switch') {
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-sm font-medium">{field.label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
        </div>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(field.key, checked ? 'true' : 'false')}
          disabled={saving}
        />
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <p className="text-xs text-muted-foreground">{field.description}</p>
        <Select value={value} onValueChange={(v) => onChange(field.key, v)} disabled={saving}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={field.placeholder || 'Select...'} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <p className="text-xs text-muted-foreground">{field.description}</p>
      <div className="relative">
        <Input
          type={field.type === 'password' && !showPassword ? 'password' : field.type}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={saving}
          className={field.type === 'password' ? 'pr-10' : ''}
        />
        {field.type === 'password' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 'check', label: 'System Check', icon: Stethoscope },
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'ai', label: 'AI Configuration', icon: Brain },
  { id: 'email', label: 'Email Setup', icon: Mail },
  { id: 'processing', label: 'Processing Rules', icon: Settings2 },
  { id: 'review', label: 'Review & Complete', icon: ClipboardCheck },
]

// ─── Setup Wizard Tab ─────────────────────────────────────────────────────────

function SetupWizardTab({ setupData, groupsRefetch }: { setupData: SetupData | undefined; groupsRefetch: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState<string | null>(null)

  const healthQuery = useQuery<HealthData>({
    queryKey: ['installer-health-wizard'],
    queryFn: () => fetch('/api/installer/health').then(r => r.ok ? r.json() : null),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  })

  // Initialize form values from setup data
  useEffect(() => {
    if (!setupData?.groups) return
    const newValues: Record<string, Record<string, string>> = {}
    for (const group of setupData.groups) {
      newValues[group.id] = {}
      for (const field of group.fields) {
        newValues[group.id][field.key] = field.currentValue
      }
    }
    setFormValues(newValues)
  }, [setupData])

  const handleFieldChange = useCallback((groupId: string, key: string, value: string) => {
    setFormValues(prev => ({
      ...prev,
      [groupId]: { ...prev[groupId], [key]: value },
    }))
  }, [])

  const saveGroup = useCallback(async (groupId: string) => {
    if (!formValues[groupId]) return
    setSaving(true)
    try {
      const res = await fetch('/api/installer/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: groupId, values: formValues[groupId] }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data.updated} configuration(s) saved`)
        groupsRefetch()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch {
      toast.error('Network error while saving')
    } finally {
      setSaving(false)
    }
  }, [formValues, groupsRefetch])

  const handleValidate = useCallback(async (action: string, label: string) => {
    setValidating(action)
    try {
      const res = await fetch('/api/installer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${label}: ${data.message}`)
      } else {
        toast.error(`${label}: ${data.message}`)
      }
    } catch {
      toast.error(`Failed to test ${label}`)
    } finally {
      setValidating(null)
    }
  }, [])

  const handleSeedFromEnv = useCallback(async () => {
    setValidating('seed')
    try {
      const res = await fetch('/api/installer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed-from-env' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        groupsRefetch()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('Failed to seed from environment')
    } finally {
      setValidating(null)
    }
  }, [groupsRefetch])

  const stepGroupMap = ['check', 'company', 'ai', 'email', 'processing', 'review']

  const next = () => {
    // Auto-save on leaving a form step
    const stepGroupId = stepGroupMap[currentStep]
    if (stepGroupId !== 'check' && stepGroupId !== 'review' && formValues[stepGroupId]) {
      saveGroup(stepGroupId)
    }
    setCurrentStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }
  const prev = () => setCurrentStep(s => Math.max(s - 1, 0))

  const completionPercent = setupData?.completionPercent ?? 0

  return (
    <FadeIn>
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Setup Progress</span>
          <span className="text-sm font-semibold">{completionPercent}%</span>
        </div>
        <Progress value={completionPercent} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step, i) => {
          const Icon = step.icon
          const isCompleted = i < currentStep
          const isCurrent = i === currentStep
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isCurrent ? 'bg-primary text-primary-foreground' :
                isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' :
                'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          )
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 0: System Check */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><Stethoscope className="size-5" /> System Health Check</h3>
                <p className="text-sm text-muted-foreground mt-1">Verifying system components before configuration.</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  healthQuery.refetch()
                  toast.success('Health check refreshed')
                }}
                disabled={healthQuery.isLoading}
              >
                <RefreshCw className={`size-3.5 ${healthQuery.isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSeedFromEnv}
                disabled={validating === 'seed'}
              >
                <Download className="size-3.5" />
                {validating === 'seed' ? 'Seeding...' : 'Seed from Environment'}
              </Button>

              {healthQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : healthQuery.data ? (
                <div className="space-y-3">
                  {/* Database */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    {healthQuery.data.checks.database.status === 'connected' ?
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> :
                      <XCircle className="size-5 text-red-500 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Database</p>
                      <p className="text-xs text-muted-foreground">{healthQuery.data.checks.database.status === 'connected' ? `Connected (${healthQuery.data.checks.database.latency}ms)` : healthQuery.data.checks.database.error}</p>
                    </div>
                    <Badge variant="outline" className={healthQuery.data.checks.database.status === 'connected' ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'}>
                      {healthQuery.data.checks.database.status}
                    </Badge>
                  </div>

                  {/* AI */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    {healthQuery.data.checks.ai.configured ?
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> :
                      <AlertTriangle className="size-5 text-amber-500 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">AI Provider</p>
                      <p className="text-xs text-muted-foreground">{healthQuery.data.checks.ai.configured ? `${healthQuery.data.checks.ai.provider} configured` : 'No API key configured'}</p>
                    </div>
                    <Badge variant="outline" className={healthQuery.data.checks.ai.configured ? 'text-emerald-600 border-emerald-300' : 'text-amber-600 border-amber-300'}>
                      {healthQuery.data.checks.ai.configured ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>

                  {/* IMAP */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    {healthQuery.data.checks.imap.configured ?
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> :
                      <XCircle className="size-5 text-red-500 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">IMAP Email</p>
                      <p className="text-xs text-muted-foreground">{healthQuery.data.checks.imap.configured ? `${healthQuery.data.checks.imap.host}:${healthQuery.data.checks.imap.port}` : 'Not configured'}</p>
                    </div>
                    <Badge variant="outline" className={healthQuery.data.checks.imap.configured ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'}>
                      {healthQuery.data.checks.imap.configured ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>

                  {/* SMTP */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border">
                    {healthQuery.data.checks.smtp.configured ?
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> :
                      <XCircle className="size-5 text-red-500 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">SMTP Email</p>
                      <p className="text-xs text-muted-foreground">{healthQuery.data.checks.smtp.configured ? `${healthQuery.data.checks.smtp.host}:${healthQuery.data.checks.smtp.port}` : 'Not configured'}</p>
                    </div>
                    <Badge variant="outline" className={healthQuery.data.checks.smtp.configured ? 'text-emerald-600 border-emerald-300' : 'text-red-600 border-red-300'}>
                      {healthQuery.data.checks.smtp.configured ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Click &quot;Refresh&quot; to run the health check.</p>
              )}
            </div>
          )}

          {/* Step 1: Company Info */}
          {currentStep === 1 && setupData?.groups && (
            <FormStep
              title="Company Information"
              description="Set up your company details for the system."
              group={setupData.groups.find(g => g.id === 'company')!}
              values={formValues.company || {}}
              onChange={(key, val) => handleFieldChange('company', key, val)}
              onSave={() => saveGroup('company')}
              saving={saving}
            />
          )}

          {/* Step 2: AI Configuration */}
          {currentStep === 2 && setupData?.groups && (
            <div className="space-y-6">
              <FormStep
                title="AI Provider Configuration"
                description="Set up the AI service for email classification and data extraction."
                group={setupData.groups.find(g => g.id === 'ai')!}
                values={formValues.ai || {}}
                onChange={(key, val) => handleFieldChange('ai', key, val)}
                onSave={() => saveGroup('ai')}
                saving={saving}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => saveGroup('ai').then(() => handleValidate('validate-ai', 'AI Connection'))}
                  disabled={validating === 'validate-ai' || saving}
                >
                  {validating === 'validate-ai' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Test Connection
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Email Setup */}
          {currentStep === 3 && setupData?.groups && (
            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Mail className="size-4" /> Incoming Email (IMAP)
                </h4>
                <FormStep
                  group={setupData.groups.find(g => g.id === 'imap')!}
                  values={formValues.imap || {}}
                  onChange={(key, val) => handleFieldChange('imap', key, val)}
                  onSave={() => saveGroup('imap')}
                  saving={saving}
                  hideTitle
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-3"
                  onClick={() => saveGroup('imap').then(() => handleValidate('validate-imap', 'IMAP'))}
                  disabled={validating === 'validate-imap' || saving}
                >
                  {validating === 'validate-imap' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Test IMAP Connection
                </Button>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Send className="size-4" /> Outgoing Email (SMTP)
                </h4>
                <FormStep
                  group={setupData.groups.find(g => g.id === 'smtp')!}
                  values={formValues.smtp || {}}
                  onChange={(key, val) => handleFieldChange('smtp', key, val)}
                  onSave={() => saveGroup('smtp')}
                  saving={saving}
                  hideTitle
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-3"
                  onClick={() => saveGroup('smtp').then(() => handleValidate('validate-smtp', 'SMTP'))}
                  disabled={validating === 'validate-smtp' || saving}
                >
                  {validating === 'validate-smtp' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  Test SMTP Connection
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Processing Rules */}
          {currentStep === 4 && setupData?.groups && (
            <div className="space-y-6">
              <FormStep
                title="Processing Rules"
                description="Configure automated claim processing behavior."
                group={setupData.groups.find(g => g.id === 'processing')!}
                values={formValues.processing || {}}
                onChange={(key, val) => handleFieldChange('processing', key, val)}
                onSave={() => saveGroup('processing')}
                saving={saving}
              />
              {/* Storage */}
              <Separator />
              <FormStep
                title="Storage Configuration"
                description="Configure file storage for claims and documents."
                group={setupData.groups.find(g => g.id === 'storage')!}
                values={formValues.storage || {}}
                onChange={(key, val) => handleFieldChange('storage', key, val)}
                onSave={() => saveGroup('storage')}
                saving={saving}
              />
            </div>
          )}

          {/* Step 5: Review & Complete */}
          {currentStep === 5 && setupData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="size-5" /> Review Configuration</h3>
                <p className="text-sm text-muted-foreground mt-1">Review all configured values before completing setup.</p>
              </div>

              {setupData.missingRequiredFields.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Missing Required Fields</p>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {setupData.missingRequiredFields.map(f => (
                      <li key={f.key} className="text-xs text-amber-700 dark:text-amber-300 list-disc">
                        {f.label} — <span className="font-medium">{f.groupId}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                {setupData.groups.map(group => {
                  const filledFields = group.fields.filter(f => f.currentValue)
                  const requiredFilled = group.fields.filter(f => f.required && f.currentValue)
                  const requiredTotal = group.fields.filter(f => f.required)
                  const Icon = ICON_MAP[group.icon] || Settings2
                  return (
                    <div key={group.id} className="p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">{group.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {requiredFilled.length}/{requiredTotal.length} required
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {group.fields.map(field => (
                          <div key={field.key} className="flex justify-between py-0.5">
                            <span className="text-xs text-muted-foreground">{field.label}</span>
                            <span className="text-xs font-medium truncate max-w-[200px]">
                              {field.currentValue
                                ? (field.sensitive ? (field.maskedValue || '••••') : field.currentValue)
                                : <span className="text-muted-foreground italic">Not set</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => {
                  // Save all groups
                  Promise.all(
                    Object.keys(formValues).map(gid => saveGroup(gid))
                  ).then(() => {
                    toast.success('Setup complete! All configurations have been saved.')
                  })
                }}
                disabled={saving}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save & Complete Setup
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button variant="outline" onClick={prev} disabled={currentStep === 0} className="gap-2">
              <ChevronLeft className="size-4" /> Back
            </Button>
            <span className="text-xs text-muted-foreground self-center">
              Step {currentStep + 1} of {WIZARD_STEPS.length}
            </span>
            <Button onClick={next} disabled={currentStep === WIZARD_STEPS.length - 1} className="gap-2">
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  )
}

// ─── Form Step ────────────────────────────────────────────────────────────────

function FormStep({
  title,
  description,
  group,
  values,
  onChange,
  onSave,
  saving,
  hideTitle,
  children,
}: {
  title?: string
  description?: string
  group: ConfigGroup
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSave: () => void
  saving: boolean
  hideTitle?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {!hideTitle && title && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {React.createElement(ICON_MAP[group.icon] || Settings2, { className: 'size-5' })}
            {title}
          </h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {group.fields.map(field => (
          <ConfigFieldInput
            key={field.key}
            field={field}
            value={values[field.key] || ''}
            onChange={onChange}
            saving={saving}
          />
        ))}
      </div>
      {children}
      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Save
        </Button>
      </div>
    </div>
  )
}

// ─── System Health Tab ────────────────────────────────────────────────────────

function SystemHealthTab() {
  const [lastChecked, setLastChecked] = useState<string>('Not yet checked')
  const { data, isLoading, refetch, isFetching } = useQuery<HealthData>({
    queryKey: ['installer-health'],
    queryFn: () => fetch('/api/installer/health').then(r => r.ok ? r.json() : null),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  })

  const handleRefresh = useCallback(() => {
    refetch().then(() => {
      setLastChecked(new Date().toLocaleTimeString())
      toast.success('Health data refreshed')
    })
  }, [refetch])

  // Auto-refresh on mount
  useEffect(() => {
    const doRefresh = async () => {
      await refetch()
      setLastChecked(new Date().toLocaleTimeString())
    }
    doRefresh()
  }, [])

  const getHealthScore = useCallback((health: HealthData) => {
    let score = 0
    if (health.checks.database.status === 'connected') score += 30
    if (health.checks.ai.configured) score += 25
    if (health.checks.imap.configured) score += 20
    if (health.checks.smtp.configured) score += 25
    return score
  }, [])

  return (
    <FadeIn>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">System Health</h3>
          <p className="text-xs text-muted-foreground">Last checked: {lastChecked}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="gap-2">
          <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Skeleton className="h-[140px] w-[140px] rounded-full" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Health Gauge */}
          <Card className="p-6">
            <CardContent className="flex flex-col items-center gap-2">
              <HealthGauge score={getHealthScore(data)} />
              <p className="text-sm text-muted-foreground text-center mt-2">
                Overall system health score based on critical service status
              </p>
            </CardContent>
          </Card>

          {/* Service Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ServiceStatusCard
              icon={Server}
              name="Dashboard"
              status="online"
              detail={`v${data.version || '2.3.0'}`}
              iconColorClass="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            />
            <ServiceStatusCard
              icon={Database}
              name="Database"
              status={data.checks.database.status === 'connected' ? 'online' : 'offline'}
              detail={data.checks.database.status === 'connected' ? `Connected (${data.checks.database.latency}ms)` : 'Disconnected'}
              iconColorClass="bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400"
            />
            <ServiceStatusCard
              icon={Mail}
              name="IMAP Email"
              status={data.checks.imap.configured ? 'online' : 'offline'}
              detail={data.checks.imap.configured ? `${data.checks.imap.host}:${data.checks.imap.port}` : 'Not configured'}
              iconColorClass="bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
            />
            <ServiceStatusCard
              icon={Send}
              name="SMTP Email"
              status={data.checks.smtp.configured ? 'online' : 'offline'}
              detail={data.checks.smtp.configured ? `${data.checks.smtp.host}:${data.checks.smtp.port}` : 'Not configured'}
              iconColorClass="bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
            />
            <ServiceStatusCard
              icon={Brain}
              name="AI Provider"
              status={data.checks.ai.configured ? 'online' : 'offline'}
              detail={data.checks.ai.configured ? `${data.checks.ai.provider} configured` : 'No API key'}
              iconColorClass="bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400"
            />
          </div>

          {/* System Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="size-4" /> System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Node.js</p>
                  <p className="text-sm font-medium font-mono">{data.system.nodeVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="text-sm font-medium">{data.system.platform} {data.system.architecture}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPU Cores</p>
                  <p className="text-sm font-medium">{data.system.cpuCores}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Memory Usage</p>
                  <p className="text-sm font-medium">{data.system.memory.usedFormatted} / {data.system.memory.totalFormatted}</p>
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                      <span>{data.system.memory.usagePercent}% used</span>
                    </div>
                    <Progress value={data.system.memory.usagePercent} className="h-1.5" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Process Uptime</p>
                  <p className="text-sm font-medium">{data.system.uptime.processUptimeFormatted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OS Uptime</p>
                  <p className="text-sm font-medium">{data.system.uptime.osUptimeFormatted}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Unable to load health data.</p>
        </div>
      )}
    </FadeIn>
  )
}

// ─── Diagnostics Tab ──────────────────────────────────────────────────────────

function DiagnosticsTab() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [running, setRunning] = useState(false)
  const [runningTest, setRunningTest] = useState<string | null>(null)

  const TEST_NAMES: Record<string, string> = {
    database: 'Database Connection',
    'ai-key': 'AI API Key',
    imap: 'IMAP Configuration',
    smtp: 'SMTP Configuration',
    'disk-space': 'System Resources',
    ports: 'Port Availability',
  }

  const TEST_FIXES: Record<string, string[]> = {
    database: ['Check DATABASE_URL in .env', 'Verify SQLite file permissions', 'Restart the application'],
    'ai-key': ['Set GEMINI_API_KEY in Settings > AI Configuration', 'Verify the key starts with "AIza..."', 'Check for typos in the key'],
    imap: ['Configure IMAP host, port, user, and password', 'For Gmail: use an App Password', 'Check firewall allows port 993'],
    smtp: ['Configure SMTP host, port, user, and password', 'Try port 465 for SSL or 587 for STARTTLS', 'Verify SMTP credentials with an email client'],
    'disk-space': ['Close unused applications', 'Increase Docker memory limit', 'Add swap space if RAM is limited'],
    ports: ['Stop other services using ports 3000 or 5678', 'Change port mapping in docker-compose.yml', 'Kill conflicting processes'],
  }

  const runTest = useCallback(async (testName: string) => {
    setRunningTest(testName)
    try {
      const res = await fetch('/api/installer/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: testName }),
      })
      const data = await res.json()
      if (data.results) {
        setResults(prev => {
          const filtered = prev.filter(r => r.test !== testName)
          return [...filtered, ...data.results]
        })
      }
    } catch {
      toast.error(`Failed to run test: ${testName}`)
    } finally {
      setRunningTest(null)
    }
  }, [])

  const runAll = useCallback(async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/installer/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'all' }),
      })
      const data = await res.json()
      if (data.results) {
        setResults(data.results)
        toast.success(`Completed ${data.results.length} diagnostic tests`)
      }
    } catch {
      toast.error('Failed to run diagnostics')
    } finally {
      setRunning(false)
    }
  }, [])

  return (
    <FadeIn>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">System Diagnostics</h3>
          <p className="text-sm text-muted-foreground">Run diagnostic tests to identify and troubleshoot issues.</p>
        </div>
        <Button onClick={runAll} disabled={running} className="gap-2">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run All Tests
        </Button>
      </div>

      {/* Summary badges */}
      {results.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
            {results.filter(r => r.status === 'pass').length} Passed
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800">
            {results.filter(r => r.status === 'fail').length} Failed
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            {results.filter(r => r.status === 'warning').length} Warnings
          </Badge>
        </div>
      )}

      {/* Individual test buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(TEST_NAMES).map(([testId, testName]) => (
          <Button
            key={testId}
            variant="outline"
            size="sm"
            className="gap-2 justify-start"
            onClick={() => runTest(testId)}
            disabled={runningTest === testId}
          >
            {runningTest === testId ? <Loader2 className="size-3.5 animate-spin" /> : <Stethoscope className="size-3.5" />}
            {testName}
          </Button>
        ))}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="size-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No diagnostic results yet. Run a test to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <DiagnosticCardComp
              key={result.test}
              name={TEST_NAMES[result.test] || result.test}
              status={result.status}
              message={result.message}
              fixSteps={TEST_FIXES[result.test]}
            />
          ))}
        </div>
      )}

      {/* Common Issues */}
      <Separator className="my-8" />
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Info className="size-4" /> Common Issues & Fixes</h4>
        <Accordion type="single" collapsible className="space-y-2">
          {COMMON_ISSUES.map((issue, i) => (
            <AccordionItem key={i} value={`issue-${i}`} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline text-sm font-medium">{issue.title}</AccordionTrigger>
              <AccordionContent>
                <p className="text-xs text-muted-foreground mb-2">{issue.description}</p>
                <ol className="space-y-1 ml-4">
                  {issue.steps.map((step, j) => (
                    <li key={j} className="text-xs text-muted-foreground list-decimal">{step}</li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </FadeIn>
  )
}

// ─── Activity Logs Tab ────────────────────────────────────────────────────────

function ActivityLogsTab() {
  const [logFilter, setLogFilter] = useState<'all' | 'ERROR' | 'WARNING' | 'SUCCESS'>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<LogsData>({
    queryKey: ['installer-logs', logFilter],
    queryFn: () => fetch(`/api/installer/logs?type=${logFilter === 'all' ? 'all' : logFilter}&limit=100`).then(r => r.ok ? r.json() : null),
    refetchOnWindowFocus: false,
    refetchInterval: autoRefresh ? 10000 : false,
    retry: 2,
    retryDelay: 1000,
  })

  const filterButtons: { label: string; value: 'all' | 'ERROR' | 'WARNING' | 'SUCCESS'; color: string }[] = [
    { label: 'All', value: 'all', color: '' },
    { label: 'Errors', value: 'ERROR', color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
    { label: 'Warnings', value: 'WARNING', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
    { label: 'Success', value: 'SUCCESS', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  ]

  return (
    <FadeIn>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Activity Logs</h3>
          <p className="text-sm text-muted-foreground">Audit log entries from system operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="text-xs text-muted-foreground">Auto-refresh</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filterButtons.map(fb => (
          <Button
            key={fb.value}
            variant={logFilter === fb.value ? 'default' : 'outline'}
            size="sm"
            className={logFilter === fb.value && fb.color ? fb.color : ''}
            onClick={() => setLogFilter(fb.value)}
          >
            {fb.label}
          </Button>
        ))}
      </div>

      {/* Summary Stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card className="py-3">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{data.summary.totalEntries}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.summary.successCount}</p>
              <p className="text-xs text-muted-foreground">Success</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.summary.warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.summary.errorCount}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : data?.logs && data.logs.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden sm:table-cell">Details</TableHead>
                    <TableHead className="hidden md:table-cell">Claim</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium ${
                          log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : log.status === 'ERROR' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800'
                          : log.status === 'WARNING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                        }`}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">{log.action}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{log.details}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {log.claimNumber ? (
                          <span className="font-mono">{log.claimNumber}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No log entries found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

// ─── Configuration Tab ────────────────────────────────────────────────────────

function ConfigurationTab({ setupData, groupsRefetch }: { setupData: SetupData | undefined; groupsRefetch: () => void }) {
  const [editField, setEditField] = useState<{ groupId: string; field: ConfigField } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configSearch, setConfigSearch] = useState('')

  const handleOpenEdit = useCallback((groupId: string, field: ConfigField) => {
    // For sensitive fields, don't pre-fill the edit with masked value
    setEditValue(field.sensitive ? '' : field.currentValue)
    setShowPassword(false)
    setEditField({ groupId, field })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editField) return
    setSaving(true)
    try {
      const res = await fetch('/api/installer/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: editField.groupId,
          values: { [editField.field.key]: editValue },
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${editField.field.label} updated`)
        groupsRefetch()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
      setEditField(null)
    }
  }, [editField, editValue, groupsRefetch])

  const handleExportConfig = useCallback(() => {
    if (!setupData) return
    const lines: string[] = ['# Stefco Claims Processing System - Configuration Export', `# Generated: ${new Date().toISOString()}`, '']
    for (const group of setupData.groups) {
      lines.push(`# ─── ${group.label} ───`)
      for (const field of group.fields) {
        const val = field.currentValue || '(not set)'
        lines.push(`${field.key}=${val}`)
      }
      lines.push('')
    }
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => toast.success('Configuration copied to clipboard'))
  }, [setupData])

  if (!setupData?.groups) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    )
  }

  const filteredGroups = configSearch
    ? setupData.groups.map(g => ({
        ...g,
        fields: g.fields.filter(f =>
          f.label.toLowerCase().includes(configSearch.toLowerCase()) ||
          f.key.toLowerCase().includes(configSearch.toLowerCase()) ||
          f.description.toLowerCase().includes(configSearch.toLowerCase())
        ),
      })).filter(g => g.fields.length > 0)
    : setupData.groups

  return (
    <FadeIn>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Configuration</h3>
          <p className="text-sm text-muted-foreground">View and edit all system configuration values.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportConfig} className="gap-2">
            <Copy className="size-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search configuration fields..."
          value={configSearch}
          onChange={(e) => setConfigSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grouped Accordions */}
      <Accordion type="multiple" defaultValue={filteredGroups.map(g => g.id)} className="space-y-2">
        {filteredGroups.map(group => {
          const Icon = ICON_MAP[group.icon] || Settings2
          const filledCount = group.fields.filter(f => f.currentValue).length
          return (
            <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-muted"><Icon className="size-4" /></div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{group.label}</p>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] ml-2">{filledCount}/{group.fields.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {group.fields.map(field => (
                    <div key={field.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{field.label}</p>
                          {field.required && <span className="text-red-500 text-xs">*</span>}
                          {field.sensitive && <Shield className="size-3 text-amber-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-muted-foreground max-w-[180px] truncate">
                          {field.currentValue
                            ? (field.sensitive ? (field.maskedValue || '••••') : field.currentValue)
                            : <span className="italic text-muted-foreground/60">Not configured</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOpenEdit(group.id, field)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Edit Dialog */}
      <Dialog open={!!editField} onOpenChange={(open) => { if (!open) setEditField(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {editField?.field.label}</DialogTitle>
            <DialogDescription>{editField?.field.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">Key: {editField?.field.key}</Label>
            {editField?.field.type === 'select' && editField.field.options ? (
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editField.field.options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : editField?.field.type === 'switch' ? (
              <div className="flex items-center gap-3 py-2">
                <Switch checked={editValue === 'true'} onCheckedChange={(checked) => setEditValue(checked ? 'true' : 'false')} />
                <span className="text-sm">{editValue === 'true' ? 'Enabled' : 'Disabled'}</span>
              </div>
            ) : (
              <div className="relative">
                <Input
                  type={editField?.field.sensitive && !showPassword ? 'password' : 'text'}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={editField?.field.placeholder}
                />
                {editField?.field.sensitive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                )}
              </div>
            )}
            {editField?.field.sensitive && (
              <p className="text-[10px] text-muted-foreground">Leave empty to keep the existing value unchanged.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditField(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FadeIn>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const TAB_META: Record<string, { title: string; description: string; icon: React.ElementType }> = {
  wizard:    { title: 'Setup Wizard',       description: 'Guided configuration wizard for initial system setup.',                icon: Sparkles },
  health:    { title: 'System Health',      description: 'Monitor real-time health status of all connected services.',           icon: Activity },
  diagnostics:{ title: 'Diagnostics',        description: 'Run diagnostic tests and troubleshoot common issues.',                icon: Stethoscope },
  logs:      { title: 'Activity Logs',      description: 'View detailed system activity logs and event history.',                icon: FileText },
  config:    { title: 'Configuration',      description: 'View and manage all system configuration settings.',                   icon: Settings2 },
}

export function InstallationManagerView() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('wizard')

  const { data: setupData, isLoading: setupLoading, refetch: groupsRefetch } = useQuery<SetupData>({
    queryKey: ['installer-setup'],
    queryFn: () => fetch('/api/installer/setup').then(r => r.ok ? r.json() : null),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  })

  const currentTab = TAB_META[activeTab] || TAB_META.wizard
  const TabIcon = currentTab.icon

  return (
    <div className="space-y-6">
      {/* Page Header — updates dynamically with active tab */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <TabIcon className="size-6" />
          {currentTab.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {currentTab.description}
        </p>
      </div>

      {setupLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-[400px]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted p-1">
            <TabsTrigger value="wizard" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-foreground">
              <Sparkles className="size-3.5" />
              Setup Wizard
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-foreground">
              <Activity className="size-3.5" />
              System Health
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-foreground">
              <Stethoscope className="size-3.5" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-foreground">
              <FileText className="size-3.5" />
              Activity Logs
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-foreground">
              <Settings2 className="size-3.5" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wizard">
            <SetupWizardTab setupData={setupData} groupsRefetch={() => groupsRefetch()} />
          </TabsContent>

          <TabsContent value="health">
            <SystemHealthTab />
          </TabsContent>

          <TabsContent value="diagnostics">
            <DiagnosticsTab />
          </TabsContent>

          <TabsContent value="logs">
            <ActivityLogsTab />
          </TabsContent>

          <TabsContent value="config">
            <ConfigurationTab setupData={setupData} groupsRefetch={() => groupsRefetch()} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
