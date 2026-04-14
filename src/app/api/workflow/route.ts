import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/workflow — fetch all stages ordered by sortOrder
export async function GET() {
  try {
    const stages = await db.workflowStage.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json({ stages })
  } catch (error) {
    console.error('Failed to fetch workflow stages:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow stages' }, { status: 500 })
  }
}

// POST /api/workflow — create a new stage
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { stageKey, label, description, icon, color } = body

    if (!stageKey || !label) {
      return NextResponse.json({ error: 'stageKey and label are required' }, { status: 400 })
    }

    // Check for duplicate stageKey
    const existing = await db.workflowStage.findUnique({ where: { stageKey } })
    if (existing) {
      return NextResponse.json({ error: `Stage with key "${stageKey}" already exists` }, { status: 409 })
    }

    // Get max sortOrder
    const maxStage = await db.workflowStage.findFirst({ orderBy: { sortOrder: 'desc' } })
    const sortOrder = (maxStage?.sortOrder ?? -1) + 1

    const stage = await db.workflowStage.create({
      data: {
        stageKey,
        label,
        description: description || '',
        icon: icon || 'Circle',
        color: color || 'slate',
        sortOrder,
        config: body.config || '{}',
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : true,
      },
    })

    return NextResponse.json({ stage, success: true })
  } catch (error) {
    console.error('Failed to create workflow stage:', error)
    return NextResponse.json({ error: 'Failed to create workflow stage' }, { status: 500 })
  }
}

// PUT /api/workflow — update a stage (enable/disable, reorder, edit)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const stage = await db.workflowStage.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json({ stage, success: true })
  } catch (error) {
    console.error('Failed to update workflow stage:', error)
    return NextResponse.json({ error: 'Failed to update workflow stage' }, { status: 500 })
  }
}

// PUT /api/workflow/reorder — batch update sort orders
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { orders } = body // [{ id: "xxx", sortOrder: 0 }, ...]

    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 })
    }

    await Promise.all(
      orders.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        db.workflowStage.update({ where: { id }, data: { sortOrder } })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder workflow stages:', error)
    return NextResponse.json({ error: 'Failed to reorder workflow stages' }, { status: 500 })
  }
}

// DELETE /api/workflow — delete a stage
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
    }

    await db.workflowStage.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete workflow stage:', error)
    return NextResponse.json({ error: 'Failed to delete workflow stage' }, { status: 500 })
  }
}
