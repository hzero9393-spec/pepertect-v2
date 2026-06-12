import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateAdmin, getClientIp } from '@/lib/admin-auth'

// GET: List users with pagination + filters
export async function GET(request: NextRequest) {
  try {
    const result = await authenticateAdmin(request)
    if (result.error) return result.error

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || ''
    const subscription = searchParams.get('subscription') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (subscription) {
      where.subscription = subscription
    }

    if (status === 'true' || status === 'active') {
      where.isActive = true
    } else if (status === 'false' || status === 'inactive') {
      where.isActive = false
    }

    // Validate sort field
    const allowedSortFields = [
      'createdAt', 'name', 'email', 'virtualBalance', 'totalTrades',
      'winRate', 'totalPnl', 'subscription', 'isActive', 'lastLoginAt',
    ]
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          subscription: true,
          virtualBalance: true,
          marginUsed: true,
          totalTrades: true,
          winRate: true,
          totalPnl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { [validSortBy]: validSortOrder },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Admin Users API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update user (block/unblock, reset balance, upgrade/downgrade plan)
export async function PUT(request: NextRequest) {
  try {
    const result = await authenticateAdmin(request)
    if (result.error) return result.error
    const admin = result.admin!

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const userId = searchParams.get('userId')

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Action and userId are required' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const ipAddress = getClientIp(request)
    let updatedUser

    switch (action) {
      case 'block':
        updatedUser = await db.user.update({
          where: { id: userId },
          data: { isActive: false },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_BLOCK',
            targetId: userId,
            details: JSON.stringify({ userName: user.name, userEmail: user.email }),
            ipAddress,
          },
        })
        break

      case 'unblock':
        updatedUser = await db.user.update({
          where: { id: userId },
          data: { isActive: true },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_UNBLOCK',
            targetId: userId,
            details: JSON.stringify({ userName: user.name, userEmail: user.email }),
            ipAddress,
          },
        })
        break

      case 'resetBalance': {
        // Get max_virtual_balance from settings or default
        const maxBalanceSetting = await db.platformSettings.findUnique({
          where: { key: 'max_virtual_balance' },
        })
        const defaultBalance = maxBalanceSetting
          ? parseFloat(maxBalanceSetting.value)
          : 100000
        updatedUser = await db.user.update({
          where: { id: userId },
          data: {
            virtualBalance: defaultBalance,
            marginUsed: 0,
          },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_RESET_BALANCE',
            targetId: userId,
            details: JSON.stringify({
              userName: user.name,
              previousBalance: user.virtualBalance,
              newBalance: defaultBalance,
            }),
            ipAddress,
          },
        })
        break
      }

      case 'upgrade':
        updatedUser = await db.user.update({
          where: { id: userId },
          data: { subscription: 'PREMIUM' },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_UPGRADE',
            targetId: userId,
            details: JSON.stringify({
              userName: user.name,
              previousPlan: user.subscription,
              newPlan: 'PREMIUM',
            }),
            ipAddress,
          },
        })
        break

      case 'downgrade':
        updatedUser = await db.user.update({
          where: { id: userId },
          data: { subscription: 'FREE' },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_DOWNGRADE',
            targetId: userId,
            details: JSON.stringify({
              userName: user.name,
              previousPlan: user.subscription,
              newPlan: 'FREE',
            }),
            ipAddress,
          },
        })
        break

      case 'delete':
        updatedUser = await db.user.update({
          where: { id: userId },
          data: { isActive: false },
        })
        await db.activityLog.create({
          data: {
            adminId: admin.id,
            action: 'USER_DELETE',
            targetId: userId,
            details: JSON.stringify({ userName: user.name, userEmail: user.email }),
            ipAddress,
          },
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: block, unblock, resetBalance, upgrade, downgrade, delete' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      message: `User ${action} successful`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        subscription: updatedUser.subscription,
        isActive: updatedUser.isActive,
        virtualBalance: updatedUser.virtualBalance,
      },
    })
  } catch (error) {
    console.error('[Admin Users API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
