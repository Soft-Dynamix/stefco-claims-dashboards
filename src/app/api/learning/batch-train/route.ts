import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { preprocessEmail } from '@/lib/agents/preprocess-agent'
import { getLearningHints } from '@/lib/learning-engine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(email: string): string {
  if (!email) return ''
  const match = email.match(/@([^@]+)$/)
  return match ? match[1].toLowerCase() : ''
}

async function upsertConfig(key: string, value: string) {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

async function getConfig(key: string): Promise<string | null> {
  const row = await db.systemConfig.findUnique({ where: { key } })
  return row?.value ?? null
}

// ─── GET: Training status ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const [trainedAt, claimsAnalyzed, patternsBuilt, accuracyRaw, readyRaw] = await Promise.all([
      getConfig('learning_trained_at'),
      getConfig('learning_claims_analyzed'),
      getConfig('learning_patterns_built'),
      getConfig('learning_accuracy'),
      getConfig('learning_ready'),
    ])

    const trained = !!trainedAt
    const patternsCount = await db.learningPattern.count()

    // Domain breakdown: per-domain classification stats
    const domainBreakdown = await db.$queryRaw<Array<{
      senderDomain: string
      totalClaims: number
      avgConfidence: number
      topClassification: string | null
    }>>`
      SELECT
        SUBSTR(c.senderEmail, INSTR(c.senderEmail, '@') + 1) as senderDomain,
        COUNT(*) as totalClaims,
        AVG(c.confidenceScore) as avgConfidence,
        c.aiClassification as topClassification
      FROM Claim c
      WHERE c.senderEmail IS NOT NULL AND c.senderEmail != ''
      GROUP BY senderDomain, topClassification
      HAVING totalClaims >= 1
      ORDER BY totalClaims DESC
      LIMIT 20
    `

    // Aggregate by domain (merge rows with same domain)
    const domainMap = new Map<string, { totalClaims: number; avgConfidence: number; classifications: Map<string, number> }>()
    for (const row of domainBreakdown) {
      const entry = domainMap.get(row.senderDomain) || { totalClaims: 0, avgConfidence: 0, classifications: new Map() }
      entry.totalClaims += row.totalClaims
      entry.avgConfidence = row.avgConfidence
      if (row.topClassification) {
        entry.classifications.set(row.topClassification, (entry.classifications.get(row.topClassification) || 0) + row.totalClaims)
      }
      domainMap.set(row.senderDomain, entry)
    }

    const domainBreakdownAggregated = Array.from(domainMap.entries()).map(([domain, data]) => {
      // Find the top classification for this domain
      let topClass = 'N/A'
      let maxCount = 0
      for (const [cls, count] of data.classifications) {
        if (count > maxCount) { maxCount = count; topClass = cls }
      }
      return {
        domain,
        totalClaims: data.totalClaims,
        avgConfidence: Math.round(data.avgConfidence),
        topClassification: topClass,
      }
    })

    return NextResponse.json({
      trained,
      trainedAt: trainedAt || null,
      claimsAnalyzed: claimsAnalyzed ? parseInt(claimsAnalyzed, 10) : 0,
      patternsBuilt: patternsBuilt ? parseInt(patternsBuilt, 10) : patternsCount,
      accuracy: accuracyRaw ? parseFloat(accuracyRaw) : 0,
      ready: readyRaw === 'true',
      domainBreakdown: domainBreakdownAggregated,
    })
  } catch (error) {
    console.error('[batch-train] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training status', details: String(error) },
      { status: 500 }
    )
  }
}

// ─── POST: Run batch training ─────────────────────────────────────────────────

export async function POST(_request: NextRequest) {
  const startTime = Date.now()
  let claimsAnalyzed = 0
  let patternsBuilt = 0

  try {
    console.error('[batch-train] Starting batch training...')

    // 1. Fetch ALL claims with senderEmail and classification data
    const claims = await db.claim.findMany({
      where: {
        senderEmail: { not: null },
        aiClassification: { not: null },
      },
      select: {
        id: true,
        claimNumber: true,
        senderEmail: true,
        emailSubject: true,
        incidentDescription: true,
        claimType: true,
        aiClassification: true,
        confidenceScore: true,
        aiClassificationConfidence: true,
        insuranceCompanyId: true,
        verifiedByUser: true,
        reviewAction: true,
      },
    })

    console.error(`[batch-train] Found ${claims.length} claims with sender email and classification`)
    claimsAnalyzed = claims.length

    if (claims.length === 0) {
      await upsertConfig('learning_trained_at', new Date().toISOString())
      await upsertConfig('learning_claims_analyzed', '0')
      await upsertConfig('learning_patterns_built', '0')
      await upsertConfig('learning_accuracy', '0')
      await upsertConfig('learning_ready', 'false')

      // Audit log
      await db.auditLog.create({
        data: {
          action: 'batch_train',
          details: 'Batch training completed — no claims to analyze',
          status: 'SUCCESS',
          processedBy: 'AUTO',
        },
      })

      return NextResponse.json({
        claimsAnalyzed: 0,
        patternsBuilt: 0,
        accuracy: 0,
        ready: false,
        duration: Date.now() - startTime,
      })
    }

    // 2. Build per-domain classification patterns
    const domainData = new Map<string, {
      totalClaims: number
      classifiedAs: Map<string, number>
      avgConfidence: number
      claimTypes: Map<string, number>
      keywords: Map<string, number>
      followUpSignals: Map<string, number>
    }>()

    // 3. For each claim: re-run preprocess, aggregate signals
    for (const claim of claims) {
      const subject = claim.emailSubject || ''
      const body = claim.incidentDescription || claim.emailSubject || ''
      const from = claim.senderEmail || ''
      const domain = extractDomain(from)

      if (!domain) continue

      const entry = domainData.get(domain) || {
        totalClaims: 0,
        classifiedAs: new Map(),
        avgConfidence: 0,
        claimTypes: new Map(),
        keywords: new Map(),
        followUpSignals: new Map(),
      }

      entry.totalClaims++
      entry.avgConfidence += claim.confidenceScore

      // Track classification
      if (claim.aiClassification) {
        entry.classifiedAs.set(
          claim.aiClassification,
          (entry.classifiedAs.get(claim.aiClassification) || 0) + 1
        )
      }

      // Track claim type
      if (claim.claimType) {
        entry.claimTypes.set(
          claim.claimType,
          (entry.claimTypes.get(claim.claimType) || 0) + 1
        )
      }

      // Run preprocess on this claim to extract signals
      try {
        const preprocessed = preprocessEmail({ subject, body, from })

        // Aggregate keywords
        for (const kw of preprocessed.keywords) {
          entry.keywords.set(kw, (entry.keywords.get(kw) || 0) + 1)
        }

        // Aggregate follow-up signals
        const fu = preprocessed.followUpSignals
        if (fu.isReply) entry.followUpSignals.set('is_reply', (entry.followUpSignals.get('is_reply') || 0) + 1)
        if (fu.isForward) entry.followUpSignals.set('is_forward', (entry.followUpSignals.get('is_forward') || 0) + 1)
        if (fu.hasFollowUpPhrases) entry.followUpSignals.set('follow_up_phrases', (entry.followUpSignals.get('follow_up_phrases') || 0) + 1)
        if (fu.hasStatusQuery) entry.followUpSignals.set('status_query', (entry.followUpSignals.get('status_query') || 0) + 1)
        if (fu.hasExistingClaimRef) entry.followUpSignals.set('existing_claim_ref', (entry.followUpSignals.get('existing_claim_ref') || 0) + 1)
      } catch (preprocessErr) {
        console.error(`[batch-train] Preprocess error for claim ${claim.claimNumber}:`, preprocessErr)
      }

      domainData.set(domain, entry)
    }

    // 4. Create LearningPattern records from domain analysis
    let newPatterns = 0

    for (const [domain, data] of domainData) {
      if (data.totalClaims < 1) continue

      const avgConf = Math.round(data.avgConfidence / data.totalClaims)

      // 4a. Domain classification pattern — what this domain typically sends
      let topClassification = 'UNKNOWN'
      let topCount = 0
      for (const [cls, count] of data.classifiedAs) {
        if (count > topCount) { topCount = count; topClassification = cls }
      }

      const classHint = `Domain "${domain}" typically sends ${topClassification} emails (${topCount}/${data.totalClaims} = ${Math.round((topCount / data.totalClaims) * 100)}% of the time) with average confidence ${avgConf}%`

      // Upsert domain classification pattern
      const existingClassPattern = await db.learningPattern.findFirst({
        where: {
          senderDomain: domain,
          fieldName: '__domain_classification',
        },
      })

      if (existingClassPattern) {
        await db.learningPattern.update({
          where: { id: existingClassPattern.id },
          data: {
            patternHint: classHint,
            correctionCount: data.totalClaims,
            confidence: Math.min(95, 50 + Math.floor(data.totalClaims * 3)),
            lastAppliedAt: new Date(),
          },
        })
      } else {
        await db.learningPattern.create({
          data: {
            senderDomain: domain,
            fieldName: '__domain_classification',
            patternHint: classHint,
            correctionCount: data.totalClaims,
            confidence: Math.min(95, 50 + Math.floor(data.totalClaims * 3)),
            lastAppliedAt: new Date(),
          },
        })
        newPatterns++
      }

      // 4b. Claim type keyword associations per domain
      for (const [claimType, count] of data.claimTypes) {
        if (count < 1) continue

        // Get top keywords for this claim type from this domain
        const typeKeywords: string[] = []
        for (const [kw, kwCount] of data.keywords) {
          if (kwCount >= 1 && typeKeywords.length < 5) {
            typeKeywords.push(kw)
          }
        }

        const typeHint = `Domain "${domain}" sends "${claimType}" claims (${count} time${count !== 1 ? 's' : ''}). Common keywords: ${typeKeywords.join(', ') || 'N/A'}`

        const fieldName = `__claim_type_${claimType.toLowerCase()}`
        const existingTypePattern = await db.learningPattern.findFirst({
          where: {
            senderDomain: domain,
            fieldName,
          },
        })

        if (existingTypePattern) {
          await db.learningPattern.update({
            where: { id: existingTypePattern.id },
            data: {
              patternHint: typeHint,
              correctionCount: count,
              confidence: Math.min(90, 50 + Math.floor(count * 5)),
              lastAppliedAt: new Date(),
            },
          })
        } else {
          await db.learningPattern.create({
            data: {
              senderDomain: domain,
              fieldName,
              patternHint: typeHint,
              correctionCount: count,
              confidence: Math.min(90, 50 + Math.floor(count * 5)),
              lastAppliedAt: new Date(),
            },
          })
          newPatterns++
        }
      }

      // 4c. Follow-up detection patterns
      for (const [signal, count] of data.followUpSignals) {
        if (count < 2) continue // Only store patterns with 2+ occurrences

        const followUpHint = `Domain "${domain}" frequently sends follow-up emails with "${signal}" signal (${count}/${data.totalClaims} = ${Math.round((count / data.totalClaims) * 100)}% of emails)`

        const fieldName = `__follow_up_${signal}`
        const existingFuPattern = await db.learningPattern.findFirst({
          where: {
            senderDomain: domain,
            fieldName,
          },
        })

        if (existingFuPattern) {
          await db.learningPattern.update({
            where: { id: existingFuPattern.id },
            data: {
              patternHint: followUpHint,
              correctionCount: count,
              confidence: Math.min(85, 50 + Math.floor(count * 4)),
              lastAppliedAt: new Date(),
            },
          })
        } else {
          await db.learningPattern.create({
            data: {
              senderDomain: domain,
              fieldName,
              patternHint: followUpHint,
              correctionCount: count,
              confidence: Math.min(85, 50 + Math.floor(count * 4)),
              lastAppliedAt: new Date(),
            },
          })
          newPatterns++
        }
      }
    }

    // 5. Reinforce patterns from existing ClaimFeedback
    const feedbackRecords = await db.claimFeedback.findMany({
      where: {
        feedbackType: 'field_corrected',
        fieldName: { not: null },
        originalValue: { not: null },
        correctedValue: { not: null },
      },
      include: {
        claim: {
          select: { senderEmail: true },
        },
      },
    })

    console.error(`[batch-train] Found ${feedbackRecords.length} feedback records to reinforce`)

    for (const feedback of feedbackRecords) {
      const domain = extractDomain(feedback.claim.senderEmail || '')
      if (!domain) continue

      const fieldName = feedback.fieldName || 'unknown'
      const originalVal = feedback.originalValue || ''
      const correctedVal = feedback.correctedValue || ''

      // Check if pattern already exists
      const existing = await db.learningPattern.findFirst({
        where: {
          senderDomain: domain,
          fieldName,
        },
      })

      if (existing) {
        // Reinforce: increment count, boost confidence
        const newCount = existing.correctionCount + 1
        const newConfidence = Math.min(95, existing.confidence + 5)
        await db.learningPattern.update({
          where: { id: existing.id },
          data: {
            correctionCount: newCount,
            confidence: newConfidence,
            exampleOriginal: originalVal,
            exampleCorrected: correctedVal,
            lastAppliedAt: new Date(),
          },
        })
      } else {
        // Create new pattern from feedback
        const hint = `For domain "${domain}", field "${fieldName}" was corrected from "${originalVal}" to "${correctedVal}" (user-verified)`
        await db.learningPattern.create({
          data: {
            senderDomain: domain,
            fieldName,
            patternHint: hint,
            exampleOriginal: originalVal,
            exampleCorrected: correctedVal,
            correctionCount: 1,
            confidence: 55,
            lastAppliedAt: new Date(),
          },
        })
        newPatterns++
      }
    }

    patternsBuilt = newPatterns

    // 6. Calculate accuracy from verified claims
    const verifiedClaims = await db.claim.findMany({
      where: {
        verifiedByUser: true,
        reviewAction: { not: null },
      },
      select: {
        aiClassification: true,
        reviewAction: true,
      },
    })

    let accuracy = 0
    if (verifiedClaims.length > 0) {
      const correctCount = verifiedClaims.filter(c => c.reviewAction === 'accepted').length
      accuracy = Math.round((correctCount / verifiedClaims.length) * 100)
    }

    // 7. Determine if ready (>= 5 patterns total)
    const totalPatterns = await db.learningPattern.count()
    const ready = totalPatterns >= 5

    // 8. Store training results in SystemConfig
    await Promise.all([
      upsertConfig('learning_trained_at', new Date().toISOString()),
      upsertConfig('learning_patterns_built', String(totalPatterns)),
      upsertConfig('learning_claims_analyzed', String(claimsAnalyzed)),
      upsertConfig('learning_accuracy', String(accuracy)),
      upsertConfig('learning_ready', String(ready)),
    ])

    // 9. Audit log
    await db.auditLog.create({
      data: {
        action: 'batch_train',
        details: `Batch training completed: ${claimsAnalyzed} claims analyzed, ${totalPatterns} patterns (${newPatterns} new), accuracy ${accuracy}%, ready=${ready}`,
        status: 'SUCCESS',
        processedBy: 'AUTO',
      },
    })

    const duration = Date.now() - startTime
    console.error(`[batch-train] Completed in ${duration}ms: ${claimsAnalyzed} claims, ${totalPatterns} patterns, ${accuracy}% accuracy, ready=${ready}`)

    return NextResponse.json({
      claimsAnalyzed,
      patternsBuilt: totalPatterns,
      newPatternsCreated: newPatterns,
      accuracy,
      ready,
      duration,
    })
  } catch (error) {
    console.error('[batch-train] Training error:', error)

    // Audit log for failure
    try {
      await db.auditLog.create({
        data: {
          action: 'batch_train',
          details: `Batch training failed: ${String(error)}`,
          status: 'ERROR',
          processedBy: 'AUTO',
        },
      })
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json(
      { error: 'Batch training failed', details: String(error) },
      { status: 500 }
    )
  }
}
