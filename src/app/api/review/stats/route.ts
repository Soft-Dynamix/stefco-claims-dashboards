import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/review/stats
 *
 * Returns comprehensive review statistics for the Daily Email Review feature:
 * - Today: claim counts by review action, review rate
 * - Weekly: totals, most corrected fields
 * - Learning: pattern counts, top domains, recent patterns
 */
export async function GET() {
  try {
    // ── Timezone helper ──────────────────────────────────────────────────────
    const now = new Date()
    const saTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' })
    )
    const todayStart = new Date(saTime.getFullYear(), saTime.getMonth(), saTime.getDate())
    const todayEnd = new Date(saTime.getFullYear(), saTime.getMonth(), saTime.getDate(), 23, 59, 59, 999)

    // 7 days ago
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

    // ── Today stats ──────────────────────────────────────────────────────────
    const todayClaims = await db.claim.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: {
        reviewAction: true,
      },
    })

    const todayTotal = todayClaims.length
    const todayReviewed = todayClaims.filter((c) => c.reviewAction !== null).length
    const todayUnreviewed = todayTotal - todayReviewed
    const todayAccepted = todayClaims.filter((c) => c.reviewAction === 'accepted').length
    const todayCorrected = todayClaims.filter((c) => c.reviewAction === 'corrected').length
    const todayFlagged = todayClaims.filter((c) => c.reviewAction === 'flagged_for_review').length
    const todaySkipped = todayClaims.filter((c) => c.reviewAction === 'skipped').length
    const todayReviewRate = todayTotal > 0
      ? Math.round((todayReviewed / todayTotal) * 1000) / 10
      : 0

    // ── Weekly stats ─────────────────────────────────────────────────────────
    const weeklyClaims = await db.claim.findMany({
      where: {
        createdAt: { gte: weekAgo },
      },
      select: {
        id: true,
        reviewAction: true,
      },
    })

    const weeklyTotal = weeklyClaims.length
    const weeklyReviewed = weeklyClaims.filter((c) => c.reviewAction !== null).length
    const weeklyReviewRate = weeklyTotal > 0
      ? Math.round((weeklyReviewed / weeklyTotal) * 1000) / 10
      : 0

    // Most corrected fields from ClaimFeedback in the last 7 days
    const weeklyFeedback = await db.claimFeedback.findMany({
      where: {
        createdAt: { gte: weekAgo },
        feedbackType: 'field_corrected',
        fieldName: { not: null },
      },
      select: {
        fieldName: true,
      },
    })

    // Group by fieldName and count
    const fieldCounts = new Map<string, number>()
    for (const fb of weeklyFeedback) {
      if (fb.fieldName) {
        fieldCounts.set(fb.fieldName, (fieldCounts.get(fb.fieldName) || 0) + 1)
      }
    }

    const topCorrectedFields = Array.from(fieldCounts.entries())
      .map(([fieldName, count]) => ({ fieldName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── Learning stats ───────────────────────────────────────────────────────
    const totalPatterns = await db.learningPattern.count()

    const patternAgg = await db.learningPattern.aggregate({
      _avg: { confidence: true },
    })

    const avgPatternConfidence = patternAgg._avg.confidence
      ? Math.round(patternAgg._avg.confidence)
      : 0

    // Top domains by pattern count
    const domainPatterns = await db.learningPattern.groupBy({
      by: ['senderDomain'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })

    const topDomains = domainPatterns.map((dp) => ({
      domain: dp.senderDomain,
      patterns: dp._count.id,
    }))

    // Recent patterns (last 5 created)
    const recentPatterns = await db.learningPattern.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        fieldName: true,
        senderDomain: true,
        confidence: true,
        correctionCount: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      today: {
        total: todayTotal,
        reviewed: todayReviewed,
        unreviewed: todayUnreviewed,
        accepted: todayAccepted,
        corrected: todayCorrected,
        flagged: todayFlagged,
        skipped: todaySkipped,
        reviewRate: todayReviewRate,
      },
      weekly: {
        total: weeklyTotal,
        reviewed: weeklyReviewed,
        reviewRate: weeklyReviewRate,
        topCorrectedFields,
      },
      learning: {
        totalPatterns,
        avgPatternConfidence,
        topDomains,
        recentPatterns: recentPatterns.map((p) => ({
          id: p.id,
          fieldName: p.fieldName,
          senderDomain: p.senderDomain,
          confidence: p.confidence,
          correctionCount: p.correctionCount,
          createdAt: p.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch review stats', details: String(error) },
      { status: 500 }
    )
  }
}
