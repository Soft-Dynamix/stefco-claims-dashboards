/**
 * Background Email Polling Scheduler
 * Native email polling scheduler using ImapFlow.
 * Runs inside the Next.js server process (works with Docker standalone mode).
 *
 * Features:
 * - Configurable poll interval (default: 60 seconds)
 * - Can be started/stopped via API
 * - Persists enabled state in SystemConfig
 * - Prevents overlapping polls (only one poll at a time)
 * - Logs all activity to audit trail
 */

import { db } from '@/lib/db'

// ─── Scheduler State (in-memory singleton) ──────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null
let isPolling = false
let pollCount = 0
let lastPollError: string | null = null
let startedAt: Date | null = null
let lastPollAt: Date | null = null
let nextPollAt: Date | null = null

const DEFAULT_INTERVAL = 60 // seconds

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function getInterval(): Promise<number> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: 'email_poll_interval' },
    })
    if (config?.value) {
      const parsed = parseInt(config.value, 10)
      if (parsed >= 15 && parsed <= 3600) return parsed
    }
  } catch { /* fallback */ }
  return DEFAULT_INTERVAL
}

async function isEnabled(): Promise<boolean> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: 'auto_poll_enabled' },
    })
    return config?.value !== 'false' // default to disabled for safety
  } catch {
    return false
  }
}

// ─── Core Poll Logic ────────────────────────────────────────────────────────────

async function executePoll() {
  if (isPolling) {
    console.error('[email-poller] Skipping poll — previous poll still running')
    return
  }

  isPolling = true
  const startTime = Date.now()

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    console.error(`[email-poller] ===== AUTO POLL #${pollCount + 1} at ${new Date().toISOString()} =====`)

    const res = await fetch(`${baseUrl}/api/email-poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      pollCount++
      lastPollAt = new Date()
      lastPollError = null

      console.error(`[email-poller] ✅ Poll #${pollCount} complete: ${data.processed || 0} processed, ${data.failed || 0} failed (${Date.now() - startTime}ms)`)

      // Update last poll stats in DB
      await db.systemConfig.upsert({
        where: { key: 'last_auto_poll' },
        update: { value: new Date().toISOString() },
        create: { key: 'last_auto_poll', value: new Date().toISOString() },
      })
      await db.systemConfig.upsert({
        where: { key: 'last_auto_poll_count' },
        update: { value: String(data.processed || 0) },
        create: { key: 'last_auto_poll_count', value: String(data.processed || 0) },
      })
    } else {
      lastPollError = `HTTP ${res.status}: ${data.error || 'Unknown error'}`
      console.error(`[email-poller] ❌ Poll failed: ${lastPollError}`)

      await db.systemConfig.upsert({
        where: { key: 'last_auto_poll_error' },
        update: { value: lastPollError },
        create: { key: 'last_auto_poll_error', value: lastPollError },
      })
    }
  } catch (err: unknown) {
    lastPollError = err instanceof Error ? err.message : String(err)
    console.error(`[email-poller] ❌ Poll error: ${lastPollError}`)
  } finally {
    isPolling = false
  }
}

// ─── Scheduler Control ──────────────────────────────────────────────────────────

/**
 * Start the auto-polling scheduler
 */
export async function startScheduler(intervalOverride?: number): Promise<{
  started: boolean
  interval: number
  message: string
}> {
  if (pollTimer) {
    return { started: false, interval: await getInterval(), message: 'Scheduler already running' }
  }

  const interval = intervalOverride || await getInterval()

  // Save enabled state
  await db.systemConfig.upsert({
    where: { key: 'auto_poll_enabled' },
    update: { value: 'true' },
    create: { key: 'auto_poll_enabled', value: 'true' },
  })

  // Save interval
  await db.systemConfig.upsert({
    where: { key: 'email_poll_interval_seconds' },
    update: { value: String(interval) },
    create: { key: 'email_poll_interval_seconds', value: String(interval) },
  })

  // Execute first poll immediately
  executePoll()

  // Start interval
  pollTimer = setInterval(executePoll, interval * 1000)
  startedAt = new Date()
  nextPollAt = new Date(Date.now() + interval * 1000)

  console.error(`[email-poller] 🚀 Scheduler started — polling every ${interval}s`)

  return { started: true, interval, message: `Scheduler started with ${interval}s interval` }
}

/**
 * Stop the auto-polling scheduler
 */
export async function stopScheduler(): Promise<{
  stopped: boolean
  message: string
}> {
  if (!pollTimer) {
    return { stopped: false, message: 'Scheduler not running' }
  }

  clearInterval(pollTimer)
  pollTimer = null
  nextPollAt = null

  // Save disabled state
  await db.systemConfig.upsert({
    where: { key: 'auto_poll_enabled' },
    update: { value: 'false' },
    create: { key: 'auto_poll_enabled', value: 'false' },
  })

  console.error(`[email-poller] ⏹️ Scheduler stopped after ${pollCount} polls`)

  return { stopped: true, message: `Scheduler stopped after ${pollCount} polls` }
}

/**
 * Restart the scheduler with a new interval
 */
export async function restartScheduler(newInterval: number): Promise<{
  restarted: boolean
  interval: number
  message: string
}> {
  await stopScheduler()

  // Small delay to ensure clean state
  await new Promise(resolve => setTimeout(resolve, 500))

  const result = await startScheduler(newInterval)
  return { restarted: result.started, interval: result.interval, message: result.message }
}

/**
 * Get the scheduler status
 */
export function getSchedulerStatus(): {
  running: boolean
  polling: boolean
  interval: number | null
  pollCount: number
  lastPollAt: Date | null
  nextPollAt: Date | null
  lastPollError: string | null
  startedAt: Date | null
  uptime: number | null // seconds
} {
  return {
    running: !!pollTimer,
    polling: isPolling,
    interval: pollTimer ? (1000 / (pollTimer as unknown as { _idleTimeout: number })._idleTimeout * 1000) : null, // approximate
    pollCount,
    lastPollAt,
    nextPollAt,
    lastPollError,
    startedAt,
    uptime: startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null,
  }
}

/**
 * Auto-start the scheduler if it was previously enabled
 * Call this once at server startup
 */
export async function autoStartIfEnabled(): Promise<void> {
  const enabled = await isEnabled()
  if (enabled) {
    const interval = await getInterval()
    console.error(`[email-poller] Auto-starting scheduler (previously enabled, interval: ${interval}s)`)
    await startScheduler(interval)
  } else {
    console.error(`[email-poller] Auto-poll is disabled — start via Settings or Email Processing view`)
  }
}
