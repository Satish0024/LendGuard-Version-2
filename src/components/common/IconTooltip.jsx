import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Hover/focus tooltip for icon-only buttons inside scrolling or clipped areas
// (tables, slide-outs). Mark the button with `data-icon-tip="Edit allocation"`.
// It looks exactly like the header's [data-tip] tooltips (dark bubble, 12px,
// below the icon) but is fixed-positioned in a portal so overflow can't clip it,
// and flips above the icon near the bottom of the screen.
const GAP = 6
const EDGE = 8

export default function IconTooltip() {
  const [tip, setTip] = useState(null)
  const bubbleRef = useRef(null)

  useEffect(() => {
    const show = (e) => {
      const el = e.target.closest?.('[data-icon-tip]')
      if (!el) return
      setTip({ text: el.getAttribute('data-icon-tip'), rect: el.getBoundingClientRect() })
    }
    const hide = (e) => {
      const el = e.target.closest?.('[data-icon-tip]')
      if (el && !el.contains(e.relatedTarget)) setTip(null)
    }
    const clear = () => setTip(null)
    const onKey = (e) => e.key === 'Escape' && clear()
    document.addEventListener('mouseover', show)
    document.addEventListener('focusin', show)
    document.addEventListener('mouseout', hide)
    document.addEventListener('focusout', hide)
    document.addEventListener('click', clear, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('resize', clear)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('focusin', show)
      document.removeEventListener('mouseout', hide)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('click', clear, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('resize', clear)
    }
  }, [])

  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return setPos(null)
    const b = bubbleRef.current.getBoundingClientRect()
    const r = tip.rect
    const below = r.bottom + GAP + b.height <= window.innerHeight - EDGE
    const left = Math.min(Math.max(r.left + r.width / 2 - b.width / 2, EDGE), window.innerWidth - EDGE - b.width)
    setPos({ left, top: below ? r.bottom + GAP : r.top - GAP - b.height })
  }, [tip])

  if (!tip) return null
  return createPortal(
    <span
      ref={bubbleRef}
      className="icon-tip"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {tip.text}
    </span>,
    document.body
  )
}
