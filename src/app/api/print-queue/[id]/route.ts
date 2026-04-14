import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const VALID_STATUSES = ['QUEUED', 'PRINTING', 'COMPLETED', 'FAILED'] as const

const updatePrintItemSchema = z.object({
  printStatus: z.enum(VALID_STATUSES),
  error: z.string().optional(),
})

// PUT /api/print-queue/[id] - Update print queue item status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = updatePrintItemSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { printStatus, error } = result.data

    // Check print item exists
    const existingItem = await db.printQueueItem.findUnique({
      where: { id },
      include: { claim: { select: { claimNumber: true } } },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Print queue item not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      printStatus,
      error: printStatus === 'FAILED' ? (error || 'Unknown error') : null,
    }

    // Set printedAt when completed
    if (printStatus === 'COMPLETED') {
      updateData.printedAt = new Date()
      updateData.error = null
    }

    const printItem = await db.printQueueItem.update({
      where: { id },
      data: updateData,
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
            insuranceCompany: { select: { name: true, folderName: true } },
          },
        },
      },
    })

    // Create audit log for status change
    if (printStatus === 'COMPLETED' || printStatus === 'FAILED') {
      await db.auditLog.create({
        data: {
          claimId: existingItem.claimId,
          action: printStatus === 'COMPLETED' ? 'print_completed' : 'print_failed',
          details: printStatus === 'COMPLETED'
            ? `Document "${existingItem.fileName}" printed successfully`
            : `Document "${existingItem.fileName}" print failed: ${error || 'Unknown error'}`,
          status: printStatus === 'COMPLETED' ? 'SUCCESS' : 'ERROR',
          processedBy: 'AUTO',
        },
      })
    }

    return NextResponse.json({ printItem })
  } catch (error) {
    console.error('Print queue update error:', error)
    return NextResponse.json(
      { error: 'Failed to update print queue item', details: String(error) },
      { status: 500 }
    )
  }
}
