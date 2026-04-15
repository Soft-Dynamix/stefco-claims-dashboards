/**
 * Knowledge Base API
 *
 * GET  /api/knowledge-base              - Query knowledge base entries (paginated)
 * GET  /api/knowledge-base?stats=true   - Get aggregate stats
 * POST /api/knowledge-base              - Create/upsert knowledge entry
 * PUT  /api/knowledge-base              - Update existing entry
 * DELETE /api/knowledge-base?id=xxx     - Delete entry by id
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET: Query entries or get stats ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stats = searchParams.get('stats') === 'true'

    if (stats) {
      return getStats()
    }

    return getEntries(searchParams)
  } catch (error) {
    console.error('[knowledge-base-api] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to query knowledge base', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── POST: Create / Upsert entry ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.senderDomain || !body.subject || !body.emailHash || !body.originalClassification) {
      return NextResponse.json(
        { error: 'Missing required fields: senderDomain, subject, emailHash, originalClassification' },
        { status: 400 },
      )
    }

    // Check for existing entry by emailHash (dedup)
    const existing = await db.classificationKnowledge.findUnique({
      where: { emailHash: body.emailHash },
    })

    let entry

    if (existing) {
      // Upsert: update classification and bump referenceCount
      entry = await db.classificationKnowledge.update({
        where: { emailHash: body.emailHash },
        data: {
          originalClassification: body.originalClassification ?? existing.originalClassification,
          referenceCount: { increment: 1 },
          confidence: body.confidence ?? existing.confidence,
          reasoning: body.reasoning ?? existing.reasoning,
          keywords: body.keywords ? JSON.stringify(body.keywords) : existing.keywords,
          followUpSignals: body.followUpSignals ? JSON.stringify(body.followUpSignals) : existing.followUpSignals,
          correctedClassification: body.correctedClassification ?? existing.correctedClassification,
          isCorrected: body.isCorrected ?? existing.isCorrected,
          source: body.source ?? existing.source,
          isActive: body.isActive ?? existing.isActive,
          claimId: body.claimId ?? existing.claimId,
          updatedAt: new Date(),
        },
      })
    } else {
      entry = await db.classificationKnowledge.create({
        data: {
          claimId: body.claimId || null,
          senderDomain: body.senderDomain,
          senderEmail: body.senderEmail || null,
          subject: body.subject,
          emailHash: body.emailHash,
          bodySnippet: body.bodySnippet ? String(body.bodySnippet).slice(0, 500) : null,
          originalClassification: body.originalClassification,
          correctedClassification: body.correctedClassification || null,
          confidence: body.confidence || 0,
          reasoning: body.reasoning || null,
          keywords: body.keywords ? JSON.stringify(body.keywords) : null,
          followUpSignals: body.followUpSignals ? JSON.stringify(body.followUpSignals) : null,
          source: body.source || 'auto',
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      })
    }

    // Update SenderPattern for this sender domain
    try {
      const { updateSenderPattern } = await import('@/lib/knowledge-base-service')
      await updateSenderPattern(
        body.senderDomain,
        body.originalClassification,
        !!body.correctedClassification,
      )
    } catch (spErr) {
      console.error('[knowledge-base-api] Sender pattern update failed (non-fatal):', spErr)
    }

    return NextResponse.json({
      success: true,
      entry,
      isNew: !existing,
    })
  } catch (error) {
    console.error('[knowledge-base-api] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create knowledge base entry', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── PUT: Update existing entry ────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 },
      )
    }

    // Check entry exists
    const existing = await db.classificationKnowledge.findUnique({
      where: { id: body.id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Knowledge base entry not found' },
        { status: 404 },
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (body.correctedClassification !== undefined) {
      updateData.correctedClassification = body.correctedClassification
      updateData.isCorrected = true
      updateData.source = 'corrected'

      // Update SenderPattern correctedCount
      try {
        await db.senderPattern.updateMany({
          where: { senderDomain: existing.senderDomain },
          data: { correctedCount: { increment: 1 }, updatedAt: new Date() },
        })
      } catch (spErr) {
        console.error('[knowledge-base-api] Sender pattern correctedCount update failed (non-fatal):', spErr)
      }
    }

    if (body.isCorrected !== undefined) updateData.isCorrected = body.isCorrected
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.confidence !== undefined) updateData.confidence = body.confidence

    const entry = await db.classificationKnowledge.update({
      where: { id: body.id },
      data: updateData as Parameters<typeof db.classificationKnowledge.update>[0]['data'],
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    console.error('[knowledge-base-api] PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update knowledge base entry', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── DELETE: Delete entry by id ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 },
      )
    }

    // Check entry exists
    const existing = await db.classificationKnowledge.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Knowledge base entry not found' },
        { status: 404 },
      )
    }

    await db.classificationKnowledge.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error) {
    console.error('[knowledge-base-api] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete knowledge base entry', details: String(error) },
      { status: 500 },
    )
  }
}

// ─── Internal: Get paginated entries ───────────────────────────────────────

async function getEntries(searchParams: URLSearchParams) {
  const senderDomain = searchParams.get('senderDomain')
  const classification = searchParams.get('classification')
  const source = searchParams.get('source')
  const isActive = searchParams.get('isActive')
  const search = searchParams.get('search')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  // Build where clause
  const where: Record<string, unknown> = {}
  if (senderDomain) where.senderDomain = senderDomain
  if (classification) where.originalClassification = classification
  if (source) where.source = source
  if (isActive !== null && isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true'
  }
  if (search) {
    where.OR = [
      { subject: { contains: search } },
      { bodySnippet: { contains: search } },
    ]
  }

  const [entries, total] = await Promise.all([
    db.classificationKnowledge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.classificationKnowledge.count({ where }),
  ])

  return NextResponse.json({
    entries,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  })
}

// ─── Internal: Get aggregate stats ─────────────────────────────────────────

async function getStats() {
  // Simple queries that work reliably with SQLite
  const total = await db.classificationKnowledge.count()
  const correctedCount = await db.classificationKnowledge.count({ where: { isCorrected: true } })
  const totalActive = await db.classificationKnowledge.count({ where: { isActive: true } })

  const avgConfidenceResult = await db.classificationKnowledge.aggregate({
    _avg: { confidence: true },
  })

  // Get all entries for manual grouping (SQLite-friendly)
  const allEntries = await db.classificationKnowledge.findMany({
    select: {
      originalClassification: true,
      source: true,
      senderDomain: true,
    },
  })

  // Manual groupBy for SQLite compatibility
  const byClassification: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  const bySenderDomain: Record<string, number> = {}

  for (const entry of allEntries) {
    byClassification[entry.originalClassification] = (byClassification[entry.originalClassification] || 0) + 1
    bySource[entry.source] = (bySource[entry.source] || 0) + 1
    bySenderDomain[entry.senderDomain] = (bySenderDomain[entry.senderDomain] || 0) + 1
  }

  // Top 5 sender domains
  const topSenderDomains = Object.entries(bySenderDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))

  const accuracyRate = total > 0
    ? Math.round(((total - correctedCount) / total) * 1000) / 10
    : 100

  // Get recent entries for the recent list
  const recentEntries = await db.classificationKnowledge.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      subject: true,
      originalClassification: true,
      correctedClassification: true,
      confidence: true,
      source: true,
      isCorrected: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    total,
    active: totalActive,
    byClassification,
    bySource,
    bySenderDomain,
    topSenderDomains,
    correctedCount,
    accuracyRate,
    avgConfidence: avgConfidenceResult._avg.confidence
      ? Math.round(avgConfidenceResult._avg.confidence * 10) / 10
      : 0,
    recentEntries,
  })
}
