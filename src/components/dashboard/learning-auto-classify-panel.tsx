'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Zap,
  Shield,
  Globe,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Database,
  TrendingUp,
  BookOpen,
  Bot,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { FadeIn } from '@/components/ui/motion'
import { formatRelativeTime } from '@/lib/helpers'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrainingStatus {
  trained: boolean
  trainedAt: string | null
  claimsAnalyzed: number
  patternsBuilt: number
  accuracy: number
  ready: boolean
  domainBreakdown: Array<{
    domain: string
    totalClaims: number
    avgConfidence: number
    topClassification: string
  }>
}

interface AutoClassifyStatus {
  enabled: boolean
  trained: boolean
  patternsCount: number
  accuracy: number
  lastTrained: string | null
  mode: 'learning' | 'auto' | 'off'
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function LearningAutoClassifyPanel() {
  const queryClient = useQueryClient()
  const [showDomains, setShowDomains] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(true)
  const [confirmToggle, setConfirmToggle] = useState<'enable' | 'disable' | null>(null)

  // Fetch training status
  const trainingQuery = useQuery<TrainingStatus>({
    queryKey: ['learning-batch-train'],
    queryFn: () => fetch('/api/learning/batch-train').then(r => r.json()),
    staleTime: 30000,
  })

  // Fetch auto-classify status
  const autoStatusQuery = useQuery<AutoClassifyStatus>({
    queryKey: ['learning-auto-classify-status'],
    queryFn: () => fetch('/api/learning/auto-classify-status').then(r => r.json()),
    staleTime: 15000,
  })

  // Train system mutation
  const trainMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/learning/batch-train', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Training failed')
      }
      return res.json() as Promise<{
        claimsAnalyzed: number
        patternsBuilt: number
        newPatternsCreated: number
        accuracy: number
        ready: boolean
        duration: number
      }>
    },
    onSuccess: (data) => {
      toast.success(
        `Training complete: ${data.claimsAnalyzed} claims analyzed, ${data.newPatternsCreated} new patterns built in ${(data.duration / 1000).toFixed(1)}s`
      )
      queryClient.invalidateQueries({ queryKey: ['learning-batch-train'] })
      queryClient.invalidateQueries({ queryKey: ['learning-auto-classify-status'] })
    },
    onError: (err) => {
      toast.error(`Training failed: ${err.message}`)
    },
  })

  // Toggle auto-classify mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch('/api/learning/auto-classify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Toggle failed')
      }
      return res.json() as Promise<{ enabled: boolean; message: string }>
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['learning-auto-classify-status'] })
      setConfirmToggle(null)
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`)
      setConfirmToggle(null)
    },
  })

  const handleTrain = useCallback(() => {
    trainMutation.mutate()
  }, [trainMutation])

  const handleToggle = useCallback((enabled: boolean) => {
    setConfirmToggle(enabled ? 'enable' : 'disable')
  }, [])

  const confirmToggleAction = useCallback(() => {
    if (confirmToggle) {
      toggleMutation.mutate(confirmToggle === 'enable')
    }
  }, [confirmToggle, toggleMutation])

  // Derived state
  const isAutoMode = autoStatusQuery.data?.mode === 'auto'
  const isLearning = autoStatusQuery.data?.mode === 'learning'
  const isTrained = autoStatusQuery.data?.trained
  const isReady = trainingQuery.data?.ready
  const patternsCount = trainingQuery.data?.patternsBuilt || 0
  const accuracy = trainingQuery.data?.accuracy || 0
  const claimsAnalyzed = trainingQuery.data?.claimsAnalyzed || 0
  const minPatterns = 5
  const progressPercent = Math.min(100, Math.round((patternsCount / minPatterns) * 100))

  // Mode badge
  const modeBadge = () => {
    if (isAutoMode) return (
      <Badge className="bg-primary/100 text-primary-foreground border-primary/50">
        <Bot className="size-3 mr-1" />
        Auto-Classify ON
      </Badge>
    )
    if (isTrained && isReady) return (
      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="size-3 mr-1" />
        Ready
      </Badge>
    )
    if (isTrained) return (
      <Badge className="bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
        <AlertCircle className="size-3 mr-1" />
        Learning
      </Badge>
    )
    return (
      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
        <XCircle className="size-3 mr-1" />
        Not Trained
      </Badge>
    )
  }

  return (
    <Card className="overflow-hidden card-enter hover-scale">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            AI Learning & Auto-Classification
          </CardTitle>
          {modeBadge()}
        </div>
        <CardDescription>
          Review existing emails to learn patterns, then enable auto-classification for new incoming emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: How It Works */}
        <div>
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <BookOpen className="size-3" />
            How It Works
            {showHowItWorks ? <ChevronUp className="size-3 ml-auto" /> : <ChevronDown className="size-3 ml-auto" />}
          </button>

          {showHowItWorks && (
            <div className="mt-3 space-y-3">
              {/* Step indicators */}
              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center size-7 rounded-full text-[11px] font-bold shrink-0 ${
                  isTrained
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isTrained ? <CheckCircle2 className="size-4" /> : '1'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isTrained ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
                    Review & Learn
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    System scans all existing claims and emails to build classification patterns per sender domain
                  </p>
                </div>
              </div>

              <div className="ml-3.5 border-l-2 border-dashed border-muted-foreground/20 h-3" />

              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center size-7 rounded-full text-[11px] font-bold shrink-0 ${
                  isReady
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : isTrained
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isReady ? <CheckCircle2 className="size-4" /> : '2'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isReady ? 'text-emerald-700 dark:text-emerald-400' : isTrained ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                    Pattern Building
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Creates domain-specific rules: which senders send new claims, follow-ups, or should be ignored
                  </p>
                </div>
              </div>

              <div className="ml-3.5 border-l-2 border-dashed border-muted-foreground/20 h-3" />

              <div className="flex items-start gap-3">
                <div className={`flex items-center justify-center size-7 rounded-full text-[11px] font-bold shrink-0 ${
                  isAutoMode
                    ? 'bg-primary/100 text-primary-foreground'
                    : isReady
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-muted/50 text-muted-foreground/50'
                }`}>
                  {isAutoMode ? <Zap className="size-4" /> : '3'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isAutoMode ? 'text-primary' : 'text-foreground'}`}>
                    Auto-Classify
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    New incoming emails are automatically classified using learned patterns with high confidence
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Step 2: Training Metrics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Training Progress</span>
            {trainingQuery.data?.trainedAt && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Last trained: {formatRelativeTime(trainingQuery.data.trainedAt)}
              </span>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="p-3 rounded-lg border bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Claims Analyzed</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{claimsAnalyzed}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Patterns Built</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{patternsCount}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Accuracy</p>
              <p className={`text-lg font-bold mt-0.5 ${
                accuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                accuracy >= 50 ? 'text-amber-600 dark:text-amber-400' :
                'text-slate-500'
              }`}>
                {accuracy}%
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                {isReady ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {patternsCount > 0 ? `${minPatterns - patternsCount} more needed` : 'Not started'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Patterns: {patternsCount} / {minPatterns} minimum</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  progressPercent >= 100
                    ? 'bg-emerald-500'
                    : progressPercent >= 50
                    ? 'bg-amber-400'
                    : 'bg-slate-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Step 3: Action Buttons */}
        <div className="space-y-3">
          {/* Train System Button */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/5 shrink-0">
                <GraduationCap className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {isTrained ? 'Retrain System' : 'Train System'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {isTrained
                    ? 'Re-scan all claims to update patterns with new data'
                    : 'Scan all existing claims to build classification patterns'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleTrain}
              disabled={trainMutation.isPending}
              className={`gap-2 shrink-0 ${isTrained ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
            >
              {trainMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Training...
                </>
              ) : isTrained ? (
                <>
                  <RefreshCw className="size-3.5" />
                  Retrain
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Train
                </>
              )}
            </Button>
          </div>

          {/* Auto-Classify Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                isAutoMode
                  ? 'bg-primary/10'
                  : 'bg-muted/50'
              }`}>
                {isAutoMode ? (
                  <ToggleRight className="size-5 text-primary" />
                ) : (
                  <ToggleLeft className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Auto-Classify</p>
                <p className="text-xs text-muted-foreground truncate">
                  {!isTrained
                    ? 'Train the system first before enabling'
                    : !isReady
                    ? `Need ${minPatterns - patternsCount} more patterns to enable`
                    : isAutoMode
                    ? 'Incoming emails are automatically classified'
                    : 'Enable to auto-classify new emails'}
                </p>
              </div>
            </div>

            {/* Confirmation state */}
            {confirmToggle ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {confirmToggle === 'enable' ? 'Enable?' : 'Disable?'}
                </span>
                <Button
                  size="sm"
                  variant={confirmToggle === 'enable' ? 'default' : 'destructive'}
                  className="h-7 gap-1 text-xs"
                  onClick={confirmToggleAction}
                  disabled={toggleMutation.isPending}
                >
                  {toggleMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setConfirmToggle(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Switch
                checked={isAutoMode}
                onCheckedChange={handleToggle}
                disabled={!isReady || toggleMutation.isPending}
              />
            )}
          </div>

          {/* Warning messages */}
          {!isTrained && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Click <strong>Train System</strong> first to build classification patterns from existing claims.
              </p>
            </div>
          )}
          {isTrained && !isReady && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Only {patternsCount} patterns built. Need at least {minPatterns} to enable auto-classification. Try retraining with more claims.
              </p>
            </div>
          )}
        </div>

        {/* Domain Breakdown (collapsible) */}
        {trainingQuery.data?.domainBreakdown && trainingQuery.data.domainBreakdown.length > 0 && (
          <>
            <Separator />
            <div>
              <button
                onClick={() => setShowDomains(!showDomains)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <Globe className="size-3" />
                Domain Breakdown ({trainingQuery.data.domainBreakdown.length} domains)
                {showDomains ? <ChevronUp className="size-3 ml-auto" /> : <ChevronDown className="size-3 ml-auto" />}
              </button>

              {showDomains && (
                <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin rounded-lg border">
                  <div className="grid grid-cols-[1fr_60px_60px_90px] gap-2 px-3 py-2 bg-muted/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium sticky top-0">
                    <span>Domain</span>
                    <span className="text-right">Claims</span>
                    <span className="text-right">Avg %</span>
                    <span className="text-right">Top Class</span>
                  </div>
                  {trainingQuery.data.domainBreakdown.map((d) => (
                    <div
                      key={d.domain}
                      className="grid grid-cols-[1fr_60px_60px_90px] gap-2 px-3 py-2 text-xs hover:bg-muted/20 transition-colors rounded"
                    >
                      <span className="font-mono text-foreground truncate">{d.domain}</span>
                      <span className="text-right text-muted-foreground">{d.totalClaims}</span>
                      <span className={`text-right font-semibold ${
                        d.avgConfidence >= 75
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : d.avgConfidence >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500'
                      }`}>
                        {d.avgConfidence}%
                      </span>
                      <span className="text-right">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            d.topClassification === 'NEW_CLAIM'
                              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                              : d.topClassification === 'IGNORE'
                              ? 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400'
                              : 'border-muted-foreground/30 text-muted-foreground'
                          }`}
                        >
                          {d.topClassification}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Auto-mode active banner */}
        {isAutoMode && (
          <>
            <Separator />
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
                <Shield className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">Auto-Classification Active</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  New emails are automatically classified with learned patterns. Low-confidence emails still require manual review.
                </p>
              </div>
              <TrendingUp className="size-4 text-primary shrink-0" />
            </div>
          </>
        )}

        {/* No data yet */}
        {!isTrained && (
          <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-center">
            <BarChart3 className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No training data yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Train the system to start building classification patterns from your existing claims.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
