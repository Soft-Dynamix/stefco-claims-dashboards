/**
 * Server Startup Initialization
 * Runs once when the Node.js process starts (module-level execution).
 * Uses a "run once" pattern since Node.js caches modules.
 */

let initialized = false

export async function init() {
  if (initialized) return
  initialized = true

  try {
    const { autoStartIfEnabled } = await import('@/lib/email-poller')
    await autoStartIfEnabled()
    console.error('[server-init] ✅ Server initialization complete')
  } catch (err) {
    console.error('[server-init] ⚠️ Auto-start scheduler failed:', err)
  }
}

// Auto-initialize on module import
init()
