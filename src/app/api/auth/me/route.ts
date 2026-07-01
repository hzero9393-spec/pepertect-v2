import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request.headers)

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Check session exists
    const session = await db.session.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Session expired. Please login again.' },
        { status: 401 }
      )
    }

    // Get fresh user data
    let user = await db.user.findUnique({
      where: { id: payload.userId },
      include: {
        _count: {
          select: {
            trades: true,
            orders: true,
            positions: { where: { isOpen: true } },
          },
        },
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or deactivated' },
        { status: 401 }
      )
    }

    // Sync marginUsed from actual open SELL positions to prevent stale data
    const realMargin = await db.position.aggregate({
      where: { userId: payload.userId, isOpen: true, tradeDirection: 'SELL' },
      _sum: { marginUsed: true },
    })
    const realMarginUsed = realMargin._sum.marginUsed || 0
    if (realMarginUsed !== (user.marginUsed || 0)) {
      user = await db.user.update({
        where: { id: payload.userId },
        data: { marginUsed: realMarginUsed },
        include: user.include,
      })
    }

    const { passwordHash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('[Auth Me API] Error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[Auth Me API] Error details:', errorMsg)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
