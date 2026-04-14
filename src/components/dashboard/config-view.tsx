'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateConfigData } from '@/lib/query-utils'
import {
  Settings,
  Save,
  Brain,
  Clock,
  MessageSquare,
  Printer,
  Shield,
  Zap,
  Server,
  Mail,
  RefreshCw,
  Eye,
  EyeOff,
  Wifi,
  Play,
  Square,
  RotateCw,
  Activity,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  XCircle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  BarChart3,
  ArrowRightLeft,
  Globe,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/motion'
import { ThemeSettingsPanel } from '@/components/dashboard/theme-settings-panel'

// ─── Scheduler & IMAP Status Types ──────────────────────────────────────────────

interface SchedulerStatus {
  running: boolean
  polling: boolean
  interval: number | null
  pollCount: number
  lastPollAt: string | null
  nextPollAt: string | null
  lastPollError: string | null
  startedAt: string | null
  uptime: number | null
}

interface ImapStatus {
  configured: boolean
  config: {
    host: string
    port: number
    user: string
    ssl: boolean
    poll_interval: number
  }
  last_poll: string | null
  last_poll_count: number
  last_poll_error: string | null
  connection: {
    status: 'connected' | 'disconnected' | 'error'
    error: string | null
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)
  if (diff < 5) return 'Just now'
  if (diff < 60) return `${diff}s ago`
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatCountdown(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = Date.now()
  const diff = Math.max(0, Math.floor((date.getTime() - now) / 1000))
  if (diff < 1) return 'Now'
  if (diff < 60) return `in ${diff}s`
  const minutes = Math.floor(diff / 60)
  if (minutes < 60) return `in ${minutes}m ${diff % 60}s`
  return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatInterval(seconds: number | null): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes}m`
  const hours = minutes / 60
  return `${hours}h`
}

// ─── Learning Stats Types ─────────────────────────────────────────────────────

interface LearningStatsData {
  totalPatterns: number
  totalFeedback: number
  confirmedCorrect: number
  flaggedIncorrect: number
  fieldCorrected: number
  topSenderDomains: Array<{ domain: string; patternCount: number; avgConfidence: number }>
  topCorrectedFields: Array<{ field: string; count: number }>
  accuracyTrend: {
    avgConfidenceAll: number
    avgConfidenceRecent: number
    improvement: number
    direction: 'improving' | 'stable' | 'declining'
  }
  learningCoverage: number
}

// ─── Learning Analysis Types ─────────────────────────────────────────────────

interface LearningAnalysisData {
  patterns: Array<{
    className: string
    avgConfidence: number
    totalPredictions: number
    correctPredictions: number
    accuracy: number
  }>
  misclassifications: Array<{
    predictedAs: string
    shouldHaveBeen: string
    count: number
    exampleReasons: string[]
  }>
  ruleImprovements: Array<{
    type: string
    description: string
    expectedImpact: 'high' | 'medium' | 'low'
    basedOnCorrections: number
  }>
  fieldAnalysis: Array<{
    fieldName: string
    correctionCount: number
    avgOriginalLength: number
    avgCorrectedLength: number
    commonPattern: string
    suggestedHint: string
  }>
  senderDomainAccuracy: Array<{
    domain: string
    totalClaims: number
    avgConfidence: number
    correctionRate: number
    mostCorrectedField: string
  }>
  overallAccuracy: number
  recentAccuracy: number
  improvementTrend: 'improving' | 'stable' | 'declining'
  totalCorrections: number
  totalConfirmations: number
  analysisPeriod: string
  generatedAt?: string
}

// ─── Self-Learning System Panel ──────────────────────────────────────────────

function SelfLearningSystemPanel() {
  const [analysisEnabled, setAnalysisEnabled] = useState(false)
  const [analysisExpanded, setAnalysisExpanded] = useState(true)

  const { data, isLoading } = useQuery<{ stats: LearningStatsData; recentFeedback: Array<{
    id: string
    feedbackType: string
    createdAt: string
    claim: { claimNumber: string; clientName: string | null; senderEmail: string | null } | null
  }> }>({
    queryKey: ['learning-stats'],
    queryFn: () => fetch('/api/learning/stats').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 2,
    staleTime: 60000,
  })

  // Learning analysis query — disabled by default, enabled after user clicks "Run Analysis"
  const {
    data: analysisData,
    isLoading: analysisLoading,
    isError: analysisError,
  } = useQuery<{ success: boolean; analysis: LearningAnalysisData; generatedAt: string }>({
    queryKey: ['learning-analysis'],
    queryFn: () => fetch('/api/learning/analyze').then((r) => { if (!r.ok) throw new Error('Analysis request failed'); return r.json() }),
    enabled: analysisEnabled,
    retry: 1,
    staleTime: 300000, // 5 minutes
  })

  const analysis = analysisData?.analysis
  const stats = data?.stats
  const recentFeedback = data?.recentFeedback || []

  const hasData = stats && (stats.totalPatterns > 0 || stats.totalFeedback > 0)
  const hasAnalysis = analysis && (analysis.misclassifications.length > 0 || analysis.ruleImprovements.length > 0 || analysis.fieldAnalysis.length > 0 || analysis.senderDomainAccuracy.length > 0)

  const renderAccuracyTrend = () => {
    if (!stats) return null
    const { improvement, direction } = stats.accuracyTrend
    if (direction === 'improving') {
      return (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-4" />
          Improving ↑ +{Math.abs(improvement)}%
        </span>
      )
    }
    if (direction === 'declining') {
      return (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <TrendingDown className="size-4" />
          Declining ↓ -{Math.abs(improvement)}%
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Minus className="size-4" />
        Stable →
      </span>
    )
  }

  const feedbackTypeBadge: Record<string, { label: string; color: string }> = {
    confirmed_correct: { label: 'Correct', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
    flagged_incorrect: { label: 'Incorrect', color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' },
    field_corrected: { label: 'Corrected', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  }

  if (isLoading) {
    return (
      <Card className="py-5 card-enter stagger-8 hover-scale">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-24 w-full rounded-lg mt-4" />
          <Skeleton className="h-40 w-full rounded-lg mt-4" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-5 card-enter stagger-8 hover-scale">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Self-Learning System</CardTitle>
          </div>
          {hasData && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {stats.totalPatterns} patterns
            </Badge>
          )}
        </div>
        <CardDescription>
          AI learning patterns from verified corrections and feedback
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="flex items-center justify-center size-12 rounded-full bg-muted/50">
              <Brain className="size-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              No learning data yet. As you verify and correct claims, the system will learn and improve.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Patterns', value: stats.totalPatterns, icon: Brain, color: 'text-primary' },
                { label: 'Total Feedback', value: stats.totalFeedback, icon: MessageSquare, color: 'text-sky-500' },
                { label: 'Accuracy Trend', value: null, icon: null, color: '', custom: renderAccuracyTrend() },
                { label: 'Learning Coverage', value: `${stats.learningCoverage}%`, icon: Target, color: 'text-amber-600 dark:text-amber-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-muted/50 shrink-0">
                    {item.icon && <item.icon className={`size-4 ${item.color || 'text-muted-foreground'}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    {item.custom ? (
                      <p className="text-xs font-semibold text-foreground mt-0.5">{item.custom}</p>
                    ) : (
                      <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Accuracy Breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accuracy Breakdown</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="size-3" />
                  Confirmed Correct: {stats.confirmedCorrect}
                </Badge>
                <Badge variant="secondary" className="gap-1.5 text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                  <XCircle className="size-3" />
                  Flagged Incorrect: {stats.flaggedIncorrect}
                </Badge>
                <Badge variant="secondary" className="gap-1.5 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  <AlertCircle className="size-3" />
                  Field Corrected: {stats.fieldCorrected}
                </Badge>
              </div>
            </div>

            {/* Top Sender Domains */}
            {stats.topSenderDomains.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Sender Domains</p>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 px-3 py-2">
                    <span>Domain</span>
                    <span className="text-center">Patterns</span>
                    <span className="text-right">Avg Confidence</span>
                  </div>
                  {stats.topSenderDomains.map((d) => (
                    <div key={d.domain} className="grid grid-cols-3 text-xs px-3 py-2 border-t last:border-b-0">
                      <span className="font-medium text-foreground truncate">{d.domain}</span>
                      <span className="text-center text-muted-foreground">{d.patternCount}</span>
                      <span className={`text-right font-medium ${d.avgConfidence >= 80 ? 'text-emerald-600 dark:text-emerald-400' : d.avgConfidence >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{d.avgConfidence}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Corrected Fields */}
            {stats.topCorrectedFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Corrected Fields</p>
                <div className="space-y-1.5">
                  {stats.topCorrectedFields.map((f) => (
                    <div key={f.field} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                      <span className="text-xs font-medium text-foreground">{f.field}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{f.count} correction{f.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Feedback Activity */}
            {recentFeedback.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Feedback Activity</p>
                <ScrollArea className="max-h-64">
                  <div className="space-y-1.5">
                    {recentFeedback.map((fb) => {
                      const badge = feedbackTypeBadge[fb.feedbackType] || { label: fb.feedbackType, color: 'bg-muted text-muted-foreground border-border' }
                      return (
                        <div key={fb.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20">
                          <span className="text-xs font-mono font-medium text-foreground shrink-0">{fb.claim?.claimNumber || '—'}</span>
                          <span className="text-xs text-muted-foreground truncate min-w-0">{fb.claim?.clientName || fb.claim?.senderEmail || '—'}</span>
                          <Badge variant="secondary" className={`text-[10px] ml-auto shrink-0 ${badge.color}`}>
                            {badge.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(fb.createdAt)}</span>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {/* ─── Learning Analysis Section ─── */}
        <Separator className="my-2" />

        {/* Run Analysis Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Deep Learning Analysis</p>
              <p className="text-xs text-muted-foreground">Analyze patterns, misclassifications, and suggest improvements</p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            disabled={analysisLoading}
            onClick={() => {
              setAnalysisEnabled(true)
              setAnalysisExpanded(true)
            }}
          >
            {analysisLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Brain className="size-3.5" />
            )}
            {analysisLoading ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Run Analysis'}
          </Button>
        </div>

        {/* Analysis Error */}
        {analysisError && !analysisLoading && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>Analysis failed. Please try again later.</span>
          </div>
        )}

        {/* Analysis Loading Skeleton */}
        {analysisLoading && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {/* Analysis Results */}
        {!analysisLoading && analysis && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Collapsible Toggle Header */}
            <button
              type="button"
              onClick={() => setAnalysisExpanded(!analysisExpanded)}
              className="flex items-center gap-2 w-full text-left group"
            >
              {analysisExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              )}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                Analysis Results
              </span>
              {('generatedAt' in analysis && analysis.generatedAt) && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {formatRelativeTime(analysis.generatedAt)}
                </span>
              )}
              {hasAnalysis && (
                <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                  {analysis.misclassifications.length + analysis.ruleImprovements.length + analysis.fieldAnalysis.length + analysis.senderDomainAccuracy.length} findings
                </Badge>
              )}
            </button>

            {analysisExpanded && (
              <div className="space-y-5">
                {/* Empty state when no analysis data */}
                {!hasAnalysis ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500/50" />
                    <p className="text-sm text-muted-foreground">
                      No analysis data yet. The system found no significant patterns to report.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Continue processing claims and providing corrections for richer analysis.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ─── 1. Misclassification Patterns ─── */}
                    {analysis.misclassifications.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="size-3.5 text-red-500" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Misclassification Patterns</p>
                          <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                            {analysis.misclassifications.length}
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {analysis.misclassifications.slice(0, 5).map((mis, idx) => (
                            <div key={idx} className="p-3 rounded-lg border bg-red-500/[0.03] border-red-500/10">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-foreground">
                                  Predicted: <span className="text-red-600 dark:text-red-400">{mis.predictedAs}</span>
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium text-foreground">
                                  Should be: <span className="text-emerald-600 dark:text-emerald-400">{mis.shouldHaveBeen}</span>
                                </span>
                                <Badge variant="secondary" className="text-[10px] ml-auto shrink-0 bg-muted/50">
                                  {mis.count} time{mis.count !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              {mis.exampleReasons.length > 0 && (
                                <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 pl-0.5">
                                  <span className="font-medium">Reasoning:</span> {mis.exampleReasons[0]}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─── 2. Suggested Rule Improvements ─── */}
                    {analysis.ruleImprovements.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="size-3.5 text-amber-500" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested Rule Improvements</p>
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                            {analysis.ruleImprovements.length}
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {analysis.ruleImprovements.map((rule, idx) => {
                            const impactConfig = {
                              high: {
                                badgeColor: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
                                dotColor: 'bg-red-500',
                                label: 'High Impact',
                              },
                              medium: {
                                badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                                dotColor: 'bg-amber-500',
                                label: 'Medium Impact',
                              },
                              low: {
                                badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
                                dotColor: 'bg-emerald-500',
                                label: 'Low Impact',
                              },
                            }
                            const cfg = impactConfig[rule.expectedImpact]
                            return (
                              <div key={idx} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-muted/20">
                                <div className={`size-2 rounded-full mt-1.5 shrink-0 ${cfg.dotColor}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground">{rule.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className={`text-[10px] ${cfg.badgeColor}`}>
                                      {cfg.label}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      Based on {rule.basedOnCorrections} correction{rule.basedOnCorrections !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ─── 3. Field Correction Analysis ─── */}
                    {analysis.fieldAnalysis.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Target className="size-3.5 text-primary" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Field Correction Analysis</p>
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            {analysis.fieldAnalysis.length} fields
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {analysis.fieldAnalysis.slice(0, 5).map((field) => (
                            <div key={field.fieldName} className="p-3 rounded-lg border bg-muted/10">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-foreground">{field.fieldName}</span>
                                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  {field.correctionCount} correction{field.correctionCount !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <Lightbulb className="size-3 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-muted-foreground">
                                  {field.suggestedHint}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─── 4. Sender Domain Accuracy ─── */}
                    {analysis.senderDomainAccuracy.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe className="size-3.5 text-primary" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sender Domain Accuracy</p>
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            {analysis.senderDomainAccuracy.length} domains
                          </Badge>
                        </div>
                        <div className="rounded-lg border overflow-hidden">
                          <div className="hidden sm:grid sm:grid-cols-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 px-3 py-2">
                            <span>Domain</span>
                            <span className="text-center">Claims</span>
                            <span className="text-center">Avg Confidence</span>
                            <span className="text-right">Correction Rate</span>
                          </div>
                          {/* Mobile: simplified grid */}
                          <div className="sm:hidden">
                            {analysis.senderDomainAccuracy.slice(0, 5).map((d) => (
                              <div key={d.domain} className="px-3 py-2.5 border-t first:border-t-0 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-foreground truncate">{d.domain}</span>
                                  <span className={`text-xs font-semibold tabular-nums ${d.correctionRate >= 50 ? 'text-red-600 dark:text-red-400' : d.correctionRate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {d.correctionRate}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span>{d.totalClaims} claims</span>
                                  <span>Conf: {d.avgConfidence}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Desktop: full table */}
                          {analysis.senderDomainAccuracy.slice(0, 5).map((d) => (
                            <div key={d.domain} className="hidden sm:grid sm:grid-cols-4 text-xs px-3 py-2 border-t last:border-b-0">
                              <span className="font-medium text-foreground truncate">{d.domain}</span>
                              <span className="text-center text-muted-foreground tabular-nums">{d.totalClaims}</span>
                              <span className={`text-center font-medium tabular-nums ${d.avgConfidence >= 80 ? 'text-emerald-600 dark:text-emerald-400' : d.avgConfidence >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                {d.avgConfidence}%
                              </span>
                              <span className={`text-right font-semibold tabular-nums ${d.correctionRate >= 50 ? 'text-red-600 dark:text-red-400' : d.correctionRate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {d.correctionRate}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Config Types ───────────────────────────────────────────────────────────────

interface SystemConfig {
  ai_provider: string
  auto_reply_enabled: string
  print_queue_enabled: string
  confidence_threshold: string
  business_hours_start: string
  business_hours_end: string
  smtp_host: string
  smtp_port: string
  smtp_ssl: string
  smtp_user: string
  smtp_password: string
  smtp_from_name: string
  smtp_from_email: string
  auto_poll_enabled: string
  email_poll_interval: string
}

// ─── Email Scheduler Status Badge (card header) ─────────────────────────────────

function EmailSchedulerStatusBadge() {
  const { data: status, isLoading } = useQuery<SchedulerStatus>({
    queryKey: ['scheduler-status'],
    queryFn: () => fetch('/api/email-poll/scheduler').then((r) => r.json()),
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/50">
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    )
  }

  const isRunning = status?.running ?? false


  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full transition-colors cursor-default ${
            isRunning
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          <span className="relative flex size-2">
            <span
              className={`absolute inset-0 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping opacity-75' : ''}`}
            />
            <span
              className={`relative rounded-full size-2 ${isRunning ? 'bg-emerald-500' : 'bg-gray-400'}`}
            />
          </span>
          <span className="text-xs font-medium">
            {isRunning ? 'Running' : 'Stopped'}
          </span>
          {isRunning && status?.uptime !== null && (
            <span className="text-[10px] opacity-70">
              {formatUptime(status?.uptime ?? 0)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isRunning
          ? `Scheduler active — ${status?.pollCount ?? 0} polls completed`
          : 'Scheduler is not running — click Start to begin'}
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Email Scheduler Panel (card body) ──────────────────────────────────────────

function EmailSchedulerPanel({
  config,
  updateConfig,
}: {
  config: SystemConfig
  updateConfig: (key: keyof SystemConfig, value: string) => void
}) {
  const queryClient = useQueryClient()

  // Live scheduler status — auto-refresh when running
  const { data: schedulerStatus, isLoading: schedulerLoading } = useQuery<SchedulerStatus>({
    queryKey: ['scheduler-status-detail'],
    queryFn: () => fetch('/api/email-poll/scheduler').then((r) => r.json()),
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.running ? 5000 : false
    },
  })

  // IMAP connection status
  const { data: imapStatus, isLoading: imapLoading } = useQuery<ImapStatus>({
    queryKey: ['imap-status'],
    queryFn: () => fetch('/api/email-poll/status').then((r) => r.json()),
    refetchInterval: 15000,
  })

  // Scheduler control mutations
  const schedulerMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop' | 'restart') => {
      const interval = config.email_poll_interval ? parseInt(config.email_poll_interval, 10) : undefined
      const res = await fetch('/api/email-poll/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, interval }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Scheduler action failed')
      }
      return res.json()
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-status-detail'] })
      const msg = data?.message || `Scheduler ${action} successful`
      toast.success(msg)
    },
    onError: (err, action) => {
      toast.error(`Failed to ${action} scheduler`, {
        description: err.message,
      })
    },
  })

  // Poll now mutation
  const pollNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Poll failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-status'] })
      queryClient.invalidateQueries({ queryKey: ['scheduler-status-detail'] })
      queryClient.invalidateQueries({ queryKey: ['imap-status'] })
      toast.success('Poll triggered', {
        description: `Processed ${data.processed || 0} of ${data.total || 0} emails`,
      })
    },
    onError: (err) => {
      toast.error('Poll failed', { description: err.message })
    },
  })

  const isRunning = schedulerStatus?.running ?? false
  const isPolling = schedulerStatus?.polling ?? false
  const isMutating = schedulerMutation.isPending || pollNowMutation.isPending

  // ─── IMAP connection badge ──────────────────────────────────────────────────
  const renderImapBadge = () => {
    if (imapLoading) {
      return (
        <Badge variant="secondary" className="gap-1.5 text-[10px]">
          <Loader2 className="size-3 animate-spin" />
          Checking...
        </Badge>
      )
    }
    if (!imapStatus?.configured) {
      return (
        <Badge variant="secondary" className="gap-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
          <AlertCircle className="size-3" />
          Not Configured
        </Badge>
      )
    }
    if (imapStatus.connection.status === 'connected') {
      return (
        <Badge variant="secondary" className="gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          <CheckCircle2 className="size-3" />
          Connected
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1.5 text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        <WifiOff className="size-3" />
        Connection Error
      </Badge>
    )
  }

  // ─── Metrics data ───────────────────────────────────────────────────────────
  const metrics = [
    {
      label: 'Total Polls',
      value: schedulerStatus?.pollCount ?? 0,
      icon: Activity,
      format: 'number' as const,
    },
    {
      label: 'Last Poll',
      value: formatRelativeTime(schedulerStatus?.lastPollAt ?? null),
      icon: Clock,
      format: 'text' as const,
    },
    {
      label: 'Next Poll',
      value: formatCountdown(schedulerStatus?.nextPollAt ?? null),
      icon: Clock,
      format: 'text' as const,
    },
    {
      label: 'Last Result',
      value: imapStatus?.last_poll_count ?? 0,
      icon: Mail,
      format: 'number' as const,
      suffix: 'emails',
    },
    {
      label: 'Poll Interval',
      value: formatInterval(schedulerStatus?.interval ?? null),
      icon: RefreshCw,
      format: 'text' as const,
    },
    {
      label: 'Last Error',
      value: schedulerStatus?.lastPollError || imapStatus?.last_poll_error || '',
      icon: AlertCircle,
      format: 'error' as const,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Live Status Bar */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isRunning
          ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
          : 'bg-muted/30 border-border'
      }`}>
        <span className="relative flex size-3 shrink-0">
          {isRunning && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          )}
          <span
            className={`relative rounded-full size-3 ${isRunning ? 'bg-emerald-500' : 'bg-gray-400'}`}
          />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            {isPolling ? 'Scheduler Polling...' : isRunning ? 'Scheduler Running' : 'Scheduler Stopped'}
          </p>
          {isRunning && schedulerStatus?.uptime !== null && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Running for {formatUptime(schedulerStatus?.uptime ?? 0)} · {schedulerStatus?.pollCount ?? 0} polls completed
            </p>
          )}
        </div>
        {isRunning && (
          <Badge variant="secondary" className="badge-pulse text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
            Live
          </Badge>
        )}
      </div>

      {/* Metrics Grid */}
      {schedulerLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-center size-8 rounded-lg bg-muted/50 shrink-0">
                <metric.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {metric.label}
                </p>
                {metric.format === 'error' ? (
                  metric.value ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs font-medium text-red-500 dark:text-red-400 mt-0.5 truncate">
                          Error
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs">{metric.value}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <p className="text-xs font-medium text-emerald-500 dark:text-emerald-400 mt-0.5">
                      No errors
                    </p>
                  )
                ) : (
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {metric.format === 'number' ? (
                      <span className="count-up">
                        {String(metric.value)}
                      </span>
                    ) : (
                      metric.value
                    )}
                    {metric.suffix && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        {metric.suffix}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isRunning || isMutating}
          onClick={() => schedulerMutation.mutate('start')}
        >
          {schedulerMutation.isPending && schedulerMutation.variables === 'start' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Start
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 text-xs"
          disabled={!isRunning || isMutating}
          onClick={() => schedulerMutation.mutate('stop')}
        >
          {schedulerMutation.isPending && schedulerMutation.variables === 'stop' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Square className="size-3.5" />
          )}
          Stop
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 text-xs"
          disabled={isMutating}
          onClick={() => schedulerMutation.mutate('restart')}
        >
          {schedulerMutation.isPending && schedulerMutation.variables === 'restart' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RotateCw className="size-3.5" />
          )}
          Restart
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={isPolling || pollNowMutation.isPending}
          onClick={() => pollNowMutation.mutate()}
        >
          {pollNowMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Activity className="size-3.5" />
          )}
          Poll Now
        </Button>
      </div>

      <Separator />

      {/* IMAP Connection Status */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="size-3.5 text-muted-foreground" />
            <Label className="text-sm font-medium text-foreground">IMAP Connection</Label>
          </div>
          {renderImapBadge()}
        </div>
        {imapStatus?.configured && imapStatus.config.host && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/20">
            <Server className="size-3.5 shrink-0" />
            <span className="truncate">
              {imapStatus.config.host}:{imapStatus.config.port}
              {imapStatus.connection.status === 'connected' && (
                <span className="text-emerald-500 ml-2">· SSL {imapStatus.config.ssl ? 'ON' : 'OFF'}</span>
              )}
            </span>
          </div>
        )}
        {imapStatus?.connection.error && imapStatus.connection.status === 'error' && (
          <p className="text-xs text-red-500 dark:text-red-400 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
            {imapStatus.connection.error}
          </p>
        )}
      </div>

      <Separator />

      {/* Config Settings (original toggles) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 p-2.5 -mx-2.5 rounded-lg bg-muted/20 transition-colors">
          <div className="flex items-start gap-3">
            <Wifi className="size-4 text-muted-foreground mt-0.5" />
            <div>
              <Label className="text-sm font-medium text-foreground">
                Enable Auto Polling
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically start the scheduler when the server starts
              </p>
            </div>
          </div>
          <Switch
            checked={config.auto_poll_enabled === 'true'}
            onCheckedChange={(checked) =>
              updateConfig('auto_poll_enabled', String(checked))
            }
            className="toggle-glow"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="poll-interval">Poll Interval</Label>
          <Select
            value={config.email_poll_interval}
            onValueChange={(v) => updateConfig('email_poll_interval', v)}
          >
            <SelectTrigger id="poll-interval" className="w-full input-glow">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Every 30 seconds</SelectItem>
              <SelectItem value="60">Every 1 minute</SelectItem>
              <SelectItem value="120">Every 2 minutes</SelectItem>
              <SelectItem value="300">Every 5 minutes</SelectItem>
              <SelectItem value="600">Every 10 minutes</SelectItem>
              <SelectItem value="900">Every 15 minutes</SelectItem>
              <SelectItem value="1800">Every 30 minutes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Shorter intervals check for new emails more frequently but use more system resources
          </p>
        </div>
      </div>
    </div>
  )
}

export function ConfigView() {
  const queryClient = useQueryClient()
  const defaults: SystemConfig = {
    ai_provider: 'gemini',
    auto_reply_enabled: 'true',
    print_queue_enabled: 'true',
    confidence_threshold: '70',
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    smtp_host: '',
    smtp_port: '587',
    smtp_ssl: 'false',
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: 'Stefco Consultants (Pty) Ltd',
    smtp_from_email: '',
    auto_poll_enabled: 'false',
    email_poll_interval: '60',
  }

  const { data: rawConfig, isLoading } = useQuery<{ config: Record<string, string> }>({
    queryKey: ['system-config'],
    queryFn: () => fetch('/api/config').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 3,
    retryDelay: 2000,
  })

  const [config, setConfig] = useState<SystemConfig>(defaults)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)

  const resolvedConfig = useMemo(() => {
    const merged = rawConfig?.config || {}
    return { ...defaults, ...merged } as SystemConfig
  }, [rawConfig, config])

  const saveMutation = useMutation({
    mutationFn: (values: SystemConfig) =>
      fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateConfigData(queryClient)
      toast.success('Settings saved successfully')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  const handleSave = () => {
    saveMutation.mutate(resolvedConfig)
  }

  const updateConfig = (key: keyof SystemConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const testSmtpConnection = useCallback(async () => {
    setTestingSmtp(true)
    try {
      const res = await fetch('/api/smtp/test', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('SMTP connection successful', {
          description: `Connected to ${resolvedConfig.smtp_host}:${resolvedConfig.smtp_port}`,
        })
      } else {
        toast.error('SMTP connection failed', {
          description: data.error || 'Unknown error occurred',
        })
      }
    } catch {
      toast.error('SMTP connection failed', {
        description: 'Could not reach the SMTP test endpoint',
      })
    } finally {
      setTestingSmtp(false)
    }
  }, [resolvedConfig.smtp_host, resolvedConfig.smtp_port])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Theme & Appearance */}
      <FadeIn delay={0.05}>
        <ThemeSettingsPanel />
      </FadeIn>

      {/* AI Provider */}
      <Card className="py-5 card-enter stagger-1 hover-scale">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">AI Provider</CardTitle>
          </div>
          <CardDescription>
            Select the primary AI provider for classification and data extraction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Select
              value={resolvedConfig.ai_provider}
              onValueChange={(v) => updateConfig('ai_provider', v)}
            >
              <SelectTrigger className="w-full input-glow">
                <SelectValue placeholder="Select AI Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (Primary)</SelectItem>
                <SelectItem value="groq">Groq (Fallback)</SelectItem>
                <SelectItem value="openrouter">OpenRouter (Fallback)</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-2 rounded-full bg-emerald-500" />
              Active providers will automatically fallback if the primary is unavailable
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Provider Status Section */}
      <Card className="py-5 card-enter stagger-2 hover-scale">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            AI Providers
          </CardTitle>
          <CardDescription>Multi-provider fallback chain for claim processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'Google Gemini 2.5 Flash', role: 'Primary', status: 'active', iconClass: 'bg-emerald-100 text-emerald-600', badgeClass: 'bg-emerald-600', desc: 'Best quality for extraction and classification. Free tier: 15 RPM, 1,500 RPD.', Icon: Zap },
              { name: 'Groq (Llama 3.3 70B)', role: 'Fallback 1', status: 'active', iconClass: 'bg-sky-100 text-sky-600', badgeClass: 'bg-sky-600', desc: 'Ultra-fast inference on dedicated LPU hardware. Free tier: ~131k tokens/day.', Icon: Zap },
              { name: 'OpenRouter Free Models', role: 'Fallback 2', status: 'active', iconClass: 'bg-violet-100 text-violet-600', badgeClass: 'bg-violet-600', desc: '29 free models from multiple providers. Auto-selects available model.', Icon: Zap },
              { name: 'Ollama (Llama 3.2 3B)', role: 'Local Fallback', status: 'standby', iconClass: 'bg-muted/50 text-muted-foreground', badgeClass: '', desc: 'Local inference, no internet needed. Lower quality but always available.', Icon: Server },
            ].map((provider, index) => {
              const isActive = provider.status === 'active'
              return (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`flex items-center justify-center size-10 rounded-xl ${provider.iconClass}`}>
                    <provider.Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{provider.name}</p>
                      <Badge variant={isActive ? 'default' : 'secondary'} className={`text-[10px] ${isActive ? provider.badgeClass : ''}`}>
                        {provider.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{provider.desc}</p>
                  </div>
                  <div className={`size-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card className="py-5 card-enter stagger-3 hover-scale">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Business Hours</CardTitle>
          </div>
          <CardDescription>
            Define business hours for automated printing and responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={resolvedConfig.business_hours_start}
                onChange={(e) =>
                  updateConfig('business_hours_start', e.target.value)
                }
                className="input-glow"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={resolvedConfig.business_hours_end}
                onChange={(e) =>
                  updateConfig('business_hours_end', e.target.value)
                }
                className="input-glow"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card className="py-5 card-enter stagger-4 hover-scale">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Feature Settings</CardTitle>
          </div>
          <CardDescription>
            Enable or disable automated features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Auto Reply */}
            <div className="flex items-center justify-between gap-4 p-2.5 -mx-2.5 rounded-lg bg-muted/20 transition-colors">
              <div className="flex items-start gap-3">
                <MessageSquare className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Auto-Reply
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically send acknowledgment emails to claim senders
                  </p>
                </div>
              </div>
              <Switch
                checked={resolvedConfig.auto_reply_enabled === 'true'}
                onCheckedChange={(checked) =>
                  updateConfig('auto_reply_enabled', String(checked))
                }
                className="toggle-glow"
              />
            </div>

            <Separator />

            {/* Print Queue */}
            <div className="flex items-center justify-between gap-4 p-2.5 -mx-2.5 rounded-lg bg-muted/20 transition-colors">
              <div className="flex items-start gap-3">
                <Printer className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Print Queue
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Queue documents for printing during business hours
                  </p>
                </div>
              </div>
              <Switch
                checked={resolvedConfig.print_queue_enabled === 'true'}
                onCheckedChange={(checked) =>
                  updateConfig('print_queue_enabled', String(checked))
                }
                className="toggle-glow"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Threshold */}
      <Card className="py-5 card-enter stagger-5 hover-scale">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Confidence Threshold</CardTitle>
          </div>
          <CardDescription>
            Claims below this confidence score will be flagged for manual review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Slider
                value={[parseInt(resolvedConfig.confidence_threshold, 10)]}
                onValueChange={([v]) =>
                  updateConfig('confidence_threshold', String(v))
                }
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <div className="w-14 text-center">
                <span className="text-lg font-bold text-foreground">
                  {resolvedConfig.confidence_threshold}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0% — Review everything</span>
              <span>100% — Auto-process everything</span>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              Claims with AI confidence scores below{' '}
              <span className="font-semibold text-foreground">
                {resolvedConfig.confidence_threshold}%
              </span>{' '}
              will automatically be set to &quot;Pending Review&quot; status for
              manual inspection.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SMTP Configuration */}
      <Card className="py-5 card-enter stagger-6 hover-scale">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">SMTP Configuration</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={testSmtpConnection}
              disabled={testingSmtp || !resolvedConfig.smtp_host}
            >
              <RefreshCw className={`size-3.5 ${testingSmtp ? 'animate-spin' : ''}`} />
              {testingSmtp ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
          <CardDescription>
            Configure the outgoing mail server for auto-replies and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={resolvedConfig.smtp_host}
                  onChange={(e) => updateConfig('smtp_host', e.target.value)}
                  className="input-glow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  placeholder="587"
                  value={resolvedConfig.smtp_port}
                  onChange={(e) => updateConfig('smtp_port', e.target.value)}
                  className="input-glow"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-2.5 -mx-2.5 rounded-lg bg-muted/20 transition-colors">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  SSL/TLS Encryption
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable secure connection to the SMTP server (port 465 usually requires this)
                </p>
              </div>
              <Switch
                checked={resolvedConfig.smtp_ssl === 'true'}
                onCheckedChange={(checked) =>
                  updateConfig('smtp_ssl', String(checked))
                }
                className="toggle-glow"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-user">SMTP Username</Label>
                <Input
                  id="smtp-user"
                  type="email"
                  placeholder="user@example.com"
                  value={resolvedConfig.smtp_user}
                  onChange={(e) => updateConfig('smtp_user', e.target.value)}
                  className="input-glow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-password">SMTP Password</Label>
                <div className="relative">
                  <Input
                    id="smtp-password"
                    type={showSmtpPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={resolvedConfig.smtp_password}
                    onChange={(e) => updateConfig('smtp_password', e.target.value)}
                    className="input-glow pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showSmtpPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSmtpPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp-from-name">From Name</Label>
                <Input
                  id="smtp-from-name"
                  type="text"
                  placeholder="Stefco Consultants (Pty) Ltd"
                  value={resolvedConfig.smtp_from_name}
                  onChange={(e) => updateConfig('smtp_from_name', e.target.value)}
                  className="input-glow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-from-email">From Email</Label>
                <Input
                  id="smtp-from-email"
                  type="email"
                  placeholder={resolvedConfig.smtp_user || 'replies@example.com'}
                  value={resolvedConfig.smtp_from_email}
                  onChange={(e) => updateConfig('smtp_from_email', e.target.value)}
                  className="input-glow"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the SMTP username as sender address
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Scheduler Control Panel */}
      <Card className="py-5 card-enter stagger-7 hover-scale">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Email Scheduler</CardTitle>
            </div>
            <EmailSchedulerStatusBadge />
          </div>
          <CardDescription>
            Monitor and control the automatic email polling scheduler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSchedulerPanel config={resolvedConfig} updateConfig={updateConfig} />
        </CardContent>
      </Card>

      {/* Self-Learning System */}
      <SelfLearningSystemPanel />

      {/* System Information */}
      <Card className="py-5 card-enter stagger-9 hover-scale">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Email Scheduler', value: 'Native (Built-in)' },
              { label: 'AI Engine', value: 'Ollama + Gemini (Multi-provider)' },
              { label: 'Database', value: 'SQLite (Prisma)' },
              { label: 'Framework', value: 'Next.js 16 + Tailwind CSS' },
              { label: 'Operating System', value: 'Windows 11 Pro' },
              { label: 'Email Server', value: 'mail.stefco-assess.co.za' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</span>
                <span className="text-sm text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          className="gap-2 hover:bg-primary/90"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="size-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
