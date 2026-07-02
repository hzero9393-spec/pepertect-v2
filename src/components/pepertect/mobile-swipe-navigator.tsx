'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAppStore, type PageId } from '@/lib/store'

// Pages in swipe order (same as mobile nav bar)
const SWIPE_PAGES: PageId[] = ['dashboard', 'trading', 'watchlist', 'positions', 'orders']

const SWIPE_THRESHOLD = 60       // min px to trigger navigation
const RUBBER_BAND_MAX = 40       // max px of drag feedback
const ANIM_DURATION = 220        // ms for slide animation
const VELOCITY_THRESHOLD = 0.3   // px/ms — fast flick detection

function getSwipeIndex(page: PageId): number {
  return SWIPE_PAGES.indexOf(page)
}

export function MobileSwipeNavigator({ children }: { children: ReactNode }) {
  const { currentPage, setCurrentPage } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const isSwiping = useRef(false)
  const isAnimating = useRef(false)

  // Drag offset for rubber-band effect
  const [dragOffset, setDragOffset] = useState(0)

  // Slide animation state
  const [slideAnim, setSlideAnim] = useState<'idle' | 'slide-out-left' | 'slide-out-right' | 'slide-in-left' | 'slide-in-right'>('idle')

  const currentIndex = getSwipeIndex(currentPage)
  const isSwipeable = currentIndex >= 0

  // Lock body scroll during animation
  useEffect(() => {
    if (slideAnim !== 'idle') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [slideAnim])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isAnimating.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    isSwiping.current = false
  }, [isSwipeable])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isAnimating.current) return

    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)

    // Once vertical scroll is detected, don't interfere
    if (deltaY > Math.abs(deltaX) && !isSwiping.current) return

    // If already scrolling vertically, skip
    if (isSwiping.current === false && deltaY > 10) return

    isSwiping.current = true

    // Apply rubber-band effect — clamp and dampen
    let offset = deltaX
    const atStart = currentIndex === 0 && deltaX > 0
    const atEnd = currentIndex === SWIPE_PAGES.length - 1 && deltaX < 0

    if (atStart || atEnd) {
      // Dampen at edges (rubber band)
      offset = deltaX * 0.25
    }

    // Clamp
    offset = Math.max(-RUBBER_BAND_MAX, Math.min(RUBBER_BAND_MAX, offset))
    setDragOffset(offset)
  }, [isSwipeable, currentIndex])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwipeable || isAnimating.current) {
      setDragOffset(0)
      return
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    const elapsed = Date.now() - touchStartTime.current
    const velocity = Math.abs(deltaX) / elapsed

    // Reset drag
    setDragOffset(0)

    // Not a valid swipe
    if (!isSwiping.current) return
    if (Math.abs(deltaX) < SWIPE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return

    isSwiping.current = false
    isAnimating.current = true

    if (deltaX < 0 && currentIndex < SWIPE_PAGES.length - 1) {
      // Swipe LEFT → go to NEXT page
      setSlideAnim('slide-out-left')
      setTimeout(() => {
        setCurrentPage(SWIPE_PAGES[currentIndex + 1])
        setSlideAnim('slide-in-left')
        setTimeout(() => {
          setSlideAnim('idle')
          isAnimating.current = false
        }, ANIM_DURATION)
      }, ANIM_DURATION)
    } else if (deltaX > 0 && currentIndex > 0) {
      // Swipe RIGHT → go to PREVIOUS page
      setSlideAnim('slide-out-right')
      setTimeout(() => {
        setCurrentPage(SWIPE_PAGES[currentIndex - 1])
        setSlideAnim('slide-in-right')
        setTimeout(() => {
          setSlideAnim('idle')
          isAnimating.current = false
        }, ANIM_DURATION)
      }, ANIM_DURATION)
    } else {
      isAnimating.current = false
    }
  }, [isSwipeable, currentIndex, setCurrentPage])

  // Don't wrap non-swipeable pages
  if (!isSwipeable) return <>{children}</>

  // Compute transform based on animation state + drag
  let transform = `translateX(${dragOffset}px)`
  let transition = 'transform 80ms ease-out'
  let opacity = '1'

  if (slideAnim === 'slide-out-left') {
    transform = 'translateX(-100%)'
    transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_DURATION}ms ease`
    opacity = '0.6'
  } else if (slideAnim === 'slide-out-right') {
    transform = 'translateX(100%)'
    transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_DURATION}ms ease`
    opacity = '0.6'
  } else if (slideAnim === 'slide-in-left') {
    transform = 'translateX(100%)'
    transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_DURATION}ms ease`
    opacity = '0.6'
  } else if (slideAnim === 'slide-in-right') {
    transform = 'translateX(-100%)'
    transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_DURATION}ms ease`
    opacity = '0.6'
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
        style={{
          transform,
          transition,
          opacity,
          willChange: slideAnim !== 'idle' ? 'transform, opacity' : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}