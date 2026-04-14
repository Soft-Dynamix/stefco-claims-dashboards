import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * POST /api/auto-reply
 *
 * Generate auto-reply email (spec §4.9).
 * Returns: { subject, body }
 */

const autoReplySchema = z.object({
  claimNumber: z.string().min(1, 'Claim number is required'),
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Valid sender email is required'),
})

/**
 * Auto-reply email template from spec §4.9.1
 */
function generateAutoReply(claimNumber: string, senderName: string): {
  subject: string
  body: string
} {
  const subject = `Claim Received - ${claimNumber}`

  const body = `Dear ${senderName},

Thank you for your email. We can confirm that your claim (${claimNumber}) has been successfully received and is being processed.

Our team will review the submission and contact you should any additional information or documentation be required.

If you have any urgent queries, please don't hesitate to contact our office directly.

Kind regards,
Stefco Assessors
Office: +27 21 555 0100
Email: claims@stefco.co.za`

  return { subject, body }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = autoReplySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { claimNumber, senderName, senderEmail } = result.data

    const autoReply = generateAutoReply(claimNumber, senderName)

    return NextResponse.json({
      to: senderEmail,
      toName: senderName,
      subject: autoReply.subject,
      body: autoReply.body,
    })
  } catch (error) {
    console.error('Auto-reply generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate auto-reply', details: String(error) },
      { status: 500 }
    )
  }
}
