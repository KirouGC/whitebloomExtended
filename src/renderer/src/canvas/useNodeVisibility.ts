import { useEffect, useRef, useState } from 'react'

/**
 * Whether a node's element is on (or near) screen, via IntersectionObserver.
 *
 * Replaces per-frame viewport math (useViewport) in media nodes: that made every
 * image/video re-render on each pan/zoom frame, which made moving around the
 * board stutter. The observer only fires when visibility actually changes.
 */
export function useNodeVisibility<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>
  isVisible: boolean
} {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const root = element.closest<HTMLElement>('.react-flow') ?? null
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setIsVisible(entry.isIntersecting)
      },
      // Keep media loaded a bit beyond the edges (like the old 15% buffer).
      { root, rootMargin: '15%' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}
