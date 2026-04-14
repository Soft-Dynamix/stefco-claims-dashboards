import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const addNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000, 'Note is too long (max 2000 characters)'),
  type: z.enum(['General', 'Follow-up', 'Decision', 'Document Request', 'Internal']).default('General'),
  pinned: z.boolean().default(false),
})

// In-memory notes store (supplements the DB notes field)
const notesStore: Record<string, Array<{
  id: string
  text: string
  type: string
  pinned: boolean
  timestamp: string
}>> = {}

function getNotes(claimId: string) {
  return notesStore[claimId] || []
}

function addNoteToStore(claimId: string, text: string, type: string, pinned: boolean) {
  if (!notesStore[claimId]) notesStore[claimId] = []
  const note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    type,
    pinned,
    timestamp: new Date().toISOString(),
  }
  notesStore[claimId].unshift(note)
  return note
}

function togglePin(claimId: string, noteId: string) {
  const notes = getNotes(claimId)
  const note = notes.find((n) => n.id === noteId)
  if (note) {
    note.pinned = !note.pinned
  }
  return note
}

// GET /api/claims/[id]/notes - Get notes for a claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const claim = await db.claim.findUnique({
      where: { id },
      select: { notes: true },
    })
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Return in-memory notes (sorted: pinned first, then by date desc)
    const enrichedNotes = getNotes(id).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json({
      notes: enrichedNotes,
      legacyNotes: claim.notes || '',
    })
  } catch (error) {
    console.error('Get notes error:', error)
    return NextResponse.json({ error: 'Failed to get notes' }, { status: 500 })
  }
}

// POST /api/claims/[id]/notes - Add a note to a claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const result = addNoteSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { content, type, pinned } = result.data

    // Check claim exists
    const claim = await db.claim.findUnique({ where: { id } })
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Add to legacy notes field for backwards compatibility
    const timestamp = new Date().toISOString()
    const noteEntry = `[${timestamp}] [${type}] ${content}`
    const updatedNotes = claim.notes
      ? `${claim.notes}\n${noteEntry}`
      : noteEntry

    await db.claim.update({
      where: { id },
      data: { notes: updatedNotes },
    })

    // Add to in-memory store
    const note = addNoteToStore(id, content, type, pinned)

    // Create audit log entry
    await db.auditLog.create({
      data: {
        claimId: id,
        action: 'NOTE_ADDED',
        details: `[${type}] ${content}`,
        status: 'SUCCESS',
        processedBy: 'MANUAL',
      },
    })

    // Return all notes for the claim
    const allNotes = getNotes(id).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json({ note, notes: allNotes, message: 'Note added successfully' })
  } catch (error) {
    console.error('Claim note error:', error)
    return NextResponse.json(
      { error: 'Failed to add note', details: String(error) },
      { status: 500 }
    )
  }
}

// PATCH /api/claims/[id]/notes - Toggle pin on a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { noteId } = body

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 })
    }

    const note = togglePin(id, noteId)
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const allNotes = getNotes(id).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json({ note, notes: allNotes })
  } catch (error) {
    console.error('Toggle pin error:', error)
    return NextResponse.json({ error: 'Failed to toggle pin' }, { status: 500 })
  }
}
