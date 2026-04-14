import { NextResponse } from 'next/server'

interface ConfigCategory {
  label: string
  items: Record<string, { value: string | null; masked: boolean }>
}

/**
 * Masks a sensitive value, showing first 4 characters followed by "..."
 */
function maskSensitive(value: string | undefined | null): string {
  if (!value) return ''
  if (value.length <= 4) return '****'
  return `${value.substring(0, 4)}...`
}

/**
 * Returns a config item with optional masking for sensitive values.
 */
function envItem(
  key: string,
  mask = false
): { value: string | null; masked: boolean } {
  const value = process.env[key] || null
  return {
    value: mask ? maskSensitive(value) : value,
    masked: mask,
  }
}

export async function GET() {
  try {
    const config: Record<string, ConfigCategory> = {
      database: {
        label: 'Database',
        items: {
          DATABASE_URL: envItem('DATABASE_URL', true),
          DATABASE_PROVIDER: {
            value: process.env.DATABASE_URL?.startsWith('postgresql')
              ? 'postgresql'
              : process.env.DATABASE_URL?.startsWith('mysql')
                ? 'mysql'
                : 'sqlite',
            masked: false,
          },
        },
      },
      email: {
        label: 'Email (IMAP & SMTP)',
        items: {
          IMAP_HOST: envItem('IMAP_HOST'),
          IMAP_PORT: envItem('IMAP_PORT'),
          IMAP_USER: envItem('IMAP_USER'),
          IMAP_PASSWORD: envItem('IMAP_PASSWORD', true),
          IMAP_TLS: envItem('IMAP_TLS'),
          SMTP_HOST: envItem('SMTP_HOST'),
          SMTP_PORT: envItem('SMTP_PORT'),
          SMTP_USER: envItem('SMTP_USER'),
          SMTP_PASSWORD: envItem('SMTP_PASSWORD', true),
          SMTP_TLS: envItem('SMTP_TLS'),
          EMAIL_FROM: envItem('EMAIL_FROM'),
          EMAIL_FROM_NAME: envItem('EMAIL_FROM_NAME'),
        },
      },
      ai: {
        label: 'AI Provider',
        items: {
          AI_PROVIDER: envItem('AI_PROVIDER'),
          GEMINI_API_KEY: envItem('GEMINI_API_KEY', true),
          GEMINI_MODEL: envItem('GEMINI_MODEL'),
          GROQ_API_KEY: envItem('GROQ_API_KEY', true),
          GROQ_MODEL: envItem('GROQ_MODEL'),
          OPENROUTER_API_KEY: envItem('OPENROUTER_API_KEY', true),
          OLLAMA_BASE_URL: envItem('OLLAMA_BASE_URL'),
          OLLAMA_MODEL: envItem('OLLAMA_MODEL'),
        },
      },
      storage: {
        label: 'Storage',
        items: {
          STORAGE_BASE_PATH: envItem('STORAGE_BASE_PATH'),
          CLAIMS_FOLDER: envItem('CLAIMS_FOLDER'),
          ATTACHMENTS_PATH: envItem('ATTACHMENTS_PATH'),
          PRINT_QUEUE_PATH: envItem('PRINT_QUEUE_PATH'),
        },
      },
      system: {
        label: 'System',
        items: {
          NODE_ENV: envItem('NODE_ENV'),
          NEXT_PUBLIC_APP_URL: envItem('NEXT_PUBLIC_APP_URL'),
          PORT: envItem('PORT'),
          LOG_LEVEL: envItem('LOG_LEVEL'),
          SLA_THRESHOLD_HOURS: envItem('SLA_THRESHOLD_HOURS'),
          BUSINESS_HOURS_START: envItem('BUSINESS_HOURS_START'),
          BUSINESS_HOURS_END: envItem('BUSINESS_HOURS_END'),
          TIMEZONE: envItem('TIMEZONE'),
        },
      },
    }

    // Compute configuration completeness summary
    const summary = {
      categories: Object.keys(config).length,
      configuredKeys: 0,
      totalKeys: 0,
      sensitiveKeys: 0,
    }

    for (const category of Object.values(config)) {
      for (const item of Object.values(category.items)) {
        summary.totalKeys++
        if (item.value) summary.configuredKeys++
        if (item.masked) summary.sensitiveKeys++
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary,
      config,
    })
  } catch (error) {
    console.error('Config endpoint error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch configuration',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
