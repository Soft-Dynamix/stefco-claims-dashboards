import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { extractClaimData } from '@/lib/ai-helpers'
import { generateFolderPath, extractEmailDomain, matchesDomain, sanitizeClientName } from '@/lib/folder-utils'
import { createClaimFolder, saveEmailMetadata } from '@/lib/fs-helpers'
import { sendClaimAcknowledgment, isAutoReplyEnabled } from '@/lib/smtp'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { getLocalPath } from '@/lib/fs-helpers'
import { getLearningHints, buildHintSection } from '@/lib/learning-engine'

// Multi-Agent imports
import { processIntake } from '@/lib/agents/intake-agent'
import { preprocessEmail } from '@/lib/agents/preprocess-agent'
import { classifyWithAgent } from '@/lib/agents/classification-agent'
import { makeDecision } from '@/lib/agents/decision-engine'

/**
 * POST /api/process-email
 *
 * Multi-Agent Claims Pipeline v3:
 *
 * 1. Email Intake Agent → structured JSON
 * 2. Preprocessing Agent → extracted signals (claim numbers, names, dates, keywords)
 * 3. Learning Engine → fetch past correction patterns
 * 4. Classification Agent → predict class + alternatives + reasoning
 * 5. Decision Engine → route: auto_classify / needs_review / manual_review
 * 6. AI Data Extraction → claim fields (with learning hints)
 * 7. Duplicate Detection → pause for duplicates only
 * 8. Folder Path Generation → filesystem
 * 9. Document Handling → save metadata + attachments
 * 10. Print Queue → create print items
 * 11. Audit Logging → full audit trail
 * 12. Auto-Reply → SMTP acknowledgment
 * 13. Store Prediction → full AI prediction record
 * 14. Store Extracted Entities → preprocessed signals
 *
 * Decision Routing:
 * - auto_classify (>85%): Full pipeline, no flags
 * - needs_review (60-85%): Full pipeline, flagged for review
 * - manual_review (<60%): Pipeline pauses at EXTRACTED, requires human
 */

const processEmailSchema = z.object({
  from: z.string().min(1, 'Sender email is required'),
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string().optional(),
        size: z.number().optional(),
        content: z.string().optional(), // base64-encoded attachment binary content
      })
    )
    .optional()
    .default([]),
})

/** Get the confidence threshold from DB config, falling back to 70 */
async function getConfidenceThreshold(): Promise<number> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: 'confidence_threshold' },
    })
    if (config && config.value) {
      const parsed = parseInt(config.value, 10)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed
    }
  } catch {
    // Ignore DB errors, use default
  }
  return 70
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = processEmailSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { from, subject, body: emailBody, attachments } = result.data

    // Read configurable threshold from DB
    const confidenceThreshold = await getConfidenceThreshold()

    // Track the furthest stage reached
    let currentStage = 'RECEIVED' as string
    let stageLog: string[] = []
    let learningHintsApplied: string[] = []

    // ==========================================
    // AGENT 1: Email Intake
    // ==========================================
    const intake = processIntake({ from, subject, body: emailBody, attachments })
    console.error(`[pipeline] Agent 1 (Intake): ${intake.senderEmail}, "${intake.subject}", ${intake.hasAttachments ? 'has attachments' : 'no attachments'}`)

    // ==========================================
    // AGENT 2: Preprocessing
    // ==========================================
    const preprocessed = preprocessEmail({
      subject: intake.subject,
      body: intake.body,
      from: intake.senderEmail,
    })
    console.error(`[pipeline] Agent 2 (Preprocess): claim#=${preprocessed.possibleClaimNumber || 'none'}, names=[${preprocessed.personNames.length}], keywords=[${preprocessed.keywords.length}]`)

    // ==========================================
    // LEARNING: Fetch past correction patterns
    // ==========================================
    const senderDomain = extractEmailDomain(intake.senderEmail)

    // Pre-fetch insurance company for context
    const activeCompanies = await db.insuranceCompany.findMany({
      where: { isActive: true },
    })
    let matchedCompany: { id: string; name: string; folderName: string } | null = null
    let matchedCompanyId: string | null = null

    for (const company of activeCompanies) {
      try {
        const domains: string[] = JSON.parse(company.senderDomains)
        if (matchesDomain(senderDomain, domains)) {
          matchedCompany = { id: company.id, name: company.name, folderName: company.folderName }
          matchedCompanyId = company.id
          break
        }
      } catch {
        continue
      }
    }

    // Fetch learning hints for this sender domain
    const hints = await getLearningHints(senderDomain, matchedCompanyId || undefined)
    let learningHintsStr = ''
    if (hints.length > 0) {
      learningHintsStr = buildHintSection(hints)
      learningHintsApplied = hints.map((h) => `${h.fieldName} (${h.confidence}%)`)
      console.error(`[pipeline] Learning: Applied ${hints.length} hints for ${senderDomain}`)
    }

    // ==========================================
    // AGENT 3: Classification (with alternatives + reasoning)
    // ==========================================
    const classification = await classifyWithAgent({
      subject: intake.subject,
      body: intake.body,
      from: intake.senderEmail,
      preprocessed: {
        possibleClaimNumber: preprocessed.possibleClaimNumber,
        personNames: preprocessed.personNames,
        dates: preprocessed.dates,
        keywords: preprocessed.keywords,
      },
      learningHints: learningHintsStr || undefined,
    })
    currentStage = 'CLASSIFIED'
    stageLog.push('CLASSIFIED')

    console.error(`[pipeline] Agent 3 (Classification): ${classification.predictedClass} @ ${(classification.confidence * 100).toFixed(0)}% — ${classification.reasoning}`)

    // If classified as IGNORE or OTHER, return early with audit log
    if (classification.predictedClass === 'IGNORE' || classification.predictedClass === 'OTHER') {
      // Store prediction record even for ignored emails
      await storePredictionRecord(null, classification, 'auto_classify', 0, learningHintsApplied.length)

      await db.auditLog.create({
        data: {
          action: 'email_ignored',
          details: `Email from ${from} classified as ${classification.predictedClass}. Confidence: ${(classification.confidence * 100).toFixed(0)}%. Reason: ${classification.reasoning}. Alternatives: ${classification.alternatives.map(a => `${a.class}(${(a.score * 100).toFixed(0)}%)`).join(', ')}`,
          status: 'WARNING',
          processedBy: 'AUTO',
        },
      })

      return NextResponse.json({
        classification: classification.predictedClass,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        alternatives: classification.alternatives,
        claim: null,
        folderPath: null,
        duplicate: false,
        requiresReview: false,
        processingStage: currentStage,
      })
    }

    // ==========================================
    // AGENT 4: Decision Engine
    // ==========================================
    const decision = makeDecision({
      predictedClass: classification.predictedClass,
      confidence: classification.confidence,
      hasLearningHints: learningHintsApplied.length > 0,
      isKnownSender: !!matchedCompany,
      isKnownInsuranceCompany: !!matchedCompany,
      hasAttachments: intake.hasAttachments,
      hasClaimNumber: !!preprocessed.possibleClaimNumber,
      confidenceThreshold,
    })

    console.error(`[pipeline] Agent 4 (Decision): ${decision.decision} — ${decision.reasoning}`)

    // ==========================================
    // AI DATA EXTRACTION (with learning hints)
    // ==========================================
    const extraction = await extractClaimData(intake.subject, emailBody, from, learningHintsStr || undefined)
    const { claimData } = extraction

    // Determine claim fields
    const claimNumber = claimData.claim_number || `STF-${Date.now().toString().slice(-6)}`
    const clientName = claimData.client_name || 'Unknown Client'
    const validClaimTypes = ['Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability']
    const claimType = claimData.claim_type && validClaimTypes.includes(claimData.claim_type)
      ? claimData.claim_type
      : 'Motor'
    const folderName = matchedCompany?.folderName || 'PENDING_REVIEW'

    currentStage = 'EXTRACTED'
    stageLog.push('EXTRACTED')

    // Confidence breakdown
    const classificationConfidence = Math.round(classification.confidence * 100)
    const extractionConfidence = extraction.confidence
    const overallConfidence = Math.round(
      (classificationConfidence * 0.4) + (extractionConfidence * 0.6)
    )

    // ==========================================
    // DUPLICATE DETECTION
    // ==========================================
    let isDuplicate = false
    let existingDuplicateClaim: { id: string; claimNumber: string; clientName: string; status: string } | null = null
    const existingClaim = await db.claim.findFirst({
      where: { claimNumber },
    })

    if (existingClaim) {
      isDuplicate = true
      existingDuplicateClaim = existingClaim
    }

    // ==========================================
    // PAUSE POINT: Duplicate OR Manual Review
    // ==========================================
    if (isDuplicate) {
      const pauseReason = `Duplicate claim number "${claimNumber}" detected.`

      // Create the claim but STOP pipeline
      const claim = await db.claim.create({
        data: {
          claimNumber: `${claimNumber}_DUP`,
          clientName,
          insuranceCompanyId: matchedCompanyId,
          claimType,
          status: 'MANUAL_REVIEW',
          senderEmail: from,
          emailSubject: subject,
          contactNumber: claimData.contact_number,
          contactEmail: claimData.contact_email,
          incidentDescription: claimData.incident_description,
          excessAmount: claimData.excess_amount,
          specialInstructions: claimData.special_instructions,
          vehicleMake: claimData.vehicle_make,
          vehicleModel: claimData.vehicle_model,
          vehicleYear: claimData.vehicle_year,
          vehicleRegistration: claimData.vehicle_registration,
          attachmentsCount: attachments.length,
          confidenceScore: overallConfidence,
          aiClassification: classification.predictedClass,
          aiClassificationConfidence: classificationConfidence,
          processingStage: 'EXTRACTED',
          needsAttention: true,
          // Multi-agent fields
          aiDecision: decision.decision,
          aiReasoning: classification.reasoning,
          aiConfidenceBreakdown: JSON.stringify({
            classification: classificationConfidence,
            extraction: extractionConfidence,
            overall: overallConfidence,
          }),
          aiAlternatives: JSON.stringify(classification.alternatives),
          notes: `DUPLICATE: Original claim ${claimNumber} exists (ID: ${existingDuplicateClaim?.id}, Client: ${existingDuplicateClaim?.clientName}). ${pauseReason}`,
        },
        include: { insuranceCompany: { select: { id: true, name: true, folderName: true } } },
      })

      // Store prediction + entities
      await storePredictionRecord(claim.id, classification, 'manual_review', overallConfidence, learningHintsApplied.length)
      await storeExtractedEntities(claim.id, preprocessed)

      // Audit logs
      await db.auditLog.createMany({
        data: [
          { claimId: claim.id, action: 'email_received', details: `Email received from ${from}. Subject: "${subject}".`, status: 'SUCCESS', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'ai_classification', details: `Classified: ${classification.predictedClass} @ ${classificationConfidence}%. Alternatives: ${classification.alternatives.map(a => `${a.class}(${(a.score * 100).toFixed(0)}%)`).join(', ')}. Reason: ${classification.reasoning}`, status: 'SUCCESS', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'decision_engine', details: `Decision: ${decision.decision}. ${decision.reasoning}`, status: 'SUCCESS', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'duplicate_detected', details: pauseReason, status: 'WARNING', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'pipeline_paused', details: `Pipeline PAUSED at EXTRACTED. ${pauseReason}`, status: 'WARNING', processedBy: 'AUTO' },
        ],
      })

      return NextResponse.json({
        classification: classification.predictedClass,
        confidence: overallConfidence,
        classificationConfidence,
        extractionConfidence,
        confidenceThreshold,
        decision: decision.decision,
        decisionReasoning: decision.reasoning,
        alternatives: classification.alternatives,
        reasoning: classification.reasoning,
        requiresReview: true,
        pipelinePaused: true,
        pipelinePausedAt: 'EXTRACTED',
        claim: {
          id: claim.id, claimNumber: claim.claimNumber, clientName: claim.clientName,
          claimType: claim.claimType, status: claim.status, processingStage: 'EXTRACTED',
          stagesCompleted: stageLog, folderPath: null, insuranceCompany: claim.insuranceCompany,
          confidenceScore: claim.confidenceScore,
        },
        folderPath: null,
        duplicate: true,
        existingClaim: { id: existingDuplicateClaim?.id, claimNumber: existingDuplicateClaim?.claimNumber },
        autoReplySent: false,
        printQueueItems: [],
      })
    }

    // ==========================================
    // PAUSE POINT: Manual Review (very low confidence)
    // ==========================================
    if (decision.decision === 'manual_review') {
      const pauseReason = `Low confidence (${(classification.confidence * 100).toFixed(0)}%) — below manual review threshold. Decision engine: ${decision.reasoning}`

      const claim = await db.claim.create({
        data: {
          claimNumber,
          clientName,
          insuranceCompanyId: matchedCompanyId,
          claimType,
          status: 'MANUAL_REVIEW',
          senderEmail: from,
          emailSubject: subject,
          contactNumber: claimData.contact_number,
          contactEmail: claimData.contact_email,
          incidentDescription: claimData.incident_description,
          excessAmount: claimData.excess_amount,
          specialInstructions: claimData.special_instructions,
          vehicleMake: claimData.vehicle_make,
          vehicleModel: claimData.vehicle_model,
          vehicleYear: claimData.vehicle_year,
          vehicleRegistration: claimData.vehicle_registration,
          attachmentsCount: attachments.length,
          confidenceScore: overallConfidence,
          aiClassification: classification.predictedClass,
          aiClassificationConfidence: classificationConfidence,
          processingStage: 'EXTRACTED',
          needsAttention: true,
          // Multi-agent fields
          aiDecision: 'manual_review',
          aiReasoning: classification.reasoning,
          aiConfidenceBreakdown: JSON.stringify({
            classification: classificationConfidence,
            extraction: extractionConfidence,
            overall: overallConfidence,
          }),
          aiAlternatives: JSON.stringify(classification.alternatives),
          notes: pauseReason,
        },
        include: { insuranceCompany: { select: { id: true, name: true, folderName: true } } },
      })

      // Store prediction + entities
      await storePredictionRecord(claim.id, classification, 'manual_review', overallConfidence, learningHintsApplied.length)
      await storeExtractedEntities(claim.id, preprocessed)

      // Audit logs
      await db.auditLog.createMany({
        data: [
          { claimId: claim.id, action: 'email_received', details: `Email received from ${from}. Subject: "${subject}".`, status: 'SUCCESS', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'ai_classification', details: `Classified: ${classification.predictedClass} @ ${classificationConfidence}%. Reason: ${classification.reasoning}`, status: 'WARNING', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'decision_engine', details: `Decision: manual_review. ${pauseReason}`, status: 'WARNING', processedBy: 'AUTO' },
          { claimId: claim.id, action: 'pipeline_paused', details: `Pipeline PAUSED at EXTRACTED. ${pauseReason}`, status: 'WARNING', processedBy: 'AUTO' },
        ],
      })

      return NextResponse.json({
        classification: classification.predictedClass,
        confidence: overallConfidence,
        classificationConfidence,
        extractionConfidence,
        confidenceThreshold,
        decision: 'manual_review',
        decisionReasoning: decision.reasoning,
        alternatives: classification.alternatives,
        reasoning: classification.reasoning,
        requiresReview: true,
        pipelinePaused: true,
        pipelinePausedAt: 'EXTRACTED',
        lowConfidenceFlagged: true,
        claim: {
          id: claim.id, claimNumber: claim.claimNumber, clientName: claim.clientName,
          claimType: claim.claimType, status: claim.status, processingStage: 'EXTRACTED',
          stagesCompleted: stageLog, folderPath: null, insuranceCompany: claim.insuranceCompany,
          confidenceScore: claim.confidenceScore,
        },
        folderPath: null,
        duplicate: false,
        autoReplySent: false,
        printQueueItems: [],
      })
    }

    // ==========================================
    // CONTINUE PIPELINE (auto_classify or needs_review)
    // ==========================================
    const isNeedsReview = decision.decision === 'needs_review'

    // Folder Path Generation
    const folderPath = generateFolderPath(claimNumber, clientName, folderName)
    let actualFolderPath: string | null = null
    let folderCreated = false
    try {
      const folderResult = await createClaimFolder(folderPath)
      if (folderResult.success) {
        actualFolderPath = folderResult.actualPath
        folderCreated = true
        currentStage = 'FOLDER_CREATED'
        stageLog.push('FOLDER_CREATED')
      }
    } catch (fsError) {
      console.warn(`[pipeline] Folder creation error (non-fatal): ${String(fsError)}`)
    }

    // Create Claim Record
    const claim = await db.claim.create({
      data: {
        claimNumber,
        clientName,
        insuranceCompanyId: matchedCompanyId,
        claimType,
        status: 'NEW',
        senderEmail: from,
        emailSubject: subject,
        contactNumber: claimData.contact_number,
        contactEmail: claimData.contact_email,
        incidentDescription: claimData.incident_description,
        excessAmount: claimData.excess_amount,
        specialInstructions: claimData.special_instructions,
        folderPath,
        vehicleMake: claimData.vehicle_make,
        vehicleModel: claimData.vehicle_model,
        vehicleYear: claimData.vehicle_year,
        vehicleRegistration: claimData.vehicle_registration,
        attachmentsCount: attachments.length,
        confidenceScore: overallConfidence,
        aiClassification: classification.predictedClass,
        aiClassificationConfidence: classificationConfidence,
        processingStage: currentStage,
        needsAttention: isNeedsReview,
        aiHintsUsed: learningHintsApplied.length > 0 ? JSON.stringify(learningHintsApplied) : null,
        // Multi-agent fields
        aiDecision: decision.decision,
        aiReasoning: classification.reasoning,
        aiConfidenceBreakdown: JSON.stringify({
          classification: classificationConfidence,
          extraction: extractionConfidence,
          overall: overallConfidence,
        }),
        aiAlternatives: JSON.stringify(classification.alternatives),
      },
      include: { insuranceCompany: { select: { id: true, name: true, folderName: true } } },
    })

    // Store prediction + entities
    await storePredictionRecord(claim.id, classification, decision.decision, overallConfidence, learningHintsApplied.length)
    await storeExtractedEntities(claim.id, preprocessed)

    // Save email metadata
    let documentsSaved = false
    try {
      await saveEmailMetadata(folderPath, {
        claimId: claim.id, claimNumber, clientName, senderEmail: from,
        emailSubject: subject, emailBody, claimType,
        insuranceCompany: matchedCompany?.name || 'PENDING_REVIEW',
        attachments, extraction: claimData, classification,
        overallConfidence, isDuplicate: false,
      })
      documentsSaved = true
      currentStage = 'DOCUMENTS_SAVED'
      stageLog.push('DOCUMENTS_SAVED')
    } catch (metaError) {
      console.warn(`[pipeline] Metadata save error (non-fatal): ${String(metaError)}`)
    }

    // Save attachments
    if (attachments.length > 0 && folderCreated) {
      try {
        const localPath = getLocalPath(folderPath)
        const attachmentsDir = path.join(localPath, 'Attachments')
        await mkdir(attachmentsDir, { recursive: true })
        for (const attachment of attachments) {
          if (attachment.content && attachment.filename) {
            try {
              const attachmentPath = path.join(attachmentsDir, attachment.filename)
              const buffer = Buffer.from(attachment.content, 'base64')
              await writeFile(attachmentPath, buffer)
            } catch (fileErr) {
              console.warn(`[pipeline] Failed to save attachment ${attachment.filename}: ${String(fileErr)}`)
            }
          }
        }
      } catch (attachErr) {
        console.warn(`[pipeline] Attachment save error (non-fatal): ${String(attachErr)}`)
      }
    }

    // Create Print Queue Items
    const printQueueItems = []
    let printQueued = false
    for (const attachment of attachments) {
      const printItem = await db.printQueueItem.create({
        data: {
          claimId: claim.id,
          fileName: attachment.filename,
          filePath: `${folderPath}/Attachments/${attachment.filename}`,
          printStatus: 'QUEUED',
        },
      })
      printQueueItems.push({
        id: printItem.id,
        fileName: printItem.fileName,
        filePath: printItem.filePath,
        printStatus: printItem.printStatus,
      })
      printQueued = true
    }
    if (printQueued) {
      currentStage = 'PRINTED'
      stageLog.push('PRINTED')
    }

    // Audit Log Entries
    currentStage = 'LOGGED'
    stageLog.push('LOGGED')

    await db.auditLog.createMany({
      data: [
        {
          claimId: claim.id,
          action: 'email_received',
          details: `Email from ${from}. Subject: "${subject}".`,
          status: 'SUCCESS',
          processedBy: 'AUTO',
        },
        {
          claimId: claim.id,
          action: 'ai_classification',
          details: `Classified: ${classification.predictedClass} @ ${classificationConfidence}%. Alternatives: ${classification.alternatives.map(a => `${a.class}(${(a.score * 100).toFixed(0)}%)`).join(', ')}. Reason: ${classification.reasoning}`,
          status: 'SUCCESS',
          processedBy: 'AUTO',
        },
        {
          claimId: claim.id,
          action: 'decision_engine',
          details: `Decision: ${decision.decision}. ${decision.reasoning}`,
          status: isNeedsReview ? 'WARNING' : 'SUCCESS',
          processedBy: 'AUTO',
        },
        {
          claimId: claim.id,
          action: matchedCompany ? 'insurance_mapping' : 'insurance_mapping',
          details: matchedCompany
            ? `Domain "${senderDomain}" → ${matchedCompany.name} (${matchedCompany.folderName})`
            : `No insurance company matched for "${senderDomain}". Set to PENDING_REVIEW.`,
          status: matchedCompany ? 'SUCCESS' : 'WARNING',
          processedBy: 'AUTO',
        },
        {
          claimId: claim.id,
          action: 'data_extraction',
          details: `Extraction confidence: ${extractionConfidence}%. Overall: ${overallConfidence}%. Threshold: ${confidenceThreshold}%.${learningHintsApplied.length > 0 ? ` Boosted by ${learningHintsApplied.length} learning hints.` : ''}${isNeedsReview ? ' ⚠️ Flagged for review.' : ''}`,
          status: overallConfidence >= confidenceThreshold ? 'SUCCESS' : 'WARNING',
          processedBy: 'AUTO',
        },
        {
          claimId: claim.id,
          action: 'folder_path_generated',
          details: `Folder: ${folderPath}${actualFolderPath ? ` → ${actualFolderPath}` : ' (not created)'}`,
          status: folderCreated ? 'SUCCESS' : 'WARNING',
          processedBy: 'AUTO',
        },
      ],
    })

    // Auto-Reply
    let autoReplySent = false
    let autoReplyError: string | null = null
    try {
      const replyEnabled = await isAutoReplyEnabled()
      if (replyEnabled) {
        const replyTo = claimData.contact_email || from
        const replyResult = await sendClaimAcknowledgment({
          toEmail: replyTo, clientName, claimNumber, claimType, subject,
        })
        if (replyResult.success) {
          autoReplySent = true
          currentStage = 'RESPONDED'
          stageLog.push('RESPONDED')
          await db.auditLog.create({
            claimId: claim.id,
            action: 'auto_reply_sent',
            details: `Auto-reply sent to ${replyTo} for claim ${claimNumber}.`,
            status: 'SUCCESS',
            processedBy: 'AUTO',
          })
        } else {
          autoReplyError = replyResult.error || 'Unknown SMTP error'
          await db.auditLog.create({
            claimId: claim.id,
            action: 'auto_reply_failed',
            details: `Failed to send auto-reply to ${replyTo}: ${autoReplyError}`,
            status: 'WARNING',
            processedBy: 'AUTO',
          })
        }
      }
    } catch (replyErr: unknown) {
      autoReplyError = replyErr instanceof Error ? replyErr.message : String(replyErr)
    }

    // Update claim with final stage
    await db.claim.update({
      where: { id: claim.id },
      data: { processingStage: currentStage },
    })

    // Return full result
    return NextResponse.json({
      classification: classification.predictedClass,
      confidence: overallConfidence,
      classificationConfidence,
      extractionConfidence,
      confidenceThreshold,
      decision: decision.decision,
      decisionReasoning: decision.reasoning,
      alternatives: classification.alternatives,
      reasoning: classification.reasoning,
      requiresReview: isNeedsReview,
      pipelinePaused: false,
      lowConfidenceFlagged: isNeedsReview,
      needsAttention: isNeedsReview,
      learningHintsApplied,
      claim: {
        id: claim.id,
        claimNumber: claim.claimNumber,
        clientName: claim.clientName,
        claimType: claim.claimType,
        status: claim.status,
        processingStage: currentStage,
        stagesCompleted: stageLog,
        folderPath: claim.folderPath,
        insuranceCompany: claim.insuranceCompany,
        confidenceScore: claim.confidenceScore,
      },
      folderPath,
      actualFolderPath,
      sanitizedName: sanitizeClientName(clientName),
      duplicate: false,
      autoReplySent,
      autoReplyError,
      printQueueItems,
    })
  } catch (error) {
    console.error('Process email error:', error)

    try {
      await db.auditLog.create({
        data: {
          action: 'email_processing_error',
          details: `Failed to process email: ${String(error)}`,
          status: 'ERROR',
          processedBy: 'AUTO',
        },
      })
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: 'Failed to process email', details: String(error) },
      { status: 500 }
    )
  }
}

// ─── Helper: Store Prediction Record ───────────────────────────────────────

async function storePredictionRecord(
  claimId: string | null,
  classification: { predictedClass: string; confidence: number; alternatives: Array<{ class: string; score: number }>; reasoning: string },
  decision: string,
  overallConfidence: number,
  hintsCount: number
) {
  try {
    await db.prediction.create({
      data: {
        claimId: claimId || '', // For ignored emails, claimId will be empty
        predictedClass: classification.predictedClass,
        confidence: classification.confidence,
        alternatives: JSON.stringify(classification.alternatives),
        reasoning: classification.reasoning,
        decision,
        decisionReasoning: `Overall confidence: ${overallConfidence}%. ${hintsCount > 0 ? `${hintsCount} learning hints applied.` : ''}`,
        learningHintsCount: hintsCount,
      },
    })
  } catch (err) {
    console.error('[pipeline] Failed to store prediction:', err)
  }
}

// ─── Helper: Store Extracted Entities ─────────────────────────────────────

async function storeExtractedEntities(
  claimId: string,
  preprocessed: { possibleClaimNumber: string | null; personNames: string[]; dates: string[]; keywords: string[]; cleanedBody?: string }
) {
  try {
    await db.extractedEntity.create({
      data: {
        claimId,
        possibleClaimNumber: preprocessed.possibleClaimNumber,
        personNames: preprocessed.personNames.length > 0 ? JSON.stringify(preprocessed.personNames) : null,
        dates: preprocessed.dates.length > 0 ? JSON.stringify(preprocessed.dates) : null,
        keywords: preprocessed.keywords.length > 0 ? JSON.stringify(preprocessed.keywords) : null,
        cleanedBody: preprocessed.cleanedBody,
      },
    })
  } catch (err) {
    console.error('[pipeline] Failed to store extracted entities:', err)
  }
}
