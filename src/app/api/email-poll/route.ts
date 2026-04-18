import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ImapFlow } from 'imapflow'

/**
 * Helper: Get IMAP config from SystemConfig, fallback to env vars
 */
async function getImapConfig() {
  const configs = await db.systemConfig.findMany({
    where: {
      key: {
        in: ['imap_host', 'imap_port', 'imap_user', 'imap_password', 'imap_ssl', 'imap_poll_interval'],
      },
    },
  })

  const map: Record<string, string> = {}
  for (const c of configs) {
    map[c.key] = c.value
  }

  return {
    host: map['imap_host'] || process.env.IMAP_HOST || '',
    port: parseInt(map['imap_port'] || process.env.IMAP_PORT || '993', 10),
    user: map['imap_user'] || process.env.IMAP_USER || '',
    password: map['imap_password'] || process.env.IMAP_PASSWORD || '',
    secure: (map['imap_ssl'] || process.env.IMAP_SSL || 'true') === 'true',
    pollInterval: parseInt(map['imap_poll_interval'] || '300', 10),
  }
}

/**
 * Helper: Get a config value from SystemConfig
 */
async function getConfigValue(key: string): Promise<string | null> {
  const config = await db.systemConfig.findUnique({ where: { key } })
  return config?.value || null
}

/**
 * Helper: Set a config value in SystemConfig
 */
async function setConfigValue(key: string, value: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/**
 * Helper: Get SMTP from-email address from SystemConfig (for loop detection)
 */
async function getSMTPConfigFromDB(): Promise<{ fromEmail: string } | null> {
  try {
    const configs = await db.systemConfig.findMany({
      where: { key: { in: ['smtp_user', 'smtp_from_email'] } },
    })
    const map: Record<string, string> = {}
    for (const c of configs) map[c.key] = c.value
    const fromEmail = map['smtp_from_email'] || map['smtp_user'] || ''
    if (!fromEmail) return null
    return { fromEmail }
  } catch {
    return null
  }
}

/**
 * Helper: Save last poll result
 */
async function savePollResult(count: number, error?: string) {
  await setConfigValue('last_email_poll', new Date().toISOString())
  await setConfigValue('last_email_poll_count', String(count))
  if (error) {
    await setConfigValue('last_email_poll_error', error)
  } else {
    const prevError = await getConfigValue('last_email_poll_error')
    if (prevError) {
      await setConfigValue('last_email_poll_error', '')
    }
  }
}

/**
 * Helper: Process a single email through the classification pipeline
 */
async function processEmail(from: string, subject: string, body: string, attachments: { filename: string; contentType?: string; size?: number; content?: string }[]) {
  try {
    const baseUrl = process.env.DASHBOARD_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    console.error(`[email-poll] Processing "${subject}" from ${from} via ${baseUrl}/api/process-email`)
    const res = await fetch(`${baseUrl}/api/process-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, subject, body, attachments }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      console.error(`[email-poll] process-email failed for "${subject}": ${res.status} ${errText}`)
      return { success: false, error: `${res.status}: ${errText}` }
    }

    return { success: true, data: await res.json() }
  } catch (err) {
    console.error(`[email-poll] process-email error for "${subject}":`, err)
    return { success: false, error: String(err) }
  }
}

/**
 * Decode transfer-encoded content
 */
function decodeContent(raw: string, encoding: string): string {
  const enc = encoding.toLowerCase()
  if (enc === 'base64') {
    try { return Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('utf-8') } catch { return '' }
  }
  if (enc === 'quoted-printable') {
    return raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)))
  }
  return raw
}

/**
 * Extract headers map from a raw MIME block
 */
function extractHeaders(block: string): { headers: Record<string, string>; body: string } {
  const sepIdx = block.indexOf('\r\n\r\n')
  if (sepIdx === -1) {
    // Try single newline separator
    const sepIdx2 = block.indexOf('\n\n')
    if (sepIdx2 === -1) return { headers: {}, body: block }
    const hdr = block.slice(0, sepIdx2)
    const bdy = block.slice(sepIdx2 + 2)
    return { headers: parseHeaderLines(hdr), body: bdy }
  }
  const hdr = block.slice(0, sepIdx)
  const bdy = block.slice(sepIdx + 4)
  return { headers: parseHeaderLines(hdr), body: bdy }
}

function parseHeaderLines(headerStr: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of headerStr.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      map[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim()
    }
  }
  return map
}

/**
 * Strip HTML tags to extract plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Parse raw email source into plain text body and attachments
 * Handles nested multipart MIME, base64, quoted-printable encoding
 */
function parseEmailBody(rawSource: string): { body: string; attachments: { filename: string; contentType?: string; size?: number; content?: string }[] } {
  const attachments: { filename: string; contentType?: string; size?: number; content?: string }[] = []

  // Normalize line endings
  const normalized = rawSource.replace(/\r?\n/g, '\r\n')

  // Split headers from body
  const headerEndIdx = normalized.indexOf('\r\n\r\n')
  if (headerEndIdx === -1) return { body: '', attachments }

  const headers = normalized.slice(0, headerEndIdx)
  let rawBody = normalized.slice(headerEndIdx + 4)

  // Detect multipart boundary
  const boundaryMatch = headers.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary="?([^"\r\n]+)"?/i)
  const transferEncoding = (headers.match(/Content-Transfer-Encoding:\s*(\S+)/i) || [])[1]?.toLowerCase() || ''

  if (boundaryMatch) {
    const boundary = boundaryMatch[1]
    console.error(`[email-poll] Multipart email, boundary: ${boundary}`)

    // Recursively parse multipart parts
    let body = parseMultipartParts(rawBody, boundary, attachments)
    console.error(`[email-poll] After multipart parse: body=${body.length} chars, ${attachments.length} attachments`)

    // If body still empty, try extracting from any nested boundaries found in the raw content
    if (!body) {
      const nestedBoundaries = rawBody.match(/boundary="?([A-Za-z0-9'()+_,-.\/:=? ]{5,80})"?/gi)
      if (nestedBoundaries) {
        for (const nb of nestedBoundaries) {
          const nbMatch = nb.match(/boundary="?([^"\r\n]+)"?/i)
          if (nbMatch && nbMatch[1] !== boundary) {
            console.error(`[email-poll] Trying nested boundary: ${nbMatch[1]}`)
            const nestedBody = parseMultipartParts(rawBody, nbMatch[1], attachments)
            if (nestedBody) {
              body = nestedBody
              console.error(`[email-poll] Found body from nested boundary: ${body.length} chars`)
              break
            }
          }
        }
      }
    }

    // Last resort: try to find any text content in the raw body
    if (!body) {
      const textMatch = rawBody.match(/Content-Type:\s*text\/plain[^\r\n]*[\r\n]+([\s\S]*?)(?=\r\n\r\n--|\r\n--|$)/i)
      if (textMatch) {
        body = decodeContent(textMatch[1].trim(), 'quoted-printable').trim()
        console.error(`[email-poll] Last resort text/plain extraction: ${body.length} chars`)
      }
    }

    return { body: body.trim(), attachments }
  }

  // Not multipart — single part body
  if (transferEncoding) {
    rawBody = decodeContent(rawBody, transferEncoding)
  }

  // Strip HTML tags if needed
  if (/Content-Type:\s*text\/html/i.test(headers)) {
    rawBody = stripHtml(rawBody)
  }

  console.error(`[email-poll] Single part email: ${rawBody.length} chars`)
  return { body: rawBody.trim(), attachments }
}

/**
 * Recursively parse multipart MIME parts
 */
function parseMultipartParts(rawBody: string, boundary: string, attachments: { filename: string; contentType?: string; size?: number; content?: string }[]): string {
  let body = ''
  const parts = rawBody.split(`--${boundary}`)

  for (const part of parts) {
    if (part.startsWith('--') || part.trim() === '' || part.trim() === '--') continue

    const { headers, body: partRawBody } = extractHeaders(part)
    const partCT = (headers['content-type'] || '').toLowerCase()
    const partTE = (headers['content-transfer-encoding'] || '').toLowerCase()
    const partCD = (headers['content-disposition'] || '').toLowerCase()

    // Skip if this is the closing boundary
    if (partRawBody.trim() === '--') continue

    // Check for nested multipart
    const nestedBoundary = partCT.match(/multipart\/[^;]+;\s*boundary="?([^"\s;]+)"?/i)?.[1]
    if (nestedBoundary) {
      console.error(`[email-poll] Found nested multipart: ${nestedBoundary}`)
      const nestedBody = parseMultipartParts(partRawBody, nestedBoundary, attachments)
      if (nestedBody && !body) body = nestedBody
      continue
    }

    // Decode the part content
    let decoded = partRawBody.replace(/\r\n$/, '')
    if (partTE) decoded = decodeContent(decoded, partTE)

    // Prefer text/plain
    if (partCT.startsWith('text/plain') && !body) {
      body = decoded.trim()
      if (body.length > 0) console.error(`[email-poll] text/plain part: ${body.length} chars`)
    }

    // Fallback to text/html
    if (!body && partCT.startsWith('text/html')) {
      const text = stripHtml(decoded)
      if (text.length > 0) {
        body = text
        console.error(`[email-poll] text/html fallback: ${text.length} chars`)
      }
    }

    // Check for attachment
    const isAttachment = partCD.includes('attachment')
      || (partCD.includes('inline') && !partCT.startsWith('text/'))

    if (isAttachment) {
      const fn = partCD.match(/filename="?([^";\r\n]+)"?/i)?.[1]
        || partCT.match(/name="?([^";\r\n]+)"?/i)?.[1]
      if (fn) {
        // Capture binary content for base64-encoded attachments
        let attachmentContent: string | undefined
        if (partTE === 'base64' && decoded.length > 0) {
          // Strip whitespace/newlines from base64 content for clean encoding
          attachmentContent = decoded.replace(/\s/g, '')
        }

        attachments.push({
          filename: fn,
          contentType: partCT.split(';')[0],
          size: attachmentContent ? Math.round(Buffer.byteLength(attachmentContent, 'base64')) : undefined,
          content: attachmentContent,
        })
        console.error(`[email-poll] Attachment: ${fn} (${partCT.split(';')[0]}, ${attachmentContent ? `${Buffer.byteLength(attachmentContent, 'base64')} bytes` : 'no content'})`)
      }
    }
  }

  return body
}

/**
 * Check if an email should be skipped to prevent processing loops.
 * Returns { skip: true, reason: string } if the email should be skipped.
 *
 * Defense layers:
 * 1. Self-email: skip emails from the system's own IMAP user or SMTP from address
 * 2. Same-domain: skip emails from the same domain as the system's email
 * 3. Auto-reply headers: skip emails with standard auto-reply loop-prevention headers
 * 4. Auto-reply subject patterns: skip emails with common auto-reply/OOO subjects
 * 5. Stefco own auto-reply: skip emails we ourselves sent (X-Stefco-Auto-Reply)
 */
function shouldSkipEmail(
  fromAddress: string,
  subject: string,
  rawSource: string,
  systemEmailAddresses: string[],
  systemDomains: string[],
): { skip: boolean; reason: string } {
  const fromLower = fromAddress.toLowerCase().trim()
  const fromDomain = fromLower.includes('@') ? fromLower.split('@').slice(-1)[0] : ''

  // Layer 1: Exact self-email match
  for (const sysAddr of systemEmailAddresses) {
    if (sysAddr && fromLower === sysAddr.toLowerCase()) {
      return { skip: true, reason: `Self-email: from ${fromLower} matches system address ${sysAddr}` }
    }
  }

  // Layer 2: Same domain as system (catches aliases, catch-alls)
  if (fromDomain && systemDomains.length > 0) {
    for (const domain of systemDomains) {
      if (domain && fromDomain === domain.toLowerCase()) {
        return { skip: true, reason: `Same-domain: from ${fromDomain} matches system domain ${domain}` }
      }
    }
  }

  // Layer 3: Standard auto-reply / loop-prevention headers
  const headerCheck = rawSource.toLowerCase()
  if (headerCheck.includes('x-stefco-auto-reply: true')) {
    return { skip: true, reason: 'Stefco auto-reply detected via X-Stefco-Auto-Reply header' }
  }
  if (headerCheck.includes('auto-submitted: auto-replied') || headerCheck.includes('auto-submitted: auto-generated')) {
    return { skip: true, reason: 'Auto-submitted email detected (Auto-Submitted header)' }
  }
  if (headerCheck.includes('x-auto-response-suppress: all')) {
    return { skip: true, reason: 'Auto-response suppression header detected' }
  }
  if (headerCheck.includes('x-loop:')) {
    return { skip: true, reason: 'X-Loop header detected (mail loop prevention)' }
  }
  if (headerCheck.includes('precedence: bulk') || headerCheck.includes('precedence: list') || headerCheck.includes('precedence: junk')) {
    return { skip: true, reason: `Bulk/list mail detected (Precedence header)` }
  }

  // Layer 4: Auto-reply / out-of-office subject patterns
  const autoReplySubjectPatterns = [
    /^(auto[- ]?reply|out of office|ooo|autoreply|automatic reply|auto-generated|do not reply|no reply)\s*:/i,
    /auto[- ]?response/i,
    /out of office/i,
    /out of the office/i,
    /away from (the )?office/i,
    /on (annual )?leave/i,
    /claim received - \w+-\d+/i, // Our own auto-reply pattern: "Claim Received - STF-XXXXXX"
    /re:.*claim received - \w+-\d+/i, // Replies to our auto-reply
  ]
  for (const pattern of autoReplySubjectPatterns) {
    if (pattern.test(subject)) {
      return { skip: true, reason: `Auto-reply subject pattern matched: "${subject.slice(0, 80)}"` }
    }
  }

  return { skip: false, reason: '' }
}

/**
 * POST /api/email-poll
 */
export async function POST() {
  const startTime = Date.now()
  console.error(`[email-poll-v3] ===== POLL STARTED at ${new Date().toISOString()} =====`)

  try {
    const config = await getImapConfig()
    console.error(`[email-poll] Config: host=${config.host}, port=${config.port}, user=${config.user ? '***' : '(empty)'}, password=${config.password ? '***' : '(empty)'}`)

    if (!config.host || !config.user || !config.password) {
      console.error(`[email-poll] IMAP NOT CONFIGURED`)
      await savePollResult(0, 'IMAP not configured: missing host, user, or password')
      return NextResponse.json(
        { error: 'IMAP not configured', details: 'Please configure IMAP settings.', configured: false },
        { status: 400 }
      )
    }

    let client: ImapFlow | null = null
    let processedCount = 0
    let failedCount = 0
    const results: Array<{ subject: string; from: string; success: boolean; error?: string }> = []

    try {
      client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        tls: { rejectUnauthorized: false },
        auth: { user: config.user, pass: config.password },
        logger: false,
        connectionTimeout: 15000,
      })

      console.error(`[email-poll] Connecting to IMAP ${config.host}:${config.port}...`)
      await client.connect()
      console.error(`[email-poll] IMAP connected successfully!`)

      // Open INBOX
      let mailboxOpened = false
      for (const mailboxName of ['INBOX', 'inbox', 'Inbox']) {
        try {
          await client.mailboxOpen(mailboxName)
          mailboxOpened = true
          console.error(`[email-poll] Opened mailbox: ${mailboxName}`)
          break
        } catch {
          console.error(`[email-poll] Mailbox "${mailboxName}" not found, trying next...`)
        }
      }
      if (!mailboxOpened) {
        try {
          const mailboxes = await client.list()
          const names = mailboxes.map(m => m.path).join(', ')
          console.error(`[email-poll] Available mailboxes: ${names}`)
          await savePollResult(0, `INBOX not found. Available: ${names}`)
        } catch {
          await savePollResult(0, 'INBOX not found')
        }
        return NextResponse.json({ error: 'INBOX not found', processed: 0, configured: true }, { status: 503 })
      }

      const searchResult = await client.search({ seen: false })
      const messages = Array.isArray(searchResult) ? searchResult : []
      console.error(`[email-poll] Found ${messages.length} unread messages`)

      if (messages.length === 0) {
        console.error('[email-poll] No unread emails — poll complete')
        await savePollResult(0)
        await client.logout()
        return NextResponse.json({ success: true, processed: 0, failed: 0, total: 0, message: 'No unread emails to process', duration_ms: Date.now() - startTime })
      }

      console.error(`[email-poll] Processing ${messages.length} unread emails...`)

      // ── Build system email address list for loop detection ──
      // Collect all system-owned email addresses and domains so we can skip
      // emails that originate from ourselves (preventing infinite auto-reply loops)
      const imapUser = config.user.toLowerCase().trim()
      const smtpConfig = await getSMTPConfigFromDB()
      const smtpFromEmail = smtpConfig?.fromEmail?.toLowerCase().trim() || ''
      const systemEmailAddresses = [imapUser, smtpFromEmail].filter(Boolean)

      const systemDomains: string[] = []
      for (const addr of systemEmailAddresses) {
        if (addr.includes('@')) {
          const domain = addr.split('@').slice(-1)[0]
          if (domain && !systemDomains.includes(domain)) {
            systemDomains.push(domain)
          }
        }
      }

      if (systemEmailAddresses.length > 0) {
        console.error(`[email-poll] Loop detection active — system addresses: [${systemEmailAddresses.join(', ')}], domains: [${systemDomains.join(', ')}]`)
      }

      let skippedCount = 0

      for (const uid of messages) {
        try {
          const message = await client.fetchOne(uid, {
            source: true,
            uid: true,
            flags: true,
            envelope: true,
          })

          if (!message || !message.envelope || !message.source) {
            console.error(`[email-poll] Skipping UID ${uid}: missing envelope or source`)
            failedCount++
            results.push({ subject: `UID ${uid}`, from: 'unknown', success: false, error: 'Missing envelope or source data' })
            continue
          }

          const from = message.envelope.from?.[0]?.address || 'unknown@unknown.com'
          const subject = message.envelope.subject || '(no subject)'

          // ── Loop detection: skip self-emails and auto-replies ──
          const sourceStr = typeof message.source === 'string'
            ? message.source
            : Buffer.from(message.source).toString('utf-8')

          const skipCheck = shouldSkipEmail(from, subject, sourceStr, systemEmailAddresses, systemDomains)
          if (skipCheck.skip) {
            console.error(`[email-poll] SKIPPING UID ${uid}: ${skipCheck.reason} — "${subject.slice(0, 60)}"`)
            skippedCount++
            // Still mark as Seen so we never process it again
            await client.messageFlagsAdd(uid, ['\\Seen'])
            continue
          }

          // Parse email body
          const { body, attachments } = parseEmailBody(sourceStr)
          console.error(`[email-poll] Parsed: "${subject}" — body: ${body.length} chars, ${attachments.length} attachments`)

          // Use subject as fallback body when body is empty
          // Forwarded emails often have claim info in the subject line
          const effectiveBody = body.length > 0
            ? body
            : `[Email body was empty or could not be parsed. Subject contains: ${subject}]`

          console.error(`[email-poll] Effective body length: ${effectiveBody.length} chars (original: ${body.length})`)

          const result = await processEmail(from, subject, effectiveBody, attachments)
          if (result.success) {
            processedCount++
            results.push({ subject, from, success: true })
          } else {
            failedCount++
            results.push({ subject, from, success: false, error: result.error })
          }

          await client.messageFlagsAdd(uid, ['\\Seen'])
        } catch (emailErr) {
          failedCount++
          console.error(`[email-poll] Error processing UID ${uid}:`, emailErr)
          results.push({ subject: `UID ${uid}`, from: 'unknown', success: false, error: String(emailErr) })
        }
      }

      await client.logout()
      await savePollResult(processedCount)

      await db.auditLog.create({
        data: {
          action: 'imap_poll',
          details: `IMAP poll completed. Processed ${processedCount}/${messages.length} emails, skipped ${skippedCount} (loop detection), failed ${failedCount}. Duration: ${Date.now() - startTime}ms.`,
          status: failedCount > 0 ? 'WARNING' : 'SUCCESS',
          processedBy: 'AUTO',
        },
      })

      console.error(`[email-poll] ===== POLL COMPLETE: ${processedCount} processed, ${skippedCount} skipped (loop), ${failedCount} failed in ${Date.now() - startTime}ms =====`)

      return NextResponse.json({ success: true, processed: processedCount, skipped: skippedCount, failed: failedCount, total: messages.length, results: results.slice(0, 50), duration_ms: Date.now() - startTime })
    } catch (imapErr: unknown) {
      const errMessage = imapErr instanceof Error ? imapErr.message : String(imapErr)
      console.error(`[email-poll] IMAP error: ${errMessage}`)
      await savePollResult(0, `IMAP error: ${errMessage}`)

      if (errMessage.includes('AUTHENTICATE FAILED') || errMessage.includes('login')) {
        return NextResponse.json({ error: 'IMAP authentication failed', details: errMessage, processed: 0, configured: true }, { status: 401 })
      }
      if (errMessage.includes('ECONNREFUSED') || errMessage.includes('ENOTFOUND')) {
        return NextResponse.json({ error: 'IMAP connection failed', details: errMessage, processed: 0, configured: true }, { status: 503 })
      }

      return NextResponse.json({ error: 'IMAP poll failed', details: errMessage, processed: 0, configured: true }, { status: 500 })
    } finally {
      if (client) { try { await client.logout() } catch { /* ignore */ } }
    }
  } catch (error) {
    console.error('[email-poll] Fatal error:', error)
    return NextResponse.json({ error: 'Email poll failed', details: String(error), processed: 0, configured: false }, { status: 500 })
  }
}
