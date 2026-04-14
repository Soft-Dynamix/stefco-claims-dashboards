import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const DEFAULT_STAGES = [
  { stageKey: 'RECEIVED', label: 'Email Received', description: 'Incoming claim email is received and parsed', icon: 'Mail', color: 'sky', sortOrder: 0 },
  { stageKey: 'CLASSIFIED', label: 'AI Classification', description: 'AI classifies the email as new claim or ignore', icon: 'Brain', color: 'violet', sortOrder: 1 },
  { stageKey: 'EXTRACTED', label: 'Data Extraction', description: 'AI extracts claim details from email content', icon: 'FileSearch', color: 'amber', sortOrder: 2 },
  { stageKey: 'FOLDER_CREATED', label: 'Insurance Mapping', description: 'Maps claim to insurance company and creates folder', icon: 'Building2', color: 'emerald', sortOrder: 3 },
  { stageKey: 'DOCUMENTS_SAVED', label: 'Document Handling', description: 'Saves extracted documents to the claim folder', icon: 'FolderPlus', color: 'teal', sortOrder: 4 },
  { stageKey: 'PRINTED', label: 'Print Coordination', description: 'Queues documents for printing during business hours', icon: 'Printer', color: 'orange', sortOrder: 5 },
  { stageKey: 'LOGGED', label: 'Audit Logging', description: 'Records all processing steps in audit trail', icon: 'FileDown', color: 'slate', sortOrder: 6 },
  { stageKey: 'RESPONDED', label: 'Auto Response', description: 'Sends acknowledgment email to the sender', icon: 'Send', color: 'emerald', sortOrder: 7 },
]

export async function POST() {
  try {
    const existing = await db.workflowStage.findMany()
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Workflow stages already initialized', count: existing.length })
    }

    const created = await db.workflowStage.createMany({
      data: DEFAULT_STAGES,
    })

    return NextResponse.json({
      success: true,
      message: `Initialized ${created.count} default workflow stages`,
      count: created.count,
    })
  } catch (error) {
    console.error('Failed to initialize workflow stages:', error)
    return NextResponse.json({ error: 'Failed to initialize workflow stages' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stages = await db.workflowStage.findMany({ orderBy: { sortOrder: 'asc' } })
    const initialized = stages.length > 0
    return NextResponse.json({ initialized, count: stages.length, stages })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check workflow status' }, { status: 500 })
  }
}
