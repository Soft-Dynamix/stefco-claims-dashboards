import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/[id]/print - Get claim data with full details for printing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        insuranceCompany: true,
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
        printQueueItems: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    // Fetch notes separately (in-memory + legacy)
    const notes = claim.notes
      ? claim.notes
          .split('\n')
          .filter((n: string) => n.trim())
          .map((line: string) => {
            const timestampMatch = line.match(/\[([^\]]+)\]/)
            const typeMatch = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]/)
            const timestamp = timestampMatch ? timestampMatch[1] : ''
            const type = typeMatch ? typeMatch[2] : 'General'
            const text = typeMatch
              ? line.replace(/\[[^\]]+\]\s*\[[^\]]+\]\s*/, '')
              : line
            return { timestamp, type, text: text.trim() }
          })
      : []

    return NextResponse.json({
      claim: {
        id: claim.id,
        claimNumber: claim.claimNumber,
        clientName: claim.clientName,
        claimType: claim.claimType,
        status: claim.status,
        processingStage: claim.processingStage,
        senderEmail: claim.senderEmail,
        emailSubject: claim.emailSubject,
        contactNumber: claim.contactNumber,
        contactEmail: claim.contactEmail,
        incidentDescription: claim.incidentDescription,
        excessAmount: claim.excessAmount,
        specialInstructions: claim.specialInstructions,
        folderPath: claim.folderPath,
        vehicleMake: claim.vehicleMake,
        vehicleModel: claim.vehicleModel,
        vehicleYear: claim.vehicleYear,
        vehicleRegistration: claim.vehicleRegistration,
        propertyAddress: claim.propertyAddress,
        attachmentsCount: claim.attachmentsCount,
        documentsPrinted: claim.documentsPrinted,
        confidenceScore: claim.confidenceScore,
        aiClassification: claim.aiClassification,
        aiClassificationConfidence: claim.aiClassificationConfidence,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
        processedAt: claim.processedAt,
        insuranceCompany: claim.insuranceCompany
          ? {
              id: claim.insuranceCompany.id,
              name: claim.insuranceCompany.name,
              folderName: claim.insuranceCompany.folderName,
            }
          : null,
      },
      auditLogs: claim.auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        status: log.status,
        processedBy: log.processedBy,
        createdAt: log.createdAt,
      })),
      printQueueItems: claim.printQueueItems.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        printStatus: item.printStatus,
        pages: item.pages,
        createdAt: item.createdAt,
        printedAt: item.printedAt,
        error: item.error,
      })),
      notes,
    })
  } catch (error) {
    console.error('Claim print data fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim for printing', details: String(error) },
      { status: 500 }
    )
  }
}
