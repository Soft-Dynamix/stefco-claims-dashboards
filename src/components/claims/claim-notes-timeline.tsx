'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateClaimData } from '@/lib/query-utils'
import {
  MessageSquarePlus,
  Clock,
  Pin,
  PinOff,
  StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelativeTime } from '@/lib/helpers'
import { toast } from 'sonner'

interface Note {
  id: string
  text: string
  type: string
  pinned: boolean
  timestamp: string
}

interface ClaimNotesTimelineProps {
  claimId: string
}

const noteTypeColors: Record<string, string> = {
  General: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
  'Follow-up': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
  Decision: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
  'Document Request': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
  Internal: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
}

const noteTypeDotColors: Record<string, string> = {
  General: 'bg-slate-400',
  'Follow-up': 'bg-amber-400',
  Decision: 'bg-emerald-400',
  'Document Request': 'bg-sky-400',
  Internal: 'bg-violet-400',
}

const noteTypes = ['General', 'Follow-up', 'Decision', 'Document Request', 'Internal'] as const

export function ClaimNotesTimeline({ claimId }: ClaimNotesTimelineProps) {
  const queryClient = useQueryClient()
  const [newNoteText, setNewNoteText] = useState('')
  const [newNoteType, setNewNoteType] = useState<string>('General')

  const { data: richNotesData, isLoading, refetch } = useQuery<{
    notes: Note[]
    legacyNotes: string
  }>({
    queryKey: ['claim-notes', claimId],
    queryFn: () => fetch(`/api/claims/${claimId}/notes`).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    enabled: !!claimId,
    retry: 2,
    retryDelay: 1000,
  })

  const notes = richNotesData?.notes || []

  const addNoteMutation = useMutation({
    mutationFn: ({ content, type }: { content: string; type: string }) =>
      fetch(`/api/claims/${claimId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateClaimData(queryClient)
      refetch()
      toast.success('Note added successfully')
    },
    onError: () => {
      toast.error('Failed to add note')
    },
  })

  const togglePinMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/claims/${claimId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      refetch()
    },
  })

  const handleAddNote = () => {
    if (!newNoteText.trim()) return
    addNoteMutation.mutate(
      { content: newNoteText.trim(), type: newNoteType },
      {
        onSuccess: () => {
          setNewNoteText('')
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Skeleton className="size-3 rounded-full shrink-0 mt-1.5" />
                <Skeleton className="w-px flex-1 mt-1" />
              </div>
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add Note Input */}
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Type:</span>
          <div className="flex flex-wrap gap-1">
            {noteTypes.map((type) => (
              <button
                key={type}
                onClick={() => setNewNoteType(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                  newNoteType === type
                    ? noteTypeColors[type] + ' ring-1 ring-offset-1 ring-current'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:border-border'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Textarea
            className="min-h-[72px] flex-1 resize-none"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add a note..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAddNote()
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={addNoteMutation.isPending || !newNoteText.trim()}
            className="shrink-0"
          >
            <MessageSquarePlus className="size-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Notes Timeline */}
      {notes.length > 0 ? (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-0.5">
            {notes.map((note, index) => {
              const isLast = index === notes.length - 1
              const dotColor = noteTypeDotColors[note.type] || 'bg-slate-400'

              return (
                <div key={note.id} className="flex gap-3 group">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`size-3 rounded-full shrink-0 mt-1.5 ring-2 ring-background ${dotColor}`}
                    />
                    {!isLast && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>

                  {/* Note entry */}
                  <div
                    className={`flex-1 p-3 rounded-lg border transition-colors mb-3 hover:bg-muted/20 ${
                      note.pinned
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1.5 ${noteTypeColors[note.type] || ''}`}
                      >
                        {note.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatRelativeTime(note.timestamp)}
                      </p>
                      {note.pinned && (
                        <span className="text-amber-500" title="Pinned">
                          <Pin className="size-3" />
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePinMutation.mutate(note.id)
                        }}
                        className={`ml-auto shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                          note.pinned
                            ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                            : 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50'
                        }`}
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        {note.pinned ? (
                          <PinOff className="size-3" />
                        ) : (
                          <Pin className="size-3" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex items-center justify-center size-14 rounded-full bg-muted/50">
            <StickyNote className="size-7 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No notes yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a note to start tracking discussions for this claim.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
