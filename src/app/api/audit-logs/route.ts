import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit-logs - List audit logs with optional filtering and summary stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const claimId = searchParams.get('claimId')
    const status = searchParams.get('status')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)

    const where: Record<string, unknown> = {}

    if (claimId) {
      where.claimId = claimId
    }
    if (status) {
      where.status = status
    }
    if (action) {
      const actions = action.split(',').map((a) => a.trim()).filter(Boolean)
      if (actions.length === 1) {
        where.action = actions[0]
      } else if (actions.length > 1) {
        where.action = { in: actions }
      }
    }

    const skip = (page - 1) * limit

    // For filtered queries, we still compute summary on the overall (unfiltered) dataset
    // so stats remain consistent regardless of user-applied filters
    const [auditLogs, total, overallCounts] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          claim: {
            select: {
              claimNumber: true,
              clientName: true,
              claimType: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.auditLog.count({ where }),
      // Overall summary counts (unfiltered)
      db.auditLog.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
    ])

    // Build summary from groupBy result
    let totalEntries = 0
    let successCount = 0
    let warningCount = 0
    let errorCount = 0

    for (const group of overallCounts) {
      const count = group._count.status
      totalEntries += count
      if (group.status === 'SUCCESS') successCount = count
      else if (group.status === 'WARNING') warningCount = count
      else if (group.status === 'ERROR') errorCount = count
    }

    const successRate = totalEntries > 0
      ? Math.round((successCount / totalEntries) * 1000) / 10
      : 0

    return NextResponse.json({
      auditLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalEntries,
        successCount,
        warningCount,
        errorCount,
        successRate,
      },
    })
  } catch (error) {
    console.error('Audit logs list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: String(error) },
      { status: 500 }
    )
  }
}
