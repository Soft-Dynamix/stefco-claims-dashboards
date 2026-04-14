import { NextResponse } from 'next/server'
import { testSMTPConnection, getSMTPConfig } from '@/lib/smtp'

/**
 * GET /api/smtp/status
 * Returns SMTP configuration status (configured or not, can test connection)
 */
export async function GET() {
  const config = await getSMTPConfig()
  return NextResponse.json({
    configured: !!config,
    config: config ? {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user ? `${config.user.slice(0, 3)}***` : '',
      fromName: config.fromName,
      fromEmail: config.fromEmail,
    } : null,
  })
}

/**
 * POST /api/smtp/test
 * Tests SMTP connection by verifying the transport
 */
export async function POST() {
  const result = await testSMTPConnection()
  return NextResponse.json(result)
}
