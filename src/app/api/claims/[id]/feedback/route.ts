import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { recordClaimFeedback, applyFeedbackToClaim } from '@/lib/learning-engine'
import { db } from '@/lib/db'
import { generateFeedbackSignal } from '@/lib/agents/feedback-agent'

/**
 * POST /api/claims/[id]/feedback
 *
 * Record user feedback on a claim's accuracy and apply corrections.
 * Generates learning signals that improve future classifications.
 *
 * Feedback types:
 * - "confirmed_correct" → Marks verified, increases pattern weights
 * - "flagged_incorrect" → Flags for review, neutral signal
 * - "field_corrected" → Saves correction, decreases pattern weights for wrong fields
 */

const feedbackSchema = z.object({
  feedbackType: z.enum(['confirmed_correct', 'flagged_incorrect', 'field_corrected']),
  fieldName: z.string().optional(),
  originalValue: z.string().optional(),
  correctedValue: z.string().optional(),
  fieldUpdates: z.record(z.string(), z.string()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = feedbackSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { feedbackType, fieldName, originalValue, correctedValue, fieldUpdates } = result.data

    // Check claim exists
    const claim = await db.claim.findUnique({
      where: { id },
      include: { insuranceCompany: { select: { id: true } } },
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Generate learning signal from feedback
    const correctedFields = fieldUpdates ? Object.keys(fieldUpdates) : (fieldName ? [fieldName] : undefined)
    const signal = generateFeedbackSignal({
      predictedClass: claim.aiClassification,
      finalClass: claim.aiClassification, // classification not changed by field correction
      feedbackType,
      correctedFields,
      originalConfidence: claim.confidenceScore,
    })

    // Record the feedback in the database with learning signal
    await recordClaimFeedback({
      claimId: id,
      feedbackType,
      fieldName,
      originalValue,
      correctedValue,
    })

    // Update the feedback record with the learning signal
    const latestFeedback = await db.claimFeedback.findFirst({
      where: { claimId: id },
      orderBy: { createdAt: 'desc' },
    })
    if (latestFeedback) {
      await db.claimFeedback.update({
        where: { id: latestFeedback.id },
        data: { learningSignal: signal.learningSignal },
      })
    }

    // Apply feedback to the claim (update status, flags, etc.)
    await applyFeedbackToClaim(id, feedbackType, fieldUpdates)

    // Create audit log entry
    let auditAction: string
    let auditDetails: string
    let auditStatus = 'SUCCESS' as string

    switch (feedbackType) {
      case 'confirmed_correct':
        auditAction = 'claim_verified'
        auditDetails = `User confirmed claim ${claim.claimNumber} is correct. Confidence: ${claim.confidenceScore}%. Learning signal: ${signal.learningSignal} (severity: ${signal.severity}).`
        break

      case 'flagged_incorrect':
        auditAction = 'claim_flagged'
        auditDetails = `User flagged claim ${claim.claimNumber}. Set to MANUAL_REVIEW. Learning signal: ${signal.learningSignal}.`
        auditStatus = 'WARNING'
        break

      case 'field_corrected':
        auditAction = 'claim_field_corrected'
        const fieldsChanged = fieldUpdates
          ? Object.keys(fieldUpdates).map((k) => `${k}: "${claim[k as keyof typeof claim] || 'empty'}" → "${fieldUpdates[k]}"`).join('; ')
          : `${fieldName}: "${originalValue}" → "${correctedValue}"`
        auditDetails = `User corrected field(s) on ${claim.claimNumber}: ${fieldsChanged}. Learning signal: ${signal.learningSignal} (severity: ${signal.severity}). Affected fields: [${signal.affectedFields.join(', ')}].`
        break
    }

    await db.auditLog.create({
      data: {
        claimId: id,
        action: auditAction,
        details: auditDetails,
        status: auditStatus,
        processedBy: 'MANUAL',
      },
    })

    // Fetch updated claim
    const updatedClaim = await db.claim.findUnique({
      where: { id },
      include: { insuranceCompany: { select: { id: true, name: true, folderName: true } } },
    })

    return NextResponse.json({
      claim: updatedClaim,
      learningSignal: signal,
      message: feedbackType === 'confirmed_correct'
        ? 'Claim verified — AI accuracy confirmed'
        : feedbackType === 'flagged_incorrect'
          ? 'Claim flagged — set to MANUAL_REVIEW'
          : `Correction saved — ${signal.learningSignal} signal recorded for ${signal.affectedFields.length} field(s)`,
      feedbackRecorded: true,
      learningUpdated: feedbackType === 'field_corrected',
    })
  } catch (error) {
    console.error('Feedback recording error:', error)
    return NextResponse.json(
      { error: 'Failed to record feedback', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/claims/[id]/feedback
 *
 * Get all feedback entries for a specific claim.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const feedback = await db.claimFeedback.findMany({
      where: { claimId: id },
      orderBy: { createdAt: 'desc' },
    })

    const summary = {
      total: feedback.length,
      confirmedCorrect: feedback.filter((f) => f.feedbackType === 'confirmed_correct').length,
      flaggedIncorrect: feedback.filter((f) => f.feedbackType === 'flagged_incorrect').length,
      fieldCorrected: feedback.filter((f) => f.feedbackType === 'field_corrected').length,
      learningSignals: {
        increaseWeight: feedback.filter((f) => f.learningSignal === 'increase_weight').length,
        decreaseWeight: feedback.filter((f) => f.learningSignal === 'decrease_weight').length,
        neutral: feedback.filter((f) => f.learningSignal === 'neutral' || !f.learningSignal).length,
      },
    }

    return NextResponse.json({ feedback, summary })
  } catch (error) {
    console.error('Feedback fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: String(error) },
      { status: 500 }
    )
  }
}
