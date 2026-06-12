'use client'

import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, Crown, UserCheck, ArrowUpDown, Crosshair,
  BarChart3, FileText, UserCircle, Settings, LogOut, TrendingUp,
  Menu, Bell, Loader2, Activity, IndianRupee, Crown as CrownIcon,
  UserCheck as UserCheckIcon, ArrowUpDown as TradesIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
  AlertDialogAction, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import dynamic from 'next/dynamic'
import { AdminErrorBoundary } from './shared'

// ─── Types ───────────────────────────────────────────────────────────────────
type PageKey = 'dashboard' | 'users' | 'paid-users' | 'free-users' | 'trades' | 'positions' | 'analytics' | 'reports' | 'profile' | 'settings'

// ─── Lazy-loaded page components (each is a separate chunk) ──────────────────
const DashboardPage = dynamic(() => import('./pages/dashboard-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const UsersPage = dynamic(() => import('./pages/users-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const TradesPage = dynamic(() => import('./pages/trades-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const PositionsPage = dynamic(() => import('./pages/positions-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const AnalyticsPage = dynamic(() => import('./pages/analytics-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const ReportsPage = dynamic(() => import('./pages/reports-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const ProfilePage = dynamic(() => import('./pages/profile-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })
const SettingsPage = dynamic(() => import('./pages/settings-page'), { ssr: false, loading: () => <PageLoadingSkeleton /> })

// ─── Loading Skeleton ────────────────────────────────────────────────────────
function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-28 border border-[#e5e7eb]" />
        ))}
      </div>
      <div className="bg-white rounded-xl h-80 border border-[#e5e7eb]" />
    </div>
  )
}

// ─── Quick Stats for welcome screen ──────────────────────────────────────────
function WelcomeStats() {
  const [stats, setStats] = useState<{totalUsers: number, activeUsers: number, paidUsers: number, totalTrades: number} | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        const res = await fetch('/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setStats({
            totalUsers: data.totalUsers || 0,
            activeUsers: data.activeUsers || 0,
            paidUsers: data.paidUsers || 0,
            totalTrades: data.totalTrades || 0,
          })
        }
      } catch {
        // Ignore errors for welcome screen
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-24 border border-[#e5e7eb] animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const statItems = [
    { icon: Users, label: 'Total Users', value: stats.totalUsers.toLocaleString('en-IN'), color: '#00D09C' },
    { icon: Activity, label: 'Active Users', value: stats.activeUsers.toLocaleString('en-IN'), color: '#3B82F6' },
    { icon: Crown, label: 'Paid Users', value: stats.paidUsers.toLocaleString('en-IN'), color: '#F59E0B' },
    { icon: ArrowUpDown, label: 'Total Trades', value: stats.totalTrades.toLocaleString('en-IN'), color: '#8B5CF6' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label} className="bg-white border-[#e5e7eb] rounded-xl">
            <CardContent className="p-4">
              <div className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                <Icon className="size-4" />
              </div>
              <p className="mt-3 text-xs font-medium text-[#6b7280]">{stat.label}</p>
              <p className="font-mono text-xl font-bold text-[#1a1a1a] mt-0.5">{stat.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Sidebar Nav Items ───────────────────────────────────────────────────────
const navItems: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'paid-users', label: 'Paid Users', icon: Crown },
  { key: 'free-users', label: 'Free Users', icon: UserCheck },
  { key: 'trades', label: 'Trades / Orders', icon: ArrowUpDown },
  { key: 'positions', label: 'Positions', icon: Crosshair },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'profile', label: 'Admin Profile', icon: UserCircle },
  { key: 'settings', label: 'Settings', icon: Settings },
]

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═════════════════════════════════════════════════════════════════════════════
export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [currentPage, setCurrentPage] = useState<PageKey | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleNavClick = (key: PageKey) => {
    setCurrentPage(key)
    setSidebarOpen(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    onLogout()
  }

  const renderPage = () => {
    // Show welcome screen with quick stats when no page selected
    if (!currentPage) {
      return (
        <div className="space-y-6">
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#00D09C]/10 mx-auto mb-4">
              <TrendingUp className="size-7 text-[#00D09C]" />
            </div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">Welcome, Admin!</h2>
            <p className="text-sm text-[#6b7280] mt-2 max-w-md mx-auto">
              Select a section from the sidebar to get started. Here&apos;s a quick overview of your platform.
            </p>
          </div>
          <WelcomeStats />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button onClick={() => setCurrentPage('dashboard')} className="bg-white border border-[#e5e7eb] rounded-xl p-5 text-left hover:shadow-sm transition-shadow">
              <LayoutDashboard className="size-5 text-[#00D09C] mb-3" />
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Dashboard</h3>
              <p className="text-xs text-[#6b7280] mt-1">View platform analytics and charts</p>
            </button>
            <button onClick={() => setCurrentPage('users')} className="bg-white border border-[#e5e7eb] rounded-xl p-5 text-left hover:shadow-sm transition-shadow">
              <Users className="size-5 text-[#3B82F6] mb-3" />
              <h3 className="text-sm font-semibold text-[#1a1a1a]">User Management</h3>
              <p className="text-xs text-[#6b7280] mt-1">Manage users, subscriptions, and balances</p>
            </button>
            <button onClick={() => setCurrentPage('trades')} className="bg-white border border-[#e5e7eb] rounded-xl p-5 text-left hover:shadow-sm transition-shadow">
              <ArrowUpDown className="size-5 text-[#8B5CF6] mb-3" />
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Trades & Orders</h3>
              <p className="text-xs text-[#6b7280] mt-1">Monitor trades across all segments</p>
            </button>
          </div>
        </div>
      )
    }

    switch (currentPage) {
      case 'dashboard': return <AdminErrorBoundary fallback="Failed to load dashboard"><DashboardPage /></AdminErrorBoundary>
      case 'users': return <AdminErrorBoundary fallback="Failed to load users"><UsersPage /></AdminErrorBoundary>
      case 'paid-users': return <AdminErrorBoundary fallback="Failed to load paid users"><UsersPage subscriptionFilter="PREMIUM" /></AdminErrorBoundary>
      case 'free-users': return <AdminErrorBoundary fallback="Failed to load free users"><UsersPage subscriptionFilter="FREE" /></AdminErrorBoundary>
      case 'trades': return <AdminErrorBoundary fallback="Failed to load trades"><TradesPage /></AdminErrorBoundary>
      case 'positions': return <AdminErrorBoundary fallback="Failed to load positions"><PositionsPage /></AdminErrorBoundary>
      case 'analytics': return <AdminErrorBoundary fallback="Failed to load analytics"><AnalyticsPage /></AdminErrorBoundary>
      case 'reports': return <AdminErrorBoundary fallback="Failed to load reports"><ReportsPage /></AdminErrorBoundary>
      case 'profile': return <AdminErrorBoundary fallback="Failed to load profile"><ProfilePage /></AdminErrorBoundary>
      case 'settings': return <AdminErrorBoundary fallback="Failed to load settings"><SettingsPage /></AdminErrorBoundary>
      default: return <AdminErrorBoundary fallback="Failed to load dashboard"><DashboardPage /></AdminErrorBoundary>
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#e5e7eb]">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#00D09C]">
          <TrendingUp className="size-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-[#1a1a1a]">Pepertect</h1>
          <p className="text-[10px] text-[#6b7280]">Admin Panel</p>
        </div>
      </div>

      {/* Nav Items */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.key
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#00D09C]/10 text-[#00D09C]'
                    : 'text-[#6b7280] hover:bg-[#f0f2f5] hover:text-[#1a1a1a]'
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </div>
      </ScrollArea>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-[#e5e7eb]">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-[#d44a2d] hover:bg-[#eb5b3c]/10 transition-colors">
              <LogOut className="size-4" />
              Logout
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to logout from the admin panel?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} className="bg-[#eb5b3c] hover:bg-[#d44a2d]">Logout</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-60 bg-white border-r border-[#e5e7eb] flex flex-col shrink-0 sticky top-0 h-screen">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-60 p-0">
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-[#e5e7eb] px-4 lg:px-6 py-3 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setSidebarOpen(true)}>
                  <Menu className="size-5 text-[#6b7280]" />
                </Button>
              )}
              <div>
                <h2 className="text-sm font-semibold text-[#1a1a1a] capitalize">
                  {currentPage ? currentPage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Welcome'}
                </h2>
                <p className="text-[10px] text-[#6b7280]">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-9 text-[#6b7280] hover:text-[#1a1a1a]">
                <Bell className="size-4" />
              </Button>
              <div className="flex items-center gap-2 pl-2 border-l border-[#e5e7eb]">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-[#00D09C]/10 text-[#00D09C] text-xs font-semibold">A</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-[#1a1a1a]">Admin</p>
                  <p className="text-[10px] text-[#6b7280]">Super Admin</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
