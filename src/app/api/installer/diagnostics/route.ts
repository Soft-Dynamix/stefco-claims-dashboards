import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import os from 'os'
import net from 'net'

interface DiagnosticResult {
  test: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  details?: Record<string, unknown>
}

const SUPPORTED_TESTS = [
  'database',
  'ai-key',
  'imap',
  'smtp',
  'disk-space',
  'ports',
  'all',
] as const

type SupportedTest = (typeof SUPPORTED_TESTS)[number]

async function checkDatabase(): Promise<DiagnosticResult> {
  try {
    const start = Date.now()
    const result = await db.$queryRaw`SELECT 1 as ok`
    const latency = Date.now() - start
    return {
      test: 'database',
      status: 'pass',
      message: 'Database connection successful',
      details: { latency: `${latency}ms`, result: String(result) },
    }
  } catch (error) {
    return {
      test: 'database',
      status: 'fail',
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

function checkAiKey(): DiagnosticResult {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      test: 'ai-key',
      status: 'fail',
      message: 'GEMINI_API_KEY is not configured',
      details: {
        configured: false,
        hint: 'Set GEMINI_API_KEY in your .env file',
      },
    }
  }
  if (apiKey.length <= 10) {
    return {
      test: 'ai-key',
      status: 'warn',
      message: 'GEMINI_API_KEY appears to be too short',
      details: {
        configured: true,
        keyLength: apiKey.length,
        hint: 'Gemini API keys are typically 39 characters long',
      },
    }
  }
  return {
    test: 'ai-key',
    status: 'pass',
    message: 'GEMINI_API_KEY is configured',
    details: {
      configured: true,
      keyLength: apiKey.length,
      prefix: `${apiKey.substring(0, 4)}...`,
    },
  }
}

function checkImap(): DiagnosticResult {
  const host = process.env.IMAP_HOST
  const user = process.env.IMAP_USER
  const password = process.env.IMAP_PASSWORD

  const missing: string[] = []
  if (!host) missing.push('IMAP_HOST')
  if (!user) missing.push('IMAP_USER')
  if (!password) missing.push('IMAP_PASSWORD')

  if (missing.length > 0) {
    return {
      test: 'imap',
      status: 'fail',
      message: `IMAP configuration incomplete: missing ${missing.join(', ')}`,
      details: { configured: false, missing },
    }
  }

  return {
    test: 'imap',
    status: 'pass',
    message: 'IMAP configuration is complete',
    details: {
      configured: true,
      host,
      port: process.env.IMAP_PORT || '993',
      tls: process.env.IMAP_TLS || 'true',
    },
  }
}

function checkSmtp(): DiagnosticResult {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD

  const missing: string[] = []
  if (!host) missing.push('SMTP_HOST')
  if (!user) missing.push('SMTP_USER')
  if (!password) missing.push('SMTP_PASSWORD')

  if (missing.length > 0) {
    return {
      test: 'smtp',
      status: 'fail',
      message: `SMTP configuration incomplete: missing ${missing.join(', ')}`,
      details: { configured: false, missing },
    }
  }

  return {
    test: 'smtp',
    status: 'pass',
    message: 'SMTP configuration is complete',
    details: {
      configured: true,
      host,
      port: process.env.SMTP_PORT || '587',
      tls: process.env.SMTP_TLS || 'true',
    },
  }
}

function checkDiskSpace(): DiagnosticResult {
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

  let status: 'pass' | 'warn' | 'fail' = 'pass'
  let message = 'System memory usage is normal'

  if (memoryUsagePercent > 90) {
    status = 'fail'
    message = 'System memory usage is critically high'
  } else if (memoryUsagePercent > 75) {
    status = 'warn'
    message = 'System memory usage is elevated'
  }

  return {
    test: 'disk-space',
    status,
    message,
    details: {
      memory: {
        total: formatBytes(totalMemory),
        free: formatBytes(freeMemory),
        used: formatBytes(usedMemory),
        usagePercent: memoryUsagePercent,
      },
      cpuCount: os.cpus().length,
      loadAvg: os.loadavg().map((avg) => avg.toFixed(2)),
    },
  }
}

function checkPorts(): Promise<DiagnosticResult> {
  const ports = [3000]

  return Promise.all(
    ports.map(
      (port) =>
        new Promise<{ port: number; available: boolean; error?: string }>(
          (resolve) => {
            const server = net
              .createServer()
              .once('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                  resolve({ port, available: false })
                } else {
                  resolve({ port, available: false, error: err.message })
                }
              })
              .once('listening', () => {
                server.close(() => resolve({ port, available: true }))
              })
              .listen(port, '127.0.0.1')
          }
        )
    )
  ).then((results) => {
    const allFree = results.every((r) => r.available)
    const details: Record<string, string | boolean> = {}
    for (const r of results) {
      details[`port_${r.port}`] = r.available ? 'available' : 'in_use'
    }

    return {
      test: 'ports',
      status: allFree ? 'pass' : ('warn' as const),
      message: allFree
        ? 'All checked ports are available'
        : 'Some ports are already in use',
      details,
    }
  })
}

async function runDiagnosticTest(testName: string): Promise<DiagnosticResult> {
  switch (testName) {
    case 'database':
      return checkDatabase()
    case 'ai-key':
      return checkAiKey()
    case 'imap':
      return checkImap()
    case 'smtp':
      return checkSmtp()
    case 'disk-space':
      return checkDiskSpace()
    case 'ports':
      return checkPorts()
    default:
      return {
        test: testName,
        status: 'fail',
        message: `Unknown diagnostic test: ${testName}`,
        details: {
          supportedTests: SUPPORTED_TESTS,
        },
      }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const test: string = body.test || ''

    if (!test) {
      return NextResponse.json(
        {
          error: 'Missing required field: test',
          supportedTests: SUPPORTED_TESTS,
        },
        { status: 400 }
      )
    }

    // Run single test
    if (test !== 'all') {
      if (!SUPPORTED_TESTS.includes(test as SupportedTest)) {
        return NextResponse.json(
          {
            error: `Unsupported test: ${test}`,
            supportedTests: SUPPORTED_TESTS,
          },
          { status: 400 }
        )
      }

      const result = await runDiagnosticTest(test)
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        results: [result],
      })
    }

    // Run all tests in parallel
    const individualTests = SUPPORTED_TESTS.filter((t) => t !== 'all')
    const results = await Promise.all(individualTests.map(runDiagnosticTest))

    const passCount = results.filter((r) => r.status === 'pass').length
    const failCount = results.filter((r) => r.status === 'fail').length
    const warnCount = results.filter((r) => r.status === 'warn').length

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        pass: passCount,
        fail: failCount,
        warn: warnCount,
        overallStatus: failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass',
      },
      results,
    })
  } catch (error) {
    console.error('Diagnostics error:', error)
    return NextResponse.json(
      {
        error: 'Diagnostic test failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
