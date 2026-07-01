'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { formatNumber, formatINR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Radio,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface OCStrike {
  strike_price: number
  pcr: number
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

const INDEX_INFO: Record<Underlying, { name: string; color: string; lotSize: number }> = {
  NIFTY: { name: 'NIFTY 50', color: '#00B386', lotSize: 50 },
  BANKNIFTY: { name: 'BANK NIFTY', color: '#6366F1', lotSize: 25 },
  FINNIFTY: { name: 'FINNIFTY', color: '#F59E0B', lotSize: 40 },
  SENSEX: { name: 'SENSEX', color: '#EF4444', lotSize: 15 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatExpiry(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+05:30')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatVolume(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr'
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-[#e5e7eb] rounded-xl p-3 sm:p-4 min-w-[120px]">
      <p className="text-[10px] sm:text-xs font-semibold text-[#6b7280] tracking-wider uppercase mb-1">{label}</p>
      <p className="text-base sm:text-lg font-bold font-mono font-tabular" style={{ color: color || '#1a1a1a' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#9ca3af] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function OptionChainPage() {
  const [selectedUnderlying, setSelectedUnderlying] = useState<Underlying>('NIFTY')
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState<string>('')
  const [data, setData] = useState<OCUpdate | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const esRef = useRef<EventSource | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const [atmRowId, setAtmRowId] = useState<string>('')

  // Fetch expiries when underlying changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)

    fetch(`/api/options/expiries/${selectedUnderlying}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const exps: string[] = json?.data?.expiries || []
        setExpiries(exps)
        if (exps.length > 0) {
          setSelectedExpiry(exps[0])
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [selectedUnderlying])

  // Connect to SSE stream
  useEffect(() => {
    if (!selectedExpiry) return

    // Close existing connection
    esRef.current?.close()

    const es = new EventSource(`/api/options/stream?underlying=${selectedUnderlying}&expiry=${encodeURIComponent(selectedExpiry)}`)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'update' && msg.data) {
          setData(msg.data)
          setLastUpdate(Date.now())
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [selectedUnderlying, selectedExpiry])

  // Scroll to ATM on first data load
  useEffect(() => {
    if (data && tableRef.current) {
      const atmEl = tableRef.current.querySelector('[data-atm="true"]')
      if (atmEl) {
        atmEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [data?.strikes?.length])

  // Filtered strikes around ATM (±20 strikes)
  const displayStrikes = useMemo(() => {
    if (!data?.strikes?.length) return []
    const spot = data.spot
    return data.strikes.filter(s => Math.abs(s.strike_price - spot) <= 2000)
  }, [data?.strikes, data?.spot])

  // Find ATM strike
  const atmStrike = useMemo(() => {
    if (!data?.strikes?.length || !data.spot) return 0
    let closest = data.strikes[0].strike_price
    let minDiff = Math.abs(data.strikes[0].strike_price - data.spot)
    for (const s of data.strikes) {
      const diff = Math.abs(s.strike_price - data.spot)
      if (diff < minDiff) { minDiff = diff; closest = s.strike_price }
    }
    return closest
  }, [data?.strikes, data?.spot])

  const info = INDEX_INFO[selectedUnderlying]
  const spotChange = data ? data.spot - (data.strikes[0]?.underlying_spot_price || data.spot) : 0

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ═══ Header ═════════════════════════════════════════════════════════ */}
      <div className="sticky top-14 md:top-14 z-20 bg-white border-b border-[#e5e7eb]">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          {/* Top row: Title + connection status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: `${info.color}15` }}>
                <Activity className="size-4" style={{ color: info.color }} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#1a1a1a]">Option Chain</h1>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#00B386]">
                      <Radio className="size-3 animate-pulse" /> LIVE 1s
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                      <WifiOff className="size-3" /> Connecting...
                    </span>
                  )}
                  {lastUpdate > 0 && (
                    <span className="text-[10px] text-[#9ca3af]">
                      Updated {new Date(lastUpdate).toLocaleTimeString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Spot Price */}
            {data && (
              <div className="text-right">
                <p className="text-xl font-bold font-mono font-tabular text-[#1a1a1a]">
                  {data.spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={cn('text-xs font-semibold', data.pcr > 1 ? 'text-[#00B386]' : 'text-[#EB5B3C]')}>
                  {data.pcr > 0 ? `PCR: ${data.pcr.toFixed(2)}` : 'PCR: --'}
                </p>
              </div>
            )}
          </div>

          {/* Index Selector */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {(Object.keys(INDEX_INFO) as Underlying[]).map((key) => {
              const i = INDEX_INFO[key]
              const active = selectedUnderlying === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedUnderlying(key)}
                  className={cn(
                    'px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border',
                    active
                      ? 'text-white border-transparent shadow-sm'
                      : 'text-[#4b5563] border-[#e5e7eb] hover:bg-[#f5f5f5]'
                  )}
                  style={active ? { background: i.color } : {}}
                >
                  {i.name}
                </button>
              )
            })}
          </div>

          {/* Expiry Selector */}
          {expiries.length > 0 && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-semibold text-[#9ca3af] shrink-0">EXPIRY:</span>
              {expiries.map((exp) => (
                <button
                  key={exp}
                  onClick={() => setSelectedExpiry(exp)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap',
                    selectedExpiry === exp
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#6b7280] hover:bg-[#f5f5f5]'
                  )}
                >
                  {formatExpiry(exp)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Summary Cards ═══════════════════════════════════════════════════ */}
      {data && (
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <SummaryCard label="Spot Price" value={formatINR(data.spot)} color={info.color} />
            <SummaryCard label="PCR" value={data.pcr > 0 ? data.pcr.toFixed(2) : '--'} color={data.pcr > 1 ? '#00B386' : '#EB5B3C'} sub={data.pcr > 1 ? 'Bullish' : 'Bearish'} />
            <SummaryCard label="Total Call OI" value={formatVolume(data.totalCallOI)} sub={`${info.lotSize} lot size`} />
            <SummaryCard label="Total Put OI" value={formatVolume(data.totalPutOI)} />
            <SummaryCard label="Max Pain" value={data.maxPainStrike > 0 ? formatINR(data.maxPainStrike) : '--'} color="#F59E0B" />
            <SummaryCard label="ATM Strike" value={atmStrike.toLocaleString('en-IN')} />
          </div>
        </div>
      )}

      {/* ═══ Option Chain Table ═══════════════════════════════════════════════ */}
      <div className="px-2 sm:px-4 lg:px-6 pb-20" ref={tableRef}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                <div className="size-2 rounded-full bg-[#00D09C] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="size-2 rounded-full bg-[#00D09C] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="size-2 rounded-full bg-[#00D09C] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-[#6b7280]">Loading option chain...</span>
            </div>
          </div>
        ) : displayStrikes.length > 0 ? (
          <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_1fr] text-[10px] font-bold uppercase tracking-wider border-b border-[#e5e7eb] bg-[#f9fafb]">
              {/* CE Header */}
              <div className="grid grid-cols-4 px-2 py-2.5 text-[#6b7280] border-r border-[#e5e7eb]">
                <span className="text-center">OI Chg</span>
                <span className="text-center">OI</span>
                <span className="text-center">Vol</span>
                <span className="text-center">IV</span>
                <span className="text-center">LTP</span>
                <span className="text-center">Chg</span>
              </div>
              {/* Strike Header */}
              <div className="px-3 py-2.5 text-center text-[#1a1a1a] font-bold bg-[#f9fafb] min-w-[80px]">
                STRIKE
              </div>
              {/* PE Header */}
              <div className="grid grid-cols-6 px-2 py-2.5 text-[#6b7280]">
                <span className="text-center">Chg</span>
                <span className="text-center">LTP</span>
                <span className="text-center">IV</span>
                <span className="text-center">Vol</span>
                <span className="text-center">OI</span>
                <span className="text-center">OI Chg</span>
              </div>
            </div>

            {/* Rows */}
            <div className="max-h-[65vh] overflow-y-auto">
              {displayStrikes.map((strike) => {
                const ce = strike.call_options.market_data
                const pe = strike.put_options.market_data
                const ceGreeks = strike.call_options.option_greeks
                const peGreeks = strike.put_options.option_greeks
                const isATM = strike.strike_price === atmStrike
                const isITMCall = strike.strike_price < data!.spot
                const isITMPut = strike.strike_price > data!.spot
                const ceChg = ce.close_price > 0 ? ce.ltp - ce.close_price : 0
                const peChg = pe.close_price > 0 ? pe.ltp - pe.close_price : 0
                const ceOIChg = ce.oi - ce.prev_oi
                const peOIChg = pe.oi - pe.prev_oi

                return (
                  <div
                    key={strike.strike_price}
                    data-atm={isATM ? 'true' : undefined}
                    id={`strike-${strike.strike_price}`}
                    className={cn(
                      'grid grid-cols-[1fr_auto_1fr] text-[11px] sm:text-xs font-mono font-tabular border-b border-[#f3f4f6] hover:bg-[#f9fafb]/80 transition-colors',
                      isATM && 'bg-[#00D09C]/5 border-y border-[#00D09C]/20',
                    )}
                  >
                    {/* CE Side */}
                    <div className={cn(
                      'grid grid-cols-6 px-2 py-1.5 items-center border-r border-[#e5e7eb]',
                      isITMCall && 'bg-[#00B386]/[0.03]'
                    )}>
                      <OIBadge value={ceOIChg} className="text-center" />
                      <span className="text-center text-[#1a1a1a]">{formatVolume(ce.oi)}</span>
                      <span className="text-center text-[#4b5563]">{formatVolume(ce.volume)}</span>
                      <span className="text-center text-[#6b7280]">{ceGreeks.iv > 0 ? ceGreeks.iv.toFixed(1) : '-'}</span>
                      <span className="text-center font-semibold text-[#1a1a1a]">{ce.ltp > 0 ? ce.ltp.toFixed(1) : '-'}</span>
                      <ChangeBadge value={ceChg} className="text-center" />
                    </div>

                    {/* Strike */}
                    <div className={cn(
                      'px-2 sm:px-3 py-1.5 text-center font-bold text-sm border-r border-[#e5e7eb]',
                      isATM ? 'text-[#00A67E] bg-[#00D09C]/10' : 'text-[#1a1a1a]'
                    )}>
                      {strike.strike_price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      {isATM && <div className="text-[8px] font-bold text-[#00D09C]">ATM</div>}
                    </div>

                    {/* PE Side */}
                    <div className={cn(
                      'grid grid-cols-6 px-2 py-1.5 items-center',
                      isITMPut && 'bg-[#EB5B3C]/[0.03]'
                    )}>
                      <ChangeBadge value={peChg} className="text-center" />
                      <span className="text-center font-semibold text-[#1a1a1a]">{pe.ltp > 0 ? pe.ltp.toFixed(1) : '-'}</span>
                      <span className="text-center text-[#6b7280]">{peGreeks.iv > 0 ? peGreeks.iv.toFixed(1) : '-'}</span>
                      <span className="text-center text-[#4b5563]">{formatVolume(pe.volume)}</span>
                      <span className="text-center text-[#1a1a1a]">{formatVolume(pe.oi)}</span>
                      <OIBadge value={peOIChg} className="text-center" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Table Footer */}
            <div className="grid grid-cols-[1fr_auto_1fr] text-[10px] font-bold border-t-2 border-[#e5e7eb] bg-[#f9fafb]">
              <div className="grid grid-cols-6 px-2 py-2 border-r border-[#e5e7eb] text-[#00B386]">
                <span /> {/* OI Chg */}
                <span className="text-center">{formatVolume(data?.totalCallOI || 0)}</span>
                <span className="text-center font-semibold text-[#6b7280]">CALLS</span>
                <span /><span /><span />
              </div>
              <div className="px-3 py-2 text-center text-[#1a1a1a] font-bold text-[10px]">
                TOTAL
              </div>
              <div className="grid grid-cols-6 px-2 py-2 text-[#EB5B3C]">
                <span /><span /><span />
                <span className="text-center font-semibold text-[#6b7280]">PUTS</span>
                <span className="text-center">{formatVolume(data?.totalPutOI || 0)}</span>
                <span />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-[#6b7280] text-sm">
            {connected ? 'No option chain data available for this expiry' : 'Connecting to live data...'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Small Components ───────────────────────────────────────────────────────

function ChangeBadge({ value, className }: { value: number; className?: string }) {
  if (value === 0) return <span className={className}>-</span>
  const isUp = value > 0
  return (
    <span className={cn(className, 'font-semibold', isUp ? 'text-[#00B386]' : 'text-[#EB5B3C]')}>
      {isUp ? '+' : ''}{value.toFixed(1)}
    </span>
  )
}

function OIBadge({ value, className }: { value: number; className?: string }) {
  if (value === 0) return <span className={className}>-</span>
  const isUp = value > 0
  return (
    <span className={cn(className, isUp ? 'text-[#00B386]' : 'text-[#EB5B3C]')}>
      {isUp ? '+' : ''}{formatVolume(Math.abs(value))}
    </span>
  )
}