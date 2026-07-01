import { NextResponse } from 'next/server'
import { getExpiryDates } from '@/lib/upstox-instruments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ underlying: string }> }
) {
  try {
    const { underlying } = await params
    const underlyingUpper = underlying.toUpperCase()

    const allExpiries = await getExpiryDates(underlyingUpper)

    const today = new Date().toISOString().split('T')[0]
    const startIdx = allExpiries.findIndex(e => e >= today)
    const from = startIdx >= 0 ? startIdx : 0
    const expiries = allExpiries.slice(from, from + 4)
    const nearestExpiry = expiries[0] || ''

    return NextResponse.json({
      success: true,
      data: {
        underlying: underlyingUpper,
        expiries,
        nearestExpiry,
        dataSource: 'calendar',
      },
    })
  } catch (error) {
    console.error('[API /options/expiries] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch expiry dates' },
      { status: 500 }
    )
  }
}