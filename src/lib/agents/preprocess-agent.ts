/**
 * Preprocessing Agent
 *
 * Cleans the email body and extracts structured signals:
 * - possible_claim_number
 * - person_names
 * - dates
 * - keywords
 *
 * Uses regex-based extraction for speed, with optional AI augmentation
 * for complex cases.
 */

export interface PreprocessResult {
  cleanedBody: string
  possibleClaimNumber: string | null
  personNames: string[]
  dates: string[]
  keywords: string[]
}

/**
 * Clean email body — remove signatures, disclaimers, noise.
 */
function cleanBody(body: string): string {
  let cleaned = body

  // Remove common email signature patterns
  cleaned = cleaned.replace(/--\s*\n[\s\S]*$/im, '') // Standard signature separator
  cleaned = cleaned.replace(/_{3,}[\s\S]*$/im, '') // Underscore signature separator
  cleaned = cleaned.replace(/-+\s*Disclaimer[\s\S]*$/gi, '') // Disclaimer blocks
  cleaned = cleaned.replace(/-+\s*Confidential[\s\S]*$/gi, '') // Confidentiality notices
  cleaned = cleaned.replace(/This e-?mail[^.]*\.(?=\s*\n|\s*$)/gi, '') // Email disclaimers
  cleaned = cleaned.replace(/\*This[^*]*\*/gi, '') // Asterisk-wrapped disclaimers
  cleaned = cleaned.replace(/Sent from my[\s\S]*$/i, '') // Mobile signatures
  cleaned = cleaned.replace(/Regards,?\s*[\s\S]*$/im, '') // "Regards" signature
  cleaned = cleaned.replace(/Kind regards,?\s*[\s\S]*$/im, '') // "Kind regards" signature
  cleaned = cleaned.replace(/Best regards,?\s*[\s\S]*$/im, '') // "Best regards" signature
  cleaned = cleaned.replace(/Sincerely,?\s*[\s\S]*$/im, '') // "Sincerely" signature
  cleaned = cleaned.replace(/Thank[s]?[,:]?\s*[\s\S]*$/im, '') // "Thanks" signature

  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  cleaned = cleaned.trim()

  return cleaned
}

/**
 * Extract possible claim number from text.
 */
function extractClaimNumber(text: string): string | null {
  const patterns = [
    /(?:claim\s*(?:no|number|ref|reference|#)[:\s]*)([A-Z0-9][\w\-/.]+[A-Z0-9])/gi,
    /(?:reference[:\s]*)([A-Z0-9][\w\-/.]+[A-Z0-9])/gi,
    /(\d{6,}[-/]\d{2,})/g, // Long numeric patterns like 123456-78
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) {
      return match[1].trim().toUpperCase()
    }
  }

  return null
}

/**
 * Extract person names from text (simple heuristic).
 * Looks for title + name patterns common in South African business emails.
 */
function extractPersonNames(text: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  // Common patterns in SA insurance emails:
  // "Dear Mr Smith", "Insured: John van der Merwe", "Client: Jane Doe"
  const namePatterns = [
    /(?:dear|insured|client|policyholder|claimant)[:\s]+(?:mr|mrs|ms|dr|prof)?\.?\s*([A-Z][a-z]+(?:\s+(?:van der|van|de|du|le)?\s*[A-Z][a-z]+){0,3})/gi,
    /(?:mr|mrs|ms|dr|prof)\.?\s+([A-Z][a-z]+(?:\s+(?:van der|van|de|du|le)?\s*[A-Z][a-z]+){0,3})/gi,
  ]

  for (const pattern of namePatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim()
      // Filter out common false positives
      if (name.length > 2 && name.length < 60 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        names.push(name)
      }
    }
  }

  return names.slice(0, 5) // Limit to 5 names
}

/**
 * Extract dates from text.
 */
function extractDates(text: string): string[] {
  const dates: string[] = []
  const seen = new Set<string>()

  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})/gi,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{2,4})/gi,
  ]

  for (const pattern of datePatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const date = match[1].trim()
      if (!seen.has(date)) {
        seen.add(date)
        dates.push(date)
      }
    }
  }

  return dates.slice(0, 5) // Limit to 5 dates
}

/**
 * Extract important keywords from text.
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = []
  const seen = new Set<string>()

  // Domain-specific keywords for SA insurance claims
  const keywordMap: Record<string, string[]> = {
    // Claim types
    motor: ['motor', 'vehicle', 'car', 'collision', 'accident', 'theft', 'hijack', 'write-off'],
    building: ['building', 'structure', 'property damage', 'fire', 'flood', 'storm'],
    marine: ['marine', 'cargo', 'shipping', 'vessel', 'container', 'transit'],
    agricultural: ['agricultural', 'crop', 'livestock', 'farm', 'harvest', 'drought'],
    household: ['household', 'contents', 'burglary', 'home', 'residential', 'theft'],
    liability: ['liability', 'third party', 'injury', 'negligence', 'public liability'],
    // Common terms
    assessment: ['assessment', 'assessor', 'inspect', 'appointment'],
    claim: ['claim', 'new claim', 'nuwe eis', 'nuwe assessering'],
    policy: ['policy', 'policy number', 'cover', 'premium'],
    excess: ['excess', 'deductible', 'voluntary excess'],
    incident: ['incident', 'loss', 'damage', 'peril'],
    documents: ['document', 'attach', 'photo', 'report', 'quotation', 'invoice'],
  }

  const lowerText = text.toLowerCase()

  for (const [category, words] of Object.entries(keywordMap)) {
    for (const word of words) {
      if (lowerText.includes(word.toLowerCase()) && !seen.has(word.toLowerCase())) {
        seen.add(word.toLowerCase())
        keywords.push(word)
      }
    }
  }

  return keywords.slice(0, 15) // Limit to 15 keywords
}

/**
 * Run the preprocessing agent on email content.
 */
export function preprocessEmail(rawEmail: {
  subject: string
  body: string
  from: string
}): PreprocessResult {
  const fullText = `${rawEmail.subject}\n${rawEmail.body}\n${rawEmail.from}`

  return {
    cleanedBody: cleanBody(rawEmail.body),
    possibleClaimNumber: extractClaimNumber(fullText),
    personNames: extractPersonNames(fullText),
    dates: extractDates(fullText),
    keywords: extractKeywords(fullText),
  }
}
