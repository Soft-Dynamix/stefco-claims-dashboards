'use client'

import React from 'react'
import {
  Plus,
  Mail,
  Wrench,
  GitBranch,
  Download,
  MessageSquare,
  Workflow,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useClaimsStore, type TabType } from '@/store/claims-store'
import { toast } from 'sonner'

const STAGGER_CLASSES = [
  'stagger-1',
  'stagger-2',
  'stagger-3',
  'stagger-4',
  'stagger-5',
  'stagger-6',
]

interface QuickAction {
  id: string
  label: string
  description: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  action: () => void
}

function QuickActionCard({ action, staggerClass }: { action: QuickAction; staggerClass: string }) {
  const Icon = action.icon
  return (
    <button
      onClick={action.action}
      className={`group text-left w-full rounded-xl border border-border/50 bg-background p-4 btn-soft btn-shine btn-press btn-glow hover:bg-muted/50 hover:border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 card-enter ${staggerClass} hover-glow-sm action-btn-modern`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex items-center justify-center size-10 rounded-lg shrink-0 transition-colors ${action.iconBg} group-hover:scale-110 transition-transform duration-200`}
        >
          <Icon className={`size-5 ${action.iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {action.label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {action.description}
          </p>
        </div>
      </div>
    </button>
  )
}

export function QuickActionsPanel() {
  const setActiveTab = useClaimsStore((s) => s.setActiveTab)
  const setShowNewClaimDialog = useClaimsStore((s) => s.setShowNewClaimDialog)

  const handleExportAllClaims = () => {
    setActiveTab('claims')
    setTimeout(() => {
      const exportBtn = document.querySelector('[data-export-csv]') as HTMLButtonElement
      if (exportBtn) {
        exportBtn.click()
      } else {
        toast.info('Navigate to Claims view and use Export CSV')
      }
    }, 300)
  }

  const handleOpenAI = () => {
    const chatPanel = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement
    if (chatPanel) {
      chatPanel.click()
    } else {
      toast.info('AI Assistant is available via the sparkle button')
    }
  }

  const handleViewPipeline = () => {
    const pipelineSection = document.getElementById('claims-pipeline')
    if (pipelineSection) {
      pipelineSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add a brief highlight effect
      pipelineSection.classList.add('card-depth-2')
      setTimeout(() => {
        pipelineSection.classList.remove('card-depth-2')
      }, 2000)
    } else {
      toast.info('Pipeline widget is available on the dashboard')
    }
  }

  const actions: QuickAction[] = [
    {
      id: 'new-claim',
      label: 'New Claim',
      description: 'Create and submit a new insurance claim',
      icon: Plus,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      action: () => {
        setActiveTab('claims')
        setShowNewClaimDialog(true)
      },
    },
    {
      id: 'process-emails',
      label: 'Process Emails',
      description: 'Review and process incoming claim emails',
      icon: Mail,
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
      iconColor: 'text-sky-600 dark:text-sky-400',
      action: () => setActiveTab('email'),
    },
    {
      id: 'run-diagnostics',
      label: 'Run Diagnostics',
      description: 'Check system health and run diagnostics',
      icon: Wrench,
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      action: () => setActiveTab('installer'),
    },
    {
      id: 'view-pipeline',
      label: 'View Pipeline',
      description: 'Scroll to the claims pipeline workflow view',
      icon: Workflow,
      iconBg: 'bg-teal-100 dark:bg-teal-950/50',
      iconColor: 'text-teal-600 dark:text-teal-400',
      action: handleViewPipeline,
    },
    {
      id: 'view-workflow',
      label: 'View Workflow',
      description: 'Monitor claim processing workflows',
      icon: GitBranch,
      iconBg: 'bg-violet-100 dark:bg-violet-950/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
      action: () => setActiveTab('workflow'),
    },
    {
      id: 'export-claims',
      label: 'Export All Claims',
      description: 'Download all claims data as CSV',
      icon: Download,
      iconBg: 'bg-rose-100 dark:bg-rose-950/50',
      iconColor: 'text-rose-600 dark:text-rose-400',
      action: handleExportAllClaims,
    },
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      description: 'Get help from the AI claims assistant',
      icon: MessageSquare,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      action: handleOpenAI,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {actions.map((action, index) => (
        <QuickActionCard
          key={action.id}
          action={action}
          staggerClass={STAGGER_CLASSES[index] || 'stagger-1'}
        />
      ))}
    </div>
  )
}
