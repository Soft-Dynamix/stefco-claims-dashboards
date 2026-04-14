import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/activity-feed - Latest 20 audit logs with claim info
export async function GET() {
  try {
    const activities = await db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
          },
        },
      },
    })

    return NextResponse.json({
      activities: activities.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        status: log.status,
        claimNumber: log.claim?.claimNumber || null,
        clientName: log.claim?.clientName || null,
        createdAt: log.createdAt,
      })),
    })
  } catch (error) {
    console.error('Activity feed error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity feed', details: String(error) },
      { status: 500 }
    )
  }
}
