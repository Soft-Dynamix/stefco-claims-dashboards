export const statusColors: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  PROCESSING: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  MANUAL_REVIEW: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  FAILED: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  PENDING_REVIEW: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
}

export const statusLabels: Record<string, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  MANUAL_REVIEW: 'Manual Review',
  FAILED: 'Failed',
  PENDING_REVIEW: 'Pending Review',
}

export function getStatusColor(status: string): string {
  return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
}

export function getStatusBadgeGlow(status: string): string {
  const glowMap: Record<string, string> = {
    COMPLETED: 'badge-success',
    NEW: 'badge-info',
    PROCESSING: 'badge-warning',
    MANUAL_REVIEW: 'badge-warning',
    PENDING_REVIEW: 'badge-info',
    FAILED: 'badge-error',
  }
  return glowMap[status] || ''
}

export function getStatusLabel(status: string): string {
  return statusLabels[status] || status
}

export function getConfidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function getConfidenceBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount
  return `R${num.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatProcessingStage(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    RECEIVED: 'text-sky-600 dark:text-sky-400',
    CLASSIFIED: 'text-violet-600 dark:text-violet-400',
    EXTRACTED: 'text-amber-600 dark:text-amber-400',
    FOLDER_CREATED: 'text-emerald-600 dark:text-emerald-400',
    DOCUMENTS_SAVED: 'text-teal-600 dark:text-teal-400',
    PRINTED: 'text-indigo-600 dark:text-indigo-400',
    LOGGED: 'text-pink-600 dark:text-pink-400',
    RESPONDED: 'text-emerald-600 dark:text-emerald-400',
  }
  return colors[stage] || 'text-muted-foreground'
}

export function getClaimTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    Motor: '🚗',
    Building: '🏢',
    Marine: '🚢',
    Agricultural: '🌾',
    Household: '🏠',
    Liability: '⚖️',
  }
  return icons[type] || '📋'
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
