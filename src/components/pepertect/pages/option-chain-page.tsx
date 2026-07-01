'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OCStrike {
  strike_price: number
  underlying_spot_price: number
  call_options: {
    market_data: {
      ltp: number; volume: number; oi: number; close_price: number
      bid_price: number; bid_qty: number; ask_price: number; ask_qty: number; prev_oi: number
    }
    option_greeks: { iv: number; delta: number; theta: number; vega: number; gamma: number }
  }
  put_options: {
    market_data: {
      ltp: number; volume: number; oi: number; close_price: number
      bid_price: number; bid_qty: number; ask_price: number; ask_qty: number; prev_oi: number
    }
    option_greeks: { iv: number; delta: number; theta: number; vega: number; gamma: number }
  }
}

interface OCUpdate {
  underlying: string
  spot: number
  pcr: number
  expiry: string
  strikes: OCStrike[]
  timestamp: number
  totalCallOI: number
  totalPutOI: number
  maxPainStrike: number
}

type Underlying = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'SENSEX'

const INDICES: { key: Underlying; label: string }[] = [
  { key: 'NIFTY', label: 'NIFTY 50' },
  { key: 'BANKNIFTY', label: 'BANKNIFTY' },
  { key: 'FINNIFTY', label: 'FINNIFTY' },
  { key: 'SENSEX', label: 'SENSEX' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtExpiry(d: string) {
  const dt = new Date(d + 'T00:00:00+05:30')
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtNum(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function fmtLtp(n: number): string {
  if (n <= 0) return '-'
  if (n < 10) return n.toFixed(2)
  return n.toFixed(1)
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OptionChainPage() {
  const [index, setIndex] = useState<Underlying>('NIFTY')
  const [expiries, setExpiries] = useState<string[]>([])
  const [expiry, setExpiry] = useState('')
  const [data, setData] = useState<OCUpdate | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const esRef = useRef<EventSource | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const scrolledOnce = useRef(false)

  // Fetch expiries
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    setExpiry('')

    fetch(`/api/options/expiries/${index}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const all: string[] = json?.data?.expiries || []
        // Rolling window: only next 4 upcoming expiries
        const today = new Date().toISOString().split('T')[0]
        const upcoming = all.filter(e => e >= today)
        const list = upcoming.slice(0, 4)
        setExpiries(list)
        if (list.length > 0) setExpiry(list[0])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [index])

  // SSE stream
  useEffect(() => {
    if (!expiry) return
    esRef.current?.close()

    const es = new EventSource(`/api/options/stream?underlying=${index}&expiry=${encodeURIComponent(expiry)}`)
    esRef.current = es

    es.onopen = () => setLive(true)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'update' && msg.data) setData(msg.data)
      } catch { /* */ }
    }
    es.onerror = () => { setLive(false); es.close() }

    return () => { es.close(); esRef.current = null; setLive(false) }
  }, [index, expiry])

  // Auto-scroll to ATM once
  useEffect(() => {
    if (data && tableRef.current && !scrolledOnce.current) {
      const el = tableRef.current.querySelector('[data-atm="true"]')
      if (el) { el.scrollIntoView({ block: 'center' }); scrolledOnce.current = true }
    }
  }, [data?.strikes?.length])

  // Reset scroll on index/expiry change
  useEffect(() => { scrolledOnce.current = false }, [index, expiry])

  // Filter strikes around spot
  const strikes = useMemo(() => {
    if (!data?.strikes?.length) return []
    const spot = data.spot
    // Show all strikes within range
    return data.strikes.filter(s => Math.abs(s.strike_price - spot) <= 2000)
  }, [data?.strikes, data?.spot])

  // ATM strike
  const atm = useMemo(() => {
    if (!data?.strikes?.length || !data.spot) return 0
    let best = data.strikes[0].strike_price
    let minD = Math.abs(best - data.spot)
    for (const s of data.strikes) {
      const d = Math.abs(s.strike_price - data.spot)
      if (d < minD) { minD = d; best = s.strike_price }
    }
    return best
  }, [data?.strikes, data?.spot])

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="sticky top-14 z-20 bg-white border-b border-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-3 py-2.5">
          {/* Index Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-2">
            {INDICES.map(ind => (
              <button
                key={ind.key}
                onClick={() => setIndex(ind.key)}
                className={cn(
                  'px-4 py-1.5 rounded text-sm font-semibold transition-colors whitespace-nowrap',
                  index === ind.key
                    ? 'bg-[#0d6efd] text-white'
                    : 'text-[#555] hover:bg-[#eee]'
                )}
              >
                {ind.label}
              </button>
            ))}

            {/* Live indicator */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {live && (
                <span className="flex items-center gap-1 text-[11px] text-[#0d6efd] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0d6efd] animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>

          {/* Expiry + Spot row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {expiries.map(e => (
                <button
                  key={e}
                  onClick={() => setExpiry(e)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
                    expiry === e ? 'bg-[#0d6efd] text-white' : 'text-[#666] hover:bg-[#eee]'
                  )}
                >
                  {fmtExpiry(e)}
                </button>
              ))}
            </div>

            {data && (
              <div className="ml-auto flex items-center gap-4 text-xs shrink-0">
                <span>
                  <span className="text-[#888]">Spot: </span>
                  <span className="font-bold text-[#111]">{data.spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </span>
                <span>
                  <span className="text-[#888]">PCR: </span>
                  <span className={cn('font-bold', data.pcr > 1 ? 'text-green-600' : 'text-red-500')}>
                    {data.pcr > 0 ? data.pcr.toFixed(2) : '-'}
                  </span>
                </span>
                <span>
                  <span className="text-[#888]">Max Pain: </span>
                  <span className="font-bold text-[#111]">{data.maxPainStrike > 0 ? data.maxPainStrike.toLocaleString('en-IN') : '-'}</span>
                </span>
                <span>
                  <span className="text-[#888]">CE OI: </span>
                  <span className="font-bold text-green-600">{fmtNum(data.totalCallOI)}</span>
                </span>
                <span>
                  <span className="text-[#888]">PE OI: </span>
                  <span className="font-bold text-red-500">{fmtNum(data.totalPutOI)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 px-2 sm:px-4 py-3 pb-20" ref={tableRef}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#888]">
            Loading option chain...
          </div>
        ) : strikes.length > 0 ? (
          <div className="bg-white border border-[#ddd] rounded overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_72px_1fr] text-[11px] font-semibold uppercase tracking-wide border-b-2 border-[#ddd] bg-[#f5f5f5]">
              <div className="grid grid-cols-5 text-center text-[#666] border-r border-[#ddd]">
                <span>OI Chg</span>
                <span>OI</span>
                <span>Volume</span>
                <span>IV</span>
                <span>LTP</span>
              </div>
              <div className="flex items-center justify-center text-[#333] font-bold text-xs">
                STRIKE
              </div>
              <div className="grid grid-cols-5 text-center text-[#666]">
                <span>LTP</span>
                <span>IV</span>
                <span>Volume</span>
                <span>OI</span>
                <span>OI Chg</span>
              </div>
            </div>

            {/* CE label */}
            <div className="grid grid-cols-[1fr_72px_1fr] text-[10px] font-bold border-b border-[#eee] bg-[#e8f5e9]">
              <div className="text-center text-green-700 py-1 border-r border-[#ddd]">CALLS (CE)</div>
              <div />
              <div className="text-center text-red-700 py-1 bg-[#fce4ec]">PUTS (PE)</div>
            </div>

            {/* Rows */}
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {strikes.map(s => {
                const ce = s.call_options.market_data
                const pe = s.put_options.market_data
                const ceIV = s.call_options.option_greeks?.iv || 0
                const peIV = s.put_options.option_greeks?.iv || 0
                const isATM = s.strike_price === atm
                const ceITM = s.strike_price < data!.spot
                const peITM = s.strike_price > data!.spot
                const ceOIChg = ce.oi - (ce.prev_oi || 0)
                const peOIChg = pe.oi - (pe.prev_oi || 0)

                return (
                  <div
                    key={s.strike_price}
                    data-atm={isATM ? 'true' : undefined}
                    className={cn(
                      'grid grid-cols-[1fr_72px_1fr] text-[11px] font-mono border-b border-[#f0f0f0] hover:bg-[#fafafa]',
                      isATM && 'bg-[#e3f2fd] border-y border-[#90caf9]'
                    )}
                  >
                    {/* CE Side */}
                    <div className={cn(
                      'grid grid-cols-5 items-center border-r border-[#ddd]',
                      ceITM && !isATM && 'bg-[#f1f8e9]'
                    )}>
                      <Cell val={ceOIChg} fmt="oiChg" />
                      <Cell val={ce.oi} fmt="num" />
                      <Cell val={ce.volume} fmt="num" />
                      <span className="text-center text-[#777]">{ceIV > 0 ? ceIV.toFixed(1) : '-'}</span>
                      <Cell val={ce.ltp} fmt="ltp" />
                    </div>

                    {/* Strike */}
                    <div className={cn(
                      'flex items-center justify-center font-bold text-xs py-1.5 border-r border-[#ddd]',
                      isATM ? 'text-[#1565c0] bg-[#e3f2fd]' : 'text-[#222]'
                    )}>
                      {s.strike_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>

                    {/* PE Side */}
                    <div className={cn(
                      'grid grid-cols-5 items-center',
                      peITM && !isATM && 'bg-[#fce4ec]'
                    )}>
                      <Cell val={pe.ltp} fmt="ltp" />
                      <span className="text-center text-[#777]">{peIV > 0 ? peIV.toFixed(1) : '-'}</span>
                      <Cell val={pe.volume} fmt="num" />
                      <Cell val={pe.oi} fmt="num" />
                      <Cell val={peOIChg} fmt="oiChg" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total Row */}
            <div className="grid grid-cols-[1fr_72px_1fr] text-[11px] font-bold border-t-2 border-[#ddd] bg-[#f5f5f5]">
              <div className="grid grid-cols-5 items-center border-r border-[#ddd]">
                <span />
                <span className="text-center text-green-700">{fmtNum(data?.totalCallOI || 0)}</span>
                <span className="text-center text-[#666]">Total CE OI</span>
                <span /><span />
              </div>
              <div />
              <div className="grid grid-cols-5 items-center">
                <span /><span />
                <span className="text-center text-[#666]">Total PE OI</span>
                <span className="text-center text-red-600">{fmtNum(data?.totalPutOI || 0)}</span>
                <span />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-[#888]">
            {live ? 'No data for this expiry' : 'Connecting...'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cell Renderer ──────────────────────────────────────────────────────────

function Cell({ val, fmt }: { val: number; fmt: 'ltp' | 'num' | 'oiChg' }) {
  if (fmt === 'ltp') {
    return (
      <span className={cn(
        'text-center font-semibold',
        val > 0 ? 'text-[#111]' : 'text-[#bbb]'
      )}>
        {fmtLtp(val)}
      </span>
    )
  }

  if (fmt === 'num') {
    return <span className="text-center text-[#333]">{val > 0 ? fmtNum(val) : '-'}</span>
  }

  // oiChg
  if (val === 0) return <span className="text-center text-[#ccc]">-</span>
  const up = val > 0
  return (
    <span className={cn('text-center', up ? 'text-green-600' : 'text-red-500')}>
      {up ? '+' : ''}{fmtNum(Math.abs(val))}
    </span>
  )
}