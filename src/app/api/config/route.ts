import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/config - Return all system configs as key-value object
export async function GET() {
  try {
    const configs = await db.systemConfig.findMany()

    const configMap: Record<string, string> = {}
    for (const config of configs) {
      configMap[config.key] = config.value
    }

    return NextResponse.json({ config: configMap })
  } catch (error) {
    console.error('Config fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system configuration', details: String(error) },
      { status: 500 }
    )
  }
}

// PUT /api/config - Update system configs (accepts { key: value } pairs)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an object with key-value pairs' },
        { status: 400 }
      )
    }

    const entries = Object.entries(body)

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No configuration values provided' },
        { status: 400 }
      )
    }

    const updatedConfigs = []

    for (const [key, value] of entries) {
      if (typeof key !== 'string' || key.trim().length === 0) {
        continue
      }

      const stringValue = String(value)

      const config = await db.systemConfig.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      })

      updatedConfigs.push(config)
    }

    // Build updated config map for response
    const allConfigs = await db.systemConfig.findMany()
    const configMap: Record<string, string> = {}
    for (const config of allConfigs) {
      configMap[config.key] = config.value
    }

    return NextResponse.json({
      message: `${updatedConfigs.length} configuration(s) updated`,
      updated: updatedConfigs.length,
      config: configMap,
    })
  } catch (error) {
    console.error('Config update error:', error)
    return NextResponse.json(
      { error: 'Failed to update system configuration', details: String(error) },
      { status: 500 }
    )
  }
}
