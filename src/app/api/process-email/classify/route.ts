import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { classifyEmail } from '@/lib/ai-helpers'

/**
 * POST /api/process-email/classify
 *
 * Standalone classification endpoint for testing classification without full processing.
 * Uses z-ai-web-dev-sdk with the classification prompt (spec §4.2).
 */

const classifySchema = z.object({
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
  from: z.string().min(1, 'Sender email is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = classifySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { subject, body: emailBody, from } = result.data

    const classification = await classifyEmail(subject, emailBody, from)

    return NextResponse.json({
      classification: classification.classification,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    })
  } catch (error) {
    console.error('Email classification error:', error)
    return NextResponse.json(
      { error: 'Failed to classify email', details: String(error) },
      { status: 500 }
    )
  }
}
