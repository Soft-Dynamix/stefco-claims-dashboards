/**
 * Sender Patterns API
 *
 * GET  /api/sender-patterns              - Get all sender patterns
 * GET  /api/sender-patterns?senderDomain=x - Get pattern by domain
 * GET  /api/sender-patterns?includeStats=true - Include per-domain stats
 * POST /api/sender-patterns              - Create or update sender pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET: Query sender patterns ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const senderDomain = searchParams.get('senderDomain')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const includeStats = searchParams.get('includeStats') === 'true'

    if (senderDomain) {
      // Get single sender pattern by domain
      const pattern = await db.senderPattern.findUnique({
        where: { senderDomain },
        include: {
          insuranceCompany: {
            select: { id: true, name: true, folderName: true },
          },
        },
      })

      if (!pattern) {
        return NextResponse.json({ pattern: null, message: 'No pattern found for this domain' })
      }

      let stats = null
      if (includeStats) {
        stats = await getDomainStats(senderDomain)
      }

      return NextResponse.json({ pattern, stats })
    }

    // Get all sender patterns
    const patterns = await db.senderPattern.findMany({
      orderBy: { totalEmails: 'desc' },
      take: limit,
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    // Optionally include stats for all patterns
    let allStats = null
    if (includeStats && patterns.length > 0) {
      allStats = {}
      for (const p of patterns) {
        allStats[p.senderDomain] = await getDomainStats(p.senderDomain)
      }
    }

    return NextResponse.json({
      patterns,
      total: patterns.length,
      stats: allStats,
    })
  } catch (error) {
    console.error('[sender-patterns-api] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to query sender patterns', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── POST: Create or update sender pattern ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.senderDomain) {
      return NextResponse.json(
        { error: 'Missing required field: senderDomain' },
        { status: 400 },
      )
    }

    // Upsert by senderDomain
    const pattern = await db.senderPattern.upsert({
      where: { senderDomain: body.senderDomain },
      update: {
        insuranceCompanyId: body.insuranceCompanyId ?? undefined,
        totalEmails: body.totalEmails ?? undefined,
        newClaimCount: body.newClaimCount ?? undefined,
        followUpCount: body.followUpCount ?? undefined,
        missingInfoCount: body.missingInfoCount ?? undefined,
        ignoreCount: body.ignoreCount ?? undefined,
        otherCount: body.otherCount ?? undefined,
        correctedCount: body.correctedCount ?? undefined,
        typicalSubjectPatterns: body.typicalSubjectPatterns ? JSON.stringify(body.typicalSubjectPatterns) : undefined,
        claimNumberRegex: body.claimNumberRegex ?? undefined,
        classificationHints: body.classificationHints ? JSON.stringify(body.classificationHints) : undefined,
        newClaimIndicators: body.newClaimIndicators ? JSON.stringify(body.newClaimIndicators) : undefined,
        followUpIndicators: body.followUpIndicators ? JSON.stringify(body.followUpIndicators) : undefined,
        accuracyRate: body.accuracyRate ?? undefined,
        avgConfidence: body.avgConfidence ?? undefined,
        lastSeenAt: body.lastSeenAt ? new Date(body.lastSeenAt) : new Date(),
        updatedAt: new Date(),
      },
      create: {
        senderDomain: body.senderDomain,
        insuranceCompanyId: body.insuranceCompanyId || null,
        totalEmails: body.totalEmails || 0,
        newClaimCount: body.newClaimCount || 0,
        followUpCount: body.followUpCount || 0,
        missingInfoCount: body.missingInfoCount || 0,
        ignoreCount: body.ignoreCount || 0,
        otherCount: body.otherCount || 0,
        correctedCount: body.correctedCount || 0,
        typicalSubjectPatterns: body.typicalSubjectPatterns ? JSON.stringify(body.typicalSubjectPatterns) : null,
        claimNumberRegex: body.claimNumberRegex || null,
        classificationHints: body.classificationHints ? JSON.stringify(body.classificationHints) : null,
        newClaimIndicators: body.newClaimIndicators ? JSON.stringify(body.newClaimIndicators) : null,
        followUpIndicators: body.followUpIndicators ? JSON.stringify(body.followUpIndicators) : null,
        accuracyRate: body.accuracyRate || 0,
        avgConfidence: body.avgConfidence || 0,
        lastSeenAt: new Date(),
      },
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    return NextResponse.json({ success: true, pattern })
  } catch (error) {
    console.error('[sender-patterns-api] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create/update sender pattern', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── Internal: Get per-domain stats ────────────────────────────────────────

async function getDomainStats(senderDomain: string) {
  const entries = await db.classificationKnowledge.findMany({
    where: { senderDomain, isActive: true },
    select: {
      originalClassification: true,
      correctedClassification: true,
      confidence: true,
      isCorrected: true,
      source: true,
    },
  })

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      byClassification: {},
      bySource: {},
      correctedCount: 0,
      accuracyRate: 100,
      avgConfidence: 0,
    }
  }

  const byClassification: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  let correctedCount = 0
  let confidenceSum = 0

  for (const entry of entries) {
    byClassification[entry.originalClassification] = (byClassification[entry.originalClassification] || 0) + 1
    bySource[entry.source] = (bySource[entry.source] || 0) + 1
    if (entry.isCorrected) correctedCount++
    confidenceSum += entry.confidence
  }

  return {
    totalEntries: entries.length,
    byClassification,
    bySource,
    correctedCount,
    accuracyRate: Math.round(((entries.length - correctedCount) / entries.length) * 1000) / 10,
    avgConfidence: Math.round((confidenceSum / entries.length) * 10) / 10,
  }
}
