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

export interface ClassificationResult {
  predictedClass: 'NEW_CLAIM' | 'IGNORE' | 'MISSING_INFO' | 'OTHER'
  confidence: number
  alternatives: Array<{ class: string; score: number }>
  reasoning: string
}

const CLASSIFICATION_AGENT_PROMPT = `You are a claims email classification agent for Stefco, a South African insurance claims management company.

Classify the email into ONE of these classes:

1. **New Claim** — The email contains a new insurance claim notification, including:
   - "New assessment" or "Nuwe assessering" (Afrikaans)
   - "New appointment" or "Nuwe benoeming"
   - "NUWE EIS" (Afrikaans for "New Claim")
   - Claim number references (Claim No, Claim Reference, Claim Ref)
   - Assessment appointment details
   - Insurance policy number references
   - Vehicle registrations with damage descriptions
   - Incident dates and descriptions
   - References to "assessor", "assessment", "claim"
   - Known insurance company sender domains
   - Attached documents (assessment reports, photos, quotes)

2. **Missing Info** — The email is related to a claim but is requesting additional information, documents, or clarification. Not a new claim itself.

3. **Ignore** — The email should be ignored:
   - Marketing, promotional, newsletter, subscription
   - Out of office / auto-reply
   - General inquiries without claim-specific information
   - Spam or phishing
   - Internal communications not related to claims
   - Payment confirmations without claim context
   - Meeting invitations without claim context

4. **Other** — The email doesn't fit the above categories but may still be relevant.

PREPROCESSED SIGNALS (extracted before classification):
- Possible claim number: {possibleClaimNumber}
- Person names: {personNames}
- Dates found: {dates}
- Keywords: {keywords}

INSTRUCTIONS:
- Provide a confidence score between 0.0 and 1.0
- Provide your top 2 alternative classifications with their confidence scores
- Explain your reasoning in one short sentence
- Use South African insurance context (Afrikaans terms, SA phone formats, ZAR currency, SA vehicle registrations)

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
  }
  learningHints?: string
}): Promise<ClassificationResult> {
  // Build the prompt with preprocessed signals injected
  const prompt = CLASSIFICATION_AGENT_PROMPT
    .replace('{possibleClaimNumber}', params.preprocessed.possibleClaimNumber || 'None found')
    .replace('{personNames}', params.preprocessed.personNames.join(', ') || 'None found')
    .replace('{dates}', params.preprocessed.dates.join(', ') || 'None found')
    .replace('{keywords}', params.preprocessed.keywords.join(', ') || 'None found')

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
  }
}): ClassificationResult {
  const fullText = `${params.subject} ${params.body} ${params.from}`.toLowerCase()
  const { keywords, possibleClaimNumber } = params.preprocessed

  // Scoring
  let claimScore = 0
  let missingInfoScore = 0

  // Strong claim indicators
  const claimKeywords = [
    'new assessment', 'nuwe assessering', 'new appointment', 'nuwe benoeming',
    'nuwe eis', 'claim no', 'claim reference', 'claim ref',
    'assessment', 'assessor', 'claim number', 'policy number',
  ]
  for (const kw of claimKeywords) {
    if (fullText.includes(kw)) claimScore += 2
  }

  // Keyword boost
  if (keywords.includes('claim')) claimScore += 3
  if (keywords.includes('assessment')) claimScore += 2
  if (possibleClaimNumber) claimScore += 4

  // Missing info indicators
  const missingInfoKeywords = [
    'missing information', 'please provide', 'we require', 'outstanding documents',
    'incomplete', 'additional information required', 'please forward',
  ]
  for (const kw of missingInfoKeywords) {
    if (fullText.includes(kw)) missingInfoScore += 2
  }
  if (keywords.includes('documents')) missingInfoScore += 1

  // Determine class
  let predictedClass: 'NEW_CLAIM' | 'IGNORE' | 'MISSING_INFO' | 'OTHER'
  let confidence: number

  if (claimScore >= 6) {
    predictedClass = 'NEW_CLAIM'
    confidence = Math.min(0.95, 0.5 + claimScore * 0.05)
  } else if (missingInfoScore >= 3) {
    predictedClass = 'MISSING_INFO'
    confidence = Math.min(0.9, 0.4 + missingInfoScore * 0.08)
  } else if (claimScore >= 3) {
    predictedClass = 'NEW_CLAIM'
    confidence = 0.6 + claimScore * 0.03
  } else {
    predictedClass = 'IGNORE'
    confidence = 0.7
  }

  // Build alternatives (the other top classes)
  const allClasses = ['NEW_CLAIM', 'IGNORE', 'MISSING_INFO', 'OTHER'] as const
  const alternatives = allClasses
    .filter((c) => c !== predictedClass)
    .slice(0, 2)
    .map((c) => ({
      class: c,
      score: c === 'NEW_CLAIM' ? claimScore * 0.03 : c === 'MISSING_INFO' ? missingInfoScore * 0.03 : 0.2,
    }))

  return {
    predictedClass,
    confidence,
    alternatives,
    reasoning: 'Fallback heuristic classification — AI API unavailable. Based on keyword matching and preprocessed signals.',
  }
}
