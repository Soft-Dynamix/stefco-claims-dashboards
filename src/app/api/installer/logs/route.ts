import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import os from 'os'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const limitParam = searchParams.get('limit') || '50'
    const limit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200)

    // Build where clause for audit log filtering
    const where: Record<string, unknown> = {}
    if (type !== 'all') {
      where.status = type.toUpperCase()
    }

    // Fetch recent audit logs
    const auditLogs = await db.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
            status: true,
          },
        },
      },
    })

    // Count by status
    const statusCounts = {
      SUCCESS: await db.auditLog.count({ where: { status: 'SUCCESS' } }),
      WARNING: await db.auditLog.count({ where: { status: 'WARNING' } }),
      ERROR: await db.auditLog.count({ where: { status: 'ERROR' } }),
    }

    const totalCount = statusCounts.SUCCESS + statusCounts.WARNING + statusCounts.ERROR

    // System info
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100)

    const formatBytes = (bytes: number): string => {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      if (bytes === 0) return '0 B'
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
    }

    const formatDuration = (seconds: number): string => {
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

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      filter: {
        type,
        limit,
        returnedCount: auditLogs.length,
      },
      system: {
        memory: {
          total: formatBytes(totalMemory),
          used: formatBytes(usedMemory),
          free: formatBytes(freeMemory),
          usagePercent: memoryUsagePercent,
        },
        uptime: formatDuration(os.uptime()),
        processUptime: formatDuration(process.uptime()),
        platform: `${os.platform()} ${os.release()}`,
        nodeVersion: process.version,
      },
      summary: {
        totalEntries: totalCount,
        successCount: statusCounts.SUCCESS,
        warningCount: statusCounts.WARNING,
        errorCount: statusCounts.ERROR,
        successRate:
          totalCount > 0
            ? `${((statusCounts.SUCCESS / totalCount) * 100).toFixed(1)}%`
            : 'N/A',
      },
      logs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        status: log.status,
        processedBy: log.processedBy,
        claimNumber: log.claim?.claimNumber || null,
        clientName: log.claim?.clientName || null,
        claimStatus: log.claim?.status || null,
        createdAt: log.createdAt,
      })),
    })
  } catch (error) {
    console.error('Logs endpoint error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch logs',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
