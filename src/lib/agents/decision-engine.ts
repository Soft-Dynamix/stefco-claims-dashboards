/**
 * Decision Agent (RULE ENGINE)
 *
 * Controls automation safely based on confidence levels.
 *
 * Three routing tiers:
 * - confidence > 0.85 → "auto_classify"   — Full automation, no human review needed
 * - confidence 0.60-0.85 → "needs_review"  — Process normally but flag for human review
 * - confidence < 0.60 → "manual_review"    — Pause pipeline, require human intervention
 *
 * The decision engine also factors in:
 * - Whether learning hints were applied (small confidence boost)
 * - Whether the sender domain is known/trusted
 * - Whether the email matches a known insurance company
 */

export interface DecisionResult {
  decision: 'auto_classify' | 'needs_review' | 'manual_review'
  finalClass: string
  reasoning: string
}

// Configurable thresholds (can be overridden from DB)
const DEFAULT_THRESHOLDS = {
  autoClassify: 0.85,
  needsReview: 0.60,
}

/**
 * Run the decision engine on a classification result.
 */
export function makeDecision(params: {
  predictedClass: string
  confidence: number
  hasLearningHints: boolean
  isKnownSender: boolean
  isKnownInsuranceCompany: boolean
  hasAttachments: boolean
  hasClaimNumber: boolean
  confidenceThreshold?: number // from DB config (0-100 scale, default 70)
}): DecisionResult {
  // Convert DB threshold from 0-100 scale to 0-1 scale
  const dbThreshold = (params.confidenceThreshold || 70) / 100

  // Determine base confidence
  let effectiveConfidence = params.confidence

  // Small boost for known sender domains (+0.03)
  if (params.isKnownSender) {
    effectiveConfidence = Math.min(1, effectiveConfidence + 0.03)
  }

  // Small boost for known insurance company (+0.05)
  if (params.isKnownInsuranceCompany) {
    effectiveConfidence = Math.min(1, effectiveConfidence + 0.05)
  }

  // Small boost for learning hints applied (+0.02)
  if (params.hasLearningHints) {
    effectiveConfidence = Math.min(1, effectiveConfidence + 0.02)
  }

  // Small boost for attachments present (+0.02, claim emails often have docs)
  if (params.hasAttachments) {
    effectiveConfidence = Math.min(1, effectiveConfidence + 0.02)
  }

  // Small boost for claim number found (+0.03)
  if (params.hasClaimNumber) {
    effectiveConfidence = Math.min(1, effectiveConfidence + 0.03)
  }

  // Determine decision
  let decision: 'auto_classify' | 'needs_review' | 'manual_review'
  let reasoning: string

  if (effectiveConfidence >= DEFAULT_THRESHOLDS.autoClassify) {
    decision = 'auto_classify'
    reasoning = `High confidence (${(effectiveConfidence * 100).toFixed(0)}%) with ${(params.confidence * 100).toFixed(0)}% base`
      + (params.isKnownInsuranceCompany ? ' + known insurer' : '')
      + (params.isKnownSender ? ' + known sender' : '')
      + (params.hasLearningHints ? ` + ${params.hasLearningHints ? 'learning hints' : ''}` : '')
      + ' — auto-processing approved'
  } else if (effectiveConfidence >= DEFAULT_THRESHOLDS.needsReview) {
    decision = 'needs_review'
    reasoning = `Moderate confidence (${(effectiveConfidence * 100).toFixed(0)}%) — processing continues but flagged for human review`
  } else {
    decision = 'manual_review'
    reasoning = `Low confidence (${(effectiveConfidence * 100).toFixed(0)}%) — below threshold (${(DEFAULT_THRESHOLDS.needsReview * 100).toFixed(0)}%), pipeline paused for human review`
  }

  return {
    decision,
    finalClass: params.predictedClass,
    reasoning,
  }
}
