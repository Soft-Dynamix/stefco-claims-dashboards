import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const AGE_BRACKETS = [
  { label: '0-7 days', minDays: 0, maxDays: 7 },
  { label: '8-30 days', minDays: 8, maxDays: 30 },
  { label: '31-60 days', minDays: 31, maxDays: 60 },
  { label: '61-90 days', minDays: 61, maxDays: 90 },
  { label: '90+ days', minDays: 91, maxDays: Infinity },
]

const CLAIM_STATUSES = ['NEW', 'PROCESSING', 'COMPLETED', 'MANUAL_REVIEW', 'FAILED', 'PENDING_REVIEW']

// GET /api/claims/aging - Claim aging report with confidence and status breakdown
export async function GET() {
  try {
    const now = new Date()

    // Fetch all claims with status, createdAt, and confidenceScore
    const claims = await db.claim.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        confidenceScore: true,
      },
    })

    // Build aging buckets
    interface AgingBucket {
      label: string
      minDays: number
      maxDays: number
      count: number
      avgConfidence: number
      statuses: Record<string, number>
      [key: string]: unknown
    }

    const buckets: AgingBucket[] = AGE_BRACKETS.map((bracket) => ({
      label: bracket.label,
      minDays: bracket.minDays,
      maxDays: bracket.maxDays,
      count: 0,
      avgConfidence: 0,
      statuses: {},
    }))

    let totalAgeDays = 0
    let totalAged = 0
    let criticalCount = 0

    for (const claim of claims) {
      const ageMs = now.getTime() - new Date(claim.createdAt).getTime()
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))

      totalAgeDays += ageDays
      totalAged++

      if (ageDays > 30) criticalCount++

      // Find matching bucket
      for (const bucket of buckets) {
        if (ageDays >= bucket.minDays && ageDays <= bucket.maxDays) {
          bucket.count++
          // Track confidence sum (we'll average later)
          bucket._confidenceSum = (bucket._confidenceSum as number || 0) + claim.confidenceScore
          // Track status breakdown
          bucket.statuses[claim.status] = (bucket.statuses[claim.status] || 0) + 1
          break
        }
      }
    }

    // Calculate averages
    for (const bucket of buckets) {
      bucket.avgConfidence = bucket.count > 0
        ? Math.round(((bucket._confidenceSum as number) || 0) / bucket.count)
        : 0
      delete bucket._confidenceSum
    }

    const avgAge = totalAged > 0 ? Math.round(totalAgeDays / totalAged) : 0

    // Also return the original status-based aging for backwards compatibility
    const legacyBrackets = [
      { label: '0-1 day', minHours: 0, maxHours: 24 },
      { label: '1-3 days', minHours: 24, maxHours: 72 },
      { label: '3-7 days', minHours: 72, maxHours: 168 },
      { label: '7+ days', minHours: 168, maxHours: Infinity },
    ]

    const aging: Record<string, { brackets: { label: string; count: number; minHours: number; maxHours: number }[] }> = {}

    for (const status of CLAIM_STATUSES) {
      aging[status] = {
        brackets: legacyBrackets.map((bracket) => ({
          label: bracket.label,
          count: 0,
          minHours: bracket.minHours,
          maxHours: bracket.maxHours,
        })),
      }
    }

    for (const claim of claims) {
      const status = claim.status
      if (!aging[status]) {
        aging[status] = {
          brackets: legacyBrackets.map((bracket) => ({
            label: bracket.label,
            count: 0,
            minHours: bracket.minHours,
            maxHours: bracket.maxHours,
          })),
        }
      }

      const ageMs = now.getTime() - new Date(claim.createdAt).getTime()
      const ageHours = ageMs / (1000 * 60 * 60)

      for (const bracket of aging[status].brackets) {
        if (ageHours >= bracket.minHours && ageHours < bracket.maxHours) {
          bracket.count++
          break
        }
      }
    }

    return NextResponse.json({
      buckets,
      summary: {
        totalAged,
        avgAge,
        criticalCount,
      },
      aging, // legacy format for backwards compat
    })
  } catch (error) {
    console.error('Claims aging error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claim aging data', details: String(error) },
      { status: 500 }
    )
  }
}
