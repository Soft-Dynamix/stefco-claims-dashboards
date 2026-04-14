'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ErrorRetryProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorRetry({ message, onRetry, className = '' }: ErrorRetryProps) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!onRetry) return
    let remaining = 4
    const timer = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(timer)
        onRetry()
        setCountdown(0)
        return
      }
      setCountdown(remaining)
    }, 1000)
    return () => clearInterval(timer)
  }, [onRetry])

  return (
    <Card className={`py-8 card-enter ${className}`}>
      <CardContent className="flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Something went wrong
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {message || 'Failed to load data. This may be due to a temporary server issue.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onRetry}
          >
            <RefreshCw className="size-3.5" />
            Retry Now
          </Button>
          {onRetry && countdown > 0 && (
            <span className="text-xs text-muted-foreground">
              Auto-retrying in {countdown}s...
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
