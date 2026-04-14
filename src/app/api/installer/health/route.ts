import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import os from 'os'

export async function GET() {
  try {
    // Database connectivity check
    let databaseStatus: 'connected' | 'disconnected' = 'disconnected'
    let databaseLatency: number | null = null
    let databaseError: string | null = null

    try {
      const dbStart = Date.now()
      await db.$queryRaw`SELECT 1 as ok`
      databaseLatency = Date.now() - dbStart
      databaseStatus = 'connected'
    } catch (error) {
      databaseStatus = 'disconnected'
      databaseError = error instanceof Error ? error.message : String(error)
    }

    // System info
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100)

    const systemInfo = {
      nodeVersion: process.version,
      platform: os.platform(),
      osRelease: os.release(),
      architecture: os.arch(),
      hostname: os.hostname(),
      cpuCores: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'unknown',
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: memoryUsagePercent,
        totalFormatted: formatBytes(totalMemory),
        freeFormatted: formatBytes(freeMemory),
        usedFormatted: formatBytes(usedMemory),
      },
      uptime: {
        processUptime: Math.floor(process.uptime()),
        osUptime: os.uptime(),
        processUptimeFormatted: formatDuration(process.uptime()),
        osUptimeFormatted: formatDuration(os.uptime()),
      },
    }

    // AI API key check
    const aiKeyConfigured = !!process.env.GEMINI_API_KEY
    const aiKeyPreview = process.env.GEMINI_API_KEY
      ? `${process.env.GEMINI_API_KEY.substring(0, 4)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}`
      : null

    // IMAP config check
    const imapConfigured = !!process.env.IMAP_HOST
    const imapConfig = {
      host: process.env.IMAP_HOST || null,
      port: process.env.IMAP_PORT || null,
      user: process.env.IMAP_USER ? maskEmail(process.env.IMAP_USER) : null,
      tls: process.env.IMAP_TLS || null,
      configured: imapConfigured,
    }

    // SMTP config check
    const smtpConfigured = !!process.env.SMTP_HOST
    const smtpConfig = {
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      user: process.env.SMTP_USER ? maskEmail(process.env.SMTP_USER) : null,
      tls: process.env.SMTP_TLS || null,
      configured: smtpConfigured,
    }

    // Overall status determination
    const criticalServices = [databaseStatus]
    const allCriticalOk = criticalServices.every((s) => s === 'connected')

    const overallStatus = allCriticalOk ? 'healthy' : 'degraded'

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '3.0.3',
      checks: {
        database: {
          status: databaseStatus,
          latency: databaseLatency,
          error: databaseError,
        },
        ai: {
          configured: aiKeyConfigured,
          provider: 'Gemini',
          keyPreview: aiKeyPreview,
        },
        imap: imapConfig,
        smtp: smtpConfig,
      },
      system: systemInfo,
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  return parts.join(' ')
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email.substring(0, 3) + '...'
  const maskedUser = user.length > 2
    ? user.substring(0, 2) + '***'
    : user + '***'
  return `${maskedUser}@${domain}`
}
