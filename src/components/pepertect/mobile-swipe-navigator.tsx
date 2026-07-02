'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAppStore, type PageId } from '@/lib/store'

// Pages in swipe order (same as mobile nav bar)
const SWIPE_PAGES: PageId[] = ['dashboard', 'trading', 'watchlist', 'positions', 'orders']

const SWIPE_THRESHOLD = 50       // min px to trigger
const RUBBER_BAND_MAX = 35       // max px of drag feedback
const EXIT_DURATION = 160        // ms — current page exits
const ENTER_DURATION = 180       // ms — new page enters
const VELOCITY_THRESHOLD = 0.35  // px/ms — fast flick

function getSwipeIndex(page: PageId): number {
  return SWIPE_PAGES.indexOf(page)
}

type AnimPhase = 'idle' | 'exit-left' | 'exit-right' | 'enter-from-right' | 'enter-from-left'

export function MobileSwipeNavigator({ children }: { children: ReactNode }) {
  const { currentPage, setCurrentPage } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const isSwiping = useRef(false)
  const isLocked = useRef(false)

  const [dragOffset, setDragOffset] = useState(0)
  const [phase, setPhase] = useState<AnimPhase>('idle')

  const currentIndex = getSwipeIndex(currentPage)
  const isSwipeable = currentIndex >= 0

  // Lock scroll during animation
  useEffect(() => {
    if (phase !== 'idle') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [phase])

  // ── Touch Handlers ──────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isLocked.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    isSwiping.current = false
  }, [isSwipeable])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isLocked.current) return

    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)

    // Don't interfere with vertical scroll
    if (dy > Math.abs(dx) && !isSwiping.current) return
    if (!isSwiping.current && dy > 8) return

    isSwiping.current = true

    // Rubber-band at edges
    let offset = dx
    if ((currentIndex === 0 && dx > 0) || (currentIndex === SWIPE_PAGES.length - 1 && dx < 0)) {
      offset = dx * 0.2
    }
    offset = Math.max(-RUBBER_BAND_MAX, Math.min(RUBBER_BAND_MAX, offset))
    setDragOffset(offset)
  }, [isSwipeable, currentIndex])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isLocked.current) {
      setDragOffset(0)
      return
    }

    const dx = e.changedTouches[0].clientX - touchStartX.current
    const elapsed = Date.now() - touchStartTime.current
    const velocity = Math.abs(dx) / elapsed

    setDragOffset(0)

    if (!isSwiping.current) return
    if (Math.abs(dx) < SWIPE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return

    isSwiping.current = false
    isLocked.current = true

    if (dx < 0 && currentIndex < SWIPE_PAGES.length - 1) {
      // ── Swipe LEFT → NEXT page ──
      setPhase('exit-left')
      // After exit animation finishes, switch page + enter from right
      setTimeout(() => {
        setCurrentPage(SWIPE_PAGES[currentIndex + 1])
        setPhase('enter-from-right')
      }, EXIT_DURATION)
    } else if (dx > 0 && currentIndex > 0) {
      // ── Swipe RIGHT → PREVIOUS page ──
      setPhase('exit-right')
      setTimeout(() => {
        setCurrentPage(SWIPE_PAGES[currentIndex - 1])
        setPhase('enter-from-left')
      }, EXIT_DURATION)
    } else {
      isLocked.current = false
    }
  }, [isSwipeable, currentIndex, setCurrentPage])

  // ── Handle enter animation end ──
  const handleAnimEnd = useCallback(() => {
    if (phase === 'enter-from-right' || phase === 'enter-from-left') {
      setPhase('idle')
      isLocked.current = false
    }
  }, [phase])

  // Non-swipeable pages: pass through
  if (!isSwipeable) return <>{children}</>

  // ── Compute styles per phase ──
  let animClass = ''
  let inlineTransform = ''
  let inlineTransition = ''

  if (phase === 'idle') {
    // Drag follows finger
    if (dragOffset !== 0) {
      inlineTransform = `translateX(${dragOffset}px)`
      inlineTransition = 'transform 60ms ease-out'
    }
  } else if (phase === 'exit-left') {
    animClass = 'swipe-exit-left'
  } else if (phase === 'exit-right') {
    animClass = 'swipe-exit-right'
  } else if (phase === 'enter-from-right') {
    animClass = 'swipe-enter-right'
  } else if (phase === 'enter-from-left') {
    animClass = 'swipe-enter-left'
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="md:hidden"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className={animClass}
        style={{
          transform: inlineTransform || undefined,
          transition: inlineTransition || undefined,
          willChange: phase !== 'idle' ? 'transform, opacity' : 'auto',
          animationFillMode: 'forwards',
        }}
        onAnimationEnd={handleAnimEnd}
      >
        {children}
      </div>
    </div>
  )
}