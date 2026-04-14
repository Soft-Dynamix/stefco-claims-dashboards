import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const bulkActionSchema = z.object({
  action: z.enum(['mark_all_printed', 'clear_completed']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = bulkActionSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid action. Use "mark_all_printed" or "clear_completed".' },
        { status: 400 }
      )
    }

    const { action } = result.data

    if (action === 'mark_all_printed') {
      const { count } = await db.printQueueItem.updateMany({
        where: {
          printStatus: { in: ['QUEUED', 'PRINTING'] },
        },
        data: {
          printStatus: 'COMPLETED',
          printedAt: new Date(),
          error: null,
        },
      })

      return NextResponse.json({
        message: `Marked ${count} item(s) as printed.`,
        count,
      })
    }

    if (action === 'clear_completed') {
      const deleted = await db.printQueueItem.deleteMany({
        where: {
          printStatus: 'COMPLETED',
        },
      })

      return NextResponse.json({
        message: `Cleared ${deleted.count} completed item(s).`,
        count: deleted.count,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Print queue bulk action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk action', details: String(error) },
      { status: 500 }
    )
  }
}
