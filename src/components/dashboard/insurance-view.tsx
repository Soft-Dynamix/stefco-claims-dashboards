'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateInsuranceData, invalidateClaimData } from '@/lib/query-utils'
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Search,
  X,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { InsurancePerformanceCards } from '@/components/dashboard/insurance-performance-cards'
import { InsuranceAnalyticsWidget } from '@/components/dashboard/insurance-analytics-widget'
import { FadeIn } from '@/components/ui/motion'

interface InsuranceCompany {
  id: string
  name: string
  folderName: string
  senderDomains: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { claims: number }
}

function CompanyForm({
  company,
  onSave,
  onCancel,
  loading,
}: {
  company: Partial<InsuranceCompany> | null
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  loading: boolean
}) {
  const [name, setName] = useState(company?.name || '')
  const [folderName, setFolderName] = useState(company?.folderName || '')
  const [domains, setDomains] = useState(() => {
    if (company?.senderDomains) {
      try {
        return JSON.parse(company.senderDomains).join(', ')
      } catch {
        return company.senderDomains
      }
    }
    return ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      folderName,
      senderDomains: domains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Company Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Santam"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="folder">Folder Name</Label>
        <Input
          id="folder"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="e.g. Santam"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="domains">Sender Domains (comma separated)</Label>
        <Input
          id="domains"
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          placeholder="santam.co.za, @santam.com"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : company?.id ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function InsuranceView() {
  const queryClient = useQueryClient()
  const [editCompany, setEditCompany] = useState<InsuranceCompany | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/insurance/export')
      if (!response.ok) {
        toast.error('Failed to export insurance companies')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      link.href = url
      link.download = `insurance_export_${dateStr}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Insurance companies exported successfully')
    } catch {
      toast.error('Failed to export insurance companies')
    } finally {
      setIsExporting(false)
    }
  }, [])

  const { data: rawData, isLoading } = useQuery<{ companies: InsuranceCompany[] }>({
    queryKey: ['insurance-companies'],
    queryFn: () => fetch('/api/insurance').then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    retry: 3,
    retryDelay: 2000,
  })
  const companies = rawData?.companies

  const filteredCompanies = useMemo(() => {
    if (!companies) return []
    if (!searchText.trim()) return companies
    const search = searchText.toLowerCase()
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.folderName.toLowerCase().includes(search)
    )
  }, [companies, searchText])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateInsuranceData(queryClient)
      invalidateClaimData(queryClient)
      setIsCreateOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/insurance`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then((r) => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      invalidateInsuranceData(queryClient)
      invalidateClaimData(queryClient)
      setDeleteId(null)
    },
  })

  return (
    <div className="space-y-4">
      {/* Insurance Company Analytics Widget */}
      <FadeIn delay={0.03}>
        <InsuranceAnalyticsWidget />
      </FadeIn>
        {/* Quick Stats */}
        {companies && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center card-enter stagger-1 hover-scale">
              <p className="text-xs text-muted-foreground">Total Companies</p>
              <p className="text-lg font-bold text-foreground">{companies.length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center card-enter stagger-2 hover-scale">
              <p className="text-xs text-muted-foreground">Active Companies</p>
              <p className="text-lg font-bold text-foreground">{companies.filter(c => c.isActive).length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center card-enter stagger-3 hover-scale">
              <p className="text-xs text-muted-foreground">Total Claims</p>
              <p className="text-lg font-bold text-foreground">{companies.reduce((sum, c) => sum + c._count.claims, 0)}</p>
            </div>
          </div>
        )}

      <Card className="py-5 shadow-sm card-hover card-enter stagger-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Insurance Companies</CardTitle>
              {companies && (
                <Badge variant="secondary" className="ml-2">
                  {companies.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex items-center border rounded-md p-0.5 bg-muted/30 shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cards
                </button>
              </div>
              <div className="relative flex-1 max-w-[280px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  className="pl-8 h-9 bg-background"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setSearchText('')}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="gap-1.5 shrink-0 btn-press"
              >
                <Download className={`size-3.5 ${isExporting ? 'animate-spin' : ''}`} />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 shrink-0 btn-press"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-3.5" />
                Add Company
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-4 w-[80px] hidden md:block" />
                  <Skeleton className="h-4 w-[60px] hidden lg:block" />
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-4 w-[50px] ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Name</TableHead>
                    <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider">Folder</TableHead>
                    <TableHead className="hidden lg:table-cell text-xs font-semibold uppercase tracking-wider">Sender Domains</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Active</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Claims</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length > 0 ? filteredCompanies.map((company) => {
                    let domains: string[] = []
                    try {
                      domains = JSON.parse(company.senderDomains)
                    } catch {
                      domains = [company.senderDomains]
                    }
                    return (
                      <TableRow key={company.id} className="even:bg-muted/30 card-row-hover">
                        <TableCell className="font-medium text-foreground">
                          {company.name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {company.folderName}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {domains.slice(0, 2).map((d) => (
                              <Badge key={d} variant="outline" className="text-xs gap-1">
                                <Globe className="size-2.5" />
                                {d}
                              </Badge>
                            ))}
                            {domains.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{domains.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={company.isActive}
                            disabled
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {company._count.claims}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setEditCompany(company)}
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <AlertDialog open={deleteId === company.id} onOpenChange={(open) => setDeleteId(open ? company.id : null)}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive">
                                  <Trash2 className="size-3.5" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Insurance Company</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{company.name}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(company.id)}
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }) : null}
                </TableBody>
              </Table>
            </ScrollArea>
            {searchText && filteredCompanies.length === 0 && (
              <div className="text-center py-8 mt-2">
                <Search className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No companies found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance Cards View */}
      {viewMode === 'cards' && (
        <div className="mt-4">
          <InsurancePerformanceCards />
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Insurance Company</DialogTitle>
            <DialogDescription>
              Add a new insurance company to the system.
            </DialogDescription>
          </DialogHeader>
          <CompanyForm
            company={null}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            loading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editCompany} onOpenChange={(open) => !open && setEditCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Insurance Company</DialogTitle>
            <DialogDescription>
              Update insurance company details.
            </DialogDescription>
          </DialogHeader>
          {editCompany && (
            <CompanyForm
              company={editCompany}
              onSave={(data) => {
                createMutation.mutate(data)
                setEditCompany(null)
              }}
              onCancel={() => setEditCompany(null)}
              loading={createMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
