import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

/**
 * POST /api/review/feedback
 *
 * Unified review feedback endpoint for the Daily Email Review Sheet.
 * Maps review actions to the underlying claim feedback system.
 *
 * Actions:
 * - "accepted" → Confirms the claim data is correct
 * - "corrected" → User corrected one or more fields
 * - "flagged_for_review" → Flag for manual follow-up
 * - "skipped" → Skip this item, no action taken
 */
const reviewFeedbackSchema = z.object({
  claimId: z.string().min(1),
  action: z.enum(['accepted', 'corrected', 'flagged_for_review', 'skipped']),
  corrections: z.array(z.object({
    field: z.string(),
    originalValue: z.string(),
    correctedValue: z.string(),
  })).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = reviewFeedbackSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { claimId, action, corrections } = result.data

    // Check claim exists
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      include: { insuranceCompany: { select: { id: true } } },
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    let auditAction: string
    let auditDetails: string
    let auditStatus = 'SUCCESS' as const
    let learningPatternsCreated = 0

    const updateData: Record<string, unknown> = {
      reviewedAt: new Date(),
    }

    switch (action) {
      case 'accepted':
        auditAction = 'review_accepted'
        auditDetails = `User accepted claim ${claim.claimNumber} in daily review. AI confidence: ${claim.confidenceScore}%.`
        updateData.verifiedByUser = true
        updateData.needsAttention = false
        updateData.reviewAction = 'accepted'

        // Create feedback record
        await db.claimFeedback.create({
          data: {
            claimId,
            feedbackType: 'confirmed_correct',
            aiConfidence: claim.confidenceScore,
            processingStage: claim.processingStage,
          },
        })
        break

      case 'corrected':
        auditAction = 'review_corrected'
        updateData.needsAttention = true
        updateData.reviewAction = 'corrected'

        // Apply field corrections to the claim
        if (corrections && corrections.length > 0) {
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
            propertyAddress: 'propertyAddress',
          }

          const correctionsDescription: string[] = []

          for (const correction of corrections) {
            const dbField = fieldMap[correction.field]
            if (dbField) {
              updateData[dbField] = correction.correctedValue
            }

            // Create a learning pattern for each correction
            const senderDomain = claim.senderEmail
              ? claim.senderEmail.split('@').pop()?.toLowerCase() || ''
              : ''

            if (senderDomain) {
              const patternHint = buildPatternHint(correction.field, correction.originalValue, correction.correctedValue)

              // Check for existing pattern
              const existing = await db.learningPattern.findFirst({
                where: {
                  senderDomain,
                  fieldName: correction.field,
                  ...(claim.insuranceCompanyId ? { insuranceCompanyId: claim.insuranceCompanyId } : {}),
                },
              })

              if (existing) {
                const newCount = existing.correctionCount + 1
                const newConfidence = Math.min(95, 50 + Math.floor(newCount * 8))
                await db.learningPattern.update({
                  where: { id: existing.id },
                  data: {
                    patternHint,
                    exampleOriginal: correction.originalValue,
                    exampleCorrected: correction.correctedValue,
                    correctionCount: newCount,
                    confidence: newConfidence,
                    lastAppliedAt: new Date(),
                  },
                })
              } else {
                await db.learningPattern.create({
                  data: {
                    senderDomain,
                    insuranceCompanyId: claim.insuranceCompanyId,
                    fieldName: correction.field,
                    patternHint,
                    exampleOriginal: correction.originalValue,
                    exampleCorrected: correction.correctedValue,
                    correctionCount: 1,
                    confidence: 55,
                    lastAppliedAt: new Date(),
                  },
                })
                learningPatternsCreated++
              }
            }

            correctionsDescription.push(
              `${correction.field}: "${correction.originalValue}" → "${correction.correctedValue}"`
            )
          }

          auditDetails = `User corrected ${corrections.length} field(s) on ${claim.claimNumber}: ${correctionsDescription.join('; ')}. ${learningPatternsCreated} learning pattern(s) created.`
        } else {
          auditDetails = `User marked ${claim.claimNumber} as corrected in daily review (no specific fields).`
        }

        // Create feedback records for each correction
        if (corrections) {
          for (const correction of corrections) {
            await db.claimFeedback.create({
              data: {
                claimId,
                feedbackType: 'field_corrected',
                fieldName: correction.field,
                originalValue: correction.originalValue,
                correctedValue: correction.correctedValue,
                aiConfidence: claim.confidenceScore,
                processingStage: claim.processingStage,
              },
            })
          }
        }
        break

      case 'flagged_for_review':
        auditAction = 'review_flagged'
        auditDetails = `User flagged claim ${claim.claimNumber} for follow-up review. Set to MANUAL_REVIEW.`
        auditStatus = 'WARNING'
        updateData.needsAttention = true
        updateData.verifiedByUser = false
        updateData.reviewAction = 'flagged_for_review'
        updateData.status = 'MANUAL_REVIEW'

        await db.claimFeedback.create({
          data: {
            claimId,
            feedbackType: 'flagged_incorrect',
            aiConfidence: claim.confidenceScore,
            processingStage: claim.processingStage,
          },
        })
        break

      case 'skipped':
        auditAction = 'review_skipped'
        auditDetails = `User skipped claim ${claim.claimNumber} in daily review.`
        updateData.reviewAction = 'skipped'
        // No feedback record for skipped — just mark as reviewed
        break
    }

    // Update the claim
    await db.claim.update({
      where: { id: claimId },
      data: updateData,
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        claimId,
        action: auditAction,
        details: auditDetails,
        status: auditStatus,
        processedBy: 'MANUAL',
      },
    })

    // Fetch updated claim for response
    const updatedClaim = await db.claim.findUnique({
      where: { id: claimId },
      include: { insuranceCompany: { select: { id: true, name: true, folderName: true } } },
    })

    return NextResponse.json({
      claim: updatedClaim,
      action,
      learningPatternsCreated,
      message: getActionMessage(action, claim.claimNumber, learningPatternsCreated),
    })
  } catch (error) {
    console.error('Review feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to submit review feedback', details: String(error) },
      { status: 500 }
    )
  }
}

function getActionMessage(action: string, claimNumber: string, patternsCreated: number): string {
  switch (action) {
    case 'accepted':
      return `Claim ${claimNumber} accepted`
    case 'corrected':
      return `Corrections saved on ${claimNumber}. ${patternsCreated} learning pattern(s) created.`
    case 'flagged_for_review':
      return `Claim ${claimNumber} flagged for review`
    case 'skipped':
      return `Claim ${claimNumber} skipped`
    default:
      return `Action recorded for ${claimNumber}`
  }
}

function buildPatternHint(fieldName: string, originalValue: string, correctedValue: string): string {
  const fieldLabels: Record<string, string> = {
    clientName: 'Client name',
    claimNumber: 'Claim number',
    claimType: 'Claim type',
    contactNumber: 'Contact number',
    contactEmail: 'Contact email',
    incidentDescription: 'Incident description',
    excessAmount: 'Excess amount',
    vehicleMake: 'Vehicle make',
    vehicleModel: 'Vehicle model',
    vehicleYear: 'Vehicle year',
    vehicleRegistration: 'Vehicle registration',
    propertyAddress: 'Property address',
  }

  const label = fieldLabels[fieldName] || fieldName.replace(/_/g, ' ')
  return `For this sender, the ${label} was corrected from "${originalValue}" to "${correctedValue}"`
}
