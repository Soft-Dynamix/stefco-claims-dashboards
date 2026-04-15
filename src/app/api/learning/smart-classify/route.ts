import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { preprocessEmail } from '@/lib/agents/preprocess-agent'
import { getLearningHints, buildHintSection } from '@/lib/learning-engine'
import { classifyWithAgent } from '@/lib/agents/classification-agent'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(email: string): string {
  if (!email) return ''
  const match = email.match(/@([^@]+)$/)
  return match ? match[1].toLowerCase() : ''
}

async function getConfig(key: string): Promise<string | null> {
  const row = await db.systemConfig.findUnique({ where: { key } })
  return row?.value ?? null
}

// Auto-classify confidence threshold: auto-process if confidence >= 75%
const AUTO_CLASSIFY_THRESHOLD = 0.75

// ─── POST: Smart classify a single email ─────────────────────────────────────

const SmartClassifySchema = z.object({
  from: z.string().min(1, 'From email is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SmartClassifySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { from, subject, body: emailBody } = parsed.data

    console.error(`[smart-classify] Classifying email from ${from}: "${subject.slice(0, 60)}..."`)

    // 1. Check if auto-classify is enabled
    const autoClassifyEnabled = await getConfig('auto_classify_enabled')
    const learningReady = await getConfig('learning_ready')
    const isAutoMode = autoClassifyEnabled === 'true' && learningReady === 'true'

    // 2. Run preprocess agent on the email
    const preprocessed = preprocessEmail({ subject, body: emailBody, from })

    console.error(`[smart-classify] Preprocessed: claimNum=${preprocessed.possibleClaimNumber}, names=${preprocessed.personNames.length}, keywords=${preprocessed.keywords.length}, followUpSignals=${[preprocessed.followUpSignals.isReply, preprocessed.followUpSignals.isForward, preprocessed.followUpSignals.hasFollowUpPhrases, preprocessed.followUpSignals.hasStatusQuery, preprocessed.followUpSignals.hasExistingClaimRef].filter(Boolean).length}/5`)

    // 3. Fetch learning hints for the sender domain
    const senderDomain = extractDomain(from)
    let learningHints: Awaited<ReturnType<typeof getLearningHints>> = []

    if (senderDomain) {
      learningHints = await getLearningHints(senderDomain)
    }

    const learningHintsApplied = learningHints.length

    // 4. Build hint section string if hints exist
    const hintSection = learningHints.length > 0
      ? buildHintSection(learningHints)
      : undefined

    // 5. Use classification agent with learning hints injected
    const classificationResult = await classifyWithAgent({
      subject,
      body: emailBody,
      from,
      preprocessed: {
        possibleClaimNumber: preprocessed.possibleClaimNumber,
        personNames: preprocessed.personNames,
        dates: preprocessed.dates,
        keywords: preprocessed.keywords,
        followUpSignals: preprocessed.followUpSignals,
      },
      learningHints: hintSection,
    })

    const confidencePercent = Math.round(classificationResult.confidence * 100)

    // 6. Determine auto-processing and review requirements
    const autoProcessed = isAutoMode && classificationResult.confidence >= AUTO_CLASSIFY_THRESHOLD
    const requiresReview = !autoProcessed // Requires review if auto-classify off OR confidence too low

    console.error(`[smart-classify] Result: ${classificationResult.predictedClass} (${confidencePercent}%), autoMode=${isAutoMode}, autoProcessed=${autoProcessed}, hintsApplied=${learningHintsApplied}`)

    // 7. Audit log
    await db.auditLog.create({
      data: {
        action: 'smart_classify',
        details: `Email from ${from} classified as ${classificationResult.predictedClass} with ${confidencePercent}% confidence. Auto-processed: ${autoProcessed}. Learning hints applied: ${learningHintsApplied}.`,
        status: autoProcessed ? 'SUCCESS' : 'WARNING',
        processedBy: 'AUTO',
      },
    })

    return NextResponse.json({
      classification: classificationResult.predictedClass,
      confidence: confidencePercent,
      reasoning: classificationResult.reasoning,
      alternatives: classificationResult.alternatives.map(a => ({
        class: a.class,
        score: Math.round(a.score * 100),
      })),
      learningHintsApplied,
      autoProcessed,
      requiresReview,
      preprocessed: {
        possibleClaimNumber: preprocessed.possibleClaimNumber,
        personNames: preprocessed.personNames,
        keywords: preprocessed.keywords,
        followUpSignals: {
          isReply: preprocessed.followUpSignals.isReply,
          isForward: preprocessed.followUpSignals.isForward,
          hasFollowUpPhrases: preprocessed.followUpSignals.hasFollowUpPhrases,
          hasStatusQuery: preprocessed.followUpSignals.hasStatusQuery,
          hasExistingClaimRef: preprocessed.followUpSignals.hasExistingClaimRef,
          phrases: preprocessed.followUpSignals.phrases,
        },
      },
      senderDomain: senderDomain || null,
      autoClassifyEnabled: isAutoMode,
      threshold: AUTO_CLASSIFY_THRESHOLD,
    })
  } catch (error) {
    console.error('[smart-classify] Classification error:', error)

    // Audit log for failure
    try {
      await db.auditLog.create({
        data: {
          action: 'smart_classify',
          details: `Smart classification failed: ${String(error)}`,
          status: 'ERROR',
          processedBy: 'AUTO',
        },
      })
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json(
      { error: 'Smart classification failed', details: String(error) },
      { status: 500 }
    )
  }
}
