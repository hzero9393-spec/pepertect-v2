'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { useTradeSuccess } from '@/components/pepertect/trade-success-popup'
import { TradeConfirmModal, TradeConfirmData } from '@/components/pepertect/ui/trade-confirm-modal'
import { X, Minus, Plus, ChevronDown } from 'lucide-react'

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

const INDICES: { key: Underlying; label: string; lotSize: number }[] = [
  { key: 'NIFTY', label: 'NIFTY 50', lotSize: 65 },
  { key: 'BANKNIFTY', label: 'BANKNIFTY', lotSize: 30 },
  { key: 'FINNIFTY', label: 'FINNIFTY', lotSize: 60 },
  { key: 'SENSEX', label: 'SENSEX', lotSize: 15 },
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

// ─── Trade Panel State ─────────────────────────────────────────────────────

interface TradeState {
  open: boolean
  side: 'BUY' | 'SELL'
  optionType: 'CE' | 'PE'
  strike: number
  ltp: number
  lots: number
  orderType: 'MARKET' | 'LIMIT'
  productType: 'INTRADAY' | 'DELIVERY'
  limitPrice: string
}

const defaultTrade: TradeState = {
  open: false, side: 'BUY', optionType: 'CE', strike: 0, ltp: 0,
  lots: 1, orderType: 'MARKET', productType: 'INTRADAY', limitPrice: '',
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

  // Trade state
  const [trade, setTrade] = useState<TradeState>(defaultTrade)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmData, setConfirmData] = useState<TradeConfirmData | null>(null)
  const [executing, setExecuting] = useState(false)

  const token = useAuthStore(s => s.token)
  const { showTradeSuccess } = useTradeSuccess()

  // Lot size for current index
  const lotSize = INDICES.find(i => i.key === index)?.lotSize || 50

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
  useEffect(() => { scrolledOnce.current = false }, [index, expiry])

  // Filter strikes
  const strikes = useMemo(() => {
    if (!data?.strikes?.length) return []
    return data.strikes.filter(s => Math.abs(s.strike_price - data.spot) <= 2000)
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

  // ── Trade Logic ──

  const openTrade = useCallback((optionType: 'CE' | 'PE', strike: number, ltp: number, side: 'BUY' | 'SELL') => {
    setTrade({
      ...defaultTrade,
      open: true,
      side,
      optionType,
      strike,
      ltp: ltp > 0 ? ltp : 0,
    })
  }, [])

  const totalQty = trade.lots * lotSize
  const fillPrice = trade.orderType === 'LIMIT' && trade.limitPrice
    ? parseFloat(trade.limitPrice) || 0
    : trade.ltp
  const totalValue = totalQty * fillPrice
  const brokerage = totalValue > 0 ? Math.max(20, Math.min(500, totalValue * 0.0005)) : 0

  const handleConfirm = useCallback(() => {
    if (!token || fillPrice <= 0) return

    setConfirmData({
      symbol: index,
      direction: trade.side,
      segment: 'OPTIONS',
      productType: trade.productType,
      orderType: trade.orderType,
      quantity: totalQty,
      price: fillPrice,
      totalValue: Math.round(totalValue * 100) / 100,
      brokerage: Math.round(brokerage * 100) / 100,
      availableBalance: 0, // will be checked server-side
      optionType: trade.optionType,
      strikePrice: trade.strike,
      lots: trade.lots,
      lotSize,
      expiryDate: expiry,
    })
    setConfirmOpen(true)
  }, [token, trade, fillPrice, totalQty, totalValue, brokerage, lotSize, index, expiry])

  const executeTrade = useCallback(async (): Promise<{
    success: boolean; message?: string; error?: string; orderId?: string; balance?: number; totalValue?: number; brokerage?: number
  }> => {
    if (!token) return { success: false, error: 'Not logged in' }

    const body: Record<string, unknown> = {
      symbol: index,
      direction: trade.side,
      orderType: trade.orderType,
      segment: 'OPTIONS',
      productType: trade.productType,
      quantity: totalQty,
      optionType: trade.optionType,
      strikePrice: trade.strike,
      lots: trade.lots,
      lotSize,
      expiryDate: expiry,
      ltp: trade.ltp, // Pass LTP for live option chain trades
    }

    if (trade.orderType === 'LIMIT' && trade.limitPrice) {
      body.price = parseFloat(trade.limitPrice)
    }

    try {
      const res = await fetch('/api/trade/place', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        showTradeSuccess({
          symbol: `${index} ${trade.strike} ${trade.optionType}`,
          type: trade.side,
          qty: totalQty,
          price: fillPrice,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase(),
          orderId: data.order?.id?.slice(-8).toUpperCase() || 'N/A',
          segment: 'OPTIONS',
          optionType: trade.optionType,
          strikePrice: trade.strike,
          totalValue: data.order?.totalValue,
          brokerage: data.order?.brokerage,
        })
        setTrade(defaultTrade)
        return { success: true, orderId: data.order?.id?.slice(-8).toUpperCase(), balance: data.balance, totalValue: data.order?.totalValue, brokerage: data.order?.brokerage }
      } else {
        return { success: false, error: data.error || 'Trade failed' }
      }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [token, trade, fillPrice, totalQty, lotSize, index, expiry, showTradeSuccess])

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* ── Top Bar ── */}
      <div className="sticky top-14 z-20 bg-white border-b border-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-3 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-2">
            {INDICES.map(ind => (
              <button
                key={ind.key}
                onClick={() => setIndex(ind.key)}
                className={cn(
                  'px-4 py-1.5 rounded text-sm font-semibold transition-colors whitespace-nowrap',
                  index === ind.key ? 'bg-[#0d6efd] text-white' : 'text-[#555] hover:bg-[#eee]'
                )}
              >
                {ind.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {live && (
                <span className="flex items-center gap-1 text-[11px] text-[#0d6efd] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0d6efd] animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>

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
                <span><span className="text-[#888]">Spot: </span><span className="font-bold text-[#111]">{data.spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                <span><span className="text-[#888]">PCR: </span><span className={cn('font-bold', data.pcr > 1 ? 'text-green-600' : 'text-red-500')}>{data.pcr > 0 ? data.pcr.toFixed(2) : '-'}</span></span>
                <span><span className="text-[#888]">Max Pain: </span><span className="font-bold text-[#111]">{data.maxPainStrike > 0 ? data.maxPainStrike.toLocaleString('en-IN') : '-'}</span></span>
                <span className="hidden sm:inline"><span className="text-[#888]">CE OI: </span><span className="font-bold text-green-600">{fmtNum(data.totalCallOI)}</span></span>
                <span className="hidden sm:inline"><span className="text-[#888]">PE OI: </span><span className="font-bold text-red-500">{fmtNum(data.totalPutOI)}</span></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 px-2 sm:px-4 py-3 pb-4" ref={tableRef}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#888]">Loading option chain...</div>
        ) : strikes.length > 0 ? (
          <div className="bg-white border border-[#ddd] rounded overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_72px_1fr] text-[11px] font-semibold uppercase tracking-wide border-b-2 border-[#ddd] bg-[#f5f5f5]">
              <div className="grid grid-cols-5 text-center text-[#666] border-r border-[#ddd]">
                <span>OI Chg</span><span>OI</span><span>Volume</span><span>IV</span><span>LTP</span>
              </div>
              <div className="flex items-center justify-center text-[#333] font-bold text-xs">STRIKE</div>
              <div className="grid grid-cols-5 text-center text-[#666]">
                <span>LTP</span><span>IV</span><span>Volume</span><span>OI</span><span>OI Chg</span>
              </div>
            </div>

            {/* CE/PE labels */}
            <div className="grid grid-cols-[1fr_72px_1fr] text-[10px] font-bold border-b border-[#eee]">
              <div className="text-center text-green-700 py-1 border-r border-[#ddd] bg-[#e8f5e9]">CALLS (CE)</div>
              <div />
              <div className="text-center text-red-700 py-1 bg-[#fce4ec]">PUTS (PE)</div>
            </div>

            {/* Rows */}
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
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
                      'grid grid-cols-[1fr_72px_1fr] text-[11px] font-mono border-b border-[#f0f0f0] hover:bg-[#f0f7ff]',
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
                      {/* CE LTP — clickable */}
                      <button
                        className="text-center font-semibold text-[#111] hover:text-[#0d6efd] hover:underline cursor-pointer"
                        onClick={() => openTrade('CE', s.strike_price, ce.ltp, 'BUY')}
                      >
                        {fmtLtp(ce.ltp)}
                      </button>
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
                      {/* PE LTP — clickable */}
                      <button
                        className="text-center font-semibold text-[#111] hover:text-[#d32f2f] hover:underline cursor-pointer"
                        onClick={() => openTrade('PE', s.strike_price, pe.ltp, 'BUY')}
                      >
                        {fmtLtp(pe.ltp)}
                      </button>
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

      {/* ═══ Trade Panel (Bottom Sheet) ═══ */}
      {trade.open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTrade(defaultTrade)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#ddd]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-[#eee]">
              <div>
                <p className="text-sm font-bold text-[#111]">
                  {index} {trade.strike} {trade.optionType}
                </p>
                <p className="text-[11px] text-[#888]">
                  Expiry: {fmtExpiry(expiry)} &middot; Lot Size: {lotSize} &middot; LTP: {'\u20B9'}{fmtLtp(trade.ltp)}
                </p>
              </div>
              <button onClick={() => setTrade(defaultTrade)} className="p-1.5 rounded-full hover:bg-[#f5f5f5]">
                <X className="size-5 text-[#666]" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-3">
              {/* Buy / Sell Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTrade(t => ({ ...t, side: 'BUY' }))}
                  className={cn(
                    'py-2.5 rounded-lg text-sm font-bold transition-colors',
                    trade.side === 'BUY' ? 'bg-[#00c853] text-white' : 'bg-[#f5f5f5] text-[#666]'
                  )}
                >
                  BUY {trade.optionType}
                </button>
                <button
                  onClick={() => setTrade(t => ({ ...t, side: 'SELL' }))}
                  className={cn(
                    'py-2.5 rounded-lg text-sm font-bold transition-colors',
                    trade.side === 'SELL' ? 'bg-[#ff1744] text-white' : 'bg-[#f5f5f5] text-[#666]'
                  )}
                >
                  SELL {trade.optionType}
                </button>
              </div>

              {/* Order Type + Product Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Order Type</label>
                  <div className="relative">
                    <select
                      value={trade.orderType}
                      onChange={e => setTrade(t => ({ ...t, orderType: e.target.value as 'MARKET' | 'LIMIT' }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-[#ddd] text-sm font-medium bg-white appearance-none pr-8"
                    >
                      <option value="MARKET">Market</option>
                      <option value="LIMIT">Limit</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-[#888] pointer-events-none mt-0.5" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Product</label>
                  <div className="relative">
                    <select
                      value={trade.productType}
                      onChange={e => setTrade(t => ({ ...t, productType: e.target.value as 'INTRADAY' | 'DELIVERY' }))}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-[#ddd] text-sm font-medium bg-white appearance-none pr-8"
                    >
                      <option value="INTRADAY">Intraday</option>
                      <option value="DELIVERY">Delivery</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-[#888] pointer-events-none mt-0.5" />
                  </div>
                </div>
              </div>

              {/* Limit Price (only for LIMIT orders) */}
              {trade.orderType === 'LIMIT' && (
                <div>
                  <label className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">Limit Price</label>
                  <input
                    type="number"
                    value={trade.limitPrice}
                    onChange={e => setTrade(t => ({ ...t, limitPrice: e.target.value }))}
                    placeholder={String(trade.ltp)}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#ddd] text-sm font-mono"
                    step="0.05"
                  />
                </div>
              )}

              {/* Quantity (Lots) */}
              <div>
                <label className="text-[10px] font-semibold text-[#888] uppercase tracking-wide">
                  Quantity ({trade.lots} lot{trade.lots > 1 ? 's' : ''} = {totalQty} qty)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setTrade(t => ({ ...t, lots: Math.max(1, t.lots - 1) }))}
                    className="w-10 h-10 rounded-lg border border-[#ddd] flex items-center justify-center hover:bg-[#f5f5f5] active:bg-[#eee]"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    value={trade.lots}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 1
                      setTrade(t => ({ ...t, lots: Math.max(1, Math.min(v, 100)) }))
                    }}
                    className="flex-1 text-center text-lg font-bold font-mono py-2 rounded-lg border border-[#ddd]"
                    min={1}
                    max={100}
                  />
                  <button
                    onClick={() => setTrade(t => ({ ...t, lots: Math.min(100, t.lots + 1) }))}
                    className="w-10 h-10 rounded-lg border border-[#ddd] flex items-center justify-center hover:bg-[#f5f5f5] active:bg-[#eee]"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-[#f8f9fa] rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#888]">Price</span>
                  <span className="font-mono font-semibold">
                    {trade.orderType === 'LIMIT' && trade.limitPrice ? parseFloat(trade.limitPrice).toFixed(2) : fmtLtp(trade.ltp)}
                    {trade.orderType === 'MARKET' && <span className="text-[#aaa] ml-1">(MKT)</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">Total Value</span>
                  <span className="font-mono font-semibold">{'\u20B9'}{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888]">Brokerage</span>
                  <span className="font-mono">{'\u20B9'}{Math.round(brokerage * 100) / 100}</span>
                </div>
                {trade.side === 'SELL' && (
                  <div className="flex justify-between text-red-600">
                    <span>Margin Required (150%)</span>
                    <span className="font-mono font-semibold">{'\u20B9'}{(totalValue * 1.5).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={handleConfirm}
                disabled={fillPrice <= 0 || !token}
                className={cn(
                  'w-full py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-40',
                  trade.side === 'BUY' ? 'bg-[#00c853] hover:bg-[#00b248] active:bg-[#009e40]' : 'bg-[#ff1744] hover:bg-[#e51539] active:bg-[#cc1233]'
                )}
              >
                {!token ? 'Login to Trade' : `${trade.side} ${trade.lots} Lot (${totalQty} Qty)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <TradeConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tradeData={confirmData}
        onConfirm={executeTrade}
      />
    </div>
  )
}

// ─── Cell Renderer ──────────────────────────────────────────────────────────

function Cell({ val, fmt }: { val: number; fmt: 'ltp' | 'num' | 'oiChg' }) {
  if (fmt === 'num') {
    return <span className="text-center text-[#333]">{val > 0 ? fmtNum(val) : '-'}</span>
  }

  if (fmt === 'oiChg') {
    if (val === 0) return <span className="text-center text-[#ccc]">-</span>
    const up = val > 0
    return (
      <span className={cn('text-center', up ? 'text-green-600' : 'text-red-500')}>
        {up ? '+' : ''}{fmtNum(Math.abs(val))}
      </span>
    )
  }

  return <span className="text-center text-[#ccc]">-</span>
}