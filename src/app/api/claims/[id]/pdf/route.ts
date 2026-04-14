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

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function formatProcessingStage(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function drawHeader(doc: PDFKit.PDFDocument) {
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
  doc.text('Claim Detail Report', doc.page.width - 160, 16, { width: 140, align: 'right' })
  const now = formatDateTime(new Date())
  doc.text(`Generated: ${now}`, doc.page.width - 160, 28, { width: 140, align: 'right' })

  doc.y = 75
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, icon: string) {
  checkPageBreak(doc, 40)
  doc.moveDown(0.8)
  const y = doc.y

  // Accent bar
  doc.rect(doc.page.margins.left, y, 3, 18).fill('#111827')

  // Section title
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151')
  doc.text(`${icon}  ${title}`, doc.page.margins.left + 10, y + 2)

  // Underline
  doc.moveTo(doc.page.margins.left, y + 24)
    .lineTo(doc.page.width - doc.page.margins.right, y + 24)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke()

  doc.y = y + 32
}

function drawFieldRow(doc: PDFKit.PDFDocument, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  const startY = doc.y
  const labelWidth = 100
  const valueWidth = 140
  const midGap = 30
  const marginLeft = doc.page.margins.left

  // Left field
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
  doc.text(leftLabel, marginLeft, startY, { width: labelWidth })
  doc.font('Helvetica').fontSize(9).fillColor('#111827')
  doc.text(safeStr(leftValue), marginLeft, startY + 11, { width: labelWidth + valueWidth - labelWidth, lineGap: 1 })

  // Right field
  const rightStart = marginLeft + labelWidth + valueWidth - labelWidth + midGap
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
  doc.text(rightLabel, rightStart, startY, { width: labelWidth })
  doc.font('Helvetica').fontSize(9).fillColor('#111827')
  doc.text(safeStr(rightValue), rightStart, startY + 11, { width: labelWidth + valueWidth - labelWidth, lineGap: 1 })

  doc.y = startY + 28
}

function drawFieldRowFull(doc: PDFKit.PDFDocument, label: string, value: string) {
  const startY = doc.y
  const marginLeft = doc.page.margins.left
  const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
  doc.text(label, marginLeft, startY, { width: 100 })

  doc.font('Helvetica').fontSize(9).fillColor('#111827')
  const valHeight = doc.heightOfString(safeStr(value), { width: maxWidth - 20 })
  doc.text(safeStr(value), marginLeft + 10, startY + 11, { width: maxWidth - 20, lineGap: 1 })

  doc.y = startY + 11 + valHeight + 8
}

function checkPageBreak(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 40) {
    doc.addPage()
    drawHeader(doc)
  }
}

function drawSummaryCards(
  doc: PDFKit.PDFDocument,
  cards: { label: string; value: string; color?: string }[]
) {
  const startY = doc.y + 4
  const cardWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - (cards.length - 1) * 8) / cards.length
  const marginLeft = doc.page.margins.left

  cards.forEach((card, i) => {
    const x = marginLeft + i * (cardWidth + 8)
    // Card background
    doc.rect(x, startY, cardWidth, 40).fillAndStroke('#f9fafb', '#e5e7eb')
    // Label
    doc.font('Helvetica').fontSize(7).fillColor('#9ca3af')
    doc.text(card.label.toUpperCase(), x + 6, startY + 6, { width: cardWidth - 12 })
    // Value
    doc.font('Helvetica-Bold').fontSize(11).fillColor(card.color || '#111827')
    doc.text(card.value, x + 6, startY + 18, { width: cardWidth - 12 })
  })

  doc.y = startY + 50
}

function drawFooter(doc: PDFKit.PDFDocument, claimNumber: string) {
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
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ef4444')
  doc.text(
    'CONFIDENTIAL — For authorized use only',
    doc.page.width - doc.page.margins.right - 200,
    bottom,
    { width: 200, align: 'right' }
  )
}

async function generateClaimPDFBuffer(claim: {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  processingStage: string
  senderEmail: string | null
  emailSubject: string | null
  contactNumber: string | null
  contactEmail: string | null
  incidentDescription: string | null
  excessAmount: string | null
  specialInstructions: string | null
  folderPath: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleYear: string | null
  vehicleRegistration: string | null
  propertyAddress: string | null
  attachmentsCount: number
  confidenceScore: number
  aiClassification: string | null
  aiClassificationConfidence: number
  createdAt: Date
  updatedAt: Date
  processedAt: Date | null
  insuranceCompany: {
    id: string
    name: string
    folderName: string
  } | null
  notes: string | null
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 70, bottom: 50, left: 45, right: 45 },
      info: {
        Title: `Claim Report - ${claim.claimNumber}`,
        Author: 'Stefco Consultants',
        Subject: 'Insurance Claim Detail Report',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // === HEADER ===
    drawHeader(doc)

    // === SUMMARY BAR ===
    const statusLabel = statusLabels[claim.status] || claim.status
    const statusColor = statusColors[claim.status] || '#6b7280'
    const claimDate = formatDateOnly(claim.createdAt)

    drawSummaryCards(doc, [
      { label: 'Claim Number', value: claim.claimNumber },
      { label: 'Client Name', value: claim.clientName },
      { label: 'Claim Type', value: claim.claimType },
      { label: 'Status', value: statusLabel, color: statusColor },
      { label: 'Date Received', value: claimDate },
    ])

    // === CLIENT DETAILS ===
    drawSectionHeader(doc, 'CLIENT DETAILS', '\u{1F464}')
    drawFieldRow(doc, 'Client Name', claim.clientName, 'Contact Number', claim.contactNumber || '')
    drawFieldRow(doc, 'Contact Email', claim.contactEmail || '', 'Sender Email', claim.senderEmail || '')

    // === VEHICLE / PROPERTY DETAILS ===
    if (claim.claimType === 'Motor' && (claim.vehicleMake || claim.vehicleModel || claim.vehicleYear || claim.vehicleRegistration)) {
      drawSectionHeader(doc, 'VEHICLE DETAILS', '\u{1F697}')
      drawFieldRow(doc, 'Vehicle Make', claim.vehicleMake || '', 'Vehicle Model', claim.vehicleModel || '')
      drawFieldRow(doc, 'Vehicle Year', claim.vehicleYear || '', 'Registration No.', claim.vehicleRegistration || '')
    } else if (claim.claimType === 'Building' && claim.propertyAddress) {
      drawSectionHeader(doc, 'PROPERTY DETAILS', '\u{1F3E0}')
      drawFieldRowFull(doc, 'Property Address', claim.propertyAddress)
    }

    // === INCIDENT DESCRIPTION ===
    if (claim.incidentDescription) {
      drawSectionHeader(doc, 'INCIDENT DESCRIPTION', '\u26A0')
      drawFieldRowFull(doc, 'Description', claim.incidentDescription)
    }

    if (claim.specialInstructions) {
      drawFieldRowFull(doc, 'Special Instructions', claim.specialInstructions)
    }

    // === FINANCIAL & INSURANCE ===
    drawSectionHeader(doc, 'FINANCIAL & INSURANCE', '\u{1F4B0}')
    drawFieldRow(doc, 'Excess Amount', claim.excessAmount || '—', 'Attachments', String(claim.attachmentsCount))
    drawFieldRow(doc, 'Confidence Score', `${claim.confidenceScore}%`, 'AI Classification', claim.aiClassification || '—')
    drawFieldRow(doc, 'Insurance Company', claim.insuranceCompany?.name || '—', 'Folder', claim.insuranceCompany?.folderName || '—')
    if (claim.folderPath) {
      drawFieldRowFull(doc, 'Folder Path', claim.folderPath)
    }

    // === PROCESSING STATUS ===
    drawSectionHeader(doc, 'PROCESSING STATUS', '\u2699')
    drawFieldRow(
      doc,
      'Current Status',
      statusLabel,
      'Processing Stage',
      formatProcessingStage(claim.processingStage)
    )
    drawFieldRow(
      doc,
      'Date Received',
      claimDate,
      'Date Processed',
      claim.processedAt ? formatDateOnly(claim.processedAt) : '—'
    )
    drawFieldRow(
      doc,
      'Last Updated',
      formatDateOnly(claim.updatedAt),
      'AI Confidence',
      `${claim.aiClassificationConfidence}%`
    )

    // === NOTES ===
    if (claim.notes && claim.notes.trim()) {
      drawSectionHeader(doc, 'NOTES', '\u{1F4DD}')
      const notesLines = claim.notes.split('\n').filter((n) => n.trim())
      for (const line of notesLines) {
        checkPageBreak(doc, 20)
        drawFieldRowFull(doc, 'Note', line)
      }
    }

    // === FOOTER ===
    drawFooter(doc, claim.claimNumber)

    doc.end()
  })
}

// GET /api/claims/[id]/pdf - Generate PDF for a single claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        insuranceCompany: {
          select: { id: true, name: true, folderName: true },
        },
      },
    })

    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      )
    }

    const pdfBuffer = await generateClaimPDFBuffer(claim)

    const fileName = `STF-${claim.claimNumber}_Claim_Report.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Claim PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate claim PDF', details: String(error) },
      { status: 500 }
    )
  }
}
