import { NextResponse } from 'next/server'

/**
 * GET /api/email-poller-status
 *
 * Returns the status of the background email poller service.
 * Proxies to the email-poller mini-service on port 3010.
 */
export async function GET() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch('http://localhost:3010/status', {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({
        poller_running: true,
        ...data,
      })
    }

    return NextResponse.json({
      poller_running: false,
      error: 'Email poller service not responding',
    })
  } catch {
    return NextResponse.json({
      poller_running: false,
      error: 'Email poller service is not running. Start it with: cd mini-services/email-poller && bun run dev',
    })
  }
}
