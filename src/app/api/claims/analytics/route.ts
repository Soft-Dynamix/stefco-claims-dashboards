import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/claims/analytics - Return detailed analytics data
export async function GET() {
  try {
    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Run all queries in parallel
    const [
      claimsByStatus,
      allClaimsWithCompany,
      topClients,
      dailyTypeTrend,
      processingTimesByStatus,
      completedClaimsWithTimes,
      totalActiveClaims,
      pendingReviews,
      docsPrintedToday,
    ] = await Promise.all([
      // Claims count by status
      db.claim.groupBy({
        by: ['status'],
        _count: true,
      }),
      // All claims with insurance company for company breakdown
      db.claim.findMany({
        select: {
          id: true,
          status: true,
          claimType: true,
          createdAt: true,
          processedAt: true,
          clientName: true,
          insuranceCompanyId: true,
          confidenceScore: true,
        },
      }),
      // Top 5 clients by claim count
      db.claim.groupBy({
        by: ['clientName'],
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Daily claim type breakdown for 14 days
      db.claim.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { claimType: true, createdAt: true },
      }),
      // Processing times by status
      db.claim.findMany({
        where: { processedAt: { not: null } },
        select: { status: true, createdAt: true, processedAt: true },
        take: 200,
        orderBy: { processedAt: 'desc' },
      }),
      // Completed claims for efficiency calculation
      db.claim.findMany({
        where: {
          status: { in: ['COMPLETED', 'MANUAL_REVIEW', 'PENDING_REVIEW'] },
          processedAt: { not: null },
        },
        select: { createdAt: true, processedAt: true },
        take: 200,
      }),
      // Total active claims
      db.claim.count({
        where: { status: { in: ['NEW', 'PROCESSING', 'MANUAL_REVIEW', 'PENDING_REVIEW'] } },
      }),
      // Pending reviews
      db.claim.count({
        where: { status: { in: ['MANUAL_REVIEW', 'PENDING_REVIEW'] } },
      }),
      // Documents printed today
      db.claim.count({
        where: {
          documentsPrinted: true,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
    ])

    // 1. Average processing time by status
    const statusTimes: Record<string, { totalMs: number; count: number }> = {}
    for (const claim of processingTimesByStatus) {
      if (claim.processedAt && claim.createdAt) {
        const ms = claim.processedAt.getTime() - claim.createdAt.getTime()
        if (!statusTimes[claim.status]) {
          statusTimes[claim.status] = { totalMs: 0, count: 0 }
        }
        statusTimes[claim.status].totalMs += ms
        statusTimes[claim.status].count++
      }
    }
    const avgProcessingByStatus = Object.entries(statusTimes).map(
      ([status, { totalMs, count }]) => ({
        status,
        avgHours: Math.round((totalMs / count / (1000 * 60)) * 10) / 10,
        avgMinutes: Math.round(totalMs / count / (1000 * 60)),
        count,
      })
    )

    // 2. Claims by insurance company breakdown
    const companyIds = [...new Set(allClaimsWithCompany.map((c) => c.insuranceCompanyId).filter(Boolean))]
    const companies =
      companyIds.length > 0
        ? await db.insuranceCompany.findMany({
            where: { id: { in: companyIds } },
            select: { id: true, name: true, folderName: true },
          })
        : []
    const companyMap = new Map(companies.map((c) => [c.id, c.name]))

    const claimsByCompany = allClaimsWithCompany.reduce<Record<string, { total: number; active: number; completed: number }>>((acc, claim) => {
      const name = claim.insuranceCompanyId ? companyMap.get(claim.insuranceCompanyId) || 'Unknown' : 'Unassigned'
      if (!acc[name]) acc[name] = { total: 0, active: 0, completed: 0 }
      acc[name].total++
      if (['NEW', 'PROCESSING', 'MANUAL_REVIEW', 'PENDING_REVIEW'].includes(claim.status)) acc[name].active++
      if (claim.status === 'COMPLETED') acc[name].completed++
      return acc
    }, {})

    const companyBreakdown = Object.entries(claimsByCompany)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)

    // 3. Claim type distribution over time (daily for last 14 days)
    const typeDailyMap: Record<string, Record<string, number>> = {}
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      typeDailyMap[dateKey] = {}
    }
    for (const claim of dailyTypeTrend) {
      const dateKey = claim.createdAt.toISOString().split('T')[0]
      if (typeDailyMap[dateKey] !== undefined) {
        typeDailyMap[dateKey][claim.claimType] = (typeDailyMap[dateKey][claim.claimType] || 0) + 1
      }
    }
    const claimTypes = [...new Set(dailyTypeTrend.map((c) => c.claimType))]
    const claimTypeOverTime = Object.entries(typeDailyMap).map(([date, types]) => ({
      date,
      ...Object.fromEntries(claimTypes.map((t) => [t, types[t] || 0])),
    }))

    // 4. Top 5 clients by claim count
    const topClientsList = topClients.map((c) => ({
      name: c.clientName || 'Unknown',
      count: c._count.id,
      percentage: Math.round((c._count.id / allClaimsWithCompany.length) * 100),
    }))

    // 5. Processing efficiency score (% completed within 2 hours = 120 minutes)
    const twoHoursInMs = 2 * 60 * 60 * 1000
    const withinSLA = completedClaimsWithTimes.filter(
      (c) => c.processedAt && c.processedAt.getTime() - c.createdAt.getTime() <= twoHoursInMs
    ).length
    const processingEfficiency = completedClaimsWithTimes.length > 0
      ? Math.round((withinSLA / completedClaimsWithTimes.length) * 100)
      : 0

    // 6. Status summary
    const statusSummary = claimsByStatus.map((s) => ({
      status: s.status,
      count: s._count,
      percentage: Math.round((s._count / allClaimsWithCompany.length) * 100),
    }))

    // 7. Average confidence score
    const avgConfidence = allClaimsWithCompany.length > 0
      ? Math.round(allClaimsWithCompany.reduce((sum, c) => sum + c.confidenceScore, 0) / allClaimsWithCompany.length)
      : 0

    // Build velocity data from daily type distribution
    const velocityData = Object.entries(typeDailyMap).map(([date, types]) => ({
      date,
      count: Object.values(types).reduce((sum, c) => sum + c, 0),
    }))

    // Efficiency calculation
    const totalProcessed = completedClaimsWithTimes.length
    const within2h = totalProcessed > 0
      ? completedClaimsWithTimes.filter(
          (c) => c.processedAt && c.processedAt.getTime() - c.createdAt.getTime() <= twoHoursInMs
        ).length
      : 0

    return NextResponse.json({
      avgProcessingByStatus,
      claimsByCompany: companyBreakdown,
      claimTypeOverTime,
      topClients: topClientsList,
      processingEfficiency,
      statusSummary,
      totalActiveClaims,
      pendingReviews,
      documentsPrintedToday: docsPrintedToday,
      avgConfidence,
      totalClaims: allClaimsWithCompany.length,
      velocityData,
      totalCompleted: totalProcessed,
      completedWithin2h: within2h,
    })
  } catch (error) {
    console.error('Claims analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: String(error) },
      { status: 500 }
    )
  }
}
