import { NextRequest, NextResponse } from 'next/server'
import {
  getSchedulerStatus,
  startScheduler,
  stopScheduler,
  restartScheduler,
} from '@/lib/email-poller'

// Lazy auto-start on first GET request (fallback if layout import doesn't fire)
let lazyInitDone = false
async function ensureAutoStarted() {
  if (lazyInitDone) return
  lazyInitDone = true
  const status = getSchedulerStatus()
  if (!status.running) {
    try {
      const { db } = await import('@/lib/db')
      const config = await db.systemConfig.findUnique({ where: { key: 'auto_poll_enabled' } })
      if (config?.value !== 'false') {
        console.error('[scheduler] Lazy auto-start: scheduler was previously enabled, restarting...')
        await startScheduler()
      }
    } catch {
      // Silently skip if DB not ready yet
    }
  }
}

/**
 * GET /api/email-poll/scheduler
 * Returns the current scheduler status (running, poll count, last poll, etc.)
 * Also lazily auto-starts the scheduler if it was previously enabled.
 */
export async function GET() {
  await ensureAutoStarted()
  const status = getSchedulerStatus()
  return NextResponse.json(status)
}

/**
 * POST /api/email-poll/scheduler
 * Control the scheduler: start, stop, restart
 * Body: { action: 'start' | 'stop' | 'restart', interval?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval } = body

    switch (action) {
      case 'start': {
        const result = await startScheduler(interval)
        return NextResponse.json({ ...result, status: getSchedulerStatus() })
      }
      case 'stop': {
        const result = await stopScheduler()
        return NextResponse.json({ ...result, status: getSchedulerStatus() })
      }
      case 'restart': {
        const newInterval = interval || 60
        const result = await restartScheduler(newInterval)
        return NextResponse.json({ ...result, status: getSchedulerStatus() })
      }
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "start", "stop", or "restart".' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Scheduler control error:', error)
    return NextResponse.json(
      { error: 'Scheduler control failed', details: String(error) },
      { status: 500 }
    )
  }
}
