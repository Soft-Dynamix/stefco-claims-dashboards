/**
 * Learning Agent (Periodic)
 *
 * Run periodically (daily/weekly) to analyze accumulated corrections
 * and identify patterns that can improve the system.
 *
 * Analysis outputs:
 * - Common misclassifications
 * - Keyword patterns per class
 * - Suggestions to improve classification rules
 * - Accuracy trends over time
 * - Fields that need the most corrections
 */

import { db } from '@/lib/db'

export interface LearningAnalysis {
  patterns: ClassificationPattern[]
  misclassifications: Misclassification[]
  ruleImprovements: RuleImprovement[]
  fieldAnalysis: FieldCorrectionAnalysis[]
  senderDomainAccuracy: SenderDomainAccuracy[]
  overallAccuracy: number
  recentAccuracy: number
  improvementTrend: 'improving' | 'stable' | 'declining'
  totalCorrections: number
  totalConfirmations: number
  analysisPeriod: string
}

interface ClassificationPattern {
  className: string
  avgConfidence: number
  totalPredictions: number
  correctPredictions: number
  accuracy: number
}

interface Misclassification {
  predictedAs: string
  shouldHaveBeen: string
  count: number
  exampleReasons: string[]
}

interface RuleImprovement {
  type: 'add_keyword' | 'remove_keyword' | 'adjust_threshold' | 'add_domain_rule'
  description: string
  expectedImpact: 'high' | 'medium' | 'low'
  basedOnCorrections: number
}

interface FieldCorrectionAnalysis {
  fieldName: string
  correctionCount: number
  avgOriginalLength: number
  avgCorrectedLength: number
  commonPattern: string
  suggestedHint: string
}

interface SenderDomainAccuracy {
  domain: string
  totalClaims: number
  avgConfidence: number
  correctionRate: number
  mostCorrectedField: string
}

/**
 * Run a full learning analysis on accumulated data.
 */
export async function runLearningAnalysis(): Promise<LearningAnalysis> {
  try {
    // 1. Get all predictions with their feedback
    const predictions = await db.prediction.findMany({
      include: {
        claim: {
          include: {
            feedback: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 2. Get all learning patterns
    const learningPatterns = await db.learningPattern.findMany({
      orderBy: { correctionCount: 'desc' },
    })

    // 3. Classification patterns (accuracy per class)
    const classPatterns = analyzeClassPatterns(predictions)

    // 4. Misclassifications
    const misclassifications = findMisclassifications(predictions)

    // 5. Rule improvements
    const ruleImprovements = suggestRuleImprovements(misclassifications, learningPatterns)

    // 6. Field correction analysis
    const fieldAnalysis = analyzeFieldCorrections(learningPatterns)

    // 7. Sender domain accuracy
    const senderDomainAccuracy = await analyzeSenderDomains()

    // 8. Overall accuracy
    const feedbackRecords = await db.claimFeedback.findMany()
    const totalConfirmations = feedbackRecords.filter(f => f.feedbackType === 'confirmed_correct').length
    const totalCorrections = feedbackRecords.filter(f => f.feedbackType === 'field_corrected').length

    // Recent accuracy (last 30 days vs overall)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentFeedback = feedbackRecords.filter(f => f.createdAt >= thirtyDaysAgo)
    const recentConfirmations = recentFeedback.filter(f => f.feedbackType === 'confirmed_correct').length
    const recentTotal = recentFeedback.filter(f => f.feedbackType === 'confirmed_correct' || f.feedbackType === 'field_corrected').length

    const overallAccuracy = (totalConfirmations + totalCorrections) > 0
      ? Math.round((totalConfirmations / (totalConfirmations + totalCorrections)) * 100)
      : 0

    const recentAccuracy = recentTotal > 0
      ? Math.round((recentConfirmations / recentTotal) * 100)
      : 0

    const improvementTrend: 'improving' | 'stable' | 'declining' =
      recentAccuracy > overallAccuracy + 3 ? 'improving' :
      recentAccuracy < overallAccuracy - 3 ? 'declining' : 'stable'

    return {
      patterns: classPatterns,
      misclassifications,
      ruleImprovements,
      fieldAnalysis,
      senderDomainAccuracy,
      overallAccuracy,
      recentAccuracy,
      improvementTrend,
      totalCorrections,
      totalConfirmations,
      analysisPeriod: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[learning-agent] Analysis error:', err)
    return emptyAnalysis()
  }
}

function analyzeClassPatterns(predictions: Array<{
  predictedClass: string
  confidence: number
  claim: { feedback: Array<{ feedbackType: string }> }
}>): ClassificationPattern[] {
  const classMap = new Map<string, { total: number; correct: number; confSum: number }>()

  for (const pred of predictions) {
    const cls = pred.predictedClass
    const entry = classMap.get(cls) || { total: 0, correct: 0, confSum: 0 }
    entry.total++
    entry.confSum += pred.confidence

    // Count as correct if there's a confirmed_correct feedback OR no negative feedback
    const hasNegativeFeedback = pred.claim.feedback.some(
      f => f.feedbackType === 'field_corrected' || f.feedbackType === 'flagged_incorrect'
    )
    const hasPositiveFeedback = pred.claim.feedback.some(
      f => f.feedbackType === 'confirmed_correct'
    )

    if (hasPositiveFeedback) {
      entry.correct++
    } else if (!hasNegativeFeedback) {
      // No feedback yet — don't count as correct or incorrect
    } else {
      // Has negative feedback — not correct
    }

    classMap.set(cls, entry)
  }

  return Array.from(classMap.entries()).map(([className, data]) => ({
    className,
    avgConfidence: data.total > 0 ? Math.round((data.confSum / data.total) * 100) : 0,
    totalPredictions: data.total,
    correctPredictions: data.correct,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }))
}

function findMisclassifications(predictions: Array<{
  predictedClass: string
  decision: string
  reasoning: string | null
  claim: {
    status: string
    feedback: Array<{ feedbackType: string; fieldName: string | null; originalValue: string | null; correctedValue: string | null }>
  }
}>): Misclassification[] {
  const misclassMap = new Map<string, { count: number; reasons: string[] }>()

  for (const pred of predictions) {
    // Check if this was corrected
    const corrections = pred.claim.feedback.filter(f => f.feedbackType === 'field_corrected')

    if (corrections.length > 0) {
      // This was misclassified
      for (const correction of corrections) {
        const key = `${pred.predictedClass} → field:${correction.fieldName || 'unknown'}`
        const entry = misclassMap.get(key) || { count: 0, reasons: [] }
        entry.count++
        if (pred.reasoning && entry.reasons.length < 3) {
          entry.reasons.push(pred.reasoning.slice(0, 100))
        }
        misclassMap.set(key, entry)
      }
    }
  }

  return Array.from(misclassMap.entries())
    .map(([key, data]) => {
      const parts = key.split(' → field:')
      return {
        predictedAs: parts[0] || 'UNKNOWN',
        shouldHaveBeen: parts[1] || 'unknown',
        count: data.count,
        exampleReasons: data.reasons,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function suggestRuleImprovements(
  misclassifications: Misclassification[],
  patterns: Array<{ fieldName: string; patternHint: string; correctionCount: number; senderDomain: string }>
): RuleImprovement[] {
  const improvements: RuleImprovement[] = []

  // From misclassifications
  for (const mis of misclassifications) {
    if (mis.count >= 2) {
      improvements.push({
        type: 'add_keyword',
        description: `Add recognition pattern for "${mis.shouldHaveBeen}" — misclassified ${mis.count} time(s)`,
        expectedImpact: mis.count >= 5 ? 'high' : 'medium',
        basedOnCorrections: mis.count,
      })
    }
  }

  // From learning patterns
  for (const pattern of patterns) {
    if (pattern.correctionCount >= 3) {
      improvements.push({
        type: 'add_domain_rule',
        description: `Domain "${pattern.senderDomain}" frequently needs "${pattern.fieldName}" correction — ${pattern.patternHint}`,
        expectedImpact: pattern.correctionCount >= 5 ? 'high' : 'medium',
        basedOnCorrections: pattern.correctionCount,
      })
    }
  }

  return improvements.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 }
    return impactOrder[a.expectedImpact] - impactOrder[b.expectedImpact]
  }).slice(0, 10)
}

function analyzeFieldCorrections(patterns: Array<{
  fieldName: string
  patternHint: string
  correctionCount: number
  exampleOriginal: string | null
  exampleCorrected: string | null
}>): FieldCorrectionAnalysis[] {
  const fieldMap = new Map<string, { count: number; origLens: number[]; corrLens: number[]; hints: string[] }>()

  for (const p of patterns) {
    const entry = fieldMap.get(p.fieldName) || { count: 0, origLens: [], corrLens: [], hints: [] }
    entry.count++
    if (p.exampleOriginal) entry.origLens.push(p.exampleOriginal.length)
    if (p.exampleCorrected) entry.corrLens.push(p.exampleCorrected.length)
    if (p.patternHint && entry.hints.length < 3) entry.hints.push(p.patternHint)
    fieldMap.set(p.fieldName, entry)
  }

  return Array.from(fieldMap.entries()).map(([fieldName, data]) => ({
    fieldName,
    correctionCount: data.count,
    avgOriginalLength: data.origLens.length > 0
      ? Math.round(data.origLens.reduce((a, b) => a + b, 0) / data.origLens.length)
      : 0,
    avgCorrectedLength: data.corrLens.length > 0
      ? Math.round(data.corrLens.reduce((a, b) => a + b, 0) / data.corrLens.length)
      : 0,
    commonPattern: data.hints[0] || 'No pattern identified',
    suggestedHint: data.hints[data.hints.length - 1] || 'No suggestion',
  }))
}

async function analyzeSenderDomains(): Promise<SenderDomainAccuracy[]> {
  try {
    const claims = await db.claim.findMany({
      where: { senderEmail: { not: null } },
      select: {
        senderEmail: true,
        confidenceScore: true,
        feedback: {
          select: { feedbackType: true },
        },
      },
    })

    const domainMap = new Map<string, { total: number; confSum: number; corrections: number; fieldCounts: Map<string, number> }>()

    for (const claim of claims) {
      const domain = claim.senderEmail?.split('@')[1]?.toLowerCase() || 'unknown'
      const entry = domainMap.get(domain) || { total: 0, confSum: 0, corrections: 0, fieldCounts: new Map() }
      entry.total++
      entry.confSum += claim.confidenceScore

      for (const fb of claim.feedback) {
        if (fb.feedbackType === 'field_corrected') {
          entry.corrections++
        }
      }

      domainMap.set(domain, entry)
    }

    return Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        totalClaims: data.total,
        avgConfidence: data.total > 0 ? Math.round(data.confSum / data.total) : 0,
        correctionRate: data.total > 0 ? Math.round((data.corrections / data.total) * 100) : 0,
        mostCorrectedField: 'N/A',
      }))
      .filter(d => d.totalClaims >= 2)
      .sort((a, b) => b.correctionRate - a.correctionRate)
      .slice(0, 10)
  } catch {
    return []
  }
}

function emptyAnalysis(): LearningAnalysis {
  return {
    patterns: [],
    misclassifications: [],
    ruleImprovements: [],
    fieldAnalysis: [],
    senderDomainAccuracy: [],
    overallAccuracy: 0,
    recentAccuracy: 0,
    improvementTrend: 'stable',
    totalCorrections: 0,
    totalConfirmations: 0,
    analysisPeriod: new Date().toISOString(),
  }
}
