import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/insurance/export - Export insurance companies as CSV
export async function GET() {
  try {
    const companies = await db.insuranceCompany.findMany({
      include: {
        _count: {
          select: { claims: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // CSV headers
    const headers = [
      'name',
      'folderName',
      'senderDomains',
      'isActive',
      'claimsCount',
      'createdAt',
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

    for (const company of companies) {
      const row = [
        company.name,
        company.folderName,
        company.senderDomains || '',
        company.isActive ? 'Yes' : 'No',
        company._count.claims,
        company.createdAt.toISOString(),
      ]
      csvRows.push(row.map(escapeCsv).join(','))
    }

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="insurance_export_${timestamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('Insurance export error:', error)
    return NextResponse.json(
      { error: 'Failed to export insurance companies', details: String(error) },
      { status: 500 }
    )
  }
}
