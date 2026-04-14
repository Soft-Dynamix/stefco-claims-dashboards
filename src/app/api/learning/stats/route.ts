import { NextResponse } from 'next/server'
import { getLearningStats } from '@/lib/learning-engine'
import { db } from '@/lib/db'

/**
 * Custom JSON serialization that handles BigInt values.
 */
function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? Number(value) : value
  )
}

/**
 * GET /api/learning/stats
 *
 * Get comprehensive self-learning system statistics.
 */
export async function GET() {
  try {
    const stats = await getLearningStats()

    // Additional: get recent feedback activity
    const recentFeedback = await db.claimFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
            senderEmail: true,
          },
        },
      },
    })

    // Get pattern coverage per insurance company
    const companyPatternsRaw = await db.$queryRaw<Array<{
      name: string
      patternCount: unknown
    }>>`
      SELECT ic.name, COUNT(lp.id) as patternCount
      FROM InsuranceCompany ic
      LEFT JOIN LearningPattern lp ON lp.insuranceCompanyId = ic.id
      GROUP BY ic.id, ic.name
      ORDER BY patternCount DESC
      LIMIT 10
    `

    // Convert raw BigInt values to numbers
    const companyPatterns = companyPatternsRaw.map((row) => ({
      name: row.name,
      patternCount: Number(row.patternCount),
    }))

    // Build response object with all BigInt values converted
    const response = {
      stats: {
        ...stats,
        accuracyTrend: {
          ...stats.accuracyTrend,
          avgConfidenceAll: Number(stats.accuracyTrend.avgConfidenceAll),
          avgConfidenceRecent: Number(stats.accuracyTrend.avgConfidenceRecent),
          improvement: Number(stats.accuracyTrend.improvement),
        },
      },
      recentFeedback: recentFeedback.map((f) => ({
        ...f,
        id: f.id,
        aiConfidence: f.aiConfidence != null ? Number(f.aiConfidence) : null,
      })),
      companyPatterns,
    }

    return new NextResponse(safeJsonStringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Learning stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning stats', details: String(error) },
      { status: 500 }
    )
  }
}
