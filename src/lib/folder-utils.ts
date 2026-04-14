/**
 * Folder path generation utilities.
 * Spec §4.5 - Folder Naming Convention
 *
 * Format: Z:\{Year}\{Month}\{FolderName}\{ClaimNumber} - {ClientName}
 * Example: Z:\2026\April\SANTAM\STF00123 - J van der Merwe
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Characters invalid in Windows file/folder paths
 */
const INVALID_PATH_CHARS = /[\\/:*?"<>|]/g

/**
 * Sanitize a client name for use in a Windows folder path.
 * Removes invalid characters and trims whitespace.
 */
export function sanitizeClientName(name: string): string {
  return name
    .replace(INVALID_PATH_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get the English month name for a given date.
 */
export function getMonthName(date: Date): string {
  return MONTH_NAMES[date.getMonth()]
}

/**
 * Generate a folder path according to the spec convention.
 *
 * @param claimNumber - The claim number (e.g., "STF00123")
 * @param clientName - The client's name (will be sanitized)
 * @param folderName - Insurance company folder name (e.g., "SANTAM")
 * @param date - The date to use for year/month (defaults to now)
 * @returns The generated folder path
 *
 * Format: Z:\{Year}\{Month}\{FolderName}\{ClaimNumber} - {ClientName}
 * Example: Z:\2026\April\SANTAM\STF00123 - J van der Merwe
 */
export function generateFolderPath(
  claimNumber: string,
  clientName: string,
  folderName: string,
  date?: Date
): string {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = getMonthName(d)
  const sanitizedName = sanitizeClientName(clientName)

  return `Z:\\${year}\\${month}\\${folderName}\\${claimNumber} - ${sanitizedName}`
}

/**
 * Get the base path (without the claim-specific subfolder).
 * Format: Z:\{Year}\{Month}\{FolderName}
 */
export function getBasePath(folderName: string, date?: Date): string {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = getMonthName(d)

  return `Z:\\${year}\\${month}\\${folderName}`
}

/**
 * Parse an email address to extract the domain.
 * e.g., "claims@santam.co.za" -> "santam.co.za"
 * e.g., "John Doe <john@santam.co.za>" -> "santam.co.za"
 */
export function extractEmailDomain(from: string): string {
  // Handle "Name <email>" format
  const emailMatch = from.match(/<([^>]+)>/)
  const email = emailMatch ? emailMatch[1] : from

  // Extract domain
  const domainMatch = email.match(/@(.+)$/)
  return domainMatch ? domainMatch[1].toLowerCase().trim() : ''
}

/**
 * Check if a sender domain matches any of the given company domains.
 */
export function matchesDomain(senderDomain: string, companyDomains: string[]): boolean {
  const normalized = senderDomain.toLowerCase()
  return companyDomains.some((d) => {
    const normalizedCompanyDomain = d.toLowerCase().replace(/^@/, '')
    return normalized === normalizedCompanyDomain || normalized.endsWith(`.${normalizedCompanyDomain}`)
  })
}
