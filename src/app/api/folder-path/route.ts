import { NextRequest, NextResponse } from 'next/server'
import { generateFolderPath, sanitizeClientName } from '@/lib/folder-utils'

/**
 * GET /api/folder-path
 *
 * Folder path preview endpoint.
 * Accepts query params: claimNumber, clientName, insuranceCompany, date
 * Returns: { folderPath, sanitizedName }
 *
 * Implements the spec's naming convention (§4.5):
 * Z:\{Year}\{Month}\{FolderName}\{ClaimNumber} - {ClientName}
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const claimNumber = searchParams.get('claimNumber')
    const clientName = searchParams.get('clientName')
    const folderName = searchParams.get('insuranceCompany') || 'PENDING_REVIEW'
    const dateParam = searchParams.get('date')

    if (!claimNumber) {
      return NextResponse.json(
        { error: 'claimNumber query parameter is required' },
        { status: 400 }
      )
    }

    if (!clientName) {
      return NextResponse.json(
        { error: 'clientName query parameter is required' },
        { status: 400 }
      )
    }

    // Parse date if provided, otherwise use current date
    let date: Date | undefined
    if (dateParam) {
      const parsed = new Date(dateParam)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use ISO 8601 format (e.g., 2026-04-15)' },
          { status: 400 }
        )
      }
      date = parsed
    }

    const sanitizedName = sanitizeClientName(clientName)
    const folderPath = generateFolderPath(claimNumber, clientName, folderName, date)

    return NextResponse.json({
      folderPath,
      sanitizedName,
      claimNumber,
      originalClientName: clientName,
      insuranceCompany: folderName,
      date: date ? date.toISOString() : new Date().toISOString(),
    })
  } catch (error) {
    console.error('Folder path generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate folder path', details: String(error) },
      { status: 500 }
    )
  }
}
