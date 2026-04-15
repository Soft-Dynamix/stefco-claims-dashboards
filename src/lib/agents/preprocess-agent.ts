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
  followUpSignals: {
    isReply: boolean
    isForward: boolean
    hasFollowUpPhrases: boolean
    hasStatusQuery: boolean
    hasExistingClaimRef: boolean
    phrases: string[]
  }
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
 * Detect follow-up signals in the email.
 * Returns structured signals that help distinguish new claims from follow-ups/queries.
 */
function detectFollowUpSignals(subject: string, body: string): PreprocessResult['followUpSignals'] {
  const subjectLower = subject.toLowerCase().trim()
  const bodyLower = body.toLowerCase()
  const phrases: string[] = []

  // 1. Reply detection
  const isReply = /^\s*re:\s*/i.test(subject) || /^\s*re\[/i.test(subject)
  if (isReply) phrases.push('RE: prefix')

  // 2. Forward detection
  const isForward = /^\s*fwd?:\s*/i.test(subject) || /^\s*fw:\s*/i.test(subject)
  if (isForward) phrases.push('Fwd: prefix')

  // 3. Follow-up phrase detection
  const followUpPhrases = [
    'follow', 'follow-up', 'followup', 'following up',
    'status update', 'status check', 'update on', 'progress',
    'any news', 'any update', 'any feedback', 'feedback on',
    'please advise', 'kindly advise', 'please confirm',
    'please note', 'for attention', 'attention of',
    'regarding claim', 'with reference to', 're: claim',
    'further to', 'in respect of', 'pertaining to',
    'resubmit', 'resubmission', 'additional documents',
    'revised', 'correction', 'amendment',
    'reminder', 'gentle reminder', 'second reminder',
    'in response to', 'reply to', 'response to',
    'as discussed', 'per our conversation', 'per telephonic',
    'our reference', 'your reference',
    'escalat', 'urgent', 'priority',
    'query', 'enquiry', 'inquiry',
  ]
  let hasFollowUpPhrases = false
  for (const phrase of followUpPhrases) {
    if (bodyLower.includes(phrase) || subjectLower.includes(phrase)) {
      hasFollowUpPhrases = true
      phrases.push(phrase)
    }
  }

  // 4. Status query detection
  const statusPhrases = [
    'what is the status', 'status of claim', 'has the assessment',
    'assessment completed', 'assessment been completed',
    'when will', 'how long', 'timeline', 'eta',
    'is the claim', 'can you provide an update',
    'when can we expect', 'outstanding', 'pending',
    'we are still waiting', 'client is waiting', 'client is anxious',
    'please process', 'kindly process', 'expedite',
    'overdue', 'delayed', 'delay',
    'please attend', 'kindly attend',
    'closure', 'finalization', 'finalise', 'finalize',
  ]
  let hasStatusQuery = false
  for (const phrase of statusPhrases) {
    if (bodyLower.includes(phrase)) {
      hasStatusQuery = true
      if (!phrases.includes(phrase)) phrases.push(phrase)
    }
  }

  // 5. Existing claim reference detection
  const existingClaimRefPatterns = [
    /claim\s*(?:no|number|ref|reference)?\s*[:#]?\s*[A-Z0-9][\w\-/.]+[A-Z0-9]/gi,
    /(?:stf|clm|eclm|mrv)\s*[-–]?\s*\d{4,}/gi,
  ]
  let hasExistingClaimRef = false
  // Check if the claim reference appears in a context suggesting it already exists
  // (e.g., "claim CLM2024-0087" in a follow-up context)
  const existingContextPhrases = [
    'the above claim', 'the aforementioned', 'above referenced',
    'the referenced claim', 'this claim', 'our claim', 'your claim',
    'the claim', 're: claim', 'claim no', 'claim ref',
  ]
  for (const ctx of existingContextPhrases) {
    if (bodyLower.includes(ctx) || subjectLower.includes(ctx)) {
      hasExistingClaimRef = true
      if (!phrases.includes(ctx)) phrases.push(ctx)
    }
  }
  // Also check claim reference patterns
  for (const pattern of existingClaimRefPatterns) {
    const match = pattern.exec(body)
    if (match && !hasExistingClaimRef) {
      // If a claim number is found AND it's not in a "new claim" context,
      // it likely references an existing claim
      const newClaimContext = ['new claim', 'nuwe eis', 'new assessment', 'nuwe assessering',
        'appointment of', 'aanstelling', 'new appointment', 'nuwe benoeming']
      const surroundingText = bodyLower.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100)
      const isNewClaimContext = newClaimContext.some(ctx => surroundingText.includes(ctx))
      if (!isNewClaimContext) {
        hasExistingClaimRef = true
      }
    }
  }

  return {
    isReply,
    isForward,
    hasFollowUpPhrases,
    hasStatusQuery,
    hasExistingClaimRef,
    phrases: phrases.slice(0, 10), // Limit to prevent token bloat
  }
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
    // Follow-up terms
    followup: ['follow-up', 'status update', 'query', 'enquiry', 'reminder'],
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
    followUpSignals: detectFollowUpSignals(rawEmail.subject, rawEmail.body),
  }
}
