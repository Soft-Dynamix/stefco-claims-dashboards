import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/email-poll/status
 *
 * Returns the current IMAP email polling status including:
 * - Whether IMAP is configured
 * - Last poll timestamp and count
 * - Poll interval setting
 * - Connection status (tested against IMAP server)
 * - Last error if any
 */
export async function GET() {
  try {
    // Fetch all relevant configs
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: [
            'imap_host',
            'imap_port',
            'imap_user',
            'imap_password',
            'imap_ssl',
            'imap_poll_interval',
            'last_email_poll',
            'last_email_poll_count',
            'last_email_poll_error',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const c of configs) {
      map[c.key] = c.value
    }

    const host = map['imap_host'] || process.env.IMAP_HOST || ''
    const port = map['imap_port'] || process.env.IMAP_PORT || '993'
    const user = map['imap_user'] || process.env.IMAP_USER || ''
    const password = map['imap_password'] || process.env.IMAP_PASSWORD || ''
    const ssl = (map['imap_ssl'] || process.env.IMAP_SSL || 'true') === 'true'
    const pollInterval = parseInt(map['imap_poll_interval'] || '300', 10)
    const lastPoll = map['last_email_poll'] || null
    const lastPollCount = parseInt(map['last_email_poll_count'] || '0', 10)
    const lastPollError = map['last_email_poll_error'] || null

    const isConfigured = !!(host && user && password)

    // Test IMAP connection if configured
    let connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'
    let connectionError: string | null = null

    if (isConfigured) {
      try {
        const { ImapFlow } = await import('imapflow')
        const client = new ImapFlow({
          host,
          port: parseInt(port, 10),
          secure: ssl,
          tls: { rejectUnauthorized: false },
          auth: {
            user,
            pass: password,
          },
          logger: false,
          authTimeout: 5000,
          connectionTimeout: 5000,
        })

        await client.connect()
        connectionStatus = 'connected'
        await client.logout()
      } catch (err: unknown) {
        connectionStatus = 'error'
        connectionError = err instanceof Error ? err.message : String(err)
      }
    }

    return NextResponse.json({
      configured: isConfigured,
      config: {
        host: isConfigured ? host : '',
        port: parseInt(port, 10),
        user: isConfigured ? user : '',
        ssl,
        poll_interval: pollInterval,
      },
      last_poll: lastPoll,
      last_poll_count: lastPollCount,
      last_poll_error: lastPollError,
      connection: {
        status: connectionStatus,
        error: connectionError,
      },
    })
  } catch (error) {
    console.error('Email poll status error:', error)
    return NextResponse.json(
      {
        configured: false,
        error: 'Failed to fetch email poll status',
        details: String(error),
        connection: { status: 'error', error: String(error) },
      },
      { status: 500 }
    )
  }
}
