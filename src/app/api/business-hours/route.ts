import { NextResponse } from 'next/server'

/**
 * GET /api/business-hours
 *
 * Check if currently within business hours (spec §3.2).
 * Returns: { isBusinessHours, dayOfWeek, currentTime, openTime, closeTime }
 *
 * Business hours: Monday-Friday, 07:00-19:00
 * Timezone: Africa/Johannesburg (SAST, UTC+2)
 */

const BUSINESS_DAYS = [1, 2, 3, 4, 5] // Monday = 1, Friday = 5
const OPEN_HOUR = 7
const CLOSE_HOUR = 19
const TIMEZONE = 'Africa/Johannesburg'

function getSouthAfricanTime(): Date {
  const now = new Date()
  // Get the time in Africa/Johannesburg timezone
  const saTimeStr = now.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Parse the localized string to get accurate day/hour info
  const saDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  return saDate
}

export async function GET() {
  try {
    const saDate = getSouthAfricanTime()
    const dayOfWeek = saDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = saDate.getHours()
    const currentMinute = saDate.getMinutes()

    const isBusinessDay = BUSINESS_DAYS.includes(dayOfWeek)
    const isWithinHours = currentHour >= OPEN_HOUR && currentHour < CLOSE_HOUR
    const isBusinessHours = isBusinessDay && isWithinHours

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`

    // Get full formatted time string with timezone
    const fullTimeStr = new Date().toLocaleString('en-US', {
      timeZone: TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    })

    return NextResponse.json({
      isBusinessHours,
      isBusinessDay,
      isWithinHours,
      dayOfWeek: dayNames[dayOfWeek],
      dayOfWeekIndex: dayOfWeek,
      currentTime,
      currentFullTime: fullTimeStr,
      openTime: '07:00',
      closeTime: '19:00',
      timezone: TIMEZONE,
    })
  } catch (error) {
    console.error('Business hours check error:', error)
    return NextResponse.json(
      { error: 'Failed to check business hours', details: String(error) },
      { status: 500 }
    )
  }
}
