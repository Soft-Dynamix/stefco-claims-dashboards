import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractClaimData } from '@/lib/ai-helpers'

/**
 * POST /api/process-email/extract
 *
 * Standalone extraction endpoint for testing data extraction without full processing.
 * Uses z-ai-web-dev-sdk with the extraction prompt (spec §4.3).
 */

const extractSchema = z.object({
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
  from: z.string().min(1, 'Sender email is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = extractSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { subject, body: emailBody, from } = result.data

    const extraction = await extractClaimData(subject, emailBody, from)

    return NextResponse.json({
      claimData: extraction.claimData,
      confidence: extraction.confidence,
    })
  } catch (error) {
    console.error('Email extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract claim data', details: String(error) },
      { status: 500 }
    )
  }
}
