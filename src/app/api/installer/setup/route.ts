import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import net from 'net'

// ─── Config Field Definitions ─────────────────────────────────────────────────

interface ConfigField {
  key: string
  label: string
  description: string
  type: 'text' | 'password' | 'email' | 'number' | 'select' | 'switch'
  placeholder: string
  required: boolean
  sensitive: boolean
  options?: { label: string; value: string }[]
}

interface ConfigGroup {
  id: string
  label: string
  description: string
  icon: string
  fields: ConfigField[]
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'company',
    label: 'Company Info',
    description: 'Basic company information for the system',
    icon: 'Building2',
    fields: [
      { key: 'company_name', label: 'Company Name', description: 'Your company or organization name', type: 'text', placeholder: 'Stefco Insurance', required: true, sensitive: false },
      { key: 'company_email', label: 'Company Email', description: 'Primary contact email address', type: 'email', placeholder: 'claims@stefco.co.za', required: true, sensitive: false },
      { key: 'phone', label: 'Phone Number', description: 'Primary contact phone number', type: 'text', placeholder: '+27 11 123 4567', required: false, sensitive: false },
      { key: 'timezone', label: 'Timezone', description: 'System timezone for scheduling and timestamps', type: 'select', placeholder: 'Africa/Johannesburg', required: true, sensitive: false, options: [
        { label: 'Africa/Johannesburg (SAST)', value: 'Africa/Johannesburg' },
        { label: 'Africa/Cairo (EET)', value: 'Africa/Cairo' },
        { label: 'Africa/Lagos (WAT)', value: 'Africa/Lagos' },
        { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
        { label: 'Europe/Paris (CET)', value: 'Europe/Paris' },
        { label: 'UTC', value: 'UTC' },
        { label: 'America/New_York (EST)', value: 'America/New_York' },
        { label: 'America/Chicago (CST)', value: 'America/Chicago' },
        { label: 'America/Denver (MST)', value: 'America/Denver' },
        { label: 'America/Los_Angeles (PST)', value: 'America/Los_Angeles' },
      ]},
    ],
  },
  {
    id: 'ai',
    label: 'AI Provider',
    description: 'Configure AI service for email classification and data extraction',
    icon: 'Brain',
    fields: [
      { key: 'ai_provider', label: 'AI Provider', description: 'Select the primary AI provider', type: 'select', placeholder: 'gemini', required: true, sensitive: false, options: [
        { label: 'Google Gemini', value: 'gemini' },
        { label: 'Groq', value: 'groq' },
        { label: 'OpenRouter', value: 'openrouter' },
      ]},
      { key: 'gemini_api_key', label: 'Gemini API Key', description: 'Google Gemini API key for AI processing', type: 'password', placeholder: 'AIza...', required: false, sensitive: true },
      { key: 'groq_api_key', label: 'Groq API Key', description: 'Groq API key (fallback provider)', type: 'password', placeholder: 'gsk_...', required: false, sensitive: true },
      { key: 'openrouter_api_key', label: 'OpenRouter API Key', description: 'OpenRouter API key (fallback provider)', type: 'password', placeholder: 'sk-or-...', required: false, sensitive: true },
      { key: 'gemini_model', label: 'Model Name', description: 'AI model to use for processing', type: 'text', placeholder: 'gemini-2.0-flash', required: false, sensitive: false },
    ],
  },
  {
    id: 'imap',
    label: 'Incoming Email (IMAP)',
    description: 'Configure email server for receiving claim notifications',
    icon: 'Mail',
    fields: [
      { key: 'imap_host', label: 'IMAP Host', description: 'IMAP server hostname', type: 'text', placeholder: 'imap.gmail.com', required: true, sensitive: false },
      { key: 'imap_port', label: 'IMAP Port', description: 'IMAP server port (usually 993 for SSL)', type: 'number', placeholder: '993', required: true, sensitive: false },
      { key: 'imap_user', label: 'IMAP Username', description: 'Email address for IMAP login', type: 'email', placeholder: 'claims@stefco.co.za', required: true, sensitive: false },
      { key: 'imap_password', label: 'IMAP Password', description: 'Password or app-specific password', type: 'password', placeholder: '••••••••', required: true, sensitive: true },
      { key: 'imap_ssl', label: 'Use SSL/TLS', description: 'Enable SSL encryption for IMAP connection', type: 'switch', placeholder: '', required: false, sensitive: false },
    ],
  },
  {
    id: 'smtp',
    label: 'Outgoing Email (SMTP)',
    description: 'Configure SMTP server for sending auto-replies and notifications',
    icon: 'Send',
    fields: [
      { key: 'smtp_host', label: 'SMTP Host', description: 'SMTP server hostname', type: 'text', placeholder: 'smtp.gmail.com', required: true, sensitive: false },
      { key: 'smtp_port', label: 'SMTP Port', description: 'SMTP server port (usually 587 for TLS)', type: 'number', placeholder: '587', required: true, sensitive: false },
      { key: 'smtp_user', label: 'SMTP Username', description: 'Email address for SMTP authentication', type: 'email', placeholder: 'claims@stefco.co.za', required: true, sensitive: false },
      { key: 'smtp_password', label: 'SMTP Password', description: 'Password or app-specific password', type: 'password', placeholder: '••••••••', required: true, sensitive: true },
      { key: 'smtp_ssl', label: 'Use SSL/TLS', description: 'Enable TLS encryption for SMTP connection', type: 'switch', placeholder: '', required: false, sensitive: false },
      { key: 'smtp_from_name', label: 'From Name', description: 'Display name for outgoing emails', type: 'text', placeholder: 'Stefco Claims', required: false, sensitive: false },
    ],
  },
  {
    id: 'processing',
    label: 'Processing Rules',
    description: 'Configure automated claim processing behavior',
    icon: 'Settings2',
    fields: [
      { key: 'confidence_threshold', label: 'Confidence Threshold', description: 'Minimum AI confidence score (0-100) for auto-processing', type: 'number', placeholder: '70', required: false, sensitive: false },
      { key: 'auto_reply_enabled', label: 'Auto-Reply Enabled', description: 'Automatically send acknowledgment emails for new claims', type: 'switch', placeholder: '', required: false, sensitive: false },
      { key: 'business_hours_start', label: 'Business Hours Start', description: 'Start of business hours (HH:MM format)', type: 'text', placeholder: '08:00', required: false, sensitive: false },
      { key: 'business_hours_end', label: 'Business Hours End', description: 'End of business hours (HH:MM format)', type: 'text', placeholder: '17:00', required: false, sensitive: false },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Configure file storage paths for claims and documents',
    icon: 'HardDrive',
    fields: [
      { key: 'claims_storage_path', label: 'Claims Storage Path', description: 'Base directory for storing claim documents and files', type: 'text', placeholder: './claims-storage', required: false, sensitive: false },
    ],
  },
]

// ─── Helper Functions ─────────────────────────────────────────────────────────

function maskValue(value: string): string {
  if (!value) return ''
  if (value.length <= 6) return '••••••'
  return `${value.substring(0, 3)}${'•'.repeat(Math.min(value.length - 6, 12))}${value.substring(value.length - 3)}`
}

// ─── GET: Fetch all config groups with current values ─────────────────────────

export async function GET() {
  try {
    // Fetch all existing system configs
    const existingConfigs = await db.systemConfig.findMany()
    const configMap: Record<string, string> = {}
    for (const config of existingConfigs) {
      configMap[config.key] = config.value
    }

    // Build response with current values
    const groups = CONFIG_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.map((field) => ({
        ...field,
        currentValue: configMap[field.key] || '',
        maskedValue: field.sensitive && configMap[field.key] ? maskValue(configMap[field.key]) : null,
      })),
    }))

    // Determine if setup is complete
    const requiredFields = CONFIG_GROUPS.flatMap((g) => g.fields.filter((f) => f.required))
    const missingRequired = requiredFields.filter((f) => !configMap[f.key] || configMap[f.key].trim() === '')
    const setupComplete = missingRequired.length === 0

    // Calculate completion percentage
    const totalRequired = requiredFields.length
    const completedRequired = totalRequired - missingRequired.length
    const completionPercent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0

    return NextResponse.json({
      groups,
      setupComplete,
      completionPercent,
      totalRequired,
      completedRequired,
      missingRequiredFields: missingRequired.map((f) => ({ key: f.key, label: f.label, groupId: CONFIG_GROUPS.find(g => g.fields.some(ff => ff.key === f.key))?.id })),
    })
  } catch (error) {
    console.error('Setup fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch setup configuration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// ─── PUT: Save config values for a specific group ─────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { group, values } = body as { group: string; values: Record<string, string> }

    if (!group || !values || typeof values !== 'object') {
      return NextResponse.json(
        { error: 'Missing required fields: group, values' },
        { status: 400 }
      )
    }

    const configGroup = CONFIG_GROUPS.find((g) => g.id === group)
    if (!configGroup) {
      return NextResponse.json(
        { error: `Unknown config group: ${group}`, availableGroups: CONFIG_GROUPS.map((g) => g.id) },
        { status: 400 }
      )
    }

    const validKeys = new Set(configGroup.fields.map((f) => f.key))
    const updatedConfigs = []

    for (const [key, value] of Object.entries(values)) {
      if (!validKeys.has(key)) {
        continue
      }
      const stringValue = String(value ?? '')

      // Retry up to 3 times for database locked errors (SQLite BUSY)
      let retries = 0
      const maxRetries = 3
      let config = null
      while (retries < maxRetries) {
        try {
          config = await db.systemConfig.upsert({
            where: { key },
            update: { value: stringValue },
            create: { key, value: stringValue },
          })
          break
        } catch (upsertErr) {
          const errMsg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr)
          if (errMsg.includes('SQLITE_BUSY') || errMsg.includes('database is locked')) {
            retries++
            if (retries >= maxRetries) {
              console.error(`Setup update: database locked after ${maxRetries} retries for key "${key}"`)
              throw new Error(`Database busy — could not save "${key}" after ${maxRetries} attempts. Please try again.`)
            }
            // Wait 100ms + random jitter before retrying
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100))
          } else {
            // Non-retryable error — rethrow
            throw upsertErr
          }
        }
      }
      if (config) updatedConfigs.push(config)
    }

    // Return updated group config
    const allConfigs = await db.systemConfig.findMany()
    const configMap: Record<string, string> = {}
    for (const config of allConfigs) {
      configMap[config.key] = config.value
    }

    const updatedGroup = {
      ...configGroup,
      fields: configGroup.fields.map((field) => ({
        ...field,
        currentValue: configMap[field.key] || '',
        maskedValue: field.sensitive && configMap[field.key] ? maskValue(configMap[field.key]) : null,
      })),
    }

    return NextResponse.json({
      message: `${updatedConfigs.length} configuration(s) updated`,
      updated: updatedConfigs.length,
      group: updatedGroup,
    })
  } catch (error) {
    console.error('Setup update error:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to update setup configuration', details: errMsg },
      { status: 500 }
    )
  }
}

// ─── POST: Validation actions ─────────────────────────────────────────────────

function tcpConnect(host: string, port: number, timeoutMs = 5000): Promise<{ success: boolean; message: string; latency?: number }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, message: `Connection timed out after ${timeoutMs}ms` })
    }, timeoutMs)

    socket.connect(port, host, () => {
      const latency = Date.now() - start
      clearTimeout(timer)
      socket.destroy()
      resolve({ success: true, message: `Connected to ${host}:${port} (${latency}ms)`, latency })
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ success: false, message: `Failed to connect to ${host}:${port} - ${err.message}` })
    })
  })
}

/**
 * Auto-detect an available Gemini model by querying the models list API.
 * Returns the best matching model name, or null if none found.
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

      // Filter to models that support generateContent
      const generative = models.filter(m =>
        m.supportedGenerationMethods?.includes('generateContent')
      )

      if (generative.length === 0) continue

      // Priority order: prefer newer flash models
      const priority = [
        /gemini-2\.5-flash/,
        /gemini-2\.0-flash/,
        /gemini-1\.5-flash/,
        /gemini-1\.5-pro/,
        /gemini-pro/,
        /gemini-1\.0/,
      ]

      // Extract model name from full path (e.g., "models/gemini-2.0-flash" → "gemini-2.0-flash")
      const nameMap = generative.map(m => {
        const parts = m.name.split('/')
        return parts[parts.length - 1]
      })

      // Try each priority in order, pick the first match
      for (const regex of priority) {
        const match = nameMap.find(n => regex.test(n))
        if (match) return match
      }

      // Fallback: return the first generative model
      return nameMap[0] || null
    } catch {
      continue
    }
  }

  return null
}

/**
 * Quickly test if a provider API is reachable and responding.
 * Used for fallback provider detection during validation.
 */
async function testProviderQuick(
  providerName: string,
  apiKey: string,
  modelName: string,
): Promise<{ success: boolean; latency: number }> {
  const start = Date.now()
  try {
    if (providerName === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "connected" in one word.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      })
      return { success: res.ok, latency: Date.now() - start }
    } else {
      const baseUrl = providerName === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions'
      const res = await fetch(baseUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
          max_tokens: 10,
        }),
      })
      return { success: res.ok, latency: Date.now() - start }
    }
  } catch {
    return { success: false, latency: Date.now() - start }
  }
}

/**
 * Test all configured fallback providers (excluding the primary).
 * Returns a list of working providers with their latency.
 */
async function testFallbackProviders(
  excludeProvider?: string,
): Promise<Array<{ provider: string; model: string; latency: number }>> {
  const working: Array<{ provider: string; model: string; latency: number }> = []

  const defaultModels: Record<string, string> = {
    gemini: 'gemini-2.0-flash',
    groq: 'llama3-8b-8192',
    openrouter: 'openai/gpt-3.5-turbo',
  }

  const providers: Array<[string, string]> = [
    ['gemini', 'gemini_api_key'],
    ['groq', 'groq_api_key'],
    ['openrouter', 'openrouter_api_key'],
  ]

  for (const [p, dbKey] of providers) {
    if (p === excludeProvider) continue
    const keyConfig = await db.systemConfig.findUnique({ where: { key: dbKey } })
    const key = keyConfig?.value || ''
    if (!key) continue

    console.error(`[setup] Testing fallback provider: ${p}`)
    const result = await testProviderQuick(p, key, defaultModels[p])
    if (result.success) {
      console.error(`[setup] Fallback provider ${p} working (${result.latency}ms)`)
      working.push({ provider: p, model: defaultModels[p], latency: result.latency })
    } else {
      console.error(`[setup] Fallback provider ${p} failed`)
    }
  }

  return working
}

async function validateAiKey(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  // Read provider from SystemConfig
  const providerConfig = await db.systemConfig.findUnique({ where: { key: 'ai_provider' } })
  const provider = providerConfig?.value || 'gemini'

  let apiKey = ''
  let modelName = ''

  switch (provider) {
    case 'groq': {
      const keyConfig = await db.systemConfig.findUnique({ where: { key: 'groq_api_key' } })
      apiKey = keyConfig?.value || ''
      modelName = 'llama3-8b-8192'
      break
    }
    case 'openrouter': {
      const keyConfig = await db.systemConfig.findUnique({ where: { key: 'openrouter_api_key' } })
      apiKey = keyConfig?.value || ''
      modelName = 'openai/gpt-3.5-turbo'
      break
    }
    default: {
      const keyConfig = await db.systemConfig.findUnique({ where: { key: 'gemini_api_key' } })
      const modelConfigs = await db.systemConfig.findMany({
        where: { key: { in: ['gemini_model', 'ai_model'] } },
      })
      const modelMap: Record<string, string> = {}
      for (const c of modelConfigs) modelMap[c.key] = c.value
      apiKey = keyConfig?.value || ''
      modelName = modelMap['gemini_model'] || modelMap['ai_model'] || 'gemini-2.0-flash'
      break
    }
  }

  if (!apiKey) {
    return {
      success: false,
      message: `No API key configured for ${provider}. Please enter a valid API key.`,
      details: { provider, configured: false },
    }
  }

  // Validate key format before making API call
  if (provider === 'gemini' && (!apiKey.startsWith('AIza') || apiKey.length < 20)) {
    return {
      success: false,
      message: `Invalid Gemini API key format. Keys should start with "AIza" and be at least 20 characters.`,
      details: { provider, configured: false, keyPrefix: apiKey.substring(0, 4), keyLength: apiKey.length },
    }
  }
  if (provider === 'groq' && (!apiKey.startsWith('gsk_') || apiKey.length < 20)) {
    return {
      success: false,
      message: `Invalid Groq API key format. Keys should start with "gsk_" and be at least 20 characters.`,
      details: { provider, configured: false },
    }
  }
  if (provider === 'openrouter' && (!apiKey.startsWith('sk-or-') || apiKey.length < 20)) {
    return {
      success: false,
      message: `Invalid OpenRouter API key format. Keys should start with "sk-or-" and be at least 20 characters.`,
      details: { provider, configured: false },
    }
  }

  try {
    const start = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let url = ''
    let headers: Record<string, string> = {}
    let body: string | undefined

    if (provider === 'gemini') {
      // Try generateContent with a minimal request — try v1beta first, then v1
      const geminiUrls = [
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
      ]
      headers = { 'Content-Type': 'application/json' }
      body = JSON.stringify({
        contents: [{ parts: [{ text: 'Say "connected" in one word.' }] }],
        generationConfig: { maxOutputTokens: 10 },
      })

      let lastResponse: Response | null = null
      for (const tryUrl of geminiUrls) {
        try {
          const tryRes = await fetch(tryUrl, {
            method: 'POST',
            signal: controller.signal,
            headers,
            body,
          })
          lastResponse = tryRes
          if (tryRes.ok) {
            clearTimeout(timeout)
            const latency = Date.now() - start
            return {
              success: true,
              message: `${provider} connection successful — model "${modelName}" responded in ${latency}ms`,
              details: { provider, model: modelName, configured: true, latency, statusCode: tryRes.status },
            }
          }
          // 401/403 = auth error, don't retry
          if (tryRes.status === 401 || tryRes.status === 403) break
        } catch {
          continue
        }
      }

      // All Gemini URLs failed — use the last response for error parsing
      if (lastResponse) {
        clearTimeout(timeout)
        const latency = Date.now() - start
        let errorDetail = lastResponse.statusText
        try {
          const errBody = await lastResponse.json()
          const rawMsg = errBody?.error?.message || errBody?.message || ''
          if (rawMsg) {
            const firstLine = rawMsg.split('\n')[0].split('.\n')[0]
            errorDetail = firstLine.length > 200 ? firstLine.substring(0, 200) + '...' : firstLine
          }
        } catch { /* ignore */ }

        let suggestion = ''
        if (lastResponse.status === 400) {
          suggestion = ' Check that the model name is correct and your region is supported.'
        } else if (lastResponse.status === 401 || lastResponse.status === 403) {
          suggestion = ' The API key may be invalid, expired, or lacks permissions.'
        } else if (lastResponse.status === 404) {
          // Model not found — auto-detect a working model
          suggestion = ` Model "${modelName}" not found. Auto-detecting available models...`
          const detected = await autoDetectGeminiModel(apiKey)
          if (detected) {
            // Update both gemini_model and ai_model in DB
            await db.systemConfig.upsert({ where: { key: 'gemini_model' }, update: { value: detected }, create: { key: 'gemini_model', value: detected } })
            await db.systemConfig.upsert({ where: { key: 'ai_model' }, update: { value: detected }, create: { key: 'ai_model', value: detected } })
            // Retry with detected model
            const retryUrls = [
              `https://generativelanguage.googleapis.com/v1beta/models/${detected}:generateContent?key=${apiKey}`,
              `https://generativelanguage.googleapis.com/v1/models/${detected}:generateContent?key=${apiKey}`,
            ]
            const retryBody = JSON.stringify({
              contents: [{ parts: [{ text: 'Say "connected" in one word.' }] }],
              generationConfig: { maxOutputTokens: 10 },
            })
            for (const retryUrl of retryUrls) {
              try {
                const retryRes = await fetch(retryUrl, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: retryBody })
                if (retryRes.ok) {
                  const retryLatency = Date.now() - start
                  return {
                    success: true,
                    message: `Auto-fixed! Model changed from "${modelName}" → "${detected}" — connection successful in ${retryLatency}ms`,
                    details: { provider, model: detected, previousModel: modelName, configured: true, autoFixed: true, latency: retryLatency },
                  }
                }
              } catch { continue }
            }
            // Detected model but retry failed — still report the fix
            suggestion = ` Auto-detected model "${detected}" (updated from "${modelName}"). Retry may have failed due to rate limits.`
          } else {
            suggestion = ` Model "${modelName}" not found and auto-detection failed. Try "gemini-2.0-flash" or "gemini-2.5-flash".`
          }
        } else if (lastResponse.status === 429) {
          suggestion = ' Rate limit exceeded.'
        }

        // ─── Fallback: try other configured providers first, then z-ai-web-dev-sdk ───
        if ([400, 404, 429, 500, 502, 503].includes(lastResponse.status)) {
          // First, try other configured providers (Groq, OpenRouter, etc.)
          const fallbacks = await testFallbackProviders(provider)
          if (fallbacks.length > 0) {
            const fallbackNames = fallbacks.map(f => `${f.provider} (${f.latency}ms)`).join(', ')
            return {
              success: true,
              message: `${provider} returned ${lastResponse.status}, but fallback provider(s) working: ${fallbackNames}. AI processing will use the fallback automatically.`,
              details: {
                provider, model: modelName, configured: true, fallback: true,
                fallbackProviders: fallbacks,
                directStatusCode: lastResponse.status,
                note: `Direct ${provider} API unavailable (${lastResponse.status}). Fallback provider(s) ${fallbackNames} will be used automatically.`,
              },
            }
          }
          // No fallback providers worked — try z-ai-web-dev-sdk as last resort
          try {
            const fallbackStart = Date.now()
            const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default || m.ZAI || m)
            const zai = await ZAI.create()
            const completion = await zai.chat.completions.create({
              messages: [
                { role: 'system', content: 'You are a connection test. Respond with exactly one word: connected.' },
                { role: 'user', content: 'Test' },
              ],
              thinking: { type: 'disabled' },
            })
            const fallbackLatency = Date.now() - fallbackStart
            const text = completion.choices?.[0]?.message?.content
            if (text) {
              return {
                success: true,
                message: `Direct ${provider} API returned ${lastResponse.status}, no other API keys configured, but built-in AI fallback responded in ${fallbackLatency}ms. AI processing will use the fallback automatically.`,
                details: {
                  provider, model: modelName, configured: true, fallback: true,
                  fallbackLatency, directStatusCode: lastResponse.status,
                  note: `The direct ${provider} API is unavailable (${lastResponse.status}), and no other API keys are configured. The built-in AI fallback works. Email processing will use the fallback.`,
                },
              }
            }
          } catch { /* fallback failed */ }
        }

        return {
          success: false,
          message: `${provider} API error (${lastResponse.status}): ${errorDetail}.${suggestion}`,
          details: { provider, model: modelName, configured: true, statusCode: lastResponse.status, suggestion: suggestion.trim() },
        }
      }
      // No response at all (network error handled below)
    } else if (provider === 'groq') {
      url = `https://api.groq.com/openai/v1/chat/completions`
      headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      body = JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
        max_tokens: 10,
      })
    } else {
      url = `https://openrouter.ai/api/v1/chat/completions`
      headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      body = JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Say "connected" in one word.' }],
        max_tokens: 10,
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body,
    })
    clearTimeout(timeout)
    const latency = Date.now() - start

    if (response.ok) {
      return {
        success: true,
        message: `${provider} connection successful — model "${modelName}" responded in ${latency}ms`,
        details: { provider, model: modelName, configured: true, latency, statusCode: response.status },
      }
    }

    // Parse error body for better messages (truncate to first line)
    let errorDetail = response.statusText
    try {
      const errBody = await response.json()
      const rawMsg = errBody?.error?.message || errBody?.message || ''
      if (rawMsg) {
        // Take only the first meaningful line (Gemini returns multi-line errors)
        const firstLine = rawMsg.split('\n')[0].split('.\n')[0]
        errorDetail = firstLine.length > 200 ? firstLine.substring(0, 200) + '...' : firstLine
      }
    } catch { /* ignore parse error */ }

    // Provide helpful suggestions based on status code
    let suggestion = ''
    if (response.status === 400) {
      suggestion = ' Check that the API key is valid and the model name is correct.'
    } else if (response.status === 401 || response.status === 403) {
      suggestion = ' The API key may be invalid, expired, or lacks permissions.'
    } else if (response.status === 429) {
      suggestion = ' Rate limit exceeded.'
    }

    // ─── Fallback: try other configured providers first, then z-ai-web-dev-sdk ───
    if (response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503) {
      // First, try other configured providers (Gemini, Groq, OpenRouter — whichever is not primary)
      const fallbacks = await testFallbackProviders(provider)
      if (fallbacks.length > 0) {
        const fallbackNames = fallbacks.map(f => `${f.provider} (${f.latency}ms)`).join(', ')
        return {
          success: true,
          message: `${provider} returned ${response.status}, but fallback provider(s) working: ${fallbackNames}. AI processing will use the fallback automatically.`,
          details: {
            provider,
            model: modelName,
            configured: true,
            fallback: true,
            fallbackProviders: fallbacks,
            directLatency: latency,
            directStatusCode: response.status,
            note: `Direct ${provider} API returned ${response.status}. Fallback provider(s) ${fallbackNames} will be used automatically for email processing.`,
          },
        }
      }
      // No fallback providers — try z-ai-web-dev-sdk as last resort
      try {
        const fallbackStart = Date.now()
        const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default || m.ZAI || m)
        const zai = await ZAI.create()
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a connection test. Respond with exactly one word: connected.' },
            { role: 'user', content: 'Test' },
          ],
          thinking: { type: 'disabled' },
        })
        const fallbackLatency = Date.now() - fallbackStart
        const text = completion.choices?.[0]?.message?.content
        if (text) {
          return {
            success: true,
            message: `${provider} returned ${response.status}, no other API keys configured, but built-in AI fallback responded in ${fallbackLatency}ms. AI processing will use the fallback automatically.`,
            details: {
              provider,
              model: modelName,
              configured: true,
              fallback: true,
              fallbackLatency,
              directLatency: latency,
              directStatusCode: response.status,
              note: `Direct ${provider} API returned ${response.status}, and no other API keys are configured. The built-in AI fallback works and will be used automatically.`,
            },
          }
        }
      } catch (fallbackErr) {
        // Fallback also failed — return original error
      }
    }

    return {
      success: false,
      message: `${provider} API error (${response.status}): ${errorDetail}.${suggestion}`,
      details: { provider, model: modelName, configured: true, statusCode: response.status, suggestion: suggestion.trim() },
    }
  } catch (error) {
    // Network error — try other configured providers first, then z-ai-web-dev-sdk
    const fallbacks = await testFallbackProviders(provider)
    if (fallbacks.length > 0) {
      const fallbackNames = fallbacks.map(f => `${f.provider} (${f.latency}ms)`).join(', ')
      return {
        success: true,
        message: `${provider} unreachable, but fallback provider(s) working: ${fallbackNames}. AI processing will use the fallback automatically.`,
        details: {
          provider,
          model: modelName,
          configured: true,
          fallback: true,
          fallbackProviders: fallbacks,
          note: `Could not reach ${provider} API directly. Fallback provider(s) ${fallbackNames} will be used automatically.`,
        },
      }
    }
    // No fallback providers — try z-ai-web-dev-sdk as last resort
    try {
      const fallbackStart = Date.now()
      const ZAI = await import('z-ai-web-dev-sdk').then((m) => m.default || m.ZAI || m)
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a connection test. Respond with exactly one word: connected.' },
          { role: 'user', content: 'Test' },
        ],
        thinking: { type: 'disabled' },
      })
      const fallbackLatency = Date.now() - fallbackStart
      const text = completion.choices?.[0]?.message?.content
      if (text) {
        return {
          success: true,
          message: `${provider} unreachable, no other API keys configured, but built-in AI fallback responded in ${fallbackLatency}ms. AI processing will use the fallback automatically.`,
          details: {
            provider,
            model: modelName,
            configured: true,
            fallback: true,
            fallbackLatency,
            note: `Could not reach ${provider} API directly, and no other API keys are configured. The built-in AI fallback works and will be used automatically.`,
          },
        }
      }
    } catch {
      // Fallback also failed
    }

    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return {
      success: false,
      message: isTimeout
        ? `${provider} API connection timed out after 15s. Check your network or try again.`
        : `Failed to reach ${provider} API: ${error instanceof Error ? error.message : String(error)}`,
      details: { provider, error: error instanceof Error ? error.message : String(error), timeout: isTimeout },
    }
  }
}

async function validateImap(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const configs = await db.systemConfig.findMany({
    where: { key: { in: ['imap_host', 'imap_port', 'imap_ssl'] } },
  })
  const configMap: Record<string, string> = {}
  for (const c of configs) configMap[c.key] = c.value

  const host = configMap['imap_host']
  const port = parseInt(configMap['imap_port'] || '993', 10)

  if (!host) {
    return { success: false, message: 'IMAP host is not configured' }
  }

  const result = await tcpConnect(host, port)
  return {
    success: result.success,
    message: result.message,
    details: { host, port, ssl: configMap['imap_ssl'] || 'true', latency: result.latency },
  }
}

async function validateSmtp(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
  const configs = await db.systemConfig.findMany({
    where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_ssl'] } },
  })
  const configMap: Record<string, string> = {}
  for (const c of configs) configMap[c.key] = c.value

  const host = configMap['smtp_host']
  const port = parseInt(configMap['smtp_port'] || '587', 10)

  if (!host) {
    return { success: false, message: 'SMTP host is not configured' }
  }

  const result = await tcpConnect(host, port)
  return {
    success: result.success,
    message: result.message,
    details: { host, port, ssl: configMap['smtp_ssl'] || 'true', latency: result.latency },
  }
}

async function seedFromEnv(): Promise<{ success: boolean; message: string; details?: Record<string, string> }> {
  const envMapping: Record<string, string> = {
    company_name: 'COMPANY_NAME',
    company_email: 'COMPANY_EMAIL',
    phone: 'COMPANY_PHONE',
    timezone: 'TZ',
    gemini_api_key: 'GEMINI_API_KEY',
    groq_api_key: 'GROQ_API_KEY',
    openrouter_api_key: 'OPENROUTER_API_KEY',
    ai_provider: 'AI_PROVIDER',
    gemini_model: 'GEMINI_MODEL',
    imap_host: 'IMAP_HOST',
    imap_port: 'IMAP_PORT',
    imap_user: 'IMAP_USER',
    imap_password: 'IMAP_PASSWORD',
    imap_ssl: 'IMAP_SSL',
    smtp_host: 'SMTP_HOST',
    smtp_port: 'SMTP_PORT',
    smtp_user: 'SMTP_USER',
    smtp_password: 'SMTP_PASSWORD',
    smtp_ssl: 'SMTP_SSL',
    smtp_from_name: 'SMTP_FROM_NAME',
    claims_storage_path: 'CLAIMS_STORAGE_PATH',
    confidence_threshold: 'CONFIDENCE_THRESHOLD',
    auto_reply_enabled: 'AUTO_REPLY_ENABLED',
    business_hours_start: 'BUSINESS_HOURS_START',
    business_hours_end: 'BUSINESS_HOURS_END',
  }

  const seeded: string[] = []
  const skipped: string[] = []

  for (const [configKey, envKey] of Object.entries(envMapping)) {
    const envValue = process.env[envKey]
    if (envValue) {
      await db.systemConfig.upsert({
        where: { key: configKey },
        update: { value: envValue },
        create: { key: configKey, value: envValue },
      })
      seeded.push(configKey)
    } else {
      skipped.push(configKey)
    }
  }

  return {
    success: true,
    message: `Seeded ${seeded.length} values from environment variables`,
    details: {
      seeded: seeded.join(', '),
      skipped: skipped.join(', '),
      total: String(Object.keys(envMapping).length),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action', supportedActions: ['validate-ai', 'validate-imap', 'validate-smtp', 'seed-from-env'] },
        { status: 400 }
      )
    }

    switch (action) {
      case 'validate-ai':
        return NextResponse.json(await validateAiKey())
      case 'validate-imap':
        return NextResponse.json(await validateImap())
      case 'validate-smtp':
        return NextResponse.json(await validateSmtp())
      case 'seed-from-env':
        return NextResponse.json(await seedFromEnv())
      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action}`, supportedActions: ['validate-ai', 'validate-imap', 'validate-smtp', 'seed-from-env'] },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Setup action error:', error)
    return NextResponse.json(
      { error: 'Action failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
