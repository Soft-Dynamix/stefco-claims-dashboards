import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/export - Export claims as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const claimType = searchParams.get('claimType')
    const search = searchParams.get('search')
    const insuranceCompany = searchParams.get('insuranceCompany')
    const insuranceCompanyId = searchParams.get('insuranceCompanyId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

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
    if (insuranceCompanyId) {
      where.insuranceCompanyId = insuranceCompanyId
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

    const claims = await db.claim.findMany({
      where,
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // CSV headers
    const headers = [
      'Claim Number',
      'Client Name',
      'Claim Type',
      'Status',
      'Insurance Company',
      'Confidence Score',
      'Processing Stage',
      'Attachments',
      'Contact Email',
      'Contact Number',
      'Created At',
      'Updated At',
    ]

    // Escape CSV values
    const escapeCsv = (value: unknown): string => {
      const str = value === null || value === undefined ? '' : String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvRows: string[] = []
    csvRows.push(headers.map(escapeCsv).join(','))

    for (const claim of claims) {
      const row = [
        claim.claimNumber,
        claim.clientName,
        claim.claimType,
        claim.status,
        claim.insuranceCompany?.name || '',
        claim.confidenceScore,
        claim.processingStage,
        claim.attachmentsCount,
        claim.contactEmail || '',
        claim.contactNumber || '',
        claim.createdAt.toISOString(),
        claim.updatedAt.toISOString(),
      ]
      csvRows.push(row.map(escapeCsv).join(','))
    }

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="claims-export-${timestamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('Claims export error:', error)
    return NextResponse.json(
      { error: 'Failed to export claims', details: String(error) },
      { status: 500 }
    )
  }
}
