import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/quick-counts - Return counts for quick filter chips
export async function GET() {
  try {
    const now = new Date()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [urgent, recent, stale, highValue, needsAttention, verified] = await Promise.all([
      // Urgent: confidence < 60%
      db.claim.count({
        where: {
          confidenceScore: { lt: 60 },
          status: { not: 'COMPLETED' },
        },
      }),
      // Recent: created in the last 7 days
      db.claim.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      // Stale: no activity (updatedAt) for 30+ days
      db.claim.count({
        where: { updatedAt: { lte: thirtyDaysAgo } },
      }),
      // High Value: excessAmount > R50,000
      db.claim.count({
        where: {
          excessAmount: { not: null },
        },
      }),
      // Needs Attention: flagged claims that are not verified
      db.claim.count({
        where: {
          needsAttention: true,
          verifiedByUser: false,
        },
      }),
      // Verified: user-verified claims
      db.claim.count({
        where: {
          verifiedByUser: true,
        },
      }),
    ])

    // For high value, we need to manually filter since excessAmount is stored as text in SQLite
    const allWithAmount = await db.claim.findMany({
      where: { excessAmount: { not: null } },
      select: { excessAmount: true },
    })

    const highValueFiltered = allWithAmount.filter((c) => {
      const amt = parseFloat(c.excessAmount?.replace(/[^0-9.-]/g, '') || '0')
      return amt > 50000
    }).length

    return NextResponse.json({
      urgent,
      recent,
      stale,
      highValue: highValueFiltered,
      needsAttention,
      verified,
    })
  } catch (error) {
    console.error('Quick counts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quick counts', details: String(error) },
      { status: 500 }
    )
  }
}
