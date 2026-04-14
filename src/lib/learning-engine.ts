/**
 * Self-Learning Engine for Stefco Claims Dashboard
 *
 * Architecture:
 * 1. When a new claim email comes in, the engine checks for existing LearningPatterns
 *    matching the sender domain and/or insurance company.
 * 2. These patterns are injected as "hints" into the AI extraction prompt, improving
 *    accuracy for recurring sender formats.
 * 3. When a user corrects a field, the correction is stored as a new LearningPattern.
 * 4. Over time, the system builds up domain-specific knowledge that makes AI extraction
 *    progressively more accurate.
 *
 * Key design decisions:
 * - Patterns are scoped by senderDomain + optional insuranceCompanyId
 * - Multiple corrections of the same field reinforce the pattern (correctionCount++)
 * - Confidence for a pattern grows with more corrections (min 50, max 95)
 * - Hints are sorted by confidence before injection (most reliable first)
 * - The system tracks which hints were applied to each claim (aiHintsUsed field)
 */

import { db } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LearningHint {
  fieldName: string
  patternHint: string
  exampleOriginal?: string | null
  exampleCorrected?: string | null
  confidence: number
  correctionCount: number
}

export interface LearningStats {
  totalPatterns: number
  totalFeedback: number
  confirmedCorrect: number
  flaggedIncorrect: number
  fieldCorrected: number
  topSenderDomains: Array<{ domain: string; patternCount: number; avgConfidence: number }>
  topCorrectedFields: Array<{ field: string; count: number }>
  accuracyTrend: AccuracyTrend
  learningCoverage: number // % of active sender domains with at least 1 pattern
}

export interface AccuracyTrend {
  avgConfidenceAll: number
  avgConfidenceRecent: number // last 50 claims
  improvement: number // percentage points improvement
  direction: 'improving' | 'stable' | 'declining'
}

// ─── Core: Get Learning Hints ──────────────────────────────────────────────────

/**
 * Get relevant learning hints for a given sender domain and insurance company.
 * Returns patterns sorted by confidence (highest first).
 */
export async function getLearningHints(
  senderDomain: string,
  insuranceCompanyId?: string
): Promise<LearningHint[]> {
  try {
    const whereClause: Record<string, unknown> = {
      senderDomain,
    }

    // If insurance company is known, prefer patterns for that specific company
    // but also include general domain patterns
    const patterns = await db.learningPattern.findMany({
      where: {
        senderDomain,
        ...(insuranceCompanyId ? {
          OR: [
            { insuranceCompanyId },
            { insuranceCompanyId: null },
          ],
        } : {}),
      },
      orderBy: [
        { confidence: 'desc' },
        { correctionCount: 'desc' },
      ],
      take: 15, // Limit hints to avoid overwhelming the AI prompt
    })

    // Deduplicate by fieldName (keep highest confidence version)
    const seen = new Map<string, LearningHint>()
    for (const p of patterns) {
      const existing = seen.get(p.fieldName)
      if (!existing || p.confidence > existing.confidence) {
        seen.set(p.fieldName, {
          fieldName: p.fieldName,
          patternHint: p.patternHint,
          exampleOriginal: p.exampleOriginal,
          exampleCorrected: p.exampleCorrected,
          confidence: p.confidence,
          correctionCount: p.correctionCount,
        })
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence)
  } catch (err) {
    console.error('[learning-engine] Error fetching hints:', err)
    return []
  }
}

// ─── Core: Build AI Hint Section ───────────────────────────────────────────────

/**
 * Build a formatted hint section to inject into the AI extraction prompt.
 */
export function buildHintSection(hints: LearningHint[]): string {
  if (hints.length === 0) return ''

  const lines = [
    '',
    'LEARNED PATTERNS FROM PREVIOUS CORRECTIONS (apply these if they match the current email):',
    '',
  ]

  for (const hint of hints) {
    let line = `- ${hint.fieldName.replace(/_/g, ' ').toUpperCase()}: ${hint.patternHint}`
    if (hint.exampleOriginal && hint.exampleCorrected) {
      line += ` (e.g., AI previously extracted "${hint.exampleOriginal}" but it should be "${hint.exampleCorrected}")`
    }
    line += ` [confidence: ${hint.confidence}% based on ${hint.correctionCount} correction${hint.correctionCount !== 1 ? 's' : ''}]`
    lines.push(line)
  }

  lines.push('')
  lines.push('Apply these learned patterns when they match the email content. These corrections have been verified by human reviewers.')
  lines.push('')

  return lines.join('\n')
}

// ─── Core: Record Correction ──────────────────────────────────────────────────

/**
 * Record a user correction as a learning pattern.
 * If a similar pattern already exists for this domain+field, increment its correctionCount.
 * Otherwise, create a new pattern.
 */
export async function recordCorrection(params: {
  claimId: string
  senderDomain: string
  insuranceCompanyId?: string
  fieldName: string
  originalValue: string
  correctedValue: string
}): Promise<{ patternId: string; isNew: boolean }> {
  const { senderDomain, insuranceCompanyId, fieldName, originalValue, correctedValue } = params

  // Build a human-readable hint from the correction
  const patternHint = buildPatternHint(fieldName, originalValue, correctedValue)

  // Check if a similar pattern already exists for this domain + field
  const existing = await db.learningPattern.findFirst({
    where: {
      senderDomain,
      fieldName,
      ...(insuranceCompanyId ? { insuranceCompanyId } : {}),
    },
  })

  if (existing) {
    // Update existing pattern: increment correction count, boost confidence
    const newCount = existing.correctionCount + 1
    const newConfidence = Math.min(95, 50 + Math.floor(newCount * 8)) // 50, 58, 66, 74, 82, 90, 95 cap

    await db.learningPattern.update({
      where: { id: existing.id },
      data: {
        patternHint,
        exampleOriginal: originalValue,
        exampleCorrected: correctedValue,
        correctionCount: newCount,
        confidence: newConfidence,
        lastAppliedAt: new Date(),
      },
    })

    console.error(`[learning-engine] Updated pattern ${existing.id}: ${fieldName} for ${senderDomain} (count: ${newCount}, confidence: ${newConfidence}%)`)

    return { patternId: existing.id, isNew: false }
  }

  // Create new pattern
  const pattern = await db.learningPattern.create({
    data: {
      senderDomain,
      insuranceCompanyId,
      fieldName,
      patternHint,
      exampleOriginal: originalValue,
      exampleCorrected: correctedValue,
      correctionCount: 1,
      confidence: 55, // Starting confidence for a single correction
      lastAppliedAt: new Date(),
    },
  })

  console.error(`[learning-engine] Created new pattern ${pattern.id}: ${fieldName} for ${senderDomain}`)

  return { patternId: pattern.id, isNew: true }
}

/**
 * Build a human-readable pattern hint from a field correction.
 */
function buildPatternHint(fieldName: string, originalValue: string, correctedValue: string): string {
  const fieldLabels: Record<string, string> = {
    client_name: 'Client name',
    claim_number: 'Claim number',
    claim_type: 'Claim type',
    contact_number: 'Contact number',
    contact_email: 'Contact email',
    incident_description: 'Incident description',
    excess_amount: 'Excess amount',
    special_instructions: 'Special instructions',
    vehicle_make: 'Vehicle make',
    vehicle_model: 'Vehicle model',
    vehicle_year: 'Vehicle year',
    vehicle_registration: 'Vehicle registration',
    insurance_company: 'Insurance company',
  }

  const label = fieldLabels[fieldName] || fieldName.replace(/_/g, ' ')

  // Detect common patterns
  if (fieldName === 'client_name') {
    if (correctedValue.includes(',')) {
      return `For this sender, the client name format is typically "${correctedValue}" — check for "Last, First" or "Last, First Middle" formatting`
    }
    if (originalValue && correctedValue.length > originalValue.length) {
      return `For this sender, the full client name includes middle names or additional parts — extract the complete name`
    }
    return `For this sender, verify the client name carefully — corrections have been made in the past`
  }

  if (fieldName === 'claim_number') {
    return `For this sender, claim numbers follow the format shown in "${correctedValue}" — look for this specific pattern`
  }

  if (fieldName === 'excess_amount') {
    return `For this sender, excess amounts are typically formatted like "${correctedValue}" — check for currency symbols and formatting`
  }

  if (fieldName === 'vehicle_registration') {
    return `For this sender, vehicle registrations follow the format "${correctedValue}" — look for province codes followed by numbers`
  }

  return `For this sender, the ${label} was corrected from "${originalValue}" to "${correctedValue}" — look for similar patterns`
}

// ─── Core: Record Feedback ────────────────────────────────────────────────────

/**
 * Record user feedback on a claim (confirmed correct, flagged incorrect, or field corrected).
 */
export async function recordClaimFeedback(params: {
  claimId: string
  feedbackType: 'confirmed_correct' | 'flagged_incorrect' | 'field_corrected'
  fieldName?: string
  originalValue?: string
  correctedValue?: string
}): Promise<void> {
  // Get claim data for context
  const claim = await db.claim.findUnique({
    where: { id: params.claimId },
    select: {
      confidenceScore: true,
      processingStage: true,
      senderEmail: true,
      insuranceCompanyId: true,
    },
  })

  if (!claim) throw new Error('Claim not found')

  await db.claimFeedback.create({
    data: {
      claimId: params.claimId,
      feedbackType: params.feedbackType,
      fieldName: params.fieldName || null,
      originalValue: params.originalValue || null,
      correctedValue: params.correctedValue || null,
      aiConfidence: claim.confidenceScore,
      processingStage: claim.processingStage,
    },
  })

  // If this is a field correction, also create/update a learning pattern
  if (params.feedbackType === 'field_corrected' && params.fieldName && params.originalValue && params.correctedValue) {
    const senderDomain = extractDomain(claim.senderEmail || '')
    if (senderDomain) {
      await recordCorrection({
        claimId: params.claimId,
        senderDomain,
        insuranceCompanyId: claim.insuranceCompanyId || undefined,
        fieldName: params.fieldName,
        originalValue: params.originalValue,
        correctedValue: params.correctedValue,
      })
    }
  }
}

// ─── Core: Update Claim After Feedback ────────────────────────────────────────

/**
 * Update a claim's status and flags after user feedback.
 */
export async function applyFeedbackToClaim(
  claimId: string,
  feedbackType: 'confirmed_correct' | 'flagged_incorrect' | 'field_corrected',
  fieldUpdates?: Record<string, string>
): Promise<void> {
  const updateData: Record<string, unknown> = {}

  if (feedbackType === 'confirmed_correct') {
    updateData.verifiedByUser = true
    updateData.needsAttention = false
    // If claim was in MANUAL_REVIEW, move to PROCESSING (user confirmed it's ok)
    updateData.status = 'COMPLETED'
    updateData.processedAt = new Date()
  }

  if (feedbackType === 'flagged_incorrect') {
    updateData.needsAttention = true
    updateData.verifiedByUser = false
    updateData.status = 'MANUAL_REVIEW'
  }

  if (feedbackType === 'field_corrected') {
    // Apply the field corrections
    if (fieldUpdates) {
      const fieldMap: Record<string, string> = {
        clientName: 'clientName',
        claimType: 'claimType',
        contactNumber: 'contactNumber',
        contactEmail: 'contactEmail',
        incidentDescription: 'incidentDescription',
        excessAmount: 'excessAmount',
        specialInstructions: 'specialInstructions',
        vehicleMake: 'vehicleMake',
        vehicleModel: 'vehicleModel',
        vehicleYear: 'vehicleYear',
        vehicleRegistration: 'vehicleRegistration',
      }
      for (const [key, value] of Object.entries(fieldUpdates)) {
        const dbField = fieldMap[key]
        if (dbField) updateData[dbField] = value
      }
    }
    updateData.needsAttention = true
  }

  if (Object.keys(updateData).length > 0) {
    await db.claim.update({
      where: { id: claimId },
      data: updateData,
    })
  }
}

// ─── Core: Get Learning Statistics ─────────────────────────────────────────────

/**
 * Get comprehensive learning system statistics for the dashboard.
 */
export async function getLearningStats(): Promise<LearningStats> {
  try {
    const [totalPatterns, totalFeedback, confirmedCount, flaggedCount, fieldCorrectedCount] =
      await Promise.all([
        db.learningPattern.count(),
        db.claimFeedback.count(),
        db.claimFeedback.count({ where: { feedbackType: 'confirmed_correct' } }),
        db.claimFeedback.count({ where: { feedbackType: 'flagged_incorrect' } }),
        db.claimFeedback.count({ where: { feedbackType: 'field_corrected' } }),
      ])

    // Top sender domains by pattern count
    const domainAgg = await db.learningPattern.groupBy({
      by: ['senderDomain'],
      _count: { id: true },
      _avg: { confidence: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const topSenderDomains = domainAgg.map((d) => ({
      domain: d.senderDomain,
      patternCount: d._count.id,
      avgConfidence: Math.round(d._avg.confidence || 0),
    }))

    // Top corrected fields
    const fieldAgg = await db.claimFeedback.groupBy({
      by: ['fieldName'],
      where: { fieldName: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const topCorrectedFields = fieldAgg
      .filter((f) => f.fieldName)
      .map((f) => ({
        field: (f.fieldName ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count: f._count.id,
      }))

    // Accuracy trend: compare recent vs overall average confidence
    const allClaims = await db.claim.findMany({
      select: { confidenceScore: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const avgConfidenceAll = allClaims.length > 0
      ? Math.round(allClaims.reduce((sum, c) => sum + c.confidenceScore, 0) / allClaims.length)
      : 0

    const recentClaims = allClaims.slice(0, 50)
    const avgConfidenceRecent = recentClaims.length > 0
      ? Math.round(recentClaims.reduce((sum, c) => sum + c.confidenceScore, 0) / recentClaims.length)
      : 0

    const improvement = avgConfidenceAll > 0 ? avgConfidenceRecent - avgConfidenceAll : 0

    // Learning coverage: % of unique sender domains that have patterns
    const uniqueDomains = await db.claim.groupBy({
      by: ['senderEmail'],
      where: { senderEmail: { not: null } },
    })
    const uniqueDomainSet = new Set(uniqueDomains.map((d) => extractDomain(d.senderEmail || '')))
    const domainsWithPatterns = new Set(
      (await db.learningPattern.findMany({ select: { senderDomain: true } }))
        .map((p) => p.senderDomain)
    )
    const learningCoverage = uniqueDomainSet.size > 0
      ? Math.round((domainsWithPatterns.size / uniqueDomainSet.size) * 100)
      : 0

    return {
      totalPatterns,
      totalFeedback,
      confirmedCorrect: confirmedCount,
      flaggedIncorrect: flaggedCount,
      fieldCorrected: fieldCorrectedCount,
      topSenderDomains,
      topCorrectedFields,
      accuracyTrend: {
        avgConfidenceAll,
        avgConfidenceRecent,
        improvement,
        direction: improvement > 3 ? 'improving' : improvement < -3 ? 'declining' : 'stable',
      },
      learningCoverage,
    }
  } catch (err) {
    console.error('[learning-engine] Error computing stats:', err)
    return {
      totalPatterns: 0,
      totalFeedback: 0,
      confirmedCorrect: 0,
      flaggedIncorrect: 0,
      fieldCorrected: 0,
      topSenderDomains: [],
      topCorrectedFields: [],
      accuracyTrend: { avgConfidenceAll: 0, avgConfidenceRecent: 0, improvement: 0, direction: 'stable' },
      learningCoverage: 0,
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(email: string): string {
  if (!email) return ''
  const match = email.match(/@([^@]+)$/)
  return match ? match[1].toLowerCase() : ''
}
