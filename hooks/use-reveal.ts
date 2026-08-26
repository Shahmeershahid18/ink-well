'use client'

import * as React from 'react'

/**
 * Plays the `.reveal` animation once, when an element scrolls into view.
 * Returns a ref for the container; every `.reveal` inside it is observed.
 *
 * The hiding is applied by this hook, never by the stylesheet alone — so content
 * is visible by default and only becomes hidden once we know we can un-hide it.
 * No script, no IntersectionObserver, reduced motion, printing: everything still
 * reads.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T | null>(null)

  React.useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    if (!targets.length) return

    const reveal = (el: HTMLElement) => {
      el.removeAttribute('data-reveal')
      el.setAttribute('data-visible', 'true')
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      targets.forEach(reveal)
      return
    }

    // Hide first, then let the observer bring each one back.
    targets.forEach((el) => el.setAttribute('data-reveal', 'pending'))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement)
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )

    // Anything already on screen animates on the next frame; the rest waits for scroll.
    const frame = requestAnimationFrame(() => {
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) reveal(el)
        else observer.observe(el)
      })
    })

    // A safety net: nothing should still be hidden a few seconds after load.
    const failsafe = window.setTimeout(() => {
      targets.forEach((el) => {
        if (el.getAttribute('data-reveal') === 'pending' && el.getBoundingClientRect().top < window.innerHeight) {
          reveal(el)
        }
      })
    }, 3000)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(failsafe)
      observer.disconnect()
    }
  }, [])

  return ref
}
