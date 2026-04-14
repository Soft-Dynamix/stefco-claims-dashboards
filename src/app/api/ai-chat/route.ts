import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

// In-memory conversation store (per session)
const conversations = new Map<string, { role: 'user' | 'system' | 'assistant'; content: string }[]>()

const SYSTEM_PROMPT = `You are the Stefco AI Claims Assistant — an intelligent helper for insurance claims processing at Stefco Consultants (Pty) Ltd in South Africa.

Your capabilities:
- Answer questions about claims, insurance processes, and the dashboard
- Help users understand claim statuses: NEW, PROCESSING, COMPLETED, MANUAL_REVIEW, FAILED, PENDING_REVIEW
- Explain claim types: Motor, Building, Marine, Agricultural, Household, Liability
- Guide users through the claims processing pipeline stages
- Provide tips on claim documentation and best practices
- Help with insurance company-specific queries (Santam, Hollard, Old Mutual, Momentum, Discovery, Outsurance, SAIA)
- Explain confidence scores and AI classification results
- Assist with workflow configuration and automation settings

Rules:
- Be concise but thorough
- Use professional yet friendly tone
- Reference South African insurance terminology where relevant
- If asked about data you don't have access to, suggest checking the relevant dashboard view
- Format responses with bullet points or numbered lists when appropriate
- Keep responses focused and actionable

Context about the system:
- Stefco Claims Dashboard v3.0.3 processes insurance claims via AI
- Claims go through 8 stages: Received → Classified → Extracted → Folder Created → Documents Saved → Printed → Logged → Responded
- The system uses AI for email classification and data extraction
- Print queue manages document printing
- SLA target is 2 hours for claim processing`

async function getZAI() {
  return await ZAI.create()
}

function getOrCreateConversation(sessionId: string) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, [
      { role: 'system', content: SYSTEM_PROMPT }
    ])
  }
  return conversations.get(sessionId)!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, sessionId = 'default', claimContext } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 }
      )
    }

    const zai = await getZAI()
    const history = getOrCreateConversation(sessionId)

    // Build context message if claim data is provided
    let userMessage = message
    if (claimContext) {
      userMessage = `[Context: Working with claim ${claimContext.claimNumber} - ${claimContext.clientName}, Status: ${claimContext.status}, Type: ${claimContext.claimType}, Insurance: ${claimContext.insuranceCompany || 'N/A'}, Confidence: ${claimContext.confidenceScore}%]\n\nUser question: ${message}`
    }

    // Add user message to history
    history.push({ role: 'user', content: userMessage })

    // Trim history if too long (keep system + last 20 messages)
    if (history.length > 22) {
      const trimmed = [history[0], ...history.slice(-20)]
      conversations.set(sessionId, trimmed)
    }

    // Get completion
    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse })

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1
    })
  } catch (error) {
    console.error('AI Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || 'default'
    conversations.delete(sessionId)
    return NextResponse.json({ success: true, message: 'Conversation cleared' })
  } catch {
    return NextResponse.json(
      { error: 'Failed to clear conversation' },
      { status: 500 }
    )
  }
}
