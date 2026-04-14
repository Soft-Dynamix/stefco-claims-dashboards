import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/claims - List claims with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const claimType = searchParams.get('claimType')
    const search = searchParams.get('search')
    const insuranceCompany = searchParams.get('insuranceCompany')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Quick filter params
    const confidenceMax = searchParams.get('confidenceMax')
    const staleDays = searchParams.get('staleDays')
    const minAmount = searchParams.get('minAmount')
    const claimIds = searchParams.get('claimIds')
    const needsAttention = searchParams.get('needsAttention')
    const verifiedByUser = searchParams.get('verifiedByUser')

    const where: Record<string, unknown> = {}

    if (status) {
      const statusValues = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statusValues.length === 1) {
        where.status = statusValues[0]
      } else if (statusValues.length > 1) {
        where.status = { in: statusValues }
      }
    }
    if (claimType) {
      where.claimType = claimType
    }
    if (insuranceCompany) {
      where.insuranceCompany = { folderName: insuranceCompany }
    }
    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { clientName: { contains: search } },
        { emailSubject: { contains: search } },
        { incidentDescription: { contains: search } },
      ]
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }
    if (confidenceMax) {
      where.confidenceScore = { ...(where.confidenceScore as Record<string, unknown> || {}), lt: parseInt(confidenceMax, 10) }
    }
    if (staleDays) {
      const staleDate = new Date(Date.now() - parseInt(staleDays, 10) * 24 * 60 * 60 * 1000)
      const existingDateFilter = where.createdAt as Record<string, unknown> || {}
      where.createdAt = { ...existingDateFilter, lte: staleDate }
    }
    if (minAmount) {
      where.excessAmount = { not: null }
      // For SQLite, we need to filter numerically — use a raw approach via string comparison fallback
      // SQLite stores excessAmount as text, so we filter with gte
      const minAmt = parseFloat(minAmount)
      if (!isNaN(minAmt)) {
        const existingOr = where.OR as Array<Record<string, unknown>> | undefined
        where.excessAmount = { gte: String(Math.round(minAmt)) }
      }
    }
    if (claimIds) {
      const ids = claimIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        where.id = { in: ids }
      }
    }
    if (needsAttention === 'true') {
      where.needsAttention = true
    }
    if (verifiedByUser === 'true') {
      where.verifiedByUser = true
    }

    const skip = (page - 1) * limit

    const [claims, total] = await Promise.all([
      db.claim.findMany({
        where,
        include: {
          insuranceCompany: {
            select: { id: true, name: true, folderName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.claim.count({ where }),
    ])

    return NextResponse.json({
      claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Claims list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claims', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/claims - Create a new claim
const createClaimSchema = z.object({
  claimNumber: z.string().min(1, 'Claim number is required'),
  clientName: z.string().min(1, 'Client name is required'),
  claimType: z.enum(['Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability']),
  insuranceCompanyId: z.string().optional(),
  status: z.enum(['NEW', 'PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'PENDING_REVIEW']).default('NEW'),
  senderEmail: z.string().email().optional().nullable(),
  emailSubject: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  incidentDescription: z.string().optional().nullable(),
  excessAmount: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  folderPath: z.string().optional().nullable(),
  vehicleMake: z.string().optional().nullable(),
  vehicleModel: z.string().optional().nullable(),
  vehicleYear: z.string().optional().nullable(),
  vehicleRegistration: z.string().optional().nullable(),
  propertyAddress: z.string().optional().nullable(),
  attachmentsCount: z.number().default(0),
  confidenceScore: z.number().min(0).max(100).default(0),
  aiClassification: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = createClaimSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const data = result.data

    // Check for duplicate claim number
    const existingClaim = await db.claim.findUnique({
      where: { claimNumber: data.claimNumber },
    })

    if (existingClaim) {
      return NextResponse.json(
        { error: 'A claim with this number already exists' },
        { status: 409 }
      )
    }

    const claim = await db.claim.create({
      data,
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    // Create initial audit log
    await db.auditLog.create({
      data: {
        claimId: claim.id,
        action: 'claim_created',
        details: `New claim ${claim.claimNumber} created for ${claim.clientName}`,
        status: 'SUCCESS',
        processedBy: 'MANUAL',
      },
    })

    return NextResponse.json({ claim }, { status: 201 })
  } catch (error) {
    console.error('Claim creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create claim', details: String(error) },
      { status: 500 }
    )
  }
}
