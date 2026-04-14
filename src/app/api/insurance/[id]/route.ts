import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  folderName: z.string().min(1).optional(),
  senderDomains: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// PUT /api/insurance/[id] - Update insurance company
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = updateCompanySchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Check company exists
    const existing = await db.insuranceCompany.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Insurance company not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = { ...result.data }

    // Convert senderDomains array to JSON string if provided
    if (result.data.senderDomains) {
      updateData.senderDomains = JSON.stringify(result.data.senderDomains)
    }

    const company = await db.insuranceCompany.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ company })
  } catch (error) {
    console.error('Insurance company update error:', error)
    return NextResponse.json(
      { error: 'Failed to update insurance company', details: String(error) },
      { status: 500 }
    )
  }
}
