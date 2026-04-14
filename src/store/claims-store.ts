import { create } from 'zustand'

export type TabType = 'dashboard' | 'email' | 'claims' | 'insurance' | 'audit' | 'print-queue' | 'config' | 'workflow' | 'setup' | 'installer'

interface ClaimsState {
  activeTab: TabType
  selectedClaimId: string | null
  selectedEmailId: string | null
  showNewClaimDialog: boolean
  showCommandPalette: boolean
  filters: {
    status: string
    claimType: string
    search: string
    insuranceCompany: string
  }
  refreshKey: number
  sidebarOpen: boolean
  compactMode: boolean
  reducedAnimations: boolean

  setActiveTab: (tab: TabType) => void
  setSelectedClaimId: (id: string | null) => void
  setSelectedEmailId: (id: string | null) => void
  setShowNewClaimDialog: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setFilter: (key: keyof ClaimsState['filters'], value: string) => void
  clearFilters: () => void
  triggerRefresh: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCompactMode: (v: boolean) => void
  setReducedAnimations: (v: boolean) => void
}

const defaultFilters = {
  status: '',
  claimType: '',
  search: '',
  insuranceCompany: '',
}

export const useClaimsStore = create<ClaimsState>((set) => ({
  activeTab: 'dashboard',
  selectedClaimId: null,
  selectedEmailId: null,
  showNewClaimDialog: false,
  showCommandPalette: false,
  filters: { ...defaultFilters },
  refreshKey: 0,
  sidebarOpen: false,
  compactMode: false,
  reducedAnimations: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedClaimId: (id) => set({ selectedClaimId: id }),
  setSelectedEmailId: (id) => set({ selectedEmailId: id }),
  setShowNewClaimDialog: (show) => set({ showNewClaimDialog: show }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ filters: { ...defaultFilters } }),
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCompactMode: (v) => set({ compactMode: v }),
  setReducedAnimations: (v) => set({ reducedAnimations: v }),
}))
