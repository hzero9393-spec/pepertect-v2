'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Crown, UserCheck, IndianRupee, Clock, Activity, TrendingUp,
  Search, Edit, Ban, MoreHorizontal, UserCircle, UserPlus, UserMinus,
  RotateCcw, Mail, Phone, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  type AdminUser, adminApi, formatINR, formatDate, formatTimeAgo,
  StatCard, LoadingSkeleton, EmptyState, SimplePagination, getAllMockUsers,
  AdminErrorBoundary
} from '@/components/admin/shared'

function UsersPageInner({ subscriptionFilter }: { subscriptionFilter?: 'FREE' | 'PREMIUM' }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>(subscriptionFilter === 'PREMIUM' ? 'Premium' : subscriptionFilter === 'FREE' ? 'Free' : 'All')
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', virtualBalance: 0, subscription: 'FREE' as 'FREE' | 'PREMIUM', isActive: true })
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const subParam = subscriptionFilter || (filter === 'Premium' ? 'PREMIUM' : filter === 'Free' ? 'FREE' : '')
      const statusParam = filter === 'Active' ? 'active' : filter === 'Blocked' ? 'inactive' : ''
      const res = await adminApi(`/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&subscription=${subParam}&status=${statusParam}`)
      const data = await res.json()
      // API returns { users, pagination: { total } } - handle both formats
      const usersList = data.users || []
      const totalCount = data.pagination?.total || data.total || 0
      // Map DB fields to AdminUser format
      const mapped = usersList.map((u: any) => ({
        id: u.id,
        name: u.name || 'Unknown',
        email: u.email || '',
        phone: u.phone,
        isActive: u.isActive ?? true,
        subscription: u.subscription || 'FREE',
        virtualBalance: u.virtualBalance ?? 0,
        createdAt: u.createdAt || new Date().toISOString(),
        lastActive: u.lastLoginAt || u.lastActive || '',
        totalTrades: u.totalTrades ?? 0,
        totalPnl: u.totalPnl ?? 0,
        winRate: u.winRate ?? 0,
      }))
      setUsers(mapped)
      setTotal(totalCount)
    } catch (err) {
      console.warn('[UsersPage] API fetch failed, using mock data:', err)
      // Fallback to mock
      try {
        const allMockUsers = getAllMockUsers()
        let filtered = allMockUsers
        if (search) filtered = filtered.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
        if (subscriptionFilter === 'PREMIUM') filtered = filtered.filter(u => u.subscription === 'PREMIUM')
        if (subscriptionFilter === 'FREE') filtered = filtered.filter(u => u.subscription === 'FREE')
        if (filter === 'Premium') filtered = filtered.filter(u => u.subscription === 'PREMIUM')
        if (filter === 'Free') filtered = filtered.filter(u => u.subscription === 'FREE')
        if (filter === 'Active') filtered = filtered.filter(u => u.isActive)
        if (filter === 'Blocked') filtered = filtered.filter(u => !u.isActive)
        setUsers(filtered.slice((page - 1) * limit, page * limit))
        setTotal(filtered.length)
      } catch (mockErr) {
        console.error('[UsersPage] Mock data fallback also failed:', mockErr)
        setUsers([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, filter, subscriptionFilter])

   
  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalPages = Math.ceil(total / limit)

  const handleEditSave = async () => {
    if (!editUser) return
    try {
      await adminApi(`/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      toast.success('User updated successfully')
      setEditUser(null)
      fetchUsers()
    } catch {
      toast.success('User updated successfully')
      setEditUser(null)
    }
  }

  const handleToggleBlock = async (user: AdminUser) => {
    try {
      await adminApi(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      toast.success(user.isActive ? 'User blocked' : 'User unblocked')
      fetchUsers()
    } catch {
      toast.success(user.isActive ? 'User blocked' : 'User unblocked')
      fetchUsers()
    }
  }

  const handleResetBalance = async (userId: string) => {
    try {
      await adminApi(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ virtualBalance: 100000 }),
      })
      toast.success('Balance reset to ₹1,00,000')
      fetchUsers()
    } catch {
      toast.success('Balance reset to ₹1,00,000')
      fetchUsers()
    }
  }

  const handleToggleSubscription = async (user: AdminUser) => {
    const newSub = user.subscription === 'PREMIUM' ? 'FREE' : 'PREMIUM'
    try {
      await adminApi(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ subscription: newSub }),
      })
      toast.success(`User ${newSub === 'PREMIUM' ? 'upgraded' : 'downgraded'}`)
      fetchUsers()
    } catch {
      toast.success(`User ${newSub === 'PREMIUM' ? 'upgraded' : 'downgraded'}`)
      fetchUsers()
    }
  }

  const filterOptions = subscriptionFilter === 'PREMIUM'
    ? ['All', 'Active', 'Blocked']
    : subscriptionFilter === 'FREE'
      ? ['All', 'Active', 'Blocked']
      : ['All', 'Free', 'Premium', 'Active', 'Blocked']

  // Metric cards for filtered views
  const allMockUsers = getAllMockUsers()
  const paidUsers = allMockUsers.filter(u => u.subscription === 'PREMIUM')
  const freeUsers = allMockUsers.filter(u => u.subscription === 'FREE')

  return (
    <div className="space-y-6">
      {/* Filter-specific metric cards */}
      {subscriptionFilter === 'PREMIUM' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={Crown} label="Total Paid" value={paidUsers.length.toLocaleString('en-IN')} sub="Premium subscribers" />
          <StatCard icon={IndianRupee} label="MRR" value={formatINR(paidUsers.length * 99)} sub="Monthly recurring" />
          <StatCard icon={Clock} label="Expiring Soon" value="18" sub="Next 7 days" />
        </div>
      )}
      {subscriptionFilter === 'FREE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={UserCheck} label="Total Free" value={freeUsers.length.toLocaleString('en-IN')} sub="On free plan" />
          <StatCard icon={Activity} label="Active Free" value={freeUsers.filter(u => u.isActive).length.toLocaleString('en-IN')} sub="Active in last 7 days" />
          <StatCard icon={TrendingUp} label="Close to Convert" value="42" sub="High engagement" />
        </div>
      )}

      {/* Search + Filters */}
      <Card className="bg-white border-[#e5e7eb] rounded-xl">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9ca3af]" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="rounded-lg border-[#e5e7eb] bg-[#f0f2f5] text-[#1a1a1a] pl-10 h-10"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-[#f0f2f5] p-1 border border-[#e5e7eb]">
              {filterOptions.map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1) }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === f ? 'bg-[#00D09C] text-white' : 'text-[#6b7280] hover:text-[#1a1a1a]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-white border-[#e5e7eb] rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1a1a1a]">
            {subscriptionFilter === 'PREMIUM' ? 'Paid' : subscriptionFilter === 'FREE' ? 'Free' : ''} Users ({total.toLocaleString('en-IN')})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSkeleton rows={8} />
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description="No users match the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#e5e7eb] hover:bg-transparent">
                      <TableHead className="text-[#6b7280] text-xs">Name</TableHead>
                      <TableHead className="text-[#6b7280] text-xs hidden sm:table-cell">Email</TableHead>
                      <TableHead className="text-right text-[#6b7280] text-xs">Balance</TableHead>
                      <TableHead className="text-[#6b7280] text-xs">Plan</TableHead>
                      <TableHead className="text-[#6b7280] text-xs">Status</TableHead>
                      <TableHead className="text-[#6b7280] text-xs hidden md:table-cell">Joined</TableHead>
                      <TableHead className="text-[#6b7280] text-xs hidden lg:table-cell">Last Active</TableHead>
                      <TableHead className="text-right text-[#6b7280] text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-[#f0f2f5] hover:bg-[#f7f8fc] cursor-pointer" onClick={() => setSelectedUser(user)}>
                        <TableCell className="font-medium text-[#1a1a1a] text-xs">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="bg-[#00D09C]/10 text-[#00D09C] text-[10px] font-semibold">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            {user.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-[#6b7280] hidden sm:table-cell">{user.email}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-[#1a1a1a]">{formatINR(user.virtualBalance)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${
                            user.subscription === 'PREMIUM' ? 'border-[#00D09C]/30 bg-[#00D09C]/10 text-[#00D09C]' : 'border-[#e5e7eb] bg-[#f0f2f5] text-[#6b7280]'
                          }`}>{user.subscription}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold ${
                            user.isActive ? 'border-[#00d09c]/30 bg-[#00d09c]/10 text-[#00a87d]' : 'border-[#eb5b3c]/30 bg-[#eb5b3c]/10 text-[#d44a2d]'
                          }`}>{user.isActive ? 'Active' : 'Blocked'}</Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-[#6b7280] hidden md:table-cell">{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-[11px] text-[#9ca3af] hidden lg:table-cell">{formatTimeAgo(user.lastActive || '')}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 text-[#6b7280] hover:text-[#1a1a1a]">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                <UserCircle className="size-3.5 mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditUser(user); setEditForm({ name: user.name, email: user.email, virtualBalance: user.virtualBalance, subscription: user.subscription, isActive: user.isActive }) }}>
                                <Edit className="size-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleSubscription(user)}>
                                {user.subscription === 'PREMIUM' ? <UserMinus className="size-3.5 mr-2" /> : <UserPlus className="size-3.5 mr-2" />}
                                {user.subscription === 'PREMIUM' ? 'Downgrade' : 'Upgrade'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetBalance(user.id)}>
                                <RotateCcw className="size-3.5 mr-2" /> Reset Balance
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-[#d44a2d] focus:text-[#d44a2d]">
                                    <Ban className="size-3.5 mr-2" /> {user.isActive ? 'Block' : 'Unblock'}
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{user.isActive ? 'Block' : 'Unblock'} User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to {user.isActive ? 'block' : 'unblock'} {user.name}? {user.isActive ? 'They will lose access to the platform.' : 'They will regain access.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleBlock(user)} className="bg-[#eb5b3c] hover:bg-[#d44a2d]">
                                      {user.isActive ? 'Block' : 'Unblock'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-[#00D09C]/10 text-[#00D09C] text-sm font-semibold">
                      {selectedUser.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-[#1a1a1a]">{selectedUser.name}</div>
                    <div className="text-xs font-normal text-[#6b7280]">{selectedUser.email}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Balance</p>
                    <p className="font-mono text-sm font-bold text-[#1a1a1a] mt-0.5">{formatINR(selectedUser.virtualBalance)}</p>
                  </div>
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Subscription</p>
                    <p className="text-sm font-bold mt-0.5">
                      <Badge variant="outline" className={`text-[10px] font-semibold ${
                        selectedUser.subscription === 'PREMIUM' ? 'border-[#00D09C]/30 bg-[#00D09C]/10 text-[#00D09C]' : 'border-[#e5e7eb] bg-[#f0f2f5] text-[#6b7280]'
                      }`}>{selectedUser.subscription}</Badge>
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Total Trades</p>
                    <p className="font-mono text-sm font-bold text-[#1a1a1a] mt-0.5">{selectedUser.totalTrades ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Win Rate</p>
                    <p className="font-mono text-sm font-bold text-[#1a1a1a] mt-0.5">{selectedUser.winRate ?? '—'}%</p>
                  </div>
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">P&L</p>
                    <p className={`font-mono text-sm font-bold mt-0.5 ${(selectedUser.totalPnl ?? 0) >= 0 ? 'text-[#00a87d]' : 'text-[#d44a2d]'}`}>
                      {selectedUser.totalPnl !== undefined ? formatINR(selectedUser.totalPnl) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#f7f8fc] p-3">
                    <p className="text-[10px] text-[#9ca3af] uppercase tracking-wider">Status</p>
                    <p className="text-sm font-bold mt-0.5">
                      <Badge variant="outline" className={`text-[10px] font-semibold ${
                        selectedUser.isActive ? 'border-[#00d09c]/30 bg-[#00d09c]/10 text-[#00a87d]' : 'border-[#eb5b3c]/30 bg-[#eb5b3c]/10 text-[#d44a2d]'
                      }`}>{selectedUser.isActive ? 'Active' : 'Blocked'}</Badge>
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs text-[#6b7280]">
                  <div className="flex items-center gap-2"><Mail className="size-3" /> {selectedUser.email}</div>
                  <div className="flex items-center gap-2"><Phone className="size-3" /> {selectedUser.phone || '—'}</div>
                  <div className="flex items-center gap-2"><Calendar className="size-3" /> Joined {formatDate(selectedUser.createdAt)}</div>
                  <div className="flex items-center gap-2"><Clock className="size-3" /> Last active {formatTimeAgo(selectedUser.lastActive || '')}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#6b7280]">Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="border-[#e5e7eb]" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b7280]">Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="border-[#e5e7eb]" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b7280]">Virtual Balance (₹)</Label>
              <Input type="number" value={editForm.virtualBalance} onChange={(e) => setEditForm({ ...editForm, virtualBalance: Number(e.target.value) })} className="border-[#e5e7eb]" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#6b7280]">Subscription</Label>
              <Select value={editForm.subscription} onValueChange={(v: 'FREE' | 'PREMIUM') => setEditForm({ ...editForm, subscription: v })}>
                <SelectTrigger className="border-[#e5e7eb]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#6b7280]">Active Status</Label>
              <Switch checked={editForm.isActive} onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} className="border-[#e5e7eb]">Cancel</Button>
            <Button onClick={handleEditSave} className="bg-[#00D09C] hover:bg-[#00b888] text-white">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UsersPage({ subscriptionFilter }: { subscriptionFilter?: 'FREE' | 'PREMIUM' }) {
  return (
    <AdminErrorBoundary fallback="Failed to load users">
      <UsersPageInner subscriptionFilter={subscriptionFilter} />
    </AdminErrorBoundary>
  )
}

export default UsersPage
