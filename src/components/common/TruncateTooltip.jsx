import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// One floating tooltip for truncated text. Any element with `data-full` shows
// its full text on hover/focus -- but only when it is actually cut off -- in a
// fixed-position bubble, so overflow:hidden parents can't clip it. Same look
// as the portal's [data-tip] tooltips.
export default function TruncateTooltip() {
  const [tip, setTip] = useState(null)
  useEffect(() => {
    const show = (e) => {
      const el = e.target.closest?.('[data-full]')
      if (!el) return
      const target = el.querySelector('.tf-chip-name') || el
      if (target.scrollWidth <= target.clientWidth + 1) return
      const r = el.getBoundingClientRect()
      setTip({ text: el.getAttribute('data-full'), x: r.left + r.width / 2, y: r.bottom + 6 })
    }
    const hide = (e) => {
      if (e.target.closest?.('[data-full]')) setTip(null)
    }
    document.addEventListener('mouseover', show)
    document.addEventListener('focusin', show)
    document.addEventListener('mouseout', hide)
    document.addEventListener('focusout', hide)
    const clear = () => setTip(null)
    window.addEventListener('scroll', clear, true)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('focusin', show)
      document.removeEventListener('mouseout', hide)
      document.removeEventListener('focusout', hide)
      window.removeEventListener('scroll', clear, true)
    }
  }, [])
  if (!tip) return null
  return createPortal(
    <span className="trunc-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </span>,
    document.body
  )
}
