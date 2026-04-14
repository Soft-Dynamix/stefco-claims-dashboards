import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/[id] - Get single claim with all relations
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

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('Claim fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim', details: String(error) },
      { status: 500 }
    )
  }
}

// PUT /api/claims/[id] - Update claim fields
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check claim exists
    const existingClaim = await db.claim.findUnique({ where: { id } })
    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    // Build update data - only include fields that are provided
    const allowedFields = [
      'clientName', 'claimType', 'status', 'senderEmail', 'emailSubject',
      'contactNumber', 'contactEmail', 'incidentDescription', 'excessAmount',
      'specialInstructions', 'folderPath', 'vehicleMake', 'vehicleModel',
      'vehicleYear', 'vehicleRegistration', 'propertyAddress',
      'attachmentsCount', 'documentsPrinted', 'confidenceScore',
      'aiClassification', 'aiClassificationConfidence', 'processingStage',
      'notes', 'insuranceCompanyId',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Set processedAt when status changes to COMPLETED
    if (updateData.status === 'COMPLETED') {
      updateData.processedAt = new Date()
    }

    const claim = await db.claim.update({
      where: { id },
      data: updateData,
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    return NextResponse.json({ claim })
  } catch (error) {
    console.error('Claim update error:', error)
    return NextResponse.json(
      { error: 'Failed to update claim', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE /api/claims/[id] - Soft delete (set status to FAILED)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingClaim = await db.claim.findUnique({ where: { id } })
    if (!existingClaim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    const claim = await db.claim.update({
      where: { id },
      data: {
        status: 'FAILED',
        notes: existingClaim.notes
          ? `${existingClaim.notes}\n\n[SOFT DELETED at ${new Date().toISOString()}]`
          : `[SOFT DELETED at ${new Date().toISOString()}]`,
      },
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    // Create audit log for soft delete
    await db.auditLog.create({
      data: {
        claimId: id,
        action: 'claim_soft_deleted',
        details: `Claim ${claim.claimNumber} was soft deleted`,
        status: 'WARNING',
        processedBy: 'MANUAL',
      },
    })

    return NextResponse.json({ claim, message: 'Claim soft deleted successfully' })
  } catch (error) {
    console.error('Claim delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete claim', details: String(error) },
      { status: 500 }
    )
  }
}
