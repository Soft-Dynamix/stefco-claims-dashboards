import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/aging-summary - Returns aging buckets and top 3 most overdue claims
export async function GET() {
  try {
    const now = new Date()

    // Time thresholds
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Active statuses (exclude COMPLETED and FAILED)
    const activeStatuses = ['NEW', 'PROCESSING', 'MANUAL_REVIEW', 'PENDING_REVIEW']

    // Query claims with their active status, grouped by aging bucket
    // We use updatedAt as the "last activity" timestamp
    const [critical, warning, normal, recent] = await Promise.all([
      // Critical: updated 7+ days ago and still active
      db.claim.count({
        where: {
          status: { in: activeStatuses },
          updatedAt: { lt: sevenDaysAgo },
        },
      }),
      // Warning: updated 3-7 days ago and still active
      db.claim.count({
        where: {
          status: { in: activeStatuses },
          updatedAt: { gte: sevenDaysAgo, lt: threeDaysAgo },
        },
      }),
      // Normal: updated 1-3 days ago and still active
      db.claim.count({
        where: {
          status: { in: activeStatuses },
          updatedAt: { gte: threeDaysAgo, lt: oneDayAgo },
        },
      }),
      // Recent: updated within 24 hours
      db.claim.count({
        where: {
          updatedAt: { gte: twentyFourHoursAgo },
        },
      }),
    ])

    // Top 3 most overdue claims (oldest updatedAt, active statuses only)
    const overdueClaims = await db.claim.findMany({
      where: {
        status: { in: activeStatuses },
        updatedAt: { lt: oneDayAgo },
      },
      select: {
        id: true,
        claimNumber: true,
        clientName: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 3,
    })

    // Calculate days overdue for each claim
    const overdue = overdueClaims.map((claim) => {
      const diffMs = now.getTime() - claim.updatedAt.getTime()
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: claim.id,
        claimNumber: claim.claimNumber,
        clientName: claim.clientName,
        daysOverdue,
        status: claim.status,
      }
    })

    const totalOverdue = critical + warning + normal

    return NextResponse.json({
      counts: {
        critical,
        warning,
        normal,
        recent,
        totalOverdue,
      },
      overdue,
    })
  } catch (error) {
    console.error('Aging summary error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch aging summary', details: String(error) },
      { status: 500 }
    )
  }
}
