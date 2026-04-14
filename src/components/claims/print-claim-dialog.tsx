'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PrintClaimDialogProps {
  claimId: string
  claimNumber: string
  onClose?: () => void
}

interface PrintClaimData {
  claim: {
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
    documentsPrinted: boolean
    confidenceScore: number
    aiClassification: string | null
    aiClassificationConfidence: number
    createdAt: string
    updatedAt: string
    processedAt: string | null
    insuranceCompany: {
      id: string
      name: string
      folderName: string
    } | null
  }
  auditLogs: Array<{
    id: string
    action: string
    details: string | null
    status: string
    processedBy: string | null
    createdAt: string
  }>
  printQueueItems: Array<{
    id: string
    fileName: string
    printStatus: string
    pages: number | null
    createdAt: string
    printedAt: string | null
    error: string | null
  }>
  notes: Array<{
    timestamp: string
    type: string
    text: string
  }>
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    MANUAL_REVIEW: 'Manual Review',
    FAILED: 'Failed',
    PENDING_REVIEW: 'Pending Review',
  }
  return labels[status] || status
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getConfidenceColor(score: number): string {
  if (score >= 80) return '#059669'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: '#0284c7',
    PROCESSING: '#d97706',
    COMPLETED: '#059669',
    MANUAL_REVIEW: '#ea580c',
    FAILED: '#dc2626',
    PENDING_REVIEW: '#7c3aed',
  }
  return colors[status] || '#6b7280'
}

function getPrintStatusColor(status: string): string {
  const colors: Record<string, string> = {
    QUEUED: '#6b7280',
    PRINTING: '#2563eb',
    COMPLETED: '#059669',
    FAILED: '#dc2626',
  }
  return colors[status] || '#6b7280'
}

function getAuditStatusColor(status: string): string {
  const colors: Record<string, string> = {
    SUCCESS: '#059669',
    WARNING: '#d97706',
    ERROR: '#dc2626',
  }
  return colors[status] || '#6b7280'
}

function generatePrintHTML(data: PrintClaimData): string {
  const { claim, auditLogs, printQueueItems, notes } = data
  const now = new Date().toISOString()

  const isMotor = claim.claimType === 'Motor'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stefco Claims Assessment - ${claim.claimNumber}</title>
  <style>
    @page {
      margin: 15mm 12mm;
      size: A4;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1f2937;
      background: #fff;
    }
    
    /* Header */
    .header {
      border-bottom: 3px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .company-name {
      font-size: 22px;
      font-weight: 700;
      color: #064e3b;
      letter-spacing: -0.5px;
    }
    .company-tagline {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 2px;
    }
    .report-title {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      text-align: right;
    }
    .report-meta {
      font-size: 9px;
      color: #9ca3af;
      text-align: right;
      margin-top: 2px;
    }
    .claim-header-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 10px 16px;
    }
    .claim-number {
      font-size: 16px;
      font-weight: 700;
      color: #064e3b;
    }
    .claim-type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      color: #fff;
    }

    /* Sections */
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #374151;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 10px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: #059669;
      border-radius: 2px;
      margin-right: 8px;
      vertical-align: middle;
    }

    /* Grid layout */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px 24px;
    }

    /* Field rows */
    .field-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 4px 0;
      border-bottom: 1px dotted #f3f4f6;
    }
    .field-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      font-weight: 500;
    }
    .field-value {
      font-size: 11px;
      color: #1f2937;
      font-weight: 500;
      text-align: right;
    }

    /* Tables */
    .print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .print-table th {
      background: #f9fafb;
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    .print-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
    }
    .print-table tr:last-child td {
      border-bottom: none;
    }
    .print-table tr:nth-child(even) {
      background: #fafafa;
    }

    /* Status dot */
    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }

    /* Confidence bar */
    .confidence-bar-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .confidence-bar {
      flex: 1;
      height: 6px;
      background: #f3f4f6;
      border-radius: 3px;
      overflow: hidden;
      max-width: 80px;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 3px;
    }

    /* Timeline */
    .timeline-item {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      position: relative;
    }
    .timeline-item:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 3.5px;
      top: 18px;
      bottom: -6px;
      width: 1px;
      background: #e5e7eb;
    }
    .timeline-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .timeline-content {
      flex: 1;
    }
    .timeline-action {
      font-weight: 600;
      font-size: 10px;
      color: #1f2937;
      text-transform: capitalize;
    }
    .timeline-details {
      font-size: 10px;
      color: #6b7280;
      margin-top: 1px;
    }
    .timeline-time {
      font-size: 9px;
      color: #9ca3af;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Notes */
    .note-item {
      padding: 8px 10px;
      border-left: 3px solid #059669;
      background: #f9fafb;
      border-radius: 0 4px 4px 0;
      margin-bottom: 6px;
    }
    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }
    .note-type {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #059669;
    }
    .note-timestamp {
      font-size: 9px;
      color: #9ca3af;
    }
    .note-text {
      font-size: 10px;
      color: #374151;
    }

    /* Description block */
    .description-block {
      padding: 10px 14px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 11px;
      color: #374151;
      line-height: 1.6;
    }

    /* Footer */
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #9ca3af;
    }

    /* Print-specific */
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Print Button (hidden when printing) -->
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="
      padding: 8px 24px;
      background: #059669;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.5px;
    ">
      Print Report
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="company-name">STEFCO</div>
        <div class="company-tagline">Claims Assessment &amp; Management</div>
      </div>
      <div>
        <div class="report-title">Claims Assessment Report</div>
        <div class="report-meta">Generated: ${formatDateTime(now)}</div>
      </div>
    </div>
    <div class="claim-header-bar">
      <span class="claim-number">${claim.claimNumber}</span>
      <span class="claim-type-badge">${claim.claimType}</span>
      <span class="status-badge" style="background: ${getStatusColor(claim.status)}">${formatStatusLabel(claim.status)}</span>
      <span style="margin-left: auto; font-size: 10px; color: #6b7280;">Stage: ${formatStageLabel(claim.processingStage)}</span>
    </div>
  </div>

  <!-- Client Information -->
  <div class="section">
    <div class="section-title">Client Information</div>
    <div class="grid-2">
      <div class="field-row">
        <span class="field-label">Client Name</span>
        <span class="field-value">${claim.clientName}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Claim Type</span>
        <span class="field-value">${claim.claimType}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Contact Number</span>
        <span class="field-value">${claim.contactNumber || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Contact Email</span>
        <span class="field-value">${claim.contactEmail || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Sender Email</span>
        <span class="field-value">${claim.senderEmail || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Email Subject</span>
        <span class="field-value">${claim.emailSubject || '—'}</span>
      </div>
    </div>
    ${isMotor && (claim.vehicleMake || claim.vehicleModel || claim.vehicleRegistration) ? `
    <div style="margin-top: 8px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px;">
      <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46; margin-bottom: 4px;">Vehicle Details</div>
      <div class="grid-2">
        <div class="field-row">
          <span class="field-label">Make / Model</span>
          <span class="field-value">${claim.vehicleMake || '—'} ${claim.vehicleModel || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Year</span>
          <span class="field-value">${claim.vehicleYear || '—'}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Registration</span>
          <span class="field-value">${claim.vehicleRegistration || '—'}</span>
        </div>
      </div>
    </div>
    ` : ''}
    ${!isMotor && claim.propertyAddress ? `
    <div style="margin-top: 8px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px;">
      <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46; margin-bottom: 4px;">Property Details</div>
      <div class="field-row">
        <span class="field-label">Property Address</span>
        <span class="field-value">${claim.propertyAddress}</span>
      </div>
    </div>
    ` : ''}
    ${claim.incidentDescription ? `
    <div style="margin-top: 10px;">
      <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 4px;">Incident Description</div>
      <div class="description-block">${claim.incidentDescription.replace(/\n/g, '<br>')}</div>
    </div>
    ` : ''}
    ${claim.specialInstructions ? `
    <div style="margin-top: 10px;">
      <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 4px;">Special Instructions</div>
      <div class="description-block">${claim.specialInstructions.replace(/\n/g, '<br>')}</div>
    </div>
    ` : ''}
  </div>

  <!-- Insurance Company & Claim Details -->
  <div class="grid-2" style="gap: 18px; margin-bottom: 18px;">
    <div class="section" style="margin-bottom: 0;">
      <div class="section-title">Insurance Company</div>
      ${claim.insuranceCompany ? `
        <div class="field-row">
          <span class="field-label">Company Name</span>
          <span class="field-value">${claim.insuranceCompany.name}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Folder Reference</span>
          <span class="field-value">${claim.insuranceCompany.folderName}</span>
        </div>
      ` : `
        <div style="font-size: 11px; color: #9ca3af; padding: 8px 0;">Not assigned</div>
      `}
    </div>
    <div class="section" style="margin-bottom: 0;">
      <div class="section-title">Claim Details</div>
      <div class="field-row">
        <span class="field-label">Status</span>
        <span class="field-value"><span class="status-dot" style="background: ${getStatusColor(claim.status)};"></span>${formatStatusLabel(claim.status)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Processing Stage</span>
        <span class="field-value">${formatStageLabel(claim.processingStage)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Confidence Score</span>
        <span class="field-value">
          <span class="confidence-bar-container">
            <span>${claim.confidenceScore}%</span>
            <span class="confidence-bar">
              <span class="confidence-fill" style="width: ${claim.confidenceScore}%; background: ${getConfidenceColor(claim.confidenceScore)};"></span>
            </span>
          </span>
        </span>
      </div>
      <div class="field-row">
        <span class="field-label">Excess Amount</span>
        <span class="field-value">${claim.excessAmount ? 'R ' + claim.excessAmount : '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Attachments</span>
        <span class="field-value">${claim.attachmentsCount} file(s)</span>
      </div>
      <div class="field-row">
        <span class="field-label">Documents Printed</span>
        <span class="field-value">${claim.documentsPrinted ? 'Yes' : 'No'}</span>
      </div>
    </div>
  </div>

  <!-- Dates -->
  <div class="section">
    <div class="section-title">Important Dates</div>
    <div class="grid-3">
      <div class="field-row">
        <span class="field-label">Date Created</span>
        <span class="field-value">${formatDateTime(claim.createdAt)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Last Updated</span>
        <span class="field-value">${formatDateTime(claim.updatedAt)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Date Processed</span>
        <span class="field-value">${claim.processedAt ? formatDateTime(claim.processedAt) : '—'}</span>
      </div>
    </div>
  </div>

  ${notes.length > 0 ? `
  <!-- Notes -->
  <div class="section">
    <div class="section-title">Notes (${notes.length})</div>
    ${notes.map((note) => `
      <div class="note-item">
        <div class="note-header">
          <span class="note-type">${note.type}</span>
          <span class="note-timestamp">${note.timestamp ? formatDate(note.timestamp) : ''}</span>
        </div>
        <div class="note-text">${note.text}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${auditLogs.length > 0 ? `
  <!-- Audit Trail -->
  <div class="section">
    <div class="section-title">Audit Trail (${auditLogs.length})</div>
    <div>
      ${auditLogs.map((log) => `
        <div class="timeline-item">
          <div class="timeline-dot" style="background: ${getAuditStatusColor(log.status)};"></div>
          <div class="timeline-content">
            <div class="timeline-action">${log.action.replace(/_/g, ' ')}</div>
            ${log.details ? `<div class="timeline-details">${log.details}</div>` : ''}
          </div>
          <div class="timeline-time">
            ${formatDateTime(log.createdAt)}
            <br><span style="color: ${getAuditStatusColor(log.status)}; font-weight: 600;">${log.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${printQueueItems.length > 0 ? `
  <!-- Print Queue -->
  <div class="section">
    <div class="section-title">Print Queue (${printQueueItems.length} document${printQueueItems.length !== 1 ? 's' : ''})</div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Document</th>
          <th>Status</th>
          <th>Pages</th>
          <th>Queued</th>
          <th>Printed</th>
        </tr>
      </thead>
      <tbody>
        ${printQueueItems.map((item) => `
          <tr>
            <td><strong>${item.fileName}</strong></td>
            <td>
              <span class="status-dot" style="background: ${getPrintStatusColor(item.printStatus)};"></span>
              ${item.printStatus}
            </td>
            <td>${item.pages || '—'}</td>
            <td>${formatDate(item.createdAt)}</td>
            <td>${item.printedAt ? formatDate(item.printedAt) : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>STEFCO Claims Assessment System v3.0.3</span>
    <span>This report was generated automatically and is confidential.</span>
    <span>Page 1 of 1</span>
  </div>

</body>
</html>`
}

export function PrintClaimButton({ claimId, claimNumber }: PrintClaimDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handlePrint = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/claims/${claimId}/print`)
      if (!response.ok) {
        throw new Error('Failed to fetch claim data')
      }

      const data: PrintClaimData = await response.json()
      const htmlContent = generatePrintHTML(data)

      const printWindow = window.open('', '_blank', 'width=800,height=1000')
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the claim report')
        setIsLoading(false)
        return
      }

      printWindow.document.write(htmlContent)
      printWindow.document.close()

      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 300)
      }

      toast.success(`Preparing print for ${claimNumber}`)
    } catch (error) {
      toast.error('Failed to generate print report')
      console.error('Print error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handlePrint}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <svg
          className="size-3.5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect width="12" height="8" x="6" y="14" />
        </svg>
      )}
      Print Claim
    </Button>
  )
}

export default PrintClaimButton
