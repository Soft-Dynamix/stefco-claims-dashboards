'use client'

import React, { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Minimize2,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useClaimsStore } from '@/store/claims-store'

// ── Hook: Safe mounted state (avoids setState-in-effect lint warning) ──
function useMounted() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      // No external store to subscribe to
      return () => {}
    },
    () => true,
    () => false,
  )
}

// ── Color Swatch Component ──
function ColorSwatch({ label, cssVar }: { label: string; cssVar: string }) {
  const [computedValue, setComputedValue] = React.useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Read the CSS variable on mount using a ref callback — no effect needed
  const stableRef = React.useCallback((node: HTMLDivElement | null) => {
    ref.current = node
    if (node && !computedValue) {
      // Use requestAnimationFrame to defer reading (runs after paint)
      requestAnimationFrame(() => {
        const computed = getComputedStyle(node).getPropertyValue(cssVar).trim()
        setComputedValue(computed || `var(${cssVar})`)
      })
    }
  }, [cssVar, computedValue])

  return (
    <div className="flex items-center gap-2.5">
      <div
        ref={stableRef}
        className="size-6 rounded-full border border-border/50 shadow-sm shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono truncate">
          {computedValue || cssVar}
        </p>
      </div>
    </div>
  )
}

// ── Theme Toggle Buttons ──
function ThemeToggleButtons() {
  const { theme, setTheme } = useTheme()

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => {
        const isActive = theme === opt.value
        const Icon = opt.icon
        return (
          <Button
            key={opt.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className={`gap-1.5 text-xs h-8 px-3 transition-all ${
              isActive
                ? 'shadow-sm'
                : 'hover:bg-muted/60'
            }`}
            onClick={() => setTheme(opt.value)}
          >
            <Icon className="size-3.5" />
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}

// ── Card Preview Mini ──
function CardPreview() {
  return (
    <div className="p-3 rounded-lg border bg-card shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        <div className="size-5 rounded bg-primary/15" />
        <div className="h-2.5 w-20 rounded bg-muted-foreground/25" />
      </div>
      <div className="h-2 w-full rounded bg-muted/50" />
      <div className="h-2 w-3/4 rounded bg-muted/50" />
      <div className="flex items-center gap-2 pt-1">
        <div className="h-5 w-12 rounded-md bg-primary/20" />
        <div className="h-5 w-10 rounded-md bg-muted/40" />
      </div>
    </div>
  )
}

// ── Chart Preview Mini ──
function ChartPreview() {
  const bars = [
    { height: '60%', color: 'var(--color-chart-1)' },
    { height: '80%', color: 'var(--color-chart-2)' },
    { height: '45%', color: 'var(--color-chart-3)' },
    { height: '90%', color: 'var(--color-chart-4)' },
  ]

  return (
    <div className="p-3 rounded-lg border bg-card shadow-sm">
      <div className="flex items-end gap-1.5 h-16">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-t-sm transition-colors"
            style={{
              height: bar.height,
              backgroundColor: bar.color,
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div className="flex gap-1.5 mt-2">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            className="size-2 rounded-sm flex-1"
            style={{ backgroundColor: bar.color }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Text Preview Mini ──
function TextPreview() {
  return (
    <div className="p-3 rounded-lg border bg-card shadow-sm space-y-1.5">
      <p className="text-xs font-semibold text-primary">Primary Text</p>
      <p className="text-xs font-medium text-secondary">Secondary Text</p>
      <p className="text-xs text-muted-foreground">Muted Foreground Text</p>
      <p className="text-xs font-medium text-accent-foreground bg-accent/50 inline-block px-1.5 py-0.5 rounded">
        Accent Text
      </p>
    </div>
  )
}

// ── Main Component ──
export function ThemeSettingsPanel() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const mounted = useMounted()

  const compactMode = useClaimsStore((s) => s.compactMode)
  const setCompactMode = useClaimsStore((s) => s.setCompactMode)
  const reducedAnimations = useClaimsStore((s) => s.reducedAnimations)
  const setReducedAnimations = useClaimsStore((s) => s.setReducedAnimations)

  // Apply reduced animations class to document
  useEffect(() => {
    if (reducedAnimations) {
      document.documentElement.classList.add('reduce-motion')
    } else {
      document.documentElement.classList.remove('reduce-motion')
    }
  }, [reducedAnimations])

  const currentThemeLabel = !mounted
    ? 'System'
    : theme === 'system'
      ? 'System'
      : theme === 'light'
        ? 'Light'
        : 'Dark'

  const currentResolvedLabel = !mounted
    ? '—'
    : resolvedTheme === 'dark'
      ? 'Dark'
      : 'Light'

  const currentIcon = !mounted
    ? Monitor
    : theme === 'dark'
      ? Moon
      : theme === 'light'
        ? Sun
        : Monitor

  const CurrentIcon = currentIcon

  return (
    <Card className="py-5 card-shine card-enter hover-scale card-depth-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10">
              <Palette className="size-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight">
                Theme & Appearance
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Dark mode optimized settings and visual preferences
              </CardDescription>
            </div>
          </div>
          {mounted && (
            <Badge
              variant="secondary"
              className="gap-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
            >
              <CurrentIcon className="size-3" />
              {currentResolvedLabel} active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Section 1: Theme Mode ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Theme Mode</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose your preferred appearance. Changes apply immediately.
          </p>
          <ThemeToggleButtons />
          {mounted && theme === 'system' && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Monitor className="size-3" />
              Following system preference — currently resolved to{' '}
              <span className="font-medium text-foreground">{currentResolvedLabel}</span>
            </p>
          )}
        </div>

        <Separator />

        {/* ── Section 2: Display Preferences ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Minimize2 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Display Preferences</h3>
          </div>
          <div className="space-y-3">
            {/* Compact Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center size-8 rounded-lg bg-muted/50 shrink-0">
                  <Minimize2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Compact Mode</p>
                  <p className="text-[11px] text-muted-foreground">
                    Reduce spacing and padding for denser layout
                  </p>
                </div>
              </div>
              <Switch
                checked={compactMode}
                onCheckedChange={setCompactMode}
                aria-label="Toggle compact mode"
              />
            </div>

            {/* Reduced Animations Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center size-8 rounded-lg bg-muted/50 shrink-0">
                  <Eye className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Reduced Animations</p>
                  <p className="text-[11px] text-muted-foreground">
                    Disable motion effects for accessibility
                  </p>
                </div>
              </div>
              <Switch
                checked={reducedAnimations}
                onCheckedChange={setReducedAnimations}
                aria-label="Toggle reduced animations"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Section 3: Theme Preview Mini-Cards ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Theme Preview</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            See how cards, charts, and text look in the current theme.
          </p>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Card Preview
              </p>
              <CardPreview />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Chart Preview
              </p>
              <ChartPreview />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Text Preview
              </p>
              <TextPreview />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Section 4: Color Scheme Display ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Color Scheme</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Active color variables for the current theme.
          </p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <ColorSwatch label="Primary" cssVar="--color-primary" />
            <ColorSwatch label="Secondary" cssVar="--color-secondary" />
            <ColorSwatch label="Accent" cssVar="--color-accent" />
            <ColorSwatch label="Background" cssVar="--color-background" />
            <ColorSwatch label="Foreground" cssVar="--color-foreground" />
            <ColorSwatch label="Muted" cssVar="--color-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
