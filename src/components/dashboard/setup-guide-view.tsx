'use client'

import React, { useState, useCallback } from 'react'
import {
  BookOpen,
  Terminal,
  Settings,
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Play,
  ChevronDown,
  Check,
  Info,
  Lightbulb,
  FolderOpen,
  Send,
  RotateCcw,
  Loader2,
  HelpCircle,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

// ─── Code Block with Copy Button ─────────────────────────────────────────────
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true)
        toast.success('Copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [code])

  return (
    <div className="relative group rounded-lg border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/80">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed custom-scrollbar">
        <code className="text-foreground font-mono">{code}</code>
      </pre>
    </div>
  )
}

// ─── Callout Box ──────────────────────────────────────────────────────────────
function CalloutBox({
  type = 'tip',
  children,
}: {
  type?: 'tip' | 'warning' | 'info'
  children: React.ReactNode
}) {
  const styles = {
    tip: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
    warning: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200',
    info: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-200',
  }

  const icons = {
    tip: <Lightbulb className="size-4 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="size-4 shrink-0 mt-0.5" />,
    info: <Info className="size-4 shrink-0 mt-0.5" />,
  }

  const labels = {
    tip: 'Tip',
    warning: 'Warning',
    info: 'Note',
  }

  return (
    <div className={`rounded-lg border p-4 ${styles[type]}`}>
      <div className="flex gap-2.5">
        {icons[type]}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1">{labels[type]}</p>
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Step Badge ───────────────────────────────────────────────────────────────
function StepBadge({ number, completed }: { number: number; completed: boolean }) {
  return (
    <div
      className={`flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 ${
        completed
          ? 'bg-emerald-500 text-white'
          : 'bg-primary/10 text-primary'
      }`}
    >
      {completed ? <Check className="size-3.5" /> : number}
    </div>
  )
}

// ─── Test Email Data ──────────────────────────────────────────────────────────
const testEmails = [
  {
    id: 'en-claim',
    title: 'English Motor Claim',
    language: 'English',
    description: 'A standard motor vehicle claim notification in English.',
    code: `{
  "to": "claims@stefco-assess.co.za",
  "from": "john.vandermerwe@gmail.com",
  "subject": "Claim Notification - Vehicle Accident",
  "body": "Dear Sir/Madam,\\n\\nI would like to report a motor vehicle accident that occurred on 15 March 2024 at the intersection of R55 and John Vorster Drive in Centurion.\\n\\nMy vehicle, a 2022 Toyota Hilux (Registration: GP 123 ABC), was hit from behind while stationary at a red robot. The other driver was in a Ford Ranger.\\n\\nMy policy number is OUT-789456. I would appreciate if you could assist me with this claim.\\n\\nRegards,\\nJohann van der Merwe\\n072 345 6789"
}`,
  },
  {
    id: 'af-claim',
    title: 'Afrikaans Motor Claim',
    language: 'Afrikaans',
    description: 'A motor vehicle claim notification in Afrikaans.',
    code: `{
  "to": "claims@stefco-assess.co.za",
  "from": "piet.duplessis@webmail.co.za",
  "subject": "Eis Kennisgewing - Voertuig Ongeval",
  "body": "Geaghe Heer/Dame,\\n\\nEk wil graag 'n motorvoertuigongeluk rapporteer wat plaasgevind het op 20 Maart 2024 by die kruising van N1 en R21 in Pretoria.\\n\\nMy voertuig, 'n 2021 Volkswagen Polo (Registrasie: CA 456 XYZ), is getref deur 'n onbeheerde voertuig wat deur 'n rooi lig gery het.\\n\\nMy polisnommer is SAS-123789. Ek sal dit waardeer as u my met hierdie eis kan help.\\n\\nMet vriendelike groete,\\nPiet du Plessis\\n083 678 9012"
}`,
  },
  {
    id: 'non-claim',
    title: 'Non-Claim Email',
    language: 'English',
    description: 'A general inquiry that is NOT a claim — tests classification accuracy.',
    code: `{
  "to": "claims@stefco-assess.co.za",
  "from": "maria.smit@company.co.za",
  "subject": "Quote Request for Insurance Coverage",
  "body": "Good day,\\n\\nI am writing to request a quote for comprehensive motor vehicle insurance. I recently purchased a 2023 Hyundai Tucson and would like to get coverage.\\n\\nI am currently insured with another provider but am looking for better rates. Could you please provide me with your best quotation?\\n\\nThank you,\\nMaria Smit\\n061 234 5678"
}`,
  },
]

// ─── Env Variables Data ───────────────────────────────────────────────────────
const envVariables = [
  { variable: 'IMAP_HOST', description: 'IMAP server hostname', example: 'mail.yourcompany.co.za', required: true },
  { variable: 'IMAP_PORT', description: 'IMAP server port', example: '993', required: true },
  { variable: 'IMAP_USER', description: 'IMAP login email', example: 'claims@yourcompany.co.za', required: true },
  { variable: 'IMAP_PASSWORD', description: 'IMAP login password or app password', example: 'your-app-password', required: true },
  { variable: 'IMAP_MAILBOX', description: 'IMAP mailbox/folder to monitor', example: 'INBOX', required: false },
  { variable: 'SMTP_HOST', description: 'SMTP server hostname', example: 'mail.yourcompany.co.za', required: true },
  { variable: 'SMTP_PORT', description: 'SMTP server port', example: '587', required: true },
  { variable: 'SMTP_USER', description: 'SMTP login email', example: 'noreply@yourcompany.co.za', required: true },
  { variable: 'SMTP_PASSWORD', description: 'SMTP login password', example: 'your-smtp-password', required: true },
  { variable: 'SMTP_FROM_NAME', description: 'Display name for auto-replies', example: 'Stefco Claims', required: false },
  { variable: 'GEMINI_API_KEY', description: 'Google Gemini API key (free tier)', example: 'AIza...', required: true },
  { variable: 'GEMINI_MODEL', description: 'Gemini model to use', example: 'gemini-2.5-flash', required: false },
  { variable: 'BASE_URL', description: 'Public URL for webhooks and dashboard', example: 'https://claims.yourcompany.co.za', required: true },
  { variable: 'DB_PATH', description: 'SQLite database file path', example: '/data/claims.db', required: false },
  { variable: 'SHARE_DRIVE', description: 'Windows network share path (Z: drive)', example: '\\\\\\\\server\\\\claims-share', required: true },
  { variable: 'PRINT_QUEUE_ENABLED', description: 'Enable/disable print queue', example: 'true', required: false },
  { variable: 'AUTO_REPLY_ENABLED', description: 'Enable/disable auto-reply emails', example: 'true', required: false },
  { variable: 'CONFIDENCE_THRESHOLD', description: 'Min confidence for auto-processing (%)', example: '70', required: false },
  { variable: 'BUSINESS_HOURS_START', description: 'Business hours start time', example: '08:00', required: false },
  { variable: 'BUSINESS_HOURS_END', description: 'Business hours end time', example: '17:00', required: false },
]

// ─── Insurance Companies Data ─────────────────────────────────────────────────
const seededCompanies = [
  { name: 'OUTsurance', folder: 'OUTsurance', domains: ['outsurance.com', 'outsurance.co.za'] },
  { name: 'Santam', folder: 'Santam', domains: ['santam.co.za'] },
  { name: 'Old Mutual', folder: 'OldMutual', domains: ['oldmutual.co.za'] },
  { name: 'Hollard', folder: 'Hollard', domains: ['hollard.co.za'] },
  { name: 'Discovery Insure', folder: 'Discovery', domains: ['discovery.co.za'] },
  { name: 'Momentum', folder: 'Momentum', domains: ['momentum.co.za'] },
  { name: 'MIWAY', folder: 'MIWAY', domains: ['miway.co.za'] },
  { name: 'Auto & General', folder: 'AutoGeneral', domains: ['ag.co.za', 'autoandgeneral.co.za'] },
]

// ─── Troubleshooting FAQ Data ─────────────────────────────────────────────────
const faqItems = [
  {
    question: 'IMAP connection keeps timing out',
    answer: 'Check your firewall settings — IMAP uses port 993 (SSL/TLS). Ensure your email provider allows IMAP access (some providers require you to explicitly enable it). If using Gmail, you need an "App Password" rather than your regular password. Verify the IMAP_HOST and IMAP_PORT in your .env file.',
  },
  {
    question: 'AI classification is inaccurate',
    answer: 'This usually happens when the Gemini API key is missing or rate-limited. Check that your GEMINI_API_KEY is valid and has sufficient quota. The free tier allows 15 requests per minute and 1,500 per day. If you exceed this, the system falls back to Groq or Ollama. You can also try lowering the CONFIDENCE_THRESHOLD to flag more claims for manual review.',
  },
  {
    question: 'Folder permission issues on Windows share',
    answer: 'Ensure the Docker container has proper mount permissions for the Z:\\ drive share. In your docker-compose.yml, the volume mount should use the correct path. On Windows, you may need to share the folder and grant read/write permissions to the user running Docker. Try running `docker exec -it <container> ls /data` to verify the mount is working.',
  },
  {
    question: 'Print queue items stay in "Queued" status',
    answer: 'The print queue processes items only during configured business hours. Check BUSINESS_HOURS_START and BUSINESS_HOURS_END in your .env or Settings page. Also verify that PRINT_QUEUE_ENABLED is set to "true". Items outside business hours will remain queued until the next business window opens.',
  },
  {
    question: 'Auto-reply emails are not being sent',
    answer: 'First verify SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD are correct. Check that AUTO_REPLY_ENABLED is "true" in settings. Some email providers require TLS on port 587, or SSL on port 465. Test the SMTP connection using the Configuration section above. Also check that the SMTP_FROM_EMAIL is a verified sender address.',
  },
  {
    question: 'Database keeps resetting on restart',
    answer: 'Ensure your SQLite database file is stored on a persistent Docker volume. In docker-compose.yml, map the data directory as a volume: `volumes: - ./data:/data`. Without this, the database is stored inside the container and lost on restart.',
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export function SetupGuideView() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [testResults, setTestResults] = useState<Record<string, string | null>>({})
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({})

  const totalSteps = 6
  const progressPercent = Math.round((completedSteps.size / totalSteps) * 100)

  const toggleStep = (step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(step)) {
        next.delete(step)
      } else {
        next.add(step)
      }
      return next
    })
  }

  const handleTestConnection = async (type: 'imap' | 'smtp') => {
    setTestLoading((prev) => ({ ...prev, [type]: true }))
    try {
      const res = await fetch(`/api/test-${type}`)
      const data = await res.json()
      setTestResults((prev) => ({ ...prev, [type]: JSON.stringify(data, null, 2) }))
      if (res.ok) {
        toast.success(`${type.toUpperCase()} connection successful!`)
      } else {
        toast.error(`${type.toUpperCase()} connection failed`)
      }
    } catch {
      const errorMsg = JSON.stringify(
        { error: 'Connection test failed — API endpoint not available. This is expected in the demo environment.' },
        null,
        2
      )
      setTestResults((prev) => ({ ...prev, [type]: errorMsg }))
      toast.info(`${type.toUpperCase()} test endpoint not available in demo mode`)
    } finally {
      setTestLoading((prev) => ({ ...prev, [type]: false }))
    }
  }

  const handleSendTestEmail = async (emailId: string) => {
    const email = testEmails.find((e) => e.id === emailId)
    if (!email) return

    setTestLoading((prev) => ({ ...prev, [emailId]: true }))
    try {
      const res = await fetch('/api/process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: email.code,
      })
      const data = await res.json()
      setTestResults((prev) => ({ ...prev, [emailId]: JSON.stringify(data, null, 2) }))
      if (res.ok) {
        toast.success('Test email processed successfully')
      } else {
        toast.error('Failed to process test email')
      }
    } catch {
      const demoResponse = JSON.stringify(
        {
          status: 'demo_mode',
          message: 'API endpoint not available in demo. Expected response:',
          expectedResponse: {
            claimNumber: 'CLM-2024-0031',
            classification: 'CLAIM',
            claimType: 'Motor',
            confidence: 0.92,
            insuranceCompany: 'OUTsurance',
            extractedData: {
              clientName: 'Johann van der Merwe',
              policyNumber: 'OUT-789456',
              registrationNumber: 'GP 123 ABC',
              incidentDate: '2024-03-15',
              vehicleDescription: '2022 Toyota Hilux',
              incidentLocation: 'R55 and John Vorster Drive, Centurion',
            },
            language: 'en',
            autoProcessed: true,
          },
        },
        null,
        2
      )
      setTestResults((prev) => ({ ...prev, [emailId]: demoResponse }))
      toast.info('Demo mode — showing expected API response')
    } finally {
      setTestLoading((prev) => ({ ...prev, [emailId]: false }))
    }
  }

  const clearTestResult = (key: string) => {
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <BookOpen className="size-6 text-primary" />
            Setup &amp; Deployment Guide
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Follow these steps to deploy the claims processing system on your server
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="text-xs gap-1.5">
            <CheckCircle2 className="size-3" />
            {completedSteps.size}/{totalSteps} Complete
          </Badge>
          <Badge variant={progressPercent === 100 ? 'default' : 'secondary'} className="text-xs">
            {progressPercent}%
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step 1: Prerequisites</span>
          <span>Step 6: Troubleshooting</span>
        </div>
      </div>

      <CalloutBox type="info">
        Click the step number to mark it as completed. Your progress is tracked during this session.
      </CalloutBox>

      {/* Accordion Sections */}
      <Accordion type="multiple" className="space-y-3">
        {/* ─── Section 1: Prerequisites ─────────────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-1" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={1} completed={completedSteps.has(1)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Prerequisites</span>
                  <span className="text-xs text-muted-foreground block">What you need before starting</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  Ensure the following requirements are met before proceeding with the installation.
                </p>

                {/* Docker */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">Docker &amp; Docker Compose</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Docker is required to run the application and its services. Docker Compose orchestrates
                    the application containers (dashboard, database).
                  </p>
                  <CodeBlock
                    language="powershell"
                    code={`# Windows 11 Pro: Install Docker Desktop
# 1. Download from: https://www.docker.com/products/docker-desktop/
# 2. Run the installer (enable WSL 2 backend)
# 3. Restart your computer
# 4. Launch Docker Desktop from Start Menu
# 5. Wait for "Engine running" in status bar

# Verify installation (in PowerShell)
docker --version
docker compose version`}
                  />
                </div>

                <Separator />

                {/* Windows Server */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">Windows Server with Network Shares</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A Windows file server is needed to store processed claim documents on a shared Z: drive.
                    This allows the office staff to access printed/saved documents directly.
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FolderOpen className="size-4 text-muted-foreground" />
                      <span className="font-medium">Shared folder path:</span>
                      <code className="text-xs bg-muted rounded px-2 py-0.5 font-mono">Z:\\Claims\\&lt;InsuranceCompany&gt;</code>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FolderOpen className="size-4 text-muted-foreground" />
                      <span className="font-medium">Folder structure:</span>
                      <code className="text-xs bg-muted rounded px-2 py-0.5 font-mono">Z:\\Claims\\OUTsurance\\CLM-2024-0001\\</code>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email Account */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">Email Account for IMAP Access</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A dedicated email account (e.g., claims@yourcompany.co.za) with IMAP access enabled.
                    This inbox receives all incoming claim notification emails.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>IMAP must be enabled on the mail server</li>
                    <li>For Gmail: Use an &quot;App Password&quot; from Google Account settings</li>
                    <li>For Exchange: Enable IMAP via Exchange Admin Center</li>
                    <li>For cPanel: Enable IMAP via Email Accounts → Manage → IMAP Access</li>
                  </ul>
                </div>

                <Separator />

                {/* SMTP */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Send className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">SMTP Credentials for Auto-Reply</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    SMTP credentials for sending automated acknowledgment emails. This can be the same
                    account as IMAP or a separate &quot;noreply&quot; address.
                  </p>
                </div>

                <Separator />

                {/* Gemini API */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">Gemini API Key (Free Tier)</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Google Gemini is used for AI-powered email classification, data extraction, and
                    language detection. The free tier is sufficient for most use cases.
                  </p>
                  <CodeBlock
                    language="text"
                    code={`# Get your free Gemini API key:
# 1. Go to https://aistudio.google.com/app/apikey
# 2. Sign in with your Google account
# 3. Click "Create API Key"
# 4. Copy the key (starts with "AIza...")

# Free tier limits:
# - 15 requests per minute
# - 1,500 requests per day
# - No credit card required`}
                  />
                  <CalloutBox type="tip">
                    The system uses a multi-provider fallback chain. If Gemini is rate-limited, it
                    automatically falls back to Groq, then OpenRouter, then Ollama (local). This
                    ensures near-zero downtime for AI processing.
                  </CalloutBox>
                </div>

                {/* Mark Complete */}
                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(1) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(1)}
                  >
                    {completedSteps.has(1) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ─── Section 2: Quick Start ────────────────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-2" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={2} completed={completedSteps.has(2)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Quick Start</span>
                  <span className="text-xs text-muted-foreground block">Get running in 5 minutes</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  Follow these steps to get the system up and running on your server as quickly as possible.
                </p>

                {/* Step 1: Clone */}
                <div className="flex gap-3">
                  <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-semibold">Clone the project</h4>
                    <CodeBlock
                      language="powershell"
                      code={`# Copy the project to your Windows machine
# e.g., extract the ZIP to C:\StefcoClaims
cd C:\StefcoClaims`}
                    />
                  </div>
                </div>

                {/* Step 2: Configure */}
                <div className="flex gap-3">
                  <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-semibold">Configure environment variables</h4>
                    <CodeBlock
                      language="powershell"
                      code={`# Run the setup wizard (right-click -> Run as Administrator)
.\setup.bat

# Or manually copy the environment file
copy .env.example .env
notepad .env`}
                    />
                    <CalloutBox type="tip">
                      See Section 3 (Configuration) for a detailed explanation of each environment variable.
                    </CalloutBox>
                  </div>
                </div>

                {/* Step 3: Docker Compose */}
                <div className="flex gap-3">
                  <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-semibold">Start the application</h4>
                    <CodeBlock
                      language="powershell"
                      code={`# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Check running containers
docker compose ps`}
                    />
                  </div>
                </div>

                {/* Step 4: Open Browser */}
                <div className="flex gap-3">
                  <div className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-semibold">Open the dashboard</h4>
                    <CodeBlock
                      language="bash"
                      code={`# The dashboard is available at:
# http://localhost:3000 (development)
# https://claims.yourcompany.co.za (production)`}
                    />
                  </div>
                </div>

                {/* Step 6: Done */}
                <div className="flex gap-3">
                  <div className="flex items-center justify-center size-6 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      You&apos;re all set! 🎉
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Send a test email to your claims inbox to verify the pipeline is working.
                    </p>
                  </div>
                </div>

                <CalloutBox type="warning">
                  Make sure to update the BASE_URL in your .env file before going to production. This
                  is used for webhook callbacks and the auto-reply sender address.
                </CalloutBox>

                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(2) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(2)}
                  >
                    {completedSteps.has(2) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ─── Section 3: Configuration ──────────────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-3" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={3} completed={completedSteps.has(3)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Configuration</span>
                  <span className="text-xs text-muted-foreground block">Environment variables &amp; connection testing</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  All configuration is managed through the <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">.env</code> file
                  in the project root. Below is a reference table of all available variables.
                </p>

                {/* Env Variables Table */}
                <ScrollArea className="max-h-96">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider w-[180px]">Variable</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider">Description</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider w-[220px]">Example</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider w-[80px] text-center">Required</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {envVariables.map((env) => (
                          <TableRow key={env.variable} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs">{env.variable}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{env.description}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{env.example}</TableCell>
                            <TableCell className="text-center">
                              {env.required ? (
                                <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">
                                  Required
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Optional
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>

                <CalloutBox type="tip">
                  Never commit your <code className="bg-amber-100 dark:bg-amber-900 rounded px-1">.env</code> file
                  to version control. The <code className="bg-amber-100 dark:bg-amber-900 rounded px-1">.env.example</code> file
                  contains placeholder values without secrets.
                </CalloutBox>

                <Separator />

                {/* Connection Tests */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Settings className="size-4 text-muted-foreground" />
                    Connection Tests
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* IMAP Test */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 text-primary" />
                        <span className="text-sm font-medium">IMAP Connection</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Test the IMAP email server connection and mailbox access.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleTestConnection('imap')}
                        disabled={testLoading.imap}
                      >
                        {testLoading.imap ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Test IMAP Connection
                      </Button>
                      {testResults.imap && (
                        <div className="space-y-2">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1"
                              onClick={() => clearTestResult('imap')}
                            >
                              <RotateCcw className="size-3" />
                              Clear
                            </Button>
                          </div>
                          <CodeBlock language="json" code={testResults.imap} />
                        </div>
                      )}
                    </div>

                    {/* SMTP Test */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Send className="size-4 text-primary" />
                        <span className="text-sm font-medium">SMTP Connection</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Test the SMTP server connection for sending auto-replies.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleTestConnection('smtp')}
                        disabled={testLoading.smtp}
                      >
                        {testLoading.smtp ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Test SMTP Connection
                      </Button>
                      {testResults.smtp && (
                        <div className="space-y-2">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1"
                              onClick={() => clearTestResult('smtp')}
                            >
                              <RotateCcw className="size-3" />
                              Clear
                            </Button>
                          </div>
                          <CodeBlock language="json" code={testResults.smtp} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(3) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(3)}
                  >
                    {completedSteps.has(3) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ─── Section 4: Insurance Companies ────────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-4" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={4} completed={completedSteps.has(4)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Insurance Companies Setup</span>
                  <span className="text-xs text-muted-foreground block">Pre-seeded companies &amp; domain mapping</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  The system comes pre-seeded with 8 major South African insurance companies. Each company
                  has a folder mapping for document storage and email domain matching for automatic assignment.
                </p>

                {/* Companies Table */}
                <ScrollArea className="max-h-96">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider">Company Name</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider">Folder Name</TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider">Email Domains</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {seededCompanies.map((company) => (
                          <TableRow key={company.name} className="hover:bg-muted/30">
                            <TableCell className="text-sm font-medium">{company.name}</TableCell>
                            <TableCell className="font-mono text-xs">{company.folder}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {company.domains.map((domain) => (
                                  <Badge key={domain} variant="secondary" className="text-[10px] font-mono">
                                    {domain}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>

                <Separator />

                {/* How to Add More */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Settings className="size-4 text-muted-foreground" />
                    Adding More Companies
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li>Navigate to the <strong className="text-foreground">Insurance Companies</strong> tab in the sidebar</li>
                      <li>Click <strong className="text-foreground">&quot;Add Company&quot;</strong> button</li>
                      <li>Fill in the company name and select or create a folder name</li>
                      <li>Add the email domains associated with this insurer (e.g., <code className="bg-muted rounded px-1 text-xs font-mono"> insurer.co.za</code>)</li>
                      <li>Click <strong className="text-foreground">Save</strong></li>
                    </ol>
                  </div>
                </div>

                <Separator />

                {/* Domain Mapping Explanation */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Info className="size-4 text-muted-foreground" />
                    How Domain Mapping Works
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    When an email arrives, the system checks the sender&apos;s email domain against the
                    configured insurance companies. For example:
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Sender:</span>{' '}
                      <code className="bg-muted rounded px-1.5 text-xs font-mono"> adjuster@outsurance.co.za</code>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Domain match:</span>{' '}
                      <code className="bg-muted rounded px-1.5 text-xs font-mono"> outsurance.co.za → OUTsurance</code>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Folder:</span>{' '}
                      <code className="bg-muted rounded px-1.5 text-xs font-mono"> Z:\\Claims\\OUTsurance\\CLM-2024-0001\\</code>
                    </div>
                  </div>
                  <CalloutBox type="tip">
                    If no domain match is found, the claim is filed under <strong>&quot;Unassigned&quot;</strong> and
                    can be manually assigned later from the Claims tab.
                  </CalloutBox>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(4) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(4)}
                  >
                    {completedSteps.has(4) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ─── Section 5: Testing the Pipeline ───────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-5" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={5} completed={completedSteps.has(5)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Testing the Pipeline</span>
                  <span className="text-xs text-muted-foreground block">Send test emails &amp; verify responses</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  Use these pre-written test emails to verify the full processing pipeline. Each test
                  sends a sample email to the classification engine and shows the AI response.
                </p>

                {testEmails.map((email) => (
                  <div key={email.id} className="rounded-lg border space-y-3 overflow-hidden">
                    {/* Email Header */}
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Mail className="size-4 text-primary shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold">{email.title}</h4>
                          <p className="text-xs text-muted-foreground">{email.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {email.language}
                      </Badge>
                    </div>

                    {/* Email Code */}
                    <div className="px-4 pb-3">
                      <CodeBlock language="json" code={email.code} />
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleSendTestEmail(email.id)}
                        disabled={testLoading[email.id]}
                      >
                        {testLoading[email.id] ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Send Test Email
                      </Button>
                      {testResults[email.id] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => clearTestResult(email.id)}
                        >
                          <RotateCcw className="size-3" />
                          Clear Result
                        </Button>
                      )}
                    </div>

                    {/* Response */}
                    {testResults[email.id] && (
                      <div className="px-4 pb-4">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          API Response
                        </div>
                        <CodeBlock language="json" code={testResults[email.id] ?? ''} />
                      </div>
                    )}
                  </div>
                ))}

                <CalloutBox type="tip">
                  In production, the test emails are actually processed by the AI pipeline. In demo mode,
                  the expected response structure is shown to help you understand what the API returns.
                </CalloutBox>

                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(5) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(5)}
                  >
                    {completedSteps.has(5) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>

        {/* ─── Section 6: Troubleshooting ────────────────────────────────── */}
        <Card className="py-0 overflow-hidden">
          <AccordionItem value="step-6" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <StepBadge number={6} completed={completedSteps.has(6)} />
                <div className="text-left">
                  <span className="text-sm font-semibold">Troubleshooting</span>
                  <span className="text-xs text-muted-foreground block">Common issues &amp; solutions</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground">
                  Frequently asked questions and common issues encountered during setup and operation.
                </p>

                <div className="space-y-3">
                  {faqItems.map((faq, index) => (
                    <div key={index} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
                        <h4 className="text-sm font-semibold">{faq.question}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6.5 leading-relaxed pl-0.5">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>

                <CalloutBox type="info">
                  If you encounter an issue not listed here, check the Docker container logs using{' '}
                  <code className="bg-sky-100 dark:bg-sky-900 rounded px-1 text-xs font-mono">docker compose logs -f</code>{' '}
                  and review the built-in email scheduler logs in the dashboard under Activity Logs.
                </CalloutBox>

                <div className="flex justify-end pt-2">
                  <Button
                    variant={completedSteps.has(6) ? 'outline' : 'default'}
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleStep(6)}
                  >
                    {completedSteps.has(6) ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        Completed
                      </>
                    ) : (
                      'Mark as Complete'
                    )}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>
    </div>
  )
}
