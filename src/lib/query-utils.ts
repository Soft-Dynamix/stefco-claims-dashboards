import { QueryClient } from '@tanstack/react-query'

/**
 * Comprehensive list of all query keys used across the app.
 * When ANY claim/insurance/config data changes, ALL of these should be invalidated
 * to keep every view perfectly in sync.
 */
const ALL_APP_QUERY_KEYS = [
  // Claims data
  'claims',
  'kanban-claims',
  'claim-detail',
  'claim-notes',
  'claim-aging',
  'claim-aging-report',
  'claims-analytics',

  // Dashboard & stats
  'dashboard',
  'activity-feed',
  'activity-feed-widget',
  'quick-stats-bar',
  'header-live-stats',
  'footer-stats',
  'active-claims-count',

  // Email & workflow
  'imap-status',
  'workflow-analytics',
  'workflow-pipeline-executions',
  'workflow-stages',
  'claims-all-stages',
  'audit-logs-pipeline',

  // Print queue
  'print-queue',

  // Insurance
  'insurance-companies',
  'insurance-comparison',

  // Audit & notifications
  'audit-logs',
  'notifications',

  // Config & system
  'system-config',
  'installer-health',
  'installer-setup',
  'installer-logs',
  'installer-config',

  // Aging
  'aging-summary',
]

/**
 * Invalidate ALL app data queries to keep entire UI in sync.
 * Call this after any mutation that changes claims, insurance, config, or audit data.
 */
export function invalidateAllAppData(queryClient: QueryClient) {
  for (const key of ALL_APP_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}

/**
 * Invalidate claim-related queries only.
 * Use for claim status changes, new claims, claim updates.
 */
export function invalidateClaimData(queryClient: QueryClient) {
  const claimKeys = [
    'claims', 'kanban-claims', 'claim-detail', 'claim-notes',
    'claim-aging', 'claim-aging-report', 'claims-analytics',
    'dashboard', 'activity-feed', 'activity-feed-widget',
    'quick-stats-bar', 'header-live-stats', 'footer-stats',
    'active-claims-count', 'workflow-analytics',
    'workflow-pipeline-executions', 'claims-all-stages',
    'audit-logs', 'notifications', 'audit-logs-pipeline',
  ]
  for (const key of claimKeys) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}

/**
 * Invalidate config/settings queries.
 * Use for settings changes, IMAP config updates.
 */
export function invalidateConfigData(queryClient: QueryClient) {
  const configKeys = [
    'system-config', 'installer-health', 'installer-setup',
    'installer-logs', 'installer-config', 'imap-status',
  ]
  for (const key of configKeys) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}

/**
 * Invalidate insurance-related queries.
 */
export function invalidateInsuranceData(queryClient: QueryClient) {
  const insuranceKeys = ['insurance-companies', 'insurance-comparison']
  for (const key of insuranceKeys) {
    queryClient.invalidateQueries({ queryKey: [key] })
  }
}
