'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, FileText, Building2, GripVertical, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/ui/motion'
import { useClaimsStore } from '@/store/claims-store'
import { invalidateClaimData } from '@/lib/query-utils'
import {
  getStatusColor,
  getStatusLabel,
  getConfidenceColor,
  getConfidenceBg,
  formatRelativeTime,
} from '@/lib/helpers'
import { toast } from 'sonner'

const KANBAN_COLUMNS = [
  { key: 'NEW', label: 'New', dotColor: 'bg-sky-500', headerBg: 'bg-sky-500/5' },
  { key: 'PROCESSING', label: 'Processing', dotColor: 'bg-amber-500', headerBg: 'bg-amber-500/5' },
  { key: 'MANUAL_REVIEW', label: 'Manual Review', dotColor: 'bg-orange-500', headerBg: 'bg-orange-500/5' },
  { key: 'PENDING_REVIEW', label: 'Pending Review', dotColor: 'bg-violet-500', headerBg: 'bg-violet-500/5' },
  { key: 'COMPLETED', label: 'Completed', dotColor: 'bg-emerald-500', headerBg: 'bg-emerald-500/5' },
  { key: 'FAILED', label: 'Failed', dotColor: 'bg-red-500', headerBg: 'bg-red-500/5' },
]

interface KanbanClaim {
  id: string
  claimNumber: string
  clientName: string
  claimType: string
  status: string
  confidenceScore: number
  createdAt: string
  insuranceCompany: { id: string; name: string } | null
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  Motor: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  Building: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  Marine: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  Agricultural: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  Household: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  Liability: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
}

function KanbanCard({
  claim,
  onClick,
  onDragStart,
  isDragging,
}: {
  claim: KanbanClaim
  onClick: (claim: KanbanClaim) => void
  onDragStart: (e: React.DragEvent, claim: KanbanClaim) => void
  isDragging: boolean
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, claim)}
      className={`w-full cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging ? 'opacity-40 scale-95 rotate-2' : 'opacity-100'
      }`}
    >
      <button
        onClick={() => onClick(claim)}
        className="w-full text-left group"
      >
        <div className="rounded-lg border bg-card p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 kanban-card">
          {/* Drag handle + top row */}
          <div className="flex items-center gap-1.5 mb-2">
            <GripVertical className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
            <span className="text-xs font-mono font-semibold text-foreground group-hover:text-primary transition-colors truncate flex-1">
              {claim.claimNumber}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] h-5 px-1.5 shrink-0 font-medium ${CLAIM_TYPE_COLORS[claim.claimType] || 'bg-muted text-muted-foreground'}`}
            >
              {claim.claimType}
            </Badge>
          </div>

          {/* Client name */}
          <p className="text-sm text-muted-foreground truncate mb-2.5 pl-[18px]">{claim.clientName}</p>

          {/* Confidence bar + time */}
          <div className="flex items-center justify-between gap-2 pl-[18px]">
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getConfidenceBg(claim.confidenceScore)}`}
                  style={{ width: `${claim.confidenceScore}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold tabular-nums ${getConfidenceColor(claim.confidenceScore)}`}>
                {claim.confidenceScore}%
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
              <Clock className="size-2.5" />
              {formatRelativeTime(claim.createdAt)}
            </span>
          </div>

          {/* Insurance company */}
          {claim.insuranceCompany && (
            <p className="text-[10px] text-muted-foreground/60 mt-2 pl-[18px] flex items-center gap-1 truncate">
              <Building2 className="size-2.5 shrink-0" />
              {claim.insuranceCompany.name}
            </p>
          )}
        </div>
      </button>
    </div>
  )
}

function KanbanColumnSkeleton() {
  return (
    <div className="min-w-[280px] w-[280px] shrink-0">
      <div className={`rounded-t-lg p-3 border border-b-0`}>
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-5 ml-auto" />
        </div>
      </div>
      <div className="rounded-b-lg border border-t-0 p-2.5 space-y-2.5 min-h-[200px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-3.5">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32 mb-2" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KanbanColumn({
  column,
  claims,
  isLoading,
  colIndex,
  onClaimClick,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverClaimId,
  isDropTarget,
  isUpdating,
}: {
  column: typeof KANBAN_COLUMNS[number]
  claims: KanbanClaim[]
  isLoading: boolean
  colIndex: number
  onClaimClick: (claim: KanbanClaim) => void
  onDragStart: (e: React.DragEvent, claim: KanbanClaim) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, status: string) => void
  dragOverClaimId: string | null
  isDropTarget: boolean
  isUpdating: boolean
}) {
  return (
    <div className="min-w-[280px] w-[280px] shrink-0 flex flex-col">
      {/* Column header */}
      <div className={`flex items-center gap-2 mb-2.5 px-1 py-1.5 rounded-t-lg ${column.headerBg}`}>
        <div className={`size-2.5 rounded-full ${column.dotColor} shadow-sm`} />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {column.label}
        </span>
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] h-5 px-1.5 font-bold tabular-nums ${getStatusColor(column.key)}`}
        >
          {claims.length}
        </Badge>
        {isUpdating && (
          <Loader2 className="size-3 animate-spin text-primary" />
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`rounded-b-lg border-2 p-2 min-h-[200px] transition-all duration-200 flex-1 ${
          isDropTarget
            ? 'border-primary bg-primary/5 shadow-[inset_0_0_12px_rgba(var(--primary),0.05)]'
            : 'border-dashed border-border/60 bg-muted/10'
        }`}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, column.key)}
      >
        <ScrollArea className="max-h-[calc(100vh-340px)]">
          <div className="space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3.5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-32 mb-2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            ) : claims.length > 0 ? (
              claims.map((claim, cardIndex) => (
                <div
                  key={claim.id}
                  className={`card-enter card-lift ${dragOverClaimId === claim.id ? 'ring-2 ring-primary ring-offset-1 rounded-lg' : ''}`}
                  style={{ animationDelay: `${colIndex * 60 + cardIndex * 40}ms` }}
                >
                  <KanbanCard
                    claim={claim}
                    onClick={onClaimClick}
                    onDragStart={onDragStart}
                    isDragging={false}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
                <FileText className="size-7 mb-2 opacity-30" />
                <p className="text-xs">No claims</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export function ClaimsKanban({ onClaimClick }: { onClaimClick: (claim: KanbanClaim) => void }) {
  const queryClient = useQueryClient()
  const refreshKey = useClaimsStore((s) => s.refreshKey)
  const [draggedClaim, setDraggedClaim] = useState<KanbanClaim | null>(null)
  const [dropTargetStatus, setDropTargetStatus] = useState<string | null>(null)
  const [dragOverClaimId, setDragOverClaimId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<Record<string, KanbanClaim[]>>({
    queryKey: ['kanban-claims', refreshKey],
    queryFn: async () => {
      const statuses = KANBAN_COLUMNS.map((col) => col.key)
      const results = await Promise.all(
        statuses.map((status) =>
          fetch(`/api/claims?status=${status}&limit=50`)
            .then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() })
            .then((data) => data.claims || [])
        )
      )
      const grouped: Record<string, KanbanClaim[]> = {}
      statuses.forEach((status, index) => {
        grouped[status] = results[index]
      })
      return grouped
    },
    refetchInterval: 30000,
    staleTime: 5000,
    retry: 2,
    retryDelay: 1000,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ claimId, newStatus }: { claimId: string; newStatus: string }) =>
      fetch(`/api/claims/${claimId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: (_data, variables) => {
      invalidateClaimData(queryClient)
      toast.success(`Moved to ${getStatusLabel(variables.newStatus)}`)
      setUpdatingId(null)
    },
    onError: () => {
      toast.error('Failed to update status')
      setUpdatingId(null)
    },
  })

  const handleDragStart = useCallback((e: React.DragEvent, claim: KanbanClaim) => {
    setDraggedClaim(claim)
    setUpdatingId(claim.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', claim.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedClaim && draggedClaim.status !== targetStatus) {
      setDropTargetStatus(targetStatus)
    }
  }, [draggedClaim])

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    setDropTargetStatus(null)
    setDragOverClaimId(null)

    if (draggedClaim && draggedClaim.status !== targetStatus) {
      updateStatusMutation.mutate({ claimId: draggedClaim.id, newStatus: targetStatus })
    } else {
      setUpdatingId(null)
    }
    setDraggedClaim(null)
  }, [draggedClaim, updateStatusMutation])

  const handleDragLeave = useCallback(() => {
    setDropTargetStatus(null)
  }, [])

  const totalClaims = data
    ? KANBAN_COLUMNS.reduce((sum, col) => sum + (data[col.key]?.length || 0), 0)
    : 0

  return (
    <FadeIn delay={0.05}>
      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Claims Kanban Board</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {totalClaims} claims
            </Badge>
            <span className="text-[10px] text-muted-foreground ml-1">
              Drag cards between columns to update status
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-fancy">
              {KANBAN_COLUMNS.map((_, i) => (
                <KanbanColumnSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-fancy">
              {KANBAN_COLUMNS.map((column, colIndex) => {
                const claims = data?.[column.key] || []
                return (
                  <div
                    key={column.key}
                    onDragLeave={handleDragLeave}
                  >
                    <KanbanColumn
                      column={column}
                      claims={claims}
                      isLoading={false}
                      colIndex={colIndex}
                      onClaimClick={onClaimClick}
                      onDragStart={handleDragStart}
                      onDragOver={(e) => handleDragOver(e, column.key)}
                      onDrop={handleDrop}
                      dragOverClaimId={dragOverClaimId}
                      isDropTarget={dropTargetStatus === column.key}
                      isUpdating={updatingId !== null && claims.some(c => c.id === updatingId)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}
