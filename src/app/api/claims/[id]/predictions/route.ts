import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/claims/[id]/predictions
 *
 * Get the full prediction record for a claim, including:
 * - Predicted class with confidence
 * - Alternative classifications with scores
 * - AI reasoning
 * - Decision engine result
 * - Extracted entities (signals)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get prediction
    const prediction = await db.prediction.findFirst({
      where: { claimId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Get extracted entities
    const entities = await db.extractedEntity.findFirst({
      where: { claimId: id },
    })

    // Get feedback history
    const feedback = await db.claimFeedback.findMany({
      where: { claimId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      prediction: prediction ? {
        id: prediction.id,
        predictedClass: prediction.predictedClass,
        confidence: prediction.confidence,
        alternatives: safeJsonParse(prediction.alternatives),
        reasoning: prediction.reasoning,
        decision: prediction.decision,
        decisionReasoning: prediction.decisionReasoning,
        learningHintsCount: prediction.learningHintsCount,
        createdAt: prediction.createdAt,
      } : null,
      entities: entities ? {
        id: entities.id,
        possibleClaimNumber: entities.possibleClaimNumber,
        personNames: safeJsonParse(entities.personNames),
        dates: safeJsonParse(entities.dates),
        keywords: safeJsonParse(entities.keywords),
        cleanedBody: entities.cleanedBody,
        createdAt: entities.createdAt,
      } : null,
      feedback: feedback.map(f => ({
        id: f.id,
        feedbackType: f.feedbackType,
        fieldName: f.fieldName,
        originalValue: f.originalValue,
        correctedValue: f.correctedValue,
        learningSignal: f.learningSignal,
        createdAt: f.createdAt,
      })),
    })
  } catch (error) {
    console.error('Prediction fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prediction data', details: String(error) },
      { status: 500 }
    )
  }
}

function safeJsonParse(str: string | null): unknown {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
