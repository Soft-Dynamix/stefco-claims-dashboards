/**
 * Knowledge Base Seed Route
 *
 * POST /api/knowledge-base/seed
 *
 * One-time backfill: reads all existing claims with AI classifications
 * and populates the ClassificationKnowledge and SenderPattern tables.
 * Skips entries whose emailHash already exists (dedup).
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { updateSenderPattern } from '@/lib/knowledge-base-service'

// ─── POST: Backfill knowledge base from existing claims ────────────────────

export async function POST() {
  console.log('[kb-seed] Starting knowledge base backfill from existing claims...')

  // Collect existing hashes up-front for fast dedup
  let existingHashes: Set<string>
  try {
    const allKnowledge = await db.classificationKnowledge.findMany({
      select: { emailHash: true },
    })
    existingHashes = new Set(allKnowledge.map((k) => k.emailHash))
    console.log(`[kb-seed] Found ${existingHashes.size} existing knowledge entries to skip`)
  } catch (err) {
    console.error('[kb-seed] Failed to load existing hashes:', err)
    return NextResponse.json(
      { error: 'Failed to read existing knowledge entries', details: String(err) },
      { status: 500 },
    )
  }

  // Fetch all claims (limit 200) with optional feedback for corrections
  let claims: Array<{
    id: string
    senderEmail: string | null
    emailSubject: string | null
    incidentDescription: string | null
    aiClassification: string | null
    aiClassificationConfidence: number
    confidenceScore: number
    aiReasoning: string | null
    verifiedByUser: boolean
    reviewAction: string | null
    feedback: Array<{ correctedValue: string | null }>
  }>

  try {
    claims = await db.claim.findMany({
      take: 200,
      where: {
        aiClassification: { not: null },
        emailSubject: { not: null },
      },
      include: {
        feedback: {
          select: { correctedValue: true },
        },
      },
    })
    console.log(`[kb-seed] Found ${claims.length} claims with classification + subject`)
  } catch (err) {
    console.error('[kb-seed] Failed to load claims:', err)
    return NextResponse.json(
      { error: 'Failed to read claims', details: String(err) },
      { status: 500 },
    )
  }

  // Process each claim
  const summary = {
    totalProcessed: 0,
    newEntries: 0,
    updatedEntries: 0,
    skipped: 0,
    errors: 0,
  }

  for (const claim of claims) {
    summary.totalProcessed += 1

    try {
      const subject = claim.emailSubject || ''
      if (!subject.trim()) {
        summary.skipped += 1
        continue
      }

      // Generate SHA-256 hash of the subject
      const emailHash = createHash('sha256').update(subject).digest('hex')

      // Dedup check
      if (existingHashes.has(emailHash)) {
        summary.skipped += 1
        continue
      }

      // Extract sender domain
      const senderEmail = claim.senderEmail || ''
      const atIdx = senderEmail.indexOf('@')
      const senderDomain = atIdx >= 0 ? senderEmail.slice(atIdx + 1).toLowerCase() : 'unknown.com'

      // Mask email: first 2 chars of local part + ***@domain
      let maskedEmail: string | null = null
      if (senderEmail && atIdx >= 0) {
        const localPart = senderEmail.slice(0, atIdx)
        const domain = senderEmail.slice(atIdx)
        const prefix = localPart.length >= 2 ? localPart.slice(0, 2) : localPart
        maskedEmail = `${prefix}***${domain}`
      }

      // Determine corrected classification from feedback
      let correctedClassification: string | null = null
      if (claim.reviewAction === 'corrected' && claim.feedback.length > 0) {
        const feedbackWithCorrection = claim.feedback.find(
          (f) => f.correctedValue !== null && f.correctedValue !== undefined,
        )
        if (feedbackWithCorrection?.correctedValue) {
          correctedClassification = feedbackWithCorrection.correctedValue
        }
      }

      // Determine source
      const source: 'auto' | 'corrected' = claim.verifiedByUser ? 'corrected' : 'auto'

      // Determine confidence
      const confidence = claim.aiClassificationConfidence || claim.confidenceScore || 0

      // Body snippet
      const bodySnippet = claim.incidentDescription?.slice(0, 500) || null

      // Determine isCorrected
      const isCorrected = !!correctedClassification

      // Create the ClassificationKnowledge entry
      await db.classificationKnowledge.create({
        data: {
          claimId: claim.id,
          senderDomain,
          senderEmail: maskedEmail,
          subject,
          emailHash,
          bodySnippet,
          originalClassification: claim.aiClassification!,
          correctedClassification,
          confidence,
          reasoning: claim.aiReasoning || null,
          isCorrected,
          source,
          isActive: true,
          referenceCount: 0,
        },
      })

      // Track this hash so duplicates within the batch are also skipped
      existingHashes.add(emailHash)
      summary.newEntries += 1

      // Update sender pattern
      try {
        await updateSenderPattern(senderDomain, claim.aiClassification!, isCorrected)
      } catch (spErr) {
        console.error(`[kb-seed] SenderPattern update failed for ${senderDomain}:`, spErr)
        // Non-fatal: knowledge entry was still created
      }
    } catch (err) {
      summary.errors += 1
      console.error(`[kb-seed] Error processing claim ${claim.id}:`, err)
    }
  }

  console.log(`[kb-seed] Backfill complete:`, summary)

  return NextResponse.json({
    success: true,
    message: 'Knowledge base backfill complete',
    ...summary,
  })
}
