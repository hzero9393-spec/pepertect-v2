import { create } from 'zustand'
import type { DateFilterPreset, DateRange } from '@/components/pepertect/date-filter'

export type PageId = 
  | 'dashboard'
  | 'trading'      // Stock trading screen
  | 'stockOverview' // Stock detail/overview page
  | 'indexDetail'  // Index detail page with chart + stats
  | 'positions'    // Positions with Index/Stock tabs
  | 'orders'       // Orders with Index/Stock tabs
  | 'portfolio'    // Portfolio overview
  | 'reports'      // Reports/analytics
  | 'watchlist'    // Watchlist page
  | 'futures'      // Futures trading
  | 'learning'     // Learn section
  | 'profile'      // Profile/settings
  | 'activeDevices' // Active devices/sessions detail
  | 'helpSupport'   // Help & Support detail page
  // Footer pages
  | 'privacy-policy'
  | 'terms-of-service'
  | 'support'
  | 'contact-us'
  | 'faq'
  | 'disclaimer'
  | 'about-us'
  | 'refund-policy'

// ─── URL Mapping ──────────────────────────────────────────────────────────

/** Map PageId to URL path */
const pageToUrlMap: Record<PageId, string> = {
  dashboard: '/',
  trading: '/stocks',
  stockOverview: '/stock', // needs symbol appended
  indexDetail: '/index',   // needs symbol appended
  positions: '/positions',
  orders: '/orders',
  portfolio: '/portfolio',
  reports: '/reports',
  watchlist: '/watchlist',
  futures: '/futures',
  learning: '/learning',
  profile: '/profile',
  activeDevices: '/active-devices',
  helpSupport: '/help-support',
  'privacy-policy': '/privacy-policy',
  'terms-of-service': '/terms-of-service',
  support: '/support',
  'contact-us': '/contact-us',
  faq: '/faq',
  disclaimer: '/disclaimer',
  'about-us': '/about-us',
  'refund-policy': '/refund-policy',
}

/** Get URL for a page (with optional stock/index symbol) */
export function getPageUrl(page: PageId, symbol?: string | null): string {
  const baseUrl = pageToUrlMap[page]
  if (!baseUrl) return '/'
  
  if ((page === 'stockOverview' || page === 'indexDetail') && symbol) {
    return `${baseUrl}/${encodeURIComponent(symbol)}`
  }
  return baseUrl
}

/** Parse URL path to determine page and symbol */
export function parseUrlPath(pathname: string): { page: PageId; stockSymbol?: string; indexSymbol?: string } {
  // Remove trailing slash
  const path = pathname.replace(/\/$/, '') || '/'
  
  // Exact matches
  if (path === '/') return { page: 'dashboard' }
  if (path === '/stocks') return { page: 'trading' }
  if (path === '/watchlist') return { page: 'watchlist' }
  if (path === '/positions') return { page: 'positions' }
  if (path === '/orders') return { page: 'orders' }
  if (path === '/portfolio') return { page: 'portfolio' }
  if (path === '/reports') return { page: 'reports' }
  if (path === '/futures') return { page: 'futures' }
  if (path === '/learning') return { page: 'learning' }
  if (path === '/profile') return { page: 'profile' }
  if (path === '/active-devices') return { page: 'activeDevices' }
  if (path === '/help-support') return { page: 'helpSupport' }
  
  // Footer pages
  if (path === '/privacy-policy') return { page: 'privacy-policy' }
  if (path === '/terms-of-service') return { page: 'terms-of-service' }
  if (path === '/support') return { page: 'support' }
  if (path === '/contact-us') return { page: 'contact-us' }
  if (path === '/faq') return { page: 'faq' }
  if (path === '/disclaimer') return { page: 'disclaimer' }
  if (path === '/about-us') return { page: 'about-us' }
  if (path === '/refund-policy') return { page: 'refund-policy' }
  
  // Dynamic routes: /stock/[symbol] and /index/[symbol]
  if (path.startsWith('/stock/')) {
    const symbol = decodeURIComponent(path.slice(7))
    if (symbol) return { page: 'stockOverview', stockSymbol: symbol }
  }
  if (path.startsWith('/index/')) {
    const symbol = decodeURIComponent(path.slice(7))
    if (symbol) return { page: 'indexDetail', indexSymbol: symbol }
  }
  
  // Default to dashboard for unknown paths
  return { page: 'dashboard' }
}

// ─── State Interface ──────────────────────────────────────────────────────

interface AppState {
  currentPage: PageId
  sidebarOpen: boolean
  watchlistSidebarOpen: boolean
  selectedStockSymbol: string | null
  selectedIndexSymbol: string | null
  urlSyncEnabled: boolean
  // Shared date filter state (persists across pages)
  dateFilterPreset: DateFilterPreset
  dateFilterRange: DateRange | undefined
  setDateFilter: (preset: DateFilterPreset, range?: DateRange) => void
  setCurrentPage: (page: PageId) => void
  setSidebarOpen: (open: boolean) => void
  setWatchlistSidebarOpen: (open: boolean) => void
  setSelectedStockSymbol: (symbol: string | null) => void
  setSelectedIndexSymbol: (symbol: string | null) => void
  navigateToStock: (symbol: string) => void
  navigateToIndex: (symbol: string) => void
  initFromUrl: () => void
  setUrlSyncEnabled: (enabled: boolean) => void
}

// ─── URL Push Helper ──────────────────────────────────────────────────────

function pushUrl(url: string) {
  if (typeof window === 'undefined') return
  // Only push if the URL is different from current
  if (window.location.pathname !== url) {
    window.history.pushState(null, '', url)
  }
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  sidebarOpen: false,
  watchlistSidebarOpen: false,
  selectedStockSymbol: null,
  selectedIndexSymbol: null,
  urlSyncEnabled: true,
  dateFilterPreset: 'all',
  dateFilterRange: undefined,
  
  setCurrentPage: (page) => {
    const state = get()
    set({ currentPage: page, sidebarOpen: false })
    // Push URL change
    if (state.urlSyncEnabled) {
      pushUrl(getPageUrl(page))
    }
  },
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setWatchlistSidebarOpen: (open) => set({ watchlistSidebarOpen: open }),
  setSelectedStockSymbol: (symbol) => set({ selectedStockSymbol: symbol }),
  setSelectedIndexSymbol: (symbol) => set({ selectedIndexSymbol: symbol }),
  
  navigateToStock: (symbol) => {
    const state = get()
    set({ selectedStockSymbol: symbol, currentPage: 'stockOverview', sidebarOpen: false })
    // Push URL change
    if (state.urlSyncEnabled) {
      pushUrl(getPageUrl('stockOverview', symbol))
    }
  },
  
  navigateToIndex: (symbol) => {
    const state = get()
    set({ selectedIndexSymbol: symbol, currentPage: 'indexDetail', sidebarOpen: false })
    // Push URL change
    if (state.urlSyncEnabled) {
      pushUrl(getPageUrl('indexDetail', symbol))
    }
  },
  
  // Initialize store state from current URL (called on mount)
  initFromUrl: () => {
    if (typeof window === 'undefined') return
    const { page, stockSymbol, indexSymbol } = parseUrlPath(window.location.pathname)
    const updates: Partial<AppState> = { currentPage: page }
    if (stockSymbol) updates.selectedStockSymbol = stockSymbol
    if (indexSymbol) updates.selectedIndexSymbol = indexSymbol
    set(updates)
  },
  
  setDateFilter: (preset, range) => set({ dateFilterPreset: preset, dateFilterRange: range }),
  setUrlSyncEnabled: (enabled) => set({ urlSyncEnabled: enabled }),
}))
