import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { createClaimFolder, saveEmailMetadata, getLocalPath } from '@/lib/fs-helpers'
import { generateFolderPath } from '@/lib/folder-utils'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { classifyEmail, extractClaimData, assessExtractionConfidence } from '@/lib/ai-helpers'
import { sendClaimAcknowledgment, isAutoReplyEnabled } from '@/lib/smtp'

const PROCESS_ACTIONS = [
  'classify',
  'extract',
  'create_folder',
  'save_documents',
  'print',
  'log',
  'respond',
  'approve',
  'reject',
  'add_note',
] as const

const PROCESSING_STAGE_MAP: Record<string, string> = {
  classify: 'CLASSIFIED',
  extract: 'EXTRACTED',
  create_folder: 'FOLDER_CREATED',
  save_documents: 'DOCUMENTS_SAVED',
  print: 'PRINTED',
  log: 'LOGGED',
  respond: 'RESPONDED',
}

const processClaimSchema = z.object({
  action: z.enum(PROCESS_ACTIONS),
  notes: z.string().optional(),
})

// GET /api/claims/[id]/process - Get print queue items for a claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const printItems = await db.printQueueItem.findMany({
      where: { claimId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        printStatus: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ items: printItems })
  } catch (error) {
    console.error('Print queue fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch print queue', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/claims/[id]/process - Process a claim through workflow stages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = processClaimSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { action, notes } = result.data

    // Check claim exists
    const claim = await db.claim.findUnique({ where: { id } })
    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    // Handle add_note action
    if (action === 'add_note') {
      if (!notes || notes.trim().length === 0) {
        return NextResponse.json(
          { error: 'Note content is required for add_note action' },
          { status: 400 }
        )
      }

      const timestamp = new Date().toISOString()
      const noteEntry = `[${timestamp}] ${notes}`
      const updatedNotes = claim.notes
        ? `${claim.notes}\n${noteEntry}`
        : noteEntry

      const updatedClaim = await db.claim.update({
        where: { id },
        data: { notes: updatedNotes },
        include: {
          insuranceCompany: { select: { id: true, name: true, folderName: true } },
        },
      })

      await db.auditLog.create({
        data: {
          claimId: id,
          action: 'note_added',
          details: `Note added to claim ${claim.claimNumber}: ${notes}`,
          status: 'SUCCESS',
          processedBy: 'MANUAL',
        },
      })

      return NextResponse.json({ claim: updatedClaim, message: 'Note added successfully' })
    }

    // Handle approve/reject actions
    if (action === 'approve') {
      const updatedClaim = await db.claim.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          processingStage: 'RESPONDED',
          processedAt: new Date(),
          notes: notes
            ? `${claim.notes ? claim.notes + '\n' : ''}APPROVED: ${notes}`
            : `${claim.notes ? claim.notes + '\n' : ''}APPROVED at ${new Date().toISOString()}`,
        },
        include: {
          insuranceCompany: { select: { id: true, name: true, folderName: true } },
        },
      })

      await db.auditLog.create({
        data: {
          claimId: id,
          action: 'claim_approved',
          details: `Claim ${claim.claimNumber} approved${notes ? `: ${notes}` : ''}`,
          status: 'SUCCESS',
          processedBy: 'MANUAL',
        },
      })

      return NextResponse.json({ claim: updatedClaim, message: 'Claim approved successfully' })
    }

    if (action === 'reject') {
      const updatedClaim = await db.claim.update({
        where: { id },
        data: {
          status: 'FAILED',
          notes: notes
            ? `${claim.notes ? claim.notes + '\n' : ''}REJECTED: ${notes}`
            : `${claim.notes ? claim.notes + '\n' : ''}REJECTED at ${new Date().toISOString()}`,
        },
        include: {
          insuranceCompany: { select: { id: true, name: true, folderName: true } },
        },
      })

      await db.auditLog.create({
        data: {
          claimId: id,
          action: 'claim_rejected',
          details: `Claim ${claim.claimNumber} rejected${notes ? `: ${notes}` : ''}`,
          status: 'WARNING',
          processedBy: 'MANUAL',
        },
      })

      return NextResponse.json({ claim: updatedClaim, message: 'Claim rejected' })
    }

    // Handle workflow processing actions
    const newStage = PROCESSING_STAGE_MAP[action]
    if (!newStage) {
      return NextResponse.json(
        { error: `Unknown processing action: ${action}` },
        { status: 400 }
      )
    }

    // Update claim status and processing stage
    const updateData: Record<string, string | number | boolean> = {
      processingStage: newStage,
    }

    // Set status based on stage progression
    if (action === 'classify') {
      updateData.status = 'PROCESSING'
    }

    // ─── REAL AI CLASSIFICATION ─────────────────────────────────────────
    if (action === 'classify') {
      try {
        // Use the claim's email data to re-classify with real AI
        const emailContent = [
          claim.emailSubject ? `Subject: ${claim.emailSubject}` : '',
          claim.incidentDescription ? `\nDescription: ${claim.incidentDescription}` : '',
          claim.senderEmail ? `\nFrom: ${claim.senderEmail}` : '',
        ].filter(Boolean).join('\n') || claim.incidentDescription || claim.emailSubject || 'No content available for re-classification'

        const classification = await classifyEmail(
          claim.emailSubject || 'Re-classification',
          emailContent,
          claim.senderEmail || 'unknown'
        )

        updateData.aiClassification = classification.classification
        updateData.aiClassificationConfidence = classification.confidence
        updateData.confidenceScore = classification.confidence

        // Flag for attention if low confidence, but don't pause the pipeline
        const threshold = await getConfidenceThreshold()
        if (classification.confidence < threshold) {
          updateData.needsAttention = true
          // Don't set MANUAL_REVIEW — claim is correct by default
        }

        await db.auditLog.create({
          data: {
            claimId: id,
            action: 'process_classify',
            details: `Manual re-classification via AI. Result: ${classification.classification}, Confidence: ${classification.confidence}%. Reason: ${classification.reasoning}`,
            status: classification.confidence >= 70 ? 'SUCCESS' : 'WARNING',
            processedBy: 'MANUAL',
          },
        })

        console.log(`[claim-process] Real AI classification: ${classification.classification} (${classification.confidence}%)`)
      } catch (aiErr) {
        // Fallback to PROCESSING status if AI fails
        updateData.aiClassification = 'NEW_CLAIM'
        updateData.aiClassificationConfidence = 50
        updateData.confidenceScore = 50
        updateData.status = 'MANUAL_REVIEW'

        await db.auditLog.create({
          data: {
            claimId: id,
            action: 'process_classify',
            details: `Manual re-classification failed (AI unavailable): ${String(aiErr)}. Claim set to MANUAL_REVIEW.`,
            status: 'ERROR',
            processedBy: 'MANUAL',
          },
        })

        console.error(`[claim-process] AI classification failed:`, aiErr)
      }
    }

    // ─── REAL AI DATA EXTRACTION ────────────────────────────────────────
    if (action === 'extract') {
      try {
        const emailContent = [
          claim.emailSubject ? `Subject: ${claim.emailSubject}` : '',
          claim.incidentDescription ? `\n${claim.incidentDescription}` : '',
          claim.specialInstructions ? `\nSpecial Instructions: ${claim.specialInstructions}` : '',
        ].filter(Boolean).join('\n') || 'No email content available for re-extraction'

        const extraction = await extractClaimData(
          claim.emailSubject || 'Re-extraction',
          emailContent,
          claim.senderEmail || 'unknown'
        )

        const { claimData } = extraction

        // Update all extracted fields on the claim
        if (claimData.client_name) updateData.clientName = claimData.client_name
        if (claimData.claim_type && ['Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability'].includes(claimData.claim_type)) {
          updateData.claimType = claimData.claim_type
        }
        if (claimData.contact_number) updateData.contactNumber = claimData.contact_number
        if (claimData.contact_email) updateData.contactEmail = claimData.contact_email
        if (claimData.incident_description) updateData.incidentDescription = claimData.incident_description
        if (claimData.excess_amount) updateData.excessAmount = claimData.excess_amount
        if (claimData.special_instructions) updateData.specialInstructions = claimData.special_instructions
        if (claimData.vehicle_make) updateData.vehicleMake = claimData.vehicle_make
        if (claimData.vehicle_model) updateData.vehicleModel = claimData.vehicle_model
        if (claimData.vehicle_year) updateData.vehicleYear = claimData.vehicle_year
        if (claimData.vehicle_registration) updateData.vehicleRegistration = claimData.vehicle_registration

        // Calculate new confidence
        const newConfidence = extraction.confidence || assessExtractionConfidence(claimData)
        updateData.confidenceScore = newConfidence

        // Flag for attention if low confidence, but don't pause the pipeline
        const threshold = await getConfidenceThreshold()
        if (newConfidence < threshold) {
          updateData.needsAttention = true
          // Don't set MANUAL_REVIEW — claim is correct by default
        }

        await db.auditLog.create({
          data: {
            claimId: id,
            action: 'process_extract',
            details: `Manual re-extraction via AI. Confidence: ${newConfidence}%. Fields updated: ${Object.keys(claimData).filter(k => claimData[k]).join(', ')}`,
            status: newConfidence >= 50 ? 'SUCCESS' : 'WARNING',
            processedBy: 'MANUAL',
          },
        })

        console.log(`[claim-process] Real AI extraction: confidence ${newConfidence}%, fields updated`)
      } catch (aiErr) {
        await db.auditLog.create({
          data: {
            claimId: id,
            action: 'process_extract',
            details: `Manual re-extraction failed (AI unavailable): ${String(aiErr)}. Stage advanced but data not updated.`,
            status: 'ERROR',
            processedBy: 'MANUAL',
          },
        })

        console.error(`[claim-process] AI extraction failed:`, aiErr)
      }
    }

    // Handle create_folder action - actually create the folder on the filesystem
    if (action === 'create_folder') {
      let targetPath = claim.folderPath
      // Generate folder path if the claim doesn't have one yet
      if (!targetPath) {
        const folderName = claim.insuranceCompanyId
          ? await db.insuranceCompany.findUnique({
              where: { id: claim.insuranceCompanyId },
              select: { folderName: true },
            }).then((c) => c?.folderName || 'PENDING_REVIEW')
          : 'PENDING_REVIEW'
        targetPath = generateFolderPath(claim.claimNumber, claim.clientName, folderName)
        // Persist the generated folder path to the claim
        await db.claim.update({
          where: { id },
          data: { folderPath: targetPath },
        })
      }

      const folderResult = await createClaimFolder(targetPath)
      if (folderResult.success) {
        console.log(`[claim-process] Folder created at: ${folderResult.actualPath}`)
        // Also save metadata into the new folder
        await saveEmailMetadata(targetPath, {
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          clientName: claim.clientName,
          claimType: claim.claimType,
          status: claim.status,
          folderCreatedVia: 'manual_process',
        })
      } else {
        console.warn(`[claim-process] Folder creation failed (non-fatal): ${folderResult.error}`)
      }
    }

    // Handle save_documents action - save a placeholder file in the claim folder
    if (action === 'save_documents') {
      const claimForDocs = await db.claim.findUnique({ where: { id } })
      let targetPath = claimForDocs?.folderPath
      if (!targetPath) {
        const folderName = claimForDocs?.insuranceCompanyId
          ? await db.insuranceCompany.findUnique({
              where: { id: claimForDocs.insuranceCompanyId },
              select: { folderName: true },
            }).then((c) => c?.folderName || 'PENDING_REVIEW')
          : 'PENDING_REVIEW'
        targetPath = generateFolderPath(claim.claimNumber, claim.clientName, folderName)
        await db.claim.update({
          where: { id },
          data: { folderPath: targetPath },
        })
      }

      // Ensure the folder exists first
      const folderResult = await createClaimFolder(targetPath)
      if (folderResult.success) {
        const localPath = getLocalPath(targetPath)
        const docsPath = path.join(localPath, 'Documents', 'document_list.txt')
        try {
          await mkdir(path.join(localPath, 'Documents'), { recursive: true })
          await writeFile(docsPath, `Claim: ${claim.claimNumber}\nClient: ${claim.clientName}\nDocuments saved at: ${new Date().toISOString()}\n`, 'utf-8')
          console.log(`[claim-process] Placeholder document saved at: ${docsPath}`)
        } catch (docErr) {
          console.warn(`[claim-process] Document save error (non-fatal): ${String(docErr)}`)
        }
      }
    }

    // Handle print action (keep as-is, just status update)
    if (action === 'print') {
      updateData.documentsPrinted = true
    }

    // ─── REAL SMTP AUTO-REPLY ───────────────────────────────────────────
    if (action === 'respond') {
      try {
        const replyEnabled = await isAutoReplyEnabled()
        if (replyEnabled) {
          const replyTo = claim.contactEmail || claim.senderEmail
          if (!replyTo) {
            await db.auditLog.create({
              data: {
                claimId: id,
                action: 'process_respond',
                details: `Cannot send reply: no contact email available for claim ${claim.claimNumber}.`,
                status: 'WARNING',
                processedBy: 'MANUAL',
              },
            })
          } else {
            const replyResult = await sendClaimAcknowledgment({
              toEmail: replyTo,
              clientName: claim.clientName,
              claimNumber: claim.claimNumber,
              claimType: claim.claimType,
              subject: claim.emailSubject || undefined,
            })

            if (replyResult.success) {
              updateData.processingStage = 'RESPONDED'
              await db.auditLog.create({
                data: {
                  claimId: id,
                  action: 'auto_reply_sent',
                  details: `Manual reply sent to ${replyTo} for claim ${claim.claimNumber}.`,
                  status: 'SUCCESS',
                  processedBy: 'MANUAL',
                },
              })
              console.log(`[claim-process] Real SMTP reply sent to ${replyTo}`)
            } else {
              await db.auditLog.create({
                data: {
                  claimId: id,
                  action: 'auto_reply_failed',
                  details: `Failed to send reply to ${replyTo}: ${replyResult.error}`,
                  status: 'ERROR',
                  processedBy: 'MANUAL',
                },
              })
              console.error(`[claim-process] SMTP reply failed: ${replyResult.error}`)
            }
          }
        } else {
          await db.auditLog.create({
            data: {
              claimId: id,
              action: 'process_respond',
              details: `Auto-reply is disabled in settings. Stage advanced but no email sent.`,
              status: 'WARNING',
              processedBy: 'MANUAL',
            },
          })
        }
      } catch (smtpErr) {
        await db.auditLog.create({
          data: {
            claimId: id,
            action: 'auto_reply_failed',
            details: `SMTP error during manual reply: ${String(smtpErr)}`,
            status: 'ERROR',
            processedBy: 'MANUAL',
          },
        })
        console.error(`[claim-process] SMTP error:`, smtpErr)
      }
    }

    const updatedClaim = await db.claim.update({
      where: { id },
      data: updateData,
      include: {
        insuranceCompany: { select: { id: true, name: true, folderName: true } },
      },
    })

    // Create a generic audit log for non-special actions (classify, extract, respond already log above)
    if (!['classify', 'extract', 'respond'].includes(action)) {
      const logDetails: Record<string, string> = {
        create_folder: `Folder created on filesystem at ${claim.folderPath || 'auto-generated path'}`,
        save_documents: `${claim.attachmentsCount} documents saved for claim ${claim.claimNumber}`,
        print: `Documents queued for printing for claim ${claim.claimNumber}`,
        log: `Claim ${claim.claimNumber} logged to system`,
      }

      await db.auditLog.create({
        data: {
          claimId: id,
          action: `process_${action}`,
          details: notes
            ? `${logDetails[action] || action}. Notes: ${notes}`
            : (logDetails[action] || action),
          status: 'SUCCESS',
          processedBy: 'MANUAL',
        },
      })
    }

    return NextResponse.json({
      claim: updatedClaim,
      message: `Claim processed: ${action}`,
      processingStage: newStage,
    })
  } catch (error) {
    console.error('Claim process error:', error)
    return NextResponse.json(
      { error: 'Failed to process claim', details: String(error) },
      { status: 500 }
    )
  }
}

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
