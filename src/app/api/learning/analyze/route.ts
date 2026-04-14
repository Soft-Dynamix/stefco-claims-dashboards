import { NextResponse } from 'next/server'
import { runLearningAnalysis } from '@/lib/agents/learning-agent'

/**
 * GET /api/learning/analyze
 *
 * Run the periodic learning agent to analyze accumulated corrections
 * and generate improvement suggestions.
 *
 * This endpoint is intended to be called periodically (daily/weekly)
 * or manually by the user to get an analysis report.
 */
export async function GET() {
  try {
    const analysis = await runLearningAnalysis()

    return NextResponse.json({
      success: true,
      analysis,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Learning analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to run learning analysis', details: String(error) },
      { status: 500 }
    )
  }
}
