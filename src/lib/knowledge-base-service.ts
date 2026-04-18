/**
 * Knowledge Base Service
 *
 * Manages the ClassificationKnowledge and SenderPattern models.
 * Provides functions to:
 * - Save classifications and update sender patterns
 * - Record user corrections
 * - Build knowledge context for AI prompt injection (few-shot examples)
 * - Query relevant historical examples by sender domain
 */

import { db } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SaveClassificationParams {
  claimId?: string
  senderDomain: string
  senderEmail?: string
  subject: string
  emailHash: string
  bodySnippet?: string
  originalClassification: string
  correctedClassification?: string
  confidence?: number
  reasoning?: string
  keywords?: string[]
  followUpSignals?: Record<string, unknown>
  source?: 'auto' | 'corrected' | 'manual'
  isActive?: boolean
}

// ─── Core Functions ────────────────────────────────────────────────────────

/**
 * Save a new classification to the knowledge base.
 * Upserts by emailHash: if the hash already exists, update originalClassification and increment referenceCount.
 * Also updates the SenderPattern for this senderDomain.
 */
export async function saveClassification(params: SaveClassificationParams): Promise<{
  knowledgeId: string
  isNew: boolean
  senderPatternUpdated: boolean
}> {
  const {
    claimId,
    senderDomain,
    senderEmail,
    subject,
    emailHash,
    bodySnippet,
    originalClassification,
    correctedClassification,
    confidence,
    reasoning,
    keywords,
    followUpSignals,
    source = 'auto',
    isActive = true,
  } = params

  // Upsert knowledge entry by emailHash
  const existing = await db.classificationKnowledge.findUnique({
    where: { emailHash },
  })

  let knowledgeId: string
  let isNew: boolean

  if (existing) {
    // Update existing entry: bump referenceCount and update classification if changed
    const updateData: Record<string, unknown> = {
      originalClassification,
      referenceCount: { increment: 1 },
      updatedAt: new Date(),
    }
    if (confidence !== undefined) updateData.confidence = confidence
    if (reasoning) updateData.reasoning = reasoning
    if (keywords) updateData.keywords = JSON.stringify(keywords)
    if (followUpSignals) updateData.followUpSignals = JSON.stringify(followUpSignals)

    await db.classificationKnowledge.update({
      where: { emailHash },
      data: updateData as Parameters<typeof db.classificationKnowledge.update>[0]['data'],
    })
    knowledgeId = existing.id
    isNew = false
  } else {
    // Create new knowledge entry
    const entry = await db.classificationKnowledge.create({
      data: {
        claimId: claimId || null,
        senderDomain,
        senderEmail: senderEmail ? maskEmail(senderEmail) : null,
        subject,
        emailHash,
        bodySnippet: bodySnippet ? bodySnippet.slice(0, 500) : null,
        originalClassification,
        correctedClassification: correctedClassification || null,
        confidence: confidence || 0,
        reasoning: reasoning || null,
        keywords: keywords && keywords.length > 0 ? JSON.stringify(keywords) : null,
        followUpSignals: followUpSignals ? JSON.stringify(followUpSignals) : null,
        source,
        isActive,
        referenceCount: 0,
      },
    })
    knowledgeId = entry.id
    isNew = true
  }

  // Update sender pattern
  const senderPatternUpdated = await updateSenderPattern(
    senderDomain,
    originalClassification,
    !!correctedClassification,
  )

  return { knowledgeId, isNew, senderPatternUpdated }
}

/**
 * Record a user correction for an existing knowledge base entry.
 * Sets isCorrected=true, updates correctedClassification, source='corrected',
 * and increments SenderPattern correctedCount.
 */
export async function recordCorrection(
  knowledgeId: string,
  correctedClassification: string,
): Promise<void> {
  // Get the existing entry to know the sender domain
  const entry = await db.classificationKnowledge.findUnique({
    where: { id: knowledgeId },
  })

  if (!entry) {
    console.error(`[knowledge-base] recordCorrection: entry ${knowledgeId} not found`)
    return
  }

  // Update the knowledge entry
  await db.classificationKnowledge.update({
    where: { id: knowledgeId },
    data: {
      correctedClassification,
      isCorrected: true,
      source: 'corrected',
      updatedAt: new Date(),
    },
  })

  // Update sender pattern corrected count
  await db.senderPattern.updateMany({
    where: { senderDomain: entry.senderDomain },
    data: {
      correctedCount: { increment: 1 },
      updatedAt: new Date(),
    },
  })

  console.error(`[knowledge-base] Correction recorded for ${knowledgeId}: ${entry.originalClassification} → ${correctedClassification}`)
}

/**
 * Update or create a SenderPattern record for a given sender domain.
 * Increments the appropriate classification counter and recalculates accuracy.
 */
export async function updateSenderPattern(
  senderDomain: string,
  classification: string,
  isCorrected: boolean,
): Promise<boolean> {
  try {
    // Map classification to the counter field
    const counterField = mapClassificationToField(classification)

    const existing = await db.senderPattern.findUnique({
      where: { senderDomain },
    })

    if (existing) {
      // Update existing pattern
      const updateData: Record<string, unknown> = {
        totalEmails: { increment: 1 },
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }

      // Increment the appropriate classification counter
      if (counterField) {
        updateData[counterField] = { increment: 1 }
      }

      // If corrected, increment correctedCount
      if (isCorrected) {
        updateData.correctedCount = { increment: 1 }
      }

      await db.senderPattern.update({
        where: { senderDomain },
        data: updateData as Parameters<typeof db.senderPattern.update>[0]['data'],
      })

      // Recalculate accuracy
      await recalculateSenderAccuracy(senderDomain)
    } else {
      // Create new sender pattern
      const data: Record<string, unknown> = {
        senderDomain,
        totalEmails: 1,
        lastSeenAt: new Date(),
      }
      if (counterField) {
        data[counterField] = 1
      }
      if (isCorrected) {
        data.correctedCount = 1
      }

      await db.senderPattern.create({
        data: data as Parameters<typeof db.senderPattern.create>[0]['data'],
      })
    }

    return true
  } catch (err) {
    console.error('[knowledge-base] updateSenderPattern error:', err)
    return false
  }
}

/**
 * Get relevant examples for a sender domain to use as few-shot learning.
 * Prioritizes corrected entries (most valuable), then auto entries with high confidence.
 * Returns max 5 examples.
 */
export async function getRelevantExamples(
  senderDomain: string,
  limit: number = 5,
): Promise<Array<{
  id: string
  subject: string
  bodySnippet: string | null
  originalClassification: string
  correctedClassification: string | null
  confidence: number
  reasoning: string | null
  isCorrected: boolean
  source: string
}>> {
  try {
    // Get corrected entries first (highest priority)
    const corrected = await db.classificationKnowledge.findMany({
      where: {
        senderDomain,
        isActive: true,
        isCorrected: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        subject: true,
        bodySnippet: true,
        originalClassification: true,
        correctedClassification: true,
        confidence: true,
        reasoning: true,
        isCorrected: true,
        source: true,
      },
    })

    // Fill remaining slots with high-confidence auto entries
    const remaining = limit - corrected.length
    if (remaining > 0) {
      const auto = await db.classificationKnowledge.findMany({
        where: {
          senderDomain,
          isActive: true,
          isCorrected: false,
          confidence: { gte: 60 },
        },
        orderBy: { confidence: 'desc' },
        take: remaining,
        select: {
          id: true,
          subject: true,
          bodySnippet: true,
          originalClassification: true,
          correctedClassification: true,
          confidence: true,
          reasoning: true,
          isCorrected: true,
          source: true,
        },
      })

      return [...corrected, ...auto]
    }

    return corrected
  } catch (err) {
    console.error('[knowledge-base] getRelevantExamples error:', err)
    return []
  }
}

/**
 * Format examples as few-shot text for AI prompt injection.
 * Produces a concise, structured text block that the AI can use as reference.
 */
export function formatExamplesAsFewShot(
  examples: Array<{
    subject: string
    bodySnippet: string | null
    originalClassification: string
    correctedClassification: string | null
    confidence: number
    reasoning: string | null
    isCorrected: boolean
  }>,
): string {
  if (examples.length === 0) return ''

  const lines: string[] = [
    'Below are historical classification examples from emails sent by the same sender domain.',
    'Use these as reference for your classification decision.',
    '',
  ]

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]
    const label = ex.isCorrected
      ? `CORRECTED: ${ex.originalClassification} → ${ex.correctedClassification}`
      : `Classified as: ${ex.originalClassification}`

    lines.push(`Example ${i + 1} [${label}] (Confidence: ${ex.confidence}%):`)
    lines.push(`  Subject: ${ex.subject.slice(0, 120)}`)
    if (ex.bodySnippet) {
      lines.push(`  Body snippet: ${ex.bodySnippet.slice(0, 200)}`)
    }
    if (ex.reasoning) {
      lines.push(`  Reasoning: ${ex.reasoning.slice(0, 150)}`)
    }
    lines.push('')
  }

  if (examples.some((e) => e.isCorrected)) {
    lines.push('IMPORTANT: Corrected examples indicate the AI was WRONG previously. Pay close attention to these corrections to avoid repeating the same mistake.')
  }

  return lines.join('\n')
}

/**
 * Get classification stats for a sender domain.
 */
export async function getSenderStats(senderDomain: string): Promise<{
  totalEmails: number
  byClassification: Record<string, number>
  correctedCount: number
  accuracyRate: number
  avgConfidence: number
} | null> {
  try {
    const pattern = await db.senderPattern.findUnique({
      where: { senderDomain },
    })

    if (!pattern) return null

    return {
      totalEmails: pattern.totalEmails,
      byClassification: {
        NEW_CLAIM: pattern.newClaimCount,
        MISSING_INFO: pattern.followUpCount,
        IGNORE: pattern.ignoreCount,
        OTHER: pattern.otherCount,
      },
      correctedCount: pattern.correctedCount,
      accuracyRate: pattern.accuracyRate,
      avgConfidence: pattern.avgConfidence,
    }
  } catch (err) {
    console.error('[knowledge-base] getSenderStats error:', err)
    return null
  }
}

/**
 * Build the full knowledge context string to inject into AI prompts.
 * Combines sender pattern stats + few-shot examples into a single text block.
 * Returns empty string if no knowledge exists for this sender.
 */
export async function buildKnowledgeContext(senderDomain: string): Promise<string> {
  try {
    const sections: string[] = []

    // Section 1: Sender pattern stats
    const pattern = await db.senderPattern.findUnique({
      where: { senderDomain },
    })

    if (pattern && pattern.totalEmails > 0) {
      const statsLines: string[] = [
        `Sender domain "${senderDomain}" statistics:`,
        `  - Total emails processed: ${pattern.totalEmails}`,
        `  - New claims: ${pattern.newClaimCount}`,
        `  - Follow-ups/Missing info: ${pattern.followUpCount}`,
        `  - Ignored: ${pattern.ignoreCount}`,
        `  - Other: ${pattern.otherCount}`,
        `  - Times AI was corrected: ${pattern.correctedCount}`,
        `  - AI accuracy rate: ${pattern.accuracyRate.toFixed(1)}%`,
        `  - Average confidence: ${pattern.avgConfidence.toFixed(1)}%`,
      ]

      if (pattern.correctedCount > 0) {
        const correctionRate = pattern.totalEmails > 0
          ? ((pattern.correctedCount / pattern.totalEmails) * 100).toFixed(1)
          : '0'
        statsLines.push(`  - Correction rate: ${correctionRate}% — BE EXTRA CAREFUL with this sender`)
      }

      sections.push(statsLines.join('\n'))
    }

    // Section 2: Few-shot examples
    const examples = await getRelevantExamples(senderDomain, 5)
    if (examples.length > 0) {
      sections.push(formatExamplesAsFewShot(examples))
    }

    if (sections.length === 0) return ''

    return sections.join('\n\n')
  } catch (err) {
    console.error('[knowledge-base] buildKnowledgeContext error:', err)
    return ''
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Map a classification string to the corresponding SenderPattern counter field.
 */
function mapClassificationToField(classification: string): string | null {
  const mapping: Record<string, string> = {
    'NEW_CLAIM': 'newClaimCount',
    'MISSING_INFO': 'followUpCount',
    'IGNORE': 'ignoreCount',
    'OTHER': 'otherCount',
  }
  return mapping[classification] || null
}

/**
 * Mask an email address for privacy (keep first 2 chars + domain).
 */
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@')
  if (atIdx < 0) return '***'
  const local = email.slice(0, atIdx)
  const domain = email.slice(atIdx)
  if (local.length <= 2) return `${local}***${domain}`
  return `${local.slice(0, 2)}***${domain}`
}

/**
 * Recalculate accuracy rate and average confidence for a sender pattern.
 */
async function recalculateSenderAccuracy(senderDomain: string): Promise<void> {
  try {
    const entries = await db.classificationKnowledge.findMany({
      where: { senderDomain, isActive: true },
      select: { isCorrected: true, confidence: true },
    })

    if (entries.length === 0) return

    const correctedCount = entries.filter((e) => e.isCorrected).length
    const accuracyRate = entries.length > 0
      ? ((entries.length - correctedCount) / entries.length) * 100
      : 0

    const avgConfidence = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
      : 0

    await db.senderPattern.update({
      where: { senderDomain },
      data: {
        accuracyRate: Math.round(accuracyRate * 10) / 10,
        avgConfidence: Math.round(avgConfidence * 10) / 10,
      },
    })
  } catch (err) {
    console.error('[knowledge-base] recalculateSenderAccuracy error:', err)
  }
}
