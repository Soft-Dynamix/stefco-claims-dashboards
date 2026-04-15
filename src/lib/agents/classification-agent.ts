/**
 * Classification Agent (CORE)
 *
 * Classifies insurance claim emails with:
 * - Predicted class (NEW_CLAIM, IGNORE, MISSING_INFO, OTHER)
 * - Confidence score (0 to 1)
 * - Top 2 alternative classes with scores
 * - Short reasoning explanation
 *
 * This agent produces a full prediction record that is stored in the
 * Prediction table for learning/audit purposes.
 */

import { callAI } from '@/lib/ai-helpers'
import { buildKnowledgeContext } from '@/lib/knowledge-base-service'
import { extractEmailDomain } from '@/lib/folder-utils'

export interface ClassificationResult {
  predictedClass: 'NEW_CLAIM' | 'IGNORE' | 'MISSING_INFO' | 'OTHER'
  confidence: number
  alternatives: Array<{ class: string; score: number }>
  reasoning: string
}

const CLASSIFICATION_AGENT_PROMPT = `You are a claims email classification agent for Stefco, a South African insurance claims management company.

Classify the email into ONE of these classes:

1. **New Claim** — The email introduces a NEW insurance claim that has NOT been previously processed. Look for:
   - "New assessment" or "Nuwe assessering" (Afrikaans)
   - "New appointment" or "Nuwe benoeming"
   - "NUWE EIS" (Afrikaans for "New Claim")
   - Appointment of assessor/loss adjuster for a NEW matter
   - FIRST notification of a loss/damage incident
   - NEW claim number being assigned (not referencing an existing one)
   - Vehicle registrations with NEW damage descriptions
   - Known insurance company sender domains sending a NEW notification
   - Attached documents typical of new claims (assessment reports, photos, quotes)

   ⚠️ IMPORTANT: A mere mention of the word "claim" does NOT make it a new claim. Follow-ups, status queries, and document resubmissions about EXISTING claims are NOT new claims.

2. **Missing Info** — The email is a FOLLOW-UP related to an EXISTING claim, requesting additional info, documents, status updates, or clarification:
   - Follow-up emails (RE:, Fwd:, "following up", "status update")
   - Status queries ("what is the status", "has the assessment been completed")
   - Requests for additional documents or information
   - Resubmissions or corrections to existing claims
   - Queries or enquiries about an existing claim
   - "Please advise", "kindly confirm", "please provide an update"
   - Reminders about pending claims
   - References to "the above claim", "this claim", "our claim" (indicating existing)

3. **Ignore** — The email should be ignored:
   - Marketing, promotional, newsletter, subscription
   - Out of office / auto-reply
   - General inquiries without claim-specific information
   - Spam or phishing
   - Internal communications not related to claims
   - Payment confirmations without claim context
   - Meeting invitations without claim context
   - Automated FTP/server notifications

4. **Other** — The email doesn't fit the above categories but may still be relevant.

HISTORICAL KNOWLEDGE:
{knowledgeContext}
PREPROCESSED SIGNALS (extracted before classification):
- Possible claim number: {possibleClaimNumber}
- Person names: {personNames}
- Dates found: {dates}
- Keywords: {keywords}
- FOLLOW-UP SIGNALS: {followUpSignals}

CRITICAL RULE: If the follow-up signals are STRONG (multiple signals detected), the email is almost certainly NOT a new claim, even if it mentions claim-related keywords. Classify as MISSING_INFO or OTHER in that case.

INSTRUCTIONS:
- Provide a confidence score between 0.0 and 1.0
- Provide your top 2 alternative classifications with their confidence scores
- Explain your reasoning in one short sentence
- Use South African insurance context (Afrikaans terms, SA phone formats, ZAR currency, SA vehicle registrations)
- HEAVILY PENALIZE "NEW_CLAIM" classification when follow-up signals are present

Return ONLY valid JSON (no markdown, no backticks):

{
  "predicted_class": "NEW_CLAIM" | "IGNORE" | "MISSING_INFO" | "OTHER",
  "confidence": 0.0,
  "alternatives": [
    {"class": "", "score": 0.0},
    {"class": "", "score": 0.0}
  ],
  "reasoning": ""
}`

/**
 * Run the classification agent on email content with preprocessed signals.
 */
export async function classifyWithAgent(params: {
  subject: string
  body: string
  from: string
  preprocessed: {
    possibleClaimNumber: string | null
    personNames: string[]
    dates: string[]
    keywords: string[]
    followUpSignals?: {
      isReply: boolean
      isForward: boolean
      hasFollowUpPhrases: boolean
      hasStatusQuery: boolean
      hasExistingClaimRef: boolean
      phrases: string[]
    }
  }
  learningHints?: string
}): Promise<ClassificationResult> {
  // Build knowledge context from the knowledge base (historical classifications for this sender)
  let knowledgeContext = 'No historical data available for this sender.'
  try {
    const senderDomain = extractEmailDomain(params.from)
    const context = await buildKnowledgeContext(senderDomain)
    if (context) {
      knowledgeContext = `(from sender domain: ${senderDomain})\n${context}`
    }
  } catch (kbErr) {
    console.error('[classification-agent] Knowledge base context lookup failed (non-fatal):', kbErr)
  }

  // Build follow-up signal summary for the prompt
  const fu = params.preprocessed.followUpSignals
  const followUpCount = fu
    ? [fu.isReply, fu.isForward, fu.hasFollowUpPhrases, fu.hasStatusQuery, fu.hasExistingClaimRef].filter(Boolean).length
    : 0
  const followUpSignalStr = fu
    ? `Reply=${fu.isReply}, Forward=${fu.isForward}, Follow-up phrases=${fu.hasFollowUpPhrases}, Status query=${fu.hasStatusQuery}, Existing claim ref=${fu.hasExistingClaimRef} (Strength: ${followUpCount}/5 signals${followUpCount >= 2 ? ' — STRONG, likely NOT a new claim' : followUpCount >= 1 ? ' — Weak, consider context' : ' — None detected'}). Detected phrases: [${fu.phrases.length > 0 ? fu.phrases.join(', ') : 'none'}]`
    : 'Not available'

  // Build the prompt with knowledge context and preprocessed signals injected
  const prompt = CLASSIFICATION_AGENT_PROMPT
    .replace('{knowledgeContext}', knowledgeContext)
    .replace('{possibleClaimNumber}', params.preprocessed.possibleClaimNumber || 'None found')
    .replace('{personNames}', params.preprocessed.personNames.join(', ') || 'None found')
    .replace('{dates}', params.preprocessed.dates.join(', ') || 'None found')
    .replace('{keywords}', params.preprocessed.keywords.join(', ') || 'None found')
    .replace('{followUpSignals}', followUpSignalStr)

  // Append learning hints if available
  const fullPrompt = params.learningHints
    ? prompt + '\n\nLEARNED PATTERNS FROM PREVIOUS CORRECTIONS:\n' + params.learningHints
    : prompt

  const text = await callAI(
    fullPrompt,
    `From: ${params.from}\n\nSubject: ${params.subject}\n\nBody:\n${params.body.slice(0, 5000)}`
  )

  if (!text) {
    // Fallback: heuristic classification using preprocessed signals
    return heuristicClassify(params)
  }

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Normalize class names
    const classMap: Record<string, 'NEW_CLAIM' | 'IGNORE' | 'MISSING_INFO' | 'OTHER'> = {
      'new_claim': 'NEW_CLAIM',
      'New Claim': 'NEW_CLAIM',
      'new claim': 'NEW_CLAIM',
      'ignore': 'IGNORE',
      'Ignore': 'IGNORE',
      'missing_info': 'MISSING_INFO',
      'Missing Info': 'MISSING_INFO',
      'missing information': 'MISSING_INFO',
      'other': 'OTHER',
      'Other': 'OTHER',
    }

    const predictedClass = classMap[parsed.predicted_class] || 'OTHER'
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.5

    // Normalize alternatives
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives.slice(0, 2).map((alt: { class: string; score: number }) => ({
          class: classMap[alt.class] || alt.class || 'OTHER',
          score: typeof alt.score === 'number' ? Math.min(1, Math.max(0, alt.score)) : 0,
        }))
      : []

    return {
      predictedClass,
      confidence,
      alternatives,
      reasoning: parsed.reasoning || 'No reasoning provided',
    }
  } catch {
    return heuristicClassify(params)
  }
}

/**
 * Fallback heuristic classification using preprocessed signals.
 */
function heuristicClassify(params: {
  subject: string
  body: string
  from: string
  preprocessed: {
    possibleClaimNumber: string | null
    personNames: string[]
    dates: string[]
    keywords: string[]
    followUpSignals?: {
      isReply: boolean
      isForward: boolean
      hasFollowUpPhrases: boolean
      hasStatusQuery: boolean
      hasExistingClaimRef: boolean
      phrases: string[]
    }
  }
}): ClassificationResult {
  const fullText = `${params.subject} ${params.body} ${params.from}`.toLowerCase()
  const { keywords, possibleClaimNumber, followUpSignals } = params.preprocessed

  // Scoring
  let claimScore = 0
  let missingInfoScore = 0
  let followUpScore = 0

  // ── STRONG new claim indicators (only these indicate a genuine new claim) ──
  const strongClaimKeywords = [
    'new assessment', 'nuwe assessering', 'new appointment', 'nuwe benoeming',
    'nuwe eis', 'appointment of', 'aanstelling van',
    'new claim notification', 'new loss', 'new matter',
  ]
  for (const kw of strongClaimKeywords) {
    if (fullText.includes(kw)) claimScore += 3
  }

  // Weak claim indicators (claim-related words that appear in follow-ups too)
  const weakClaimKeywords = [
    'assessment', 'assessor', 'claim number', 'policy number',
    'claim no', 'claim reference', 'claim ref',
  ]
  for (const kw of weakClaimKeywords) {
    if (fullText.includes(kw)) claimScore += 1
  }

  // Keyword boost (but reduce if follow-up signals present)
  if (keywords.includes('claim')) claimScore += 2
  if (keywords.includes('assessment')) claimScore += 1
  if (possibleClaimNumber) claimScore += 2

  // ── Follow-up / query indicators ──
  const followUpKeywords = [
    'follow', 'follow-up', 'followup', 'following up',
    'status update', 'status check', 'update on', 'progress',
    'any news', 'any update', 'any feedback', 'feedback on',
    'please advise', 'kindly advise', 'please confirm',
    'resubmit', 'resubmission', 'revised', 'correction', 'amendment',
    'reminder', 'gentle reminder',
    'query', 'enquiry', 'inquiry',
    'what is the status', 'status of claim', 'has the assessment',
    'when will', 'how long', 'timeline',
    'we are still waiting', 'client is waiting',
    'please process', 'kindly process', 'expedite',
    'overdue', 'delayed',
    'closure', 'finalization', 'finalise', 'finalize',
    'escalat', 'urgent',
    'in response to', 'as discussed', 'per our conversation',
    'further to', 'in respect of', 'pertaining to',
    're: claim', 'regarding claim', 'with reference to',
  ]
  for (const kw of followUpKeywords) {
    if (fullText.includes(kw)) followUpScore += 2
  }

  // Missing info indicators
  const missingInfoKeywords = [
    'missing information', 'please provide', 'we require', 'outstanding documents',
    'incomplete', 'additional information required', 'please forward',
    'additional documents',
  ]
  for (const kw of missingInfoKeywords) {
    if (fullText.includes(kw)) missingInfoScore += 2
  }
  if (keywords.includes('documents')) missingInfoScore += 1

  // ── Structural follow-up signals from preprocessing ──
  if (followUpSignals) {
    if (followUpSignals.isReply) followUpScore += 4
    if (followUpSignals.isForward) followUpScore += 3
    if (followUpSignals.hasStatusQuery) followUpScore += 5
    if (followUpSignals.hasExistingClaimRef) followUpScore += 4
    if (followUpSignals.hasFollowUpPhrases) followUpScore += 3
  }

  // ── CRITICAL: Penalize claim score when follow-up signals are strong ──
  if (followUpScore >= 6) {
    // Strong follow-up: drastically reduce claim score
    claimScore = Math.floor(claimScore * 0.3)
    missingInfoScore += 3 // Boost missing info / follow-up classification
  } else if (followUpScore >= 3) {
    // Moderate follow-up: reduce claim score
    claimScore = Math.floor(claimScore * 0.6)
  }

  // ── Determine class ──
  let predictedClass: 'NEW_CLAIM' | 'IGNORE' | 'MISSING_INFO' | 'OTHER'
  let confidence: number

  if (followUpScore >= 8 && missingInfoScore >= 2) {
    // Strong follow-up + missing info: likely a follow-up on existing claim
    predictedClass = 'MISSING_INFO'
    confidence = Math.min(0.85, 0.4 + followUpScore * 0.04)
  } else if (followUpScore >= 6) {
    // Strong follow-up even without missing info
    predictedClass = 'MISSING_INFO'
    confidence = Math.min(0.8, 0.35 + followUpScore * 0.04)
  } else if (missingInfoScore >= 4) {
    predictedClass = 'MISSING_INFO'
    confidence = Math.min(0.9, 0.4 + missingInfoScore * 0.08)
  } else if (claimScore >= 8) {
    // High threshold for new claim (was 6)
    predictedClass = 'NEW_CLAIM'
    confidence = Math.min(0.95, 0.5 + claimScore * 0.04)
  } else if (claimScore >= 5) {
    // Medium claim score but only if no follow-up signals
    predictedClass = 'NEW_CLAIM'
    confidence = 0.55 + claimScore * 0.03
  } else if (missingInfoScore >= 2) {
    predictedClass = 'MISSING_INFO'
    confidence = 0.5 + missingInfoScore * 0.06
  } else {
    predictedClass = 'IGNORE'
    confidence = 0.7
  }

  // Build reasoning
  let reasoning = 'Fallback heuristic — AI unavailable.'
  if (followUpScore >= 6) {
    reasoning += ` Strong follow-up signals detected (${followUpScore} pts): ${followUpSignals?.phrases.slice(0, 3).join(', ') || 'reply/query/follow-up keywords'}. Not a new claim.`
  } else if (claimScore >= 5) {
    reasoning += ` New claim indicators found (score: ${claimScore}).`
  }

  // Build alternatives
  const allClasses = ['NEW_CLAIM', 'IGNORE', 'MISSING_INFO', 'OTHER'] as const
  const alternatives = allClasses
    .filter((c) => c !== predictedClass)
    .slice(0, 2)
    .map((c) => ({
      class: c,
      score: c === 'NEW_CLAIM' ? claimScore * 0.02 : c === 'MISSING_INFO' ? Math.max(missingInfoScore, followUpScore) * 0.02 : 0.15,
    }))

  return {
    predictedClass,
    confidence,
    alternatives,
    reasoning,
  }
}
