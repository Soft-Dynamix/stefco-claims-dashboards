/**
 * SMTP Email Sender Utility
 * Uses nodemailer to send acknowledgment emails after claim creation.
 * Native SMTP sender for auto-reply acknowledgment emails.
 */

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromEmail: string
}

let transporter: nodemailer.Transporter | null = null

/**
 * Get SMTP config from SystemConfig + env vars
 */
export async function getSMTPConfig(): Promise<SMTPConfig | null> {
  try {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: ['smtp_host', 'smtp_port', 'smtp_ssl', 'smtp_user', 'smtp_password', 'smtp_from_name', 'smtp_from_email'],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const c of configs) map[c.key] = c.value

    const host = map['smtp_host'] || process.env.SMTP_HOST || ''
    const port = parseInt(map['smtp_port'] || process.env.SMTP_PORT || '587', 10)
    const secure = (map['smtp_ssl'] || process.env.SMTP_SSL || 'false') === 'true'
    const user = map['smtp_user'] || process.env.SMTP_USER || ''
    const pass = map['smtp_password'] || process.env.SMTP_PASSWORD || ''
    const fromName = map['smtp_from_name'] || 'Stefco Consultants (Pty) Ltd'
    const fromEmail = map['smtp_from_email'] || user || 'claims@stefco-assess.co.za'

    if (!host || !user || !pass) {
      return null
    }

    return { host, port, secure, user, pass, fromName, fromEmail }
  } catch {
    return null
  }
}

/**
 * Get or create a nodemailer transport instance
 */
async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter

  const config = await getSMTPConfig()
  if (!config) return null

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  })

  return transporter
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = await getTransporter()
    if (!transport) {
      return { success: false, error: 'SMTP not configured' }
    }

    await transport.verify()
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Reset transporter on error
    transporter = null
    return { success: false, error: message }
  }
}

/**
 * Send a claim acknowledgment email to the sender
 */
export async function sendClaimAcknowledgment(params: {
  toEmail: string
  clientName: string
  claimNumber: string
  claimType: string
  subject?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getSMTPConfig()
    const transport = await getTransporter()

    if (!config || !transport) {
      console.error('[smtp] Cannot send email: SMTP not configured')
      return { success: false, error: 'SMTP not configured' }
    }

    const replySubject = params.subject
      ? `Re: ${params.subject} - Claim Received`
      : `Claim Received - ${params.claimNumber}`

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: params.toEmail,
      subject: replySubject,
      // ── Loop-prevention headers ──
      // These headers allow the IMAP poller to detect and skip its own auto-replies,
      // preventing an infinite email processing loop.
      headers: {
        'X-Auto-Response-Suppress': 'All',
        'X-Stefco-Auto-Reply': 'true',
        'Auto-Submitted': 'auto-replied',
        'Precedence': 'bulk',
        'X-Loop': config.fromEmail,
      },
      text: `Dear ${params.clientName},

Thank you for your email. Your claim has been received and is being processed.

Claim Reference: ${params.claimNumber}
Claim Type: ${params.claimType}

Our team will contact you shortly with an update. If you have any questions in the meantime, please reply to this email.

Kind regards,
${config.fromName}
Claims Department

---
This is an automated acknowledgment. Please do not delete this email as it contains your claim reference number.`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 30px 40px; color: white; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .body { padding: 30px 40px; }
    .body p { font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 16px; }
    .claim-ref { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .claim-ref-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .claim-ref-label { color: #6b7280; }
    .claim-ref-value { color: #065f46; font-weight: 600; }
    .footer { padding: 20px 40px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { font-size: 12px; color: #9ca3af; margin: 4px 0; }
    .footer a { color: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Claim Received</h1>
      <p>Your insurance claim has been successfully registered</p>
    </div>
    <div class="body">
      <p>Dear <strong>${params.clientName}</strong>,</p>
      <p>Thank you for your email. Your claim has been received and is being processed by our assessment team.</p>
      <div class="claim-ref">
        <div class="claim-ref-row">
          <span class="claim-ref-label">Claim Reference</span>
          <span class="claim-ref-value">${params.claimNumber}</span>
        </div>
        <div class="claim-ref-row">
          <span class="claim-ref-label">Claim Type</span>
          <span class="claim-ref-value">${params.claimType}</span>
        </div>
      </div>
      <p>Our team will contact you shortly with an update. If you have any urgent questions, please reply to this email with your claim reference number.</p>
      <p>Kind regards,<br><strong>Stefco Consultants (Pty) Ltd</strong><br>Claims Department</p>
    </div>
    <div class="footer">
      <p>Stefco Consultants (Pty) Ltd — Insurance Loss Assessors</p>
      <p>This is an automated acknowledgment. Do not delete — it contains your claim reference.</p>
    </div>
  </div>
</body>
</html>`,
    }

    const info = await transport.sendMail(mailOptions)
    console.error(`[smtp] Acknowledgment sent to ${params.toEmail}: ${info.messageId}`)

    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[smtp] Failed to send acknowledgment: ${message}`)
    // Reset transporter on error
    transporter = null
    return { success: false, error: message }
  }
}

/**
 * Check if auto-reply is enabled in system config
 */
export async function isAutoReplyEnabled(): Promise<boolean> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key: 'auto_reply_enabled' },
    })
    // Default to enabled if not explicitly set
    return config?.value !== 'false'
  } catch {
    return true
  }
}
