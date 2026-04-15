import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getConfig(key: string): Promise<string | null> {
  const row = await db.systemConfig.findUnique({ where: { key } })
  return row?.value ?? null
}

async function upsertConfig(key: string, value: string) {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

// ─── GET: Auto-classify status ────────────────────────────────────────────────

export async function GET() {
  try {
    const [enabledRaw, readyRaw, trainedAtRaw, patternsBuiltRaw, accuracyRaw] = await Promise.all([
      getConfig('auto_classify_enabled'),
      getConfig('learning_ready'),
      getConfig('learning_trained_at'),
      getConfig('learning_patterns_built'),
      getConfig('learning_accuracy'),
    ])

    const enabled = enabledRaw === 'true'
    const trained = !!trainedAtRaw
    const ready = readyRaw === 'true'
    const patternsCount = patternsBuiltRaw ? parseInt(patternsBuiltRaw, 10) : 0
    const accuracy = accuracyRaw ? parseFloat(accuracyRaw) : 0

    // Determine mode
    let mode: 'learning' | 'auto' | 'off'
    if (enabled && trained) {
      mode = 'auto'
    } else if (trained) {
      mode = 'learning'
    } else {
      mode = 'off'
    }

    return NextResponse.json({
      enabled,
      trained,
      patternsCount,
      accuracy,
      lastTrained: trainedAtRaw || null,
      mode,
    })
  } catch (error) {
    console.error('[auto-classify-status] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-classify status', details: String(error) },
      { status: 500 }
    )
  }
}

// ─── POST: Toggle auto-classify ───────────────────────────────────────────────

const ToggleSchema = z.object({
  enabled: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ToggleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { enabled } = parsed.data

    // If enabling, validate that learning is ready (>= 5 patterns)
    if (enabled) {
      const readyRaw = await getConfig('learning_ready')
      const ready = readyRaw === 'true'

      if (!ready) {
        const patternsCount = await db.learningPattern.count()
        return NextResponse.json(
          {
            error: 'Cannot enable auto-classify: not enough learning patterns',
            enabled: false,
            message: `Auto-classify requires at least 5 learning patterns. Currently: ${patternsCount}. Run batch training first.`,
          },
          { status: 400 }
        )
      }

      // Also verify training has been run
      const trainedAtRaw = await getConfig('learning_trained_at')
      if (!trainedAtRaw) {
        return NextResponse.json(
          {
            error: 'Cannot enable auto-classify: training has not been run',
            enabled: false,
            message: 'Run batch training before enabling auto-classify.',
          },
          { status: 400 }
        )
      }
    }

    // Store the setting
    await upsertConfig('auto_classify_enabled', String(enabled))

    // Audit log
    await db.auditLog.create({
      data: {
        action: enabled ? 'auto_classify_enabled' : 'auto_classify_disabled',
        details: `Auto-classify ${enabled ? 'enabled' : 'disabled'} by user`,
        status: 'SUCCESS',
        processedBy: 'MANUAL',
      },
    })

    console.error(`[auto-classify-status] Auto-classify ${enabled ? 'enabled' : 'disabled'}`)

    return NextResponse.json({
      enabled,
      message: enabled
        ? 'Auto-classify enabled. Incoming emails will be automatically classified using learned patterns.'
        : 'Auto-classify disabled. Emails will require manual classification.',
    })
  } catch (error) {
    console.error('[auto-classify-status] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to toggle auto-classify', details: String(error) },
      { status: 500 }
    )
  }
}
