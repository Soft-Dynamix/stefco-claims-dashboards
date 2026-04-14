import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Actions that represent meaningful claim lifecycle events worth notifying about
const NOTIFIABLE_ACTIONS = new Set([
  'email_received',
  'ai_classification',
  'email_processing_error',
  'folder_path_generated',
  'folder_created',
  'duplicate_detected',
  'claim_approved',
  'claim_rejected',
  'claim_created',
  'email_ignored',
  'imap_poll',
  'note_added',
  'data_extraction',
  'insurance_mapping',
  'process_respond',
  'process_classify',
  'process_extract',
  'auto_reply_sent',
])

/** Map action names to user-friendly notification titles */
const ACTION_TITLES: Record<string, string> = {
  email_received: 'New Email Received',
  ai_classification: 'AI Classification',
  email_processing_error: 'Processing Error',
  folder_path_generated: 'Folder Path Generated',
  folder_created: 'Folder Created',
  duplicate_detected: 'Duplicate Detected',
  claim_approved: 'Claim Approved',
  claim_rejected: 'Claim Rejected',
  claim_created: 'Claim Created',
  email_ignored: 'Email Ignored',
  imap_poll: 'Email Check',
  note_added: 'Note Added',
  data_extraction: 'Data Extracted',
  insurance_mapping: 'Company Matched',
  process_respond: 'Response Sent',
  process_classify: 'Classified',
  process_extract: 'Extracted',
  auto_reply_sent: 'Auto-Reply Sent',
}

type NotificationType = 'success' | 'warning' | 'info' | 'error'
type NotificationCategory = 'claims' | 'system' | 'alerts'

function detectType(action: string, status: string): NotificationType {
  const statusLower = status.toLowerCase()
  if (statusLower === 'error') return 'error'
  if (statusLower === 'warning') return 'warning'
  if (statusLower === 'success' || statusLower === 'complete') return 'success'
  return 'info'
}

function detectCategory(action: string, status: string, hasClaim: boolean): NotificationCategory {
  const actionLower = action.toLowerCase()

  // Errors and warnings are always alerts
  if (status === 'ERROR') return 'alerts'
  if (actionLower === 'duplicate_detected') return 'alerts'

  // Claim-related actions
  const claimActions = new Set([
    'email_received',
    'ai_classification',
    'claim_approved',
    'claim_rejected',
    'claim_created',
    'note_added',
    'data_extraction',
    'insurance_mapping',
    'process_classify',
    'process_extract',
    'process_respond',
    'auto_reply_sent',
  ])

  if (claimActions.has(actionLower) || hasClaim) return 'claims'

  // Everything else is system
  return 'system'
}

function formatTitle(action: string): string {
  const lower = action.toLowerCase()
  return ACTION_TITLES[lower] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// GET /api/notifications - Pre-filtered notification feed with categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    // Fetch more entries than needed to account for filtering
    const fetchLimit = limit * 3

    const auditLogs = await db.auditLog.findMany({
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
            claimType: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
    })

    // Filter to only meaningful notifications
    const notifications = auditLogs
      .filter((entry) => {
        if (entry.status === 'ERROR') return true
        if (NOTIFIABLE_ACTIONS.has(entry.action.toLowerCase())) return true
        return false
      })
      .slice(0, limit)
      .map((entry) => {
        const type = detectType(entry.action, entry.status)
        const category = detectCategory(entry.action, entry.status, !!entry.claimId)

        return {
          id: entry.id,
          action: entry.action,
          title: formatTitle(entry.action),
          description:
            entry.details ||
            (entry.claim
              ? `${entry.claim.claimNumber} — ${entry.claim.clientName}`
              : ''),
          type,
          category,
          status: entry.status,
          createdAt: entry.createdAt.toISOString(),
          read: false,
          claim: entry.claim
            ? {
                claimNumber: entry.claim.claimNumber,
                clientName: entry.claim.clientName,
                claimType: entry.claim.claimType,
                status: entry.claim.status,
              }
            : null,
        }
      })

    // Compute summary counts
    const errorCount = notifications.filter((n) => n.type === 'error').length
    const warningCount = notifications.filter((n) => n.type === 'warning').length
    const unreadCount = errorCount + warningCount

    // Category counts
    const claimsCount = notifications.filter((n) => n.category === 'claims').length
    const systemCount = notifications.filter((n) => n.category === 'system').length
    const alertsCount = notifications.filter((n) => n.category === 'alerts').length

    return NextResponse.json({
      notifications,
      unreadCount,
      summary: {
        total: notifications.length,
        errorCount,
        warningCount,
        successCount: notifications.filter((n) => n.type === 'success').length,
        infoCount: notifications.filter((n) => n.type === 'info').length,
        categories: { claims: claimsCount, system: systemCount, alerts: alertsCount },
      },
    })
  } catch (error) {
    console.error('Notifications fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: String(error) },
      { status: 500 }
    )
  }
}
