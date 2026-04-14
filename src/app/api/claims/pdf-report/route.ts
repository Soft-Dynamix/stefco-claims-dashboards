import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import PDFDocument from 'pdfkit'

const statusLabels: Record<string, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  MANUAL_REVIEW: 'Manual Review',
  FAILED: 'Failed',
  PENDING_REVIEW: 'Pending Review',
}

const statusColors: Record<string, string> = {
  NEW: '#0ea5e9',
  PROCESSING: '#f59e0b',
  COMPLETED: '#10b981',
  MANUAL_REVIEW: '#f97316',
  FAILED: '#ef4444',
  PENDING_REVIEW: '#a855f7',
}

function formatDateOnly(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function safeStr(val: string | null | undefined): string {
  return val || '—'
}

function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  // Dark header bar
  doc.rect(0, 0, doc.page.width, 60).fill('#111827')

  // Logo circle
  doc.circle(35, 30, 16).fill('#ffffff')
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827')
  doc.text('S', 28, 20, { width: 14, align: 'center' })

  // Brand name
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
  doc.text('Stefco Consultants', 60, 14)
  doc.font('Helvetica').fontSize(9).fillColor('#9ca3af')
  doc.text('Insurance Claims Management System', 60, 34)

  // Right side text
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
  doc.text(title, doc.page.width - 180, 16, { width: 160, align: 'right' })
  const now = new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(`Generated: ${now}`, doc.page.width - 180, 28, { width: 160, align: 'right' })

  doc.y = 75
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number) {
  const bottom = doc.page.height - 30
  doc.moveTo(doc.page.margins.left, bottom - 10)
    .lineTo(doc.page.width - doc.page.margins.right, bottom - 10)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke()

  doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
  doc.text(
    'Stefco Consultants — Insurance Claims Management System',
    doc.page.margins.left,
    bottom,
    { width: 250 }
  )
  doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
  doc.text(
    `Page ${pageNum}`,
    doc.page.width - doc.page.margins.right - 60,
    bottom,
    { width: 60, align: 'right' }
  )
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ef4444')
  doc.text(
    'CONFIDENTIAL — For authorized use only',
    doc.page.width - doc.page.margins.right - 200,
    bottom,
    { width: 130, align: 'right' }
  )
}

function checkPageBreak(doc: PDFKit.PDFDocument, needed: number, pageNum: { value: number }) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 50) {
    drawFooter(doc, pageNum.value)
    pageNum.value++
    doc.addPage()
    drawHeader(doc, 'Claims Summary Report')
  }
}

interface ClaimRow {
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  confidenceScore: number
  insuranceCompany: { name: string } | null
  createdAt: Date
  processedAt: Date | null
  excessAmount: string | null
  attachmentsCount: number
}

async function generateSummaryPDFBuffer(
  claims: ClaimRow[],
  filters: {
    status?: string
    claimType?: string
    search?: string
    insuranceCompany?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 70, bottom: 50, left: 40, right: 40 },
      info: {
        Title: 'Claims Summary Report',
        Author: 'Stefco Consultants',
        Subject: 'Insurance Claims Summary Report',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageNum = { value: 1 }

    // === HEADER ===
    drawHeader(doc, 'Claims Summary Report')

    // === FILTER SUMMARY ===
    doc.moveDown(0.3)
    const filterParts: string[] = []
    if (filters.status) filterParts.push(`Status: ${statusLabels[filters.status] || filters.status}`)
    if (filters.claimType) filterParts.push(`Type: ${filters.claimType}`)
    if (filters.search) filterParts.push(`Search: "${filters.search}"`)
    if (filters.insuranceCompany) filterParts.push(`Insurer: ${filters.insuranceCompany}`)
    if (filters.dateFrom) filterParts.push(`From: ${filters.dateFrom}`)
    if (filters.dateTo) filterParts.push(`To: ${filters.dateTo}`)

    if (filterParts.length > 0) {
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
      doc.text(`Filters: ${filterParts.join('  |  ')}`, doc.page.margins.left, doc.y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      })
    }
    doc.moveDown(0.5)

    // === STATS SUMMARY ===
    const totalPages = Math.ceil(claims.length / 25)
    const statusCounts: Record<string, number> = {}
    const typeCounts: Record<string, number> = {}
    let totalAttachments = 0
    let avgConfidence = 0

    for (const c of claims) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
      typeCounts[c.claimType] = (typeCounts[c.claimType] || 0) + 1
      totalAttachments += c.attachmentsCount
      avgConfidence += c.confidenceScore
    }
    avgConfidence = claims.length > 0 ? Math.round(avgConfidence / claims.length) : 0

    // Summary cards
    const cardData = [
      { label: 'Total Claims', value: String(claims.length) },
      { label: 'Avg Confidence', value: `${avgConfidence}%` },
      { label: 'Total Attachments', value: String(totalAttachments) },
      { label: 'Claim Types', value: String(Object.keys(typeCounts).length) },
    ]
    const cardWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - (cardData.length - 1) * 10) / cardData.length
    const cardStartY = doc.y + 2
    cardData.forEach((card, i) => {
      const x = doc.page.margins.left + i * (cardWidth + 10)
      doc.rect(x, cardStartY, cardWidth, 38).fillAndStroke('#f9fafb', '#e5e7eb')
      doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
      doc.text(card.label.toUpperCase(), x + 6, cardStartY + 6, { width: cardWidth - 12 })
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827')
      doc.text(card.value, x + 6, cardStartY + 18, { width: cardWidth - 12 })
    })
    doc.y = cardStartY + 48

    // Status distribution
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
    doc.text('Status Distribution', doc.page.margins.left, doc.y)
    doc.moveDown(0.3)

    const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])
    const statusBarWidth = 200
    const maxCount = Math.max(...statusEntries.map(([, v]) => v), 1)

    statusEntries.forEach(([status, count]) => {
      const y = doc.y
      doc.font('Helvetica').fontSize(8).fillColor('#374151')
      doc.text(`${statusLabels[status] || status}: ${count}`, doc.page.margins.left, y, { width: 130 })
      const barX = doc.page.margins.left + 135
      const barFill = Math.max(1, (count / maxCount) * statusBarWidth)
      doc.rect(barX, y + 1, statusBarWidth, 10).fillAndStroke('#f3f4f6', '#e5e7eb')
      doc.rect(barX, y + 1, barFill, 10).fill(statusColors[status] || '#6b7280')
      doc.y = y + 16
    })

    // Type distribution
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
    doc.text('Claim Type Distribution', doc.page.margins.left, doc.y)
    doc.moveDown(0.3)

    const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
    typeEntries.forEach(([type, count], idx) => {
      const x = doc.page.margins.left + idx * 75
      const y = doc.y
      doc.rect(x, y, 65, 28).fillAndStroke('#f9fafb', '#e5e7eb')
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827')
      doc.text(String(count), x + 4, y + 4, { width: 57 })
      doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
      doc.text(type, x + 4, y + 17, { width: 57 })
    })
    doc.y += 36

    // === CLAIMS TABLE ===
    checkPageBreak(doc, 60, pageNum)
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151')
    doc.text('Claims List', doc.page.margins.left, doc.y)
    doc.moveDown(0.4)

    // Table header
    const tableLeft = doc.page.margins.left
    const tableRight = doc.page.width - doc.page.margins.right
    const tableWidth = tableRight - tableLeft
    const colWidths = [85, 110, 65, 72, 55, 70]
    const colHeaders = ['Claim #', 'Client', 'Type', 'Status', 'Conf.', 'Date']

    // Header row background
    doc.rect(tableLeft, doc.y, tableWidth, 18).fill('#f9fafb')
    let x = tableLeft
    colHeaders.forEach((header, i) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280')
      doc.text(header, x + 4, doc.y + 4, { width: colWidths[i] - 8 })
      x += colWidths[i]
    })
    doc.y += 18

    // Table header bottom border
    doc.moveTo(tableLeft, doc.y)
      .lineTo(tableRight, doc.y)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke()

    // Table rows
    claims.forEach((claim, rowIdx) => {
      checkPageBreak(doc, 22, pageNum)

      const y = doc.y
      const rowHeight = 20

      // Alternating row background
      if (rowIdx % 2 === 1) {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill('#fafafa')
      }

      x = tableLeft
      const statusColor = statusColors[claim.status] || '#6b7280'

      // Claim Number
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111827')
      doc.text(claim.claimNumber, x + 4, y + 5, { width: colWidths[0] - 8 })
      x += colWidths[0]

      // Client Name
      doc.font('Helvetica').fontSize(7.5).fillColor('#374151')
      doc.text(claim.clientName, x + 4, y + 5, { width: colWidths[1] - 8, lineBreak: false, ellipsis: true })
      x += colWidths[1]

      // Claim Type
      doc.font('Helvetica').fontSize(7.5).fillColor('#374151')
      doc.text(claim.claimType, x + 4, y + 5, { width: colWidths[2] - 8 })
      x += colWidths[2]

      // Status badge
      doc.font('Helvetica-Bold').fontSize(7).fillColor(statusColor)
      doc.text(statusLabels[claim.status] || claim.status, x + 4, y + 5, { width: colWidths[3] - 8 })
      x += colWidths[3]

      // Confidence
      doc.font('Helvetica').fontSize(7.5).fillColor('#374151')
      doc.text(`${claim.confidenceScore}%`, x + 4, y + 5, { width: colWidths[4] - 8 })
      x += colWidths[4]

      // Date
      doc.font('Helvetica').fontSize(7).fillColor('#6b7280')
      doc.text(formatDateOnly(claim.createdAt), x + 4, y + 5, { width: colWidths[5] - 8 })

      doc.y = y + rowHeight

      // Row bottom border
      doc.moveTo(tableLeft, doc.y)
        .lineTo(tableRight, doc.y)
        .strokeColor('#f3f4f6')
        .lineWidth(0.3)
        .stroke()
    })

    // === FOOTER ===
    drawFooter(doc, pageNum.value)

    doc.end()
  })
}

// GET /api/claims/pdf-report - Generate multi-claim PDF summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') || undefined
    const claimType = searchParams.get('claimType') || undefined
    const search = searchParams.get('search') || undefined
    const insuranceCompany = searchParams.get('insuranceCompany') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }
    if (claimType) {
      where.claimType = claimType
    }
    if (insuranceCompany) {
      where.insuranceCompany = { folderName: insuranceCompany }
    }
    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { clientName: { contains: search } },
        { emailSubject: { contains: search } },
        { incidentDescription: { contains: search } },
      ]
    }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    const claims = await db.claim.findMany({
      where,
      include: {
        insuranceCompany: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const pdfBuffer = await generateSummaryPDFBuffer(claims, {
      status,
      claimType,
      search,
      insuranceCompany,
      dateFrom,
      dateTo,
    })

    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="STF-Claims_Summary_${timestamp}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Claims PDF report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate claims PDF report', details: String(error) },
      { status: 500 }
    )
  }
}
