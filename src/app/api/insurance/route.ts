import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/insurance - List all insurance companies
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get('all') === 'true'

    const companies = await db.insuranceCompany.findMany({
      where: includeAll ? {} : { isActive: true },
      include: {
        _count: {
          select: { claims: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ companies })
  } catch (error) {
    console.error('Insurance companies list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance companies', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/insurance - Create new insurance company
const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  folderName: z.string().min(1, 'Folder name is required'),
  senderDomains: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = createCompanySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const data = result.data

    // Check for duplicate folder name
    const existing = await db.insuranceCompany.findUnique({
      where: { folderName: data.folderName },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An insurance company with this folder name already exists' },
        { status: 409 }
      )
    }

    const company = await db.insuranceCompany.create({
      data: {
        name: data.name,
        folderName: data.folderName,
        senderDomains: JSON.stringify(data.senderDomains || []),
        isActive: data.isActive,
      },
    })

    return NextResponse.json({ company }, { status: 201 })
  } catch (error) {
    console.error('Insurance company creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create insurance company', details: String(error) },
      { status: 500 }
    )
  }
}
