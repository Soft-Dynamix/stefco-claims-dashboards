/**
 * AI Helpers for email classification and claim data extraction.
 * Calls Gemini/Groq/OpenRouter APIs directly via fetch (no z-ai-web-dev-sdk dependency in production).
 * Supports a proper fallback chain: primary provider → other configured providers → z-ai-web-dev-sdk (last resort).
 */

const CLASSIFICATION_SYSTEM_PROMPT = `You are an insurance claims email classifier for Stefco, a South African insurance claims management company. Your job is to analyze incoming emails and determine whether they represent a new insurance claim notification that should be processed.

CLASSIFICATION CRITERIA:

Classify as "NEW_CLAIM" if the email contains ANY of these indicators:
- "New assessment" or "Nuwe assessering" (New assessment in Afrikaans)
- "New appointment" or "Nuwe benoeming" 
- "NUWE EIS" (New Claim in Afrikaans)
- Claim number references (e.g., "Claim No:", "Claim Reference:")
- Assessment appointment details
- Insurance policy number references
- Vehicle registration numbers with damage descriptions
- Incident dates and descriptions
- References to "assessor", "assessment", "claim"
- Attached documents typically found with claims (assessment reports, photos, quotes)
- Sender is a known insurance company domain

Classify as "IGNORE" if the email is:
- Marketing or promotional content
- Newsletter or subscription updates
- Out of office / auto-reply messages
- General inquiries without claim-specific information
- Spam or phishing attempts
- Internal company communications not related to claims
- Payment confirmations or receipts without claim context
- Meeting invitations without claim context

RESPOND WITH ONLY A JSON OBJECT (no markdown, no backticks):
{
  "classification": "NEW_CLAIM" or "IGNORE",
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation>"
}`

const EXTRACTION_SYSTEM_PROMPT = `You are an insurance claims data extraction specialist for Stefco, a South African insurance claims management company. Extract all relevant claim information from the email content.

SOUTH AFRICAN CONTEXT:
- Names may be in Afrikaans (e.g., van der Merwe, Joubert, Nel, Botha, van Wyk)
- Phone numbers are in format: +27XX XXX XXXX or 0XX XXX XXXX
- Currency is South African Rand (ZAR / R)
- Vehicle registrations follow format: e.g., CA 123-456 (Cape Town), GP 789-012 (Gauteng), etc.
- Common claim types: Motor (vehicle accidents), Building (structural damage), Marine (cargo/shipping), Agricultural (crop/livestock), Household (contents), Liability (third-party)

EXTRACT THE FOLLOWING FIELDS:
- claim_number: The insurance company's claim reference number (look for "Claim No", "Reference", "Claim Ref")
- client_name: Full name of the insured person / claimant
- insurance_company: Name of the insurance company (if mentioned)
- claim_type: One of: Motor, Building, Marine, Agricultural, Household, Liability
- contact_number: Phone number for contact
- contact_email: Email address for contact
- incident_description: Detailed description of what happened / the incident
- excess_amount: The excess/deductible amount (e.g., "R2,500", "R5000")
- special_instructions: Any special instructions or notes from the insurer
- vehicle_make: Vehicle manufacturer (for Motor claims, e.g., Toyota, Volkswagen, BMW)
- vehicle_model: Vehicle model (for Motor claims, e.g., Corolla, Golf, X5)
- vehicle_year: Vehicle year (for Motor claims, e.g., 2022)
- vehicle_registration: SA license plate number (for Motor claims, e.g., CA 123456)

RESPOND WITH ONLY A JSON OBJECT (no markdown, no backticks):
{
  "claim_number": "<string or null>",
  "client_name": "<string or null>",
  "insurance_company": "<string or null>",
  "claim_type": "<Motor|Building|Marine|Agricultural|Household|Liability|null>",
  "contact_number": "<string or null>",
  "contact_email": "<string or null>",
  "incident_description": "<string or null>",
  "excess_amount": "<string or null>",
  "special_instructions": "<string or null>",
  "vehicle_make": "<string or null>",
  "vehicle_model": "<string or null>",
  "vehicle_year": "<string or null>",
  "vehicle_registration": "<string or null>"
}

Only include fields that you can confidently extract from the email. Use null for fields you cannot determine.`

/**
 * Auto-detect an available Gemini model by querying the models list API.
 * Shared between validateAiKey and callAI.
 */
async function autoDetectGeminiModel(apiKey: string): Promise<string | null> {
  const listUrls = [
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
  ]
  for (const listUrl of listUrls) {
    try {
      const res = await fetch(listUrl, { method: 'GET', signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const data = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }
      const models = data.models || []
      const generative = models.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      if (generative.length === 0) continue
      const priority = [/gemini-2\.5-flash/, /gemini-2\.0-flash/, /gemini-1\.5-flash/, /gemini-1\.5-pro/, /gemini-pro/, /gemini-1\.0/]
      const nameMap = generative.map(m => { const parts = m.name.split('/'); return parts[parts.length - 1] })
      for (const regex of priority) {
        const match = nameMap.find(n => regex.test(n))
        if (match) return match
      }
      return nameMap[0] || null
    } catch { continue }
  }
  return null
}

/**
 * Get AI provider config from SystemConfig + env vars.
 * Returns ALL configured keys so callers can build a fallback chain.
 */
async function getAIConfig() {
  const { db } = await import('@/lib/db')

  // Try to get from SystemConfig
  let provider = 'gemini'
  let model = 'gemini-2.0-flash'
  let geminiKey = ''
  let groqKey = ''
  let openrouterKey = ''

  try {
    const configs = await db.systemConfig.findMany({
      where: { key: { in: ['ai_provider', 'ai_model', 'gemini_api_key', 'groq_api_key', 'openrouter_api_key', 'gemini_model'] } },
    })
    const map: Record<string, string> = {}
    for (const c of configs) map[c.key] = c.value

    provider = map['ai_provider'] || provider
    model = map['gemini_model'] || map['ai_model'] || model

    // Collect ALL keys, not just the primary one
    geminiKey = map['gemini_api_key'] || process.env.GEMINI_API_KEY || ''
    groqKey = map['groq_api_key'] || process.env.GROQ_API_KEY || ''
    openrouterKey = map['openrouter_api_key'] || process.env.OPENROUTER_API_KEY || ''
  } catch {
    // Fallback to env vars — collect all available keys
    geminiKey = process.env.GEMINI_API_KEY || ''
    groqKey = process.env.GROQ_API_KEY || ''
    openrouterKey = process.env.OPENROUTER_API_KEY || ''
  }

  return { provider, model, geminiKey, groqKey, openrouterKey }
}

/** Default models for each provider when used as fallback */
const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama3-8b-8192',
  openrouter: 'openai/gpt-3.5-turbo',
}

/**
 * Try calling a specific AI provider with the given parameters.
 * Returns the response text, or empty string on failure.
 * Each provider handles its own error cases (including Gemini 404 auto-detection).
 */
async function tryProvider(
  providerName: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (providerName === 'groq') {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
        }),
      })

      if (!res.ok) {
        const err = await res.text().catch(() => 'Unknown error')
        console.error(`[ai-helpers] Groq API error: ${res.status} ${err}`)
        return ''
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (fetchErr) {
      console.error(`[ai-helpers] Groq fetch failed:`, fetchErr)
      return ''
    }
  }

  if (providerName === 'openrouter') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
        }),
      })

      if (!res.ok) {
        const err = await res.text().catch(() => 'Unknown error')
        console.error(`[ai-helpers] OpenRouter API error: ${res.status} ${err}`)
        return ''
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (fetchErr) {
      console.error(`[ai-helpers] OpenRouter fetch failed:`, fetchErr)
      return ''
    }
  }

  // Default: Gemini API (using generateContent endpoint)
  // Try v1beta first, then v1 as fallback
  const geminiUrls = [
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
  ]

  let got404 = false
  for (const url of geminiUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return text
      } else if (res.status === 404) {
        got404 = true
        const err = await res.text().catch(() => 'Unknown error')
        console.error(`[ai-helpers] Gemini API 404 for model ${model}: ${err}`)
        continue // Try next URL version
      } else if (res.status === 400) {
        const err = await res.text().catch(() => 'Unknown error')
        console.error(`[ai-helpers] Gemini API 400 for model ${model}: ${err}`)
        continue // Try next URL version
      } else {
        const err = await res.text().catch(() => 'Unknown error')
        console.error(`[ai-helpers] Gemini API error: ${res.status} ${err}`)
        break
      }
    } catch (fetchErr) {
      console.error(`[ai-helpers] Gemini fetch failed:`, fetchErr)
      continue
    }
  }

  // If we got 404, the model name is wrong — auto-detect and retry once
  if (got404) {
    console.error(`[ai-helpers] Model "${model}" not found (404). Auto-detecting...`)
    const detected = await autoDetectGeminiModel(apiKey)
    if (detected && detected !== model) {
      console.error(`[ai-helpers] Auto-detected model: ${detected}. Updating config and retrying.`)
      // Persist the fix
      try {
        const { db } = await import('@/lib/db')
        await db.systemConfig.upsert({ where: { key: 'gemini_model' }, update: { value: detected }, create: { key: 'gemini_model', value: detected } })
        await db.systemConfig.upsert({ where: { key: 'ai_model' }, update: { value: detected }, create: { key: 'ai_model', value: detected } })
      } catch (dbErr) {
        console.error(`[ai-helpers] Failed to persist model fix:`, dbErr)
      }
      // Retry with detected model
      const retryUrls = [
        `https://generativelanguage.googleapis.com/v1beta/models/${detected}:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1/models/${detected}:generateContent?key=${apiKey}`,
      ]
      for (const retryUrl of retryUrls) {
        try {
          const res = await fetch(retryUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
            }),
          })
          if (res.ok) {
            const data = await res.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            if (text) {
              console.error(`[ai-helpers] Retry with "${detected}" succeeded (${text.length} chars)`)
              return text
            }
          }
        } catch { continue }
      }
    }
  }

  return ''
}

/**
 * Call AI API with a proper fallback chain.
 * 1. Try primary provider (Gemini/Groq/OpenRouter) as configured
 * 2. If retriable error (429, 500, 502, 503), try OTHER configured providers
 * 3. Try z-ai-web-dev-sdk as LAST resort (sandbox only)
 * Exported for use by agent modules.
 */
export async function callAI(systemPrompt: string, userMessage: string, model?: string): Promise<string> {
  const config = await getAIConfig()
  const primaryModel = model || config.model

  console.error(`[ai-helpers] Primary provider: ${config.provider}, model: ${primaryModel}`)
  console.error(`[ai-helpers] Configured keys — gemini: ${!!config.geminiKey}, groq: ${!!config.groqKey}, openrouter: ${!!config.openrouterKey}`)

  // Build ordered provider list: primary first, then other configured providers as fallbacks
  const providerList: Array<{ provider: string; apiKey: string; model: string }> = []

  // Add primary provider if it has a key
  if (config.provider === 'gemini' && config.geminiKey) {
    providerList.push({ provider: 'gemini', apiKey: config.geminiKey, model: primaryModel })
  } else if (config.provider === 'groq' && config.groqKey) {
    providerList.push({ provider: 'groq', apiKey: config.groqKey, model: primaryModel })
  } else if (config.provider === 'openrouter' && config.openrouterKey) {
    providerList.push({ provider: 'openrouter', apiKey: config.openrouterKey, model: primaryModel })
  }

  // Add other configured providers as fallbacks (using default models for each)
  const fallbackEntries: Array<[string, string]> = [
    ['gemini', config.geminiKey],
    ['groq', config.groqKey],
    ['openrouter', config.openrouterKey],
  ]
  for (const [p, key] of fallbackEntries) {
    if (p !== config.provider && key) {
      providerList.push({ provider: p, apiKey: key, model: PROVIDER_DEFAULT_MODELS[p] })
    }
  }

  if (providerList.length === 0) {
    console.error(`[ai-helpers] WARNING: No API keys configured for any provider. Trying z-ai-web-dev-sdk fallback.`)
  } else {
    // Try each provider in order
    for (const attempt of providerList) {
      const isPrimary = attempt.provider === config.provider
      console.error(`[ai-helpers] ${isPrimary ? 'Trying' : 'Falling back to'} provider: ${attempt.provider}, model: ${attempt.model}`)
      const text = await tryProvider(attempt.provider, attempt.apiKey, attempt.model, systemPrompt, userMessage)
      if (text) {
        console.error(`[ai-helpers] Provider ${attempt.provider} succeeded (${text.length} chars)`)
        return text
      }
      console.error(`[ai-helpers] Provider ${attempt.provider} failed. ${isPrimary ? 'Trying fallback providers...' : 'Trying next fallback...'}`)
    }
    console.error(`[ai-helpers] All external AI providers failed. Trying z-ai-web-dev-sdk as last resort.`)
  }

  // z-ai-web-dev-sdk as absolute last resort (sandbox only)
  try {
    const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default || m.ZAI || m)
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    })
    const text = completion.choices?.[0]?.message?.content
    if (text) {
      console.error(`[ai-helpers] z-ai-web-dev-sdk fallback succeeded (${text.length} chars)`)
      return text
    }
  } catch (sdkErr) {
    console.error(`[ai-helpers] z-ai-web-dev-sdk fallback also failed:`, sdkErr)
  }

  return ''
}

/**
 * Classify an email as NEW_CLAIM or IGNORE using AI.
 */
export async function classifyEmail(subject: string, body: string, from: string): Promise<{
  classification: 'NEW_CLAIM' | 'IGNORE'
  confidence: number
  reasoning: string
}> {
  const text = await callAI(
    CLASSIFICATION_SYSTEM_PROMPT,
    `Analyze this email:\n\nFrom: ${from}\n\nSubject: ${subject}\n\nBody:\n${body.slice(0, 4000)}`
  )

  if (!text) {
    // Fallback: heuristic classification
    const lowerText = `${subject} ${body} ${from}`.toLowerCase()
    const claimKeywords = [
      'new assessment', 'nuwe assessering', 'new appointment', 'nuwe benoeming',
      'nuwe eis', 'claim no', 'claim reference', 'claim ref',
      'assessment', 'assessor', 'claim number', 'policy number',
    ]
    const hasClaimKeywords = claimKeywords.some((kw) => lowerText.includes(kw))

    return {
      classification: hasClaimKeywords ? 'NEW_CLAIM' : 'IGNORE',
      confidence: hasClaimKeywords ? 60 : 80,
      reasoning: 'Fallback classification due to AI API unavailable. Keyword matching used.',
    }
  }

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      classification: parsed.classification === 'NEW_CLAIM' ? 'NEW_CLAIM' : 'IGNORE',
      confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, parsed.confidence)) : 0,
      reasoning: parsed.reasoning || 'No reasoning provided',
    }
  } catch {
    // Fallback if JSON parse fails
    const lowerText = `${subject} ${body} ${from}`.toLowerCase()
    const claimKeywords = [
      'new assessment', 'nuwe assessering', 'new appointment', 'nuwe benoeming',
      'nuwe eis', 'claim no', 'claim reference', 'claim ref',
      'assessment', 'assessor', 'claim number', 'policy number',
    ]
    const hasClaimKeywords = claimKeywords.some((kw) => lowerText.includes(kw))

    return {
      classification: hasClaimKeywords ? 'NEW_CLAIM' : 'IGNORE',
      confidence: hasClaimKeywords ? 60 : 80,
      reasoning: 'Fallback classification due to AI response parsing failure. Keyword matching used.',
    }
  }
}

/**
 * Extract structured claim data from an email using AI.
 * Optionally includes learning hints from the self-learning engine.
 */
export async function extractClaimData(subject: string, body: string, from: string, learningHints?: string): Promise<{
  claimData: {
    claim_number: string | null
    client_name: string | null
    insurance_company: string | null
    claim_type: string | null
    contact_number: string | null
    contact_email: string | null
    incident_description: string | null
    excess_amount: string | null
    special_instructions: string | null
    vehicle_make: string | null
    vehicle_model: string | null
    vehicle_year: string | null
    vehicle_registration: string | null
  }
  confidence: number
}> {
  // Build prompt with optional learning hints
  const systemPrompt = learningHints
    ? EXTRACTION_SYSTEM_PROMPT + '\n\n' + learningHints
    : EXTRACTION_SYSTEM_PROMPT

  const text = await callAI(
    systemPrompt,
    `Extract claim data from this email:\n\nFrom: ${from}\n\nSubject: ${subject}\n\nBody:\n${body.slice(0, 6000)}`
  )

  if (!text) {
    return {
      claimData: {
        claim_number: null,
        client_name: null,
        insurance_company: null,
        claim_type: null,
        contact_number: null,
        contact_email: null,
        incident_description: null,
        excess_amount: null,
        special_instructions: null,
        vehicle_make: null,
        vehicle_model: null,
        vehicle_year: null,
        vehicle_registration: null,
      },
      confidence: 0,
    }
  }

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Calculate confidence using weighted field scoring
    const confidence = assessExtractionConfidence(parsed)

    return {
      claimData: {
        claim_number: parsed.claim_number || null,
        client_name: parsed.client_name || null,
        insurance_company: parsed.insurance_company || null,
        claim_type: parsed.claim_type || null,
        contact_number: parsed.contact_number || null,
        contact_email: parsed.contact_email || null,
        incident_description: parsed.incident_description || null,
        excess_amount: parsed.excess_amount || null,
        special_instructions: parsed.special_instructions || null,
        vehicle_make: parsed.vehicle_make || null,
        vehicle_model: parsed.vehicle_model || null,
        vehicle_year: parsed.vehicle_year || null,
        vehicle_registration: parsed.vehicle_registration || null,
      },
      confidence,
    }
  } catch {
    return {
      claimData: {
        claim_number: null,
        client_name: null,
        insurance_company: null,
        claim_type: null,
        contact_number: null,
        contact_email: null,
        incident_description: null,
        excess_amount: null,
        special_instructions: null,
        vehicle_make: null,
        vehicle_model: null,
        vehicle_year: null,
        vehicle_registration: null,
      },
      confidence: 0,
    }
  }
}

/**
 * Get a confidence assessment for the extraction result.
 * Uses weighted scoring: critical fields matter more, with quality checks.
 *
 * Weight allocation (total 100 points):
 *   claim_number:          30 pts (most critical — unique identifier)
 *   client_name:           20 pts (essential for communication)
 *   claim_type:            15 pts (determines processing path)
 *   incident_description:  15 pts (context for assessors)
 *   contact_number:         5 pts (nice to have)
 *   contact_email:          5 pts (nice to have)
 *   insurance_company:      5 pts (helps folder routing)
 *   excess_amount:          3 pts (financial detail)
 *   vehicle registration:   2 pts (motor-specific detail)
 *
 * Quality penalties:
 *   - Very short claim_number (< 3 chars): -10
 *   - Very short client_name (< 2 chars): -5
 *   - Invalid claim_type: -10
 */
export function assessExtractionConfidence(claimData: Record<string, string | null>): number {
  const validClaimTypes = ['Motor', 'Building', 'Marine', 'Agricultural', 'Household', 'Liability']

  const weights: Record<string, number> = {
    claim_number: 30,
    client_name: 20,
    claim_type: 15,
    incident_description: 15,
    contact_number: 5,
    contact_email: 5,
    insurance_company: 5,
    excess_amount: 3,
    vehicle_registration: 2,
  }

  let score = 0

  for (const [field, weight] of Object.entries(weights)) {
    const value = claimData[field]
    if (value && value !== null && value.trim().length > 0) {
      score += weight
    }
  }

  // Quality penalties
  const claimNumber = claimData.claim_number
  if (claimNumber && claimNumber.trim().length > 0 && claimNumber.trim().length < 3) {
    score -= 10
  }

  const clientName = claimData.client_name
  if (clientName && clientName.trim().length > 0 && clientName.trim().length < 2) {
    score -= 5
  }

  const claimType = claimData.claim_type
  if (claimType && !validClaimTypes.includes(claimType)) {
    score -= 10
  }

  return Math.min(100, Math.max(0, Math.round(score)))
}
