/**
 * Email Intake Agent
 *
 * Converts raw email data into structured JSON for the pipeline.
 * This is the first agent in the chain — it normalizes raw email
 * into a consistent format for downstream agents.
 */

export interface IntakeResult {
  subject: string
  senderEmail: string
  senderName: string | null
  body: string
  hasAttachments: boolean
  timestamp: string | null
}

export function processIntake(raw: {
  from: string
  subject: string
  body: string
  attachments?: Array<{ filename: string; contentType?: string; size?: number }>
}): IntakeResult {
  // Extract sender name from email address format "Name <email@domain.com>"
  let senderName: string | null = null
  const nameMatch = raw.from.match(/^"?(.+?)"?\s*<[^>]+>$/)
  if (nameMatch) {
    senderName = nameMatch[1].trim()
  }

  // Clean timestamp — we use current time if not provided
  const timestamp = new Date().toISOString()

  return {
    subject: raw.subject.trim(),
    senderEmail: raw.from.replace(/<|>/g, '').trim(),
    senderName,
    body: raw.body,
    hasAttachments: (raw.attachments || []).length > 0,
    timestamp,
  }
}
