import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
export type PageKey = 'dashboard' | 'users' | 'paid-users' | 'free-users' | 'trades' | 'positions' | 'analytics' | 'reports' | 'profile' | 'settings'

export interface AdminUser {
  id: string
  name: string
  email: string
  phone?: string
  isActive: boolean
  subscription: 'FREE' | 'PREMIUM'
  virtualBalance: number
  createdAt: string
  lastActive?: string
  totalTrades?: number
  totalPnl?: number
  winRate?: number
}

export interface Trade {
  id: string
  userId: string
  userName: string
  symbol: string
  segment: string
  direction: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice?: number
  quantity: number
  pnl?: number
  status: 'OPEN' | 'CLOSED'
  createdAt: string
}

export interface Position {
  id: string
  userId: string
  userName: string
  symbol: string
  segment: string
  direction: 'BUY' | 'SELL'
  entryPrice: number
  currentPrice: number
  quantity: number
  pnl: number
  createdAt: string
}

export interface DashboardData {
  totalUsers: number
  activeUsers: number
  paidUsers: number
  freeUsers: number
  conversionRate: number
  totalRevenue: number
  totalTrades: number
  userGrowth: { month: string; count: number }[]
  recentTrades: Trade[]
  recentActivity: { user: string; action: string; symbol: string; time: string }[]
}

export interface SettingsItem {
  key: string
  value: string
  description: string
}

// ─── API Helper ──────────────────────────────────────────────────────────────
export async function adminApi(endpoint: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const res = await fetch(`/api/admin${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    throw new Error('Unauthorized - please login again')
  }
  if (!res.ok) {
    let errorMsg = 'API Error'
    try {
      const errData = await res.json()
      errorMsg = errData.error || errData.message || `API Error (${res.status})`
    } catch {
      errorMsg = `API Error (${res.status})`
    }
    throw new Error(errorMsg)
  }
  return res
}

// ─── Formatters ──────────────────────────────────────────────────────────────
export function formatINR(amount: number): string {
  const isNeg = amount < 0
  const abs = Math.abs(amount)
  const str = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return `${isNeg ? '-' : ''}₹${str}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ─── Chart Data ──────────────────────────────────────────────────────────────
export const mockUserGrowth = [
  { month: 'Jan', count: 320 }, { month: 'Feb', count: 410 }, { month: 'Mar', count: 540 },
  { month: 'Apr', count: 620 }, { month: 'May', count: 730 }, { month: 'Jun', count: 850 },
  { month: 'Jul', count: 960 }, { month: 'Aug', count: 1050 }, { month: 'Sep', count: 1130 },
  { month: 'Oct', count: 1200 }, { month: 'Nov', count: 1248 }, { month: 'Dec', count: 1310 },
]

export const mockDailyTrades = [
  { day: 'Mon', trades: 142 }, { day: 'Tue', trades: 186 }, { day: 'Wed', trades: 210 },
  { day: 'Thu', trades: 178 }, { day: 'Fri', trades: 195 }, { day: 'Sat', trades: 62 },
  { day: 'Sun', trades: 28 },
]

export const mockRevenueTrend = [
  { month: 'Jan', revenue: 28000 }, { month: 'Feb', revenue: 35000 }, { month: 'Mar', revenue: 42000 },
  { month: 'Apr', revenue: 48000 }, { month: 'May', revenue: 52000 }, { month: 'Jun', revenue: 58000 },
  { month: 'Jul', revenue: 62000 }, { month: 'Aug', revenue: 68000 }, { month: 'Sep', revenue: 74000 },
  { month: 'Oct', revenue: 78000 }, { month: 'Nov', revenue: 82000 }, { month: 'Dec', revenue: 88000 },
]

export const mockWinRate = [
  { range: '0-20%', users: 45 }, { range: '20-40%', users: 120 }, { range: '40-60%', users: 280 },
  { range: '60-80%', users: 190 }, { range: '80-100%', users: 65 },
]

export const mockTradeFreq = [
  { range: '1-10', users: 380 }, { range: '11-50', users: 420 }, { range: '51-100', users: 210 },
  { range: '100+', users: 90 },
]

export const mockTopStocks = [
  { symbol: 'RELIANCE', trades: 1840 }, { symbol: 'TCS', trades: 1520 }, { symbol: 'HDFCBANK', trades: 1380 },
  { symbol: 'INFY', trades: 1260 }, { symbol: 'ICICIBANK', trades: 1100 }, { symbol: 'NIFTY', trades: 980 },
  { symbol: 'BANKNIFTY', trades: 870 }, { symbol: 'SBIN', trades: 760 },
]

export const mockPeakHours = [
  { hour: '9AM', trades: 180 }, { hour: '10AM', trades: 320 }, { hour: '11AM', trades: 280 },
  { hour: '12PM', trades: 190 }, { hour: '1PM', trades: 210 }, { hour: '2PM', trades: 260 },
  { hour: '3PM', trades: 340 }, { hour: '4PM', trades: 50 },
]

export const mockConversionFunnel = [
  { stage: 'Signups', value: 1310 }, { stage: 'First Trade', value: 920 }, { stage: 'Active (7d)', value: 680 },
  { stage: 'Premium Trial', value: 310 }, { stage: 'Paid', value: 234 },
]

// ─── Mock Data Generators ────────────────────────────────────────────────────
export function generateMockUsers(count: number): AdminUser[] {
  const names = ['Arjun Mehta', 'Priya Sharma', 'Rahul Verma', 'Sneha Patel', 'Vikram Singh', 'Ananya Iyer', 'Kavita Reddy', 'Amit Kumar', 'Deepa Nair', 'Sanjay Gupta', 'Meera Joshi', 'Rajesh Pillai', 'Pooja Agarwal', 'Karthik Iyer', 'Lakshmi Rao', 'Nitin Deshmukh', 'Swati Bhatt', 'Manish Tiwari', 'Ritu Saxena', 'Aditya Kapoor', 'Nisha Chauhan', 'Praveen Yadav', 'Shruti Mishra', 'Vivek Menon', 'Divya Iyengar']
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icici.com', 'hdfc.com', 'tcs.com', 'infosys.com']
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const name = names[i % names.length]
    const sub = Math.random() > 0.72 ? 'PREMIUM' as const : 'FREE' as const
    const daysAgo = Math.floor(Math.random() * 365)
    const created = new Date(now.getTime() - daysAgo * 86400000)
    const lastAct = new Date(now.getTime() - Math.floor(Math.random() * 30) * 86400000)
    return {
      id: `usr_${1000 + i}`,
      name: name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@${domains[i % domains.length]}`,
      phone: `+91 ${9000000000 + Math.floor(Math.random() * 999999999)}`,
      isActive: Math.random() > 0.12,
      subscription: sub,
      virtualBalance: Math.floor(Math.random() * 950000 + 50000),
      createdAt: created.toISOString(),
      lastActive: lastAct.toISOString(),
      totalTrades: Math.floor(Math.random() * 900 + 10),
      totalPnl: Math.floor(Math.random() * 200000 - 50000),
      winRate: Math.floor(Math.random() * 60 + 20),
    }
  })
}

export function generateMockTrades(count: number): Trade[] {
  const users = generateMockUsers(10)
  const symbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'NIFTY 23500 CE', 'BANKNIFTY 50000 PE', 'RELIANCE 2900 CE', 'TCS 4100 PE']
  const segments = ['INDEX', 'STOCK', 'OPTIONS']
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const user = users[i % users.length]
    const hoursAgo = Math.floor(Math.random() * 168)
    const created = new Date(now.getTime() - hoursAgo * 3600000)
    const isBuy = Math.random() > 0.45
    const isOpen = Math.random() > 0.6
    const entry = Math.floor(Math.random() * 5000 + 100)
    return {
      id: `trd_${5000 + i}`,
      userId: user.id,
      userName: user.name,
      symbol: symbols[i % symbols.length],
      segment: segments[i % segments.length],
      direction: isBuy ? 'BUY' as const : 'SELL' as const,
      entryPrice: entry,
      exitPrice: isOpen ? undefined : Math.floor(entry * (1 + (Math.random() - 0.45) * 0.1)),
      quantity: Math.floor(Math.random() * 50 + 1),
      pnl: isOpen ? undefined : Math.floor((Math.random() - 0.4) * 20000),
      status: isOpen ? 'OPEN' as const : 'CLOSED' as const,
      createdAt: created.toISOString(),
    }
  })
}

export function generateMockPositions(count: number): Position[] {
  const users = generateMockUsers(8)
  const symbols = ['NIFTY 24000 CE', 'BANKNIFTY 52000 PE', 'RELIANCE', 'TCS', 'HDFCBANK', 'NIFTY', 'BANKNIFTY', 'INFY']
  const segments = ['OPTIONS', 'STOCK', 'INDEX']
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const user = users[i % users.length]
    const hoursAgo = Math.floor(Math.random() * 48)
    const created = new Date(now.getTime() - hoursAgo * 3600000)
    const entry = Math.floor(Math.random() * 5000 + 100)
    const current = entry * (1 + (Math.random() - 0.45) * 0.08)
    return {
      id: `pos_${3000 + i}`,
      userId: user.id,
      userName: user.name,
      symbol: symbols[i % symbols.length],
      segment: segments[i % segments.length],
      direction: Math.random() > 0.5 ? 'BUY' as const : 'SELL' as const,
      entryPrice: entry,
      currentPrice: current,
      quantity: Math.floor(Math.random() * 50 + 1),
      pnl: (current - entry) * (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 20 + 1),
      createdAt: created.toISOString(),
    }
  })
}

// ─── Lazy Mock Data ──────────────────────────────────────────────────────────
let _allMockUsers: AdminUser[] | null = null
let _allMockTrades: Trade[] | null = null
let _allMockPositions: Position[] | null = null

export function ensureMockData() {
  if (!_allMockUsers) _allMockUsers = generateMockUsers(85)
  if (!_allMockTrades) _allMockTrades = generateMockTrades(120)
  if (!_allMockPositions) _allMockPositions = generateMockPositions(35)
}

export function getAllMockUsers(): AdminUser[] {
  ensureMockData()
  return _allMockUsers!
}

export function getAllMockTrades(): Trade[] {
  ensureMockData()
  return _allMockTrades!
}

export function getAllMockPositions(): Position[] {
  ensureMockData()
  return _allMockPositions!
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
            <AlertTriangle className="size-7 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-[#1a1a1a]">
            {this.props.fallback || 'Something went wrong'}
          </h3>
          <p className="text-xs text-[#6b7280] mt-1 max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred while loading this section.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[#00D09C] text-white hover:bg-[#00b888] transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Stat Card Component ─────────────────────────────────────────────────────
export function StatCard({ icon: Icon, label, value, sub, color = '#00D09C' }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <Card className="bg-white border-[#e5e7eb] rounded-xl hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-[#6b7280]">{label}</p>
        <p className="font-mono text-xl font-bold text-[#1a1a1a] mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-[#9ca3af] mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────
export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#f0f2f5] mb-4">
        <Icon className="size-7 text-[#9ca3af]" />
      </div>
      <h3 className="text-sm font-semibold text-[#1a1a1a]">{title}</h3>
      <p className="text-xs text-[#6b7280] mt-1 max-w-xs">{description}</p>
    </div>
  )
}

// ─── Simple Pagination (no external Pagination UI dependency) ─────────────────
export function SimplePagination({ page, totalPages, onPageChange }: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => page > 1 && onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f0f2f5] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>
      <span className="text-xs text-[#6b7280]">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => page < totalPages && onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f0f2f5] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}
