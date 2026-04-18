import { useEffect, useRef } from 'react'

export function useScrollReveal(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            if (options.once !== false) observer.unobserve(entry.target)
          } else if (options.once === false) {
            entry.target.classList.remove('is-visible')
          }
        })
      },
      { threshold: options.threshold ?? 0.15 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options.threshold, options.once])

  return ref
}

export function useRevealChildren(options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const kids = Array.from(el.querySelectorAll('[data-reveal]'))

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = kids.indexOf(entry.target)
            entry.target.style.transitionDelay = `${idx * (options.stagger ?? 80)}ms`
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: options.threshold ?? 0.15 },
    )

    kids.forEach((k) => observer.observe(k))
    return () => observer.disconnect()
  }, [options.stagger, options.threshold])

  return ref
}
