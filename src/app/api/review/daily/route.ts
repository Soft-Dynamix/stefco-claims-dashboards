import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/review/daily
 *
 * Returns all claims created today for the Daily Email Review Sheet.
 * Uses claim.reviewAction field (populated by feedback endpoint).
 * Includes AI decision data, confidence breakdowns, and review status.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'

    // Get today's date range (SA timezone aware)
    const now = new Date()
    const saTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' })
    )
    const startOfDay = new Date(saTime.getFullYear(), saTime.getMonth(), saTime.getDate())
    const endOfDay = new Date(saTime.getFullYear(), saTime.getMonth(), saTime.getDate() + 1)

    const todayWhere = {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    }

    // Build filter-specific where clause
    let whereClause: any = { ...todayWhere }

    switch (filter) {
      case 'needs_review':
        whereClause = { ...todayWhere, reviewAction: null as unknown as string }
        break
      case 'low_confidence':
        whereClause = { ...todayWhere, confidenceScore: { lt: 50 } }
        break
      case 'accepted':
        whereClause = { ...todayWhere, reviewAction: 'accepted' }
        break
      case 'corrected':
        whereClause = { ...todayWhere, reviewAction: 'corrected' }
        break
      case 'flagged':
        whereClause = { ...todayWhere, reviewAction: 'flagged_for_review' }
        break
    }

    // Fetch filtered claims
    const claims = await db.claim.findMany({
      where: whereClause,
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Get counts for all today's claims (unfiltered) for summary
    const totalCounts = await db.claim.groupBy({
      by: ['reviewAction'],
      where: todayWhere,
      _count: true,
    })

    const avgConfResult = await db.claim.aggregate({
      where: todayWhere,
      _avg: { confidenceScore: true },
    })

    // Build summary counts
    const allCount = totalCounts.find((c) => c.reviewAction === null)?._count ?? 0
    const acceptedCount = totalCounts.find((c) => c.reviewAction === 'accepted')?._count ?? 0
    const correctedCount = totalCounts.find((c) => c.reviewAction === 'corrected')?._count ?? 0
    const flaggedCount = totalCounts.find((c) => c.reviewAction === 'flagged_for_review')?._count ?? 0
    const skippedCount = totalCounts.find((c) => c.reviewAction === 'skipped')?._count ?? 0

    const total = totalCounts.reduce((sum, c) => sum + c._count, 0)
    const reviewed = total - allCount
    const unreviewed = allCount

    // Low confidence count (needs separate query)
    let lowConfidenceCount = 0
    if (filter === 'all') {
      const lowConf = await db.claim.count({
        where: { ...todayWhere, confidenceScore: { lt: 50 } },
      })
      lowConfidenceCount = lowConf
    } else if (filter === 'low_confidence') {
      lowConfidenceCount = claims.length
    }

    const filterCounts = {
      all: total,
      needs_review: unreviewed,
      low_confidence: lowConfidenceCount,
      accepted: acceptedCount,
      corrected: correctedCount,
      flagged: flaggedCount,
    }

    return NextResponse.json({
      claims,
      summary: {
        total,
        reviewed,
        unreviewed,
        avgConfidence: avgConfResult._avg.confidenceScore
          ? Math.round(avgConfResult._avg.confidenceScore)
          : 0,
        filterCounts,
      },
      date: saTime.toISOString(),
    })
  } catch (error) {
    console.error('Review daily fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily review data', details: String(error) },
      { status: 500 }
    )
  }
}
