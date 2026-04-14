import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/insurance/comparison - Returns claim volume comparison by insurance company
export async function GET() {
  try {
    // Get all claims grouped by insurance company with status breakdown
    const claims = await db.claim.findMany({
      where: {
        insuranceCompanyId: { not: null },
      },
      select: {
        id: true,
        insuranceCompanyId: true,
        status: true,
        confidenceScore: true,
      },
    })

    // Group by insurance company
    const companyMap: Record<string, {
      ids: Set<string>
      statusBreakdown: Record<string, number>
      totalConfidence: number
    }> = {}

    for (const claim of claims) {
      const companyId = claim.insuranceCompanyId!
      if (!companyMap[companyId]) {
        companyMap[companyId] = {
          ids: new Set(),
          statusBreakdown: {},
          totalConfidence: 0,
        }
      }
      companyMap[companyId].ids.add(claim.id)
      companyMap[companyId].statusBreakdown[claim.status] =
        (companyMap[companyId].statusBreakdown[claim.status] || 0) + 1
      companyMap[companyId].totalConfidence += claim.confidenceScore
    }

    // Get company names
    const companyIds = Object.keys(companyMap)
    const companies = companyIds.length > 0
      ? await db.insuranceCompany.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true },
        })
      : []

    const companyNameMap: Record<string, string> = {}
    for (const company of companies) {
      companyNameMap[company.id] = company.name
    }

    // Build result array, sorted by total claims descending
    const result = Object.entries(companyMap)
      .map(([id, data]) => {
        const totalClaims = data.ids.size
        return {
          company: companyNameMap[id] || 'Unknown',
          totalClaims,
          statusBreakdown: {
            NEW: data.statusBreakdown['NEW'] || 0,
            PROCESSING: data.statusBreakdown['PROCESSING'] || 0,
            MANUAL_REVIEW: data.statusBreakdown['MANUAL_REVIEW'] || 0,
            COMPLETED: data.statusBreakdown['COMPLETED'] || 0,
          },
          avgConfidence: totalClaims > 0
            ? Math.round(data.totalConfidence / totalClaims)
            : 0,
        }
      })
      .sort((a, b) => b.totalClaims - a.totalClaims)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Insurance comparison error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insurance comparison', details: String(error) },
      { status: 500 }
    )
  }
}
