import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/print-queue - List print queue items with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const claimId = searchParams.get('claimId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)

    const where: Record<string, unknown> = {}

    if (status) {
      where.printStatus = status
    }
    if (claimId) {
      where.claimId = claimId
    }

    const skip = (page - 1) * limit

    const [printQueueItems, total] = await Promise.all([
      db.printQueueItem.findMany({
        where,
        include: {
          claim: {
            select: {
              claimNumber: true,
              clientName: true,
              claimType: true,
              status: true,
              insuranceCompany: {
                select: { name: true, folderName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.printQueueItem.count({ where }),
    ])

    return NextResponse.json({
      printQueueItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Print queue list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch print queue', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/print-queue - Add item to print queue
const createPrintItemSchema = z.object({
  claimId: z.string().min(1, 'Claim ID is required'),
  fileName: z.string().min(1, 'File name is required'),
  filePath: z.string().optional(),
  pages: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = createPrintItemSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { claimId, fileName, filePath, pages } = result.data

    // Verify claim exists
    const claim = await db.claim.findUnique({ where: { id: claimId } })
    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    const printItem = await db.printQueueItem.create({
      data: {
        claimId,
        fileName,
        filePath,
        pages,
        printStatus: 'QUEUED',
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        claimId,
        action: 'print_queued',
        details: `Document "${fileName}" added to print queue for claim ${claim.claimNumber}`,
        status: 'SUCCESS',
        processedBy: 'AUTO',
      },
    })

    return NextResponse.json({ printItem }, { status: 201 })
  } catch (error) {
    console.error('Print queue creation error:', error)
    return NextResponse.json(
      { error: 'Failed to add item to print queue', details: String(error) },
      { status: 500 }
    )
  }
}
