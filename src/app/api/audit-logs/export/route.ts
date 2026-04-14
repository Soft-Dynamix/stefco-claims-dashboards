import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit-logs/export - Export audit logs as CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { details: { contains: search } },
        { processedBy: { contains: search } },
      ]
    }

    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // CSV headers
    const headers = [
      'id',
      'action',
      'details',
      'status',
      'claimNumber',
      'clientName',
      'processedBy',
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

    for (const log of auditLogs) {
      const row = [
        log.id,
        log.action,
        log.details || '',
        log.status,
        log.claim?.claimNumber || '',
        log.claim?.clientName || '',
        log.processedBy || 'SYSTEM',
        log.createdAt.toISOString(),
      ]
      csvRows.push(row.map(escapeCsv).join(','))
    }

    const csvContent = csvRows.join('\n')
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_logs_export_${timestamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('Audit logs export error:', error)
    return NextResponse.json(
      { error: 'Failed to export audit logs', details: String(error) },
      { status: 500 }
    )
  }
}
