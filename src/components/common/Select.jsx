import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../lib/icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'

// A stand-in for the native <option> — Select reads its props to build the
// list, it never renders on its own.
export function Option() {
  return null
}

const GAP = 4
// Tall enough for 8 options (e.g. every withdraw type) without scrolling.
const MAX_H = 360
// Menus can be wider than a narrow trigger so long options (plan names) wrap
// to at most two lines instead of three or four.
const MIN_MENU_W = 360
const EDGE = 8

// A custom, document-styled dropdown that drop-in replaces a native
// <select>/<option> pair. Keeps the same children-as-options API and calls
// onChange with an { target: { value } } shape so existing
// `onChange={(e) => set(e.target.value)}` handlers work unchanged.
//
// The menu renders in a portal on document.body, positioned to the trigger,
// rather than as an absolutely-positioned sibling. As a sibling it was
// trapped by whatever ancestor happened to clip or stack: inside
// `.enroll-modal` (max-height + overflow:auto) it was cut off at the modal
// edge and scrolled the dialog instead of opening over it, and on mobile its
// z-index sat below the fixed bottom tab bar, so taps on the lower options
// hit the nav instead of the option. A portal has no clipping ancestor, so
// neither can happen wherever a Select is used.
export default function Select({ id, value, onChange, disabled, placeholder, className = '', children, ...rest }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  // Anchor to the trigger, flipping above it when the space below can't hold
  // a usable menu — otherwise a Select near the bottom of a dialog or page
  // opens into a few pixels of clipped list.
  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP
    const above = r.top - GAP
    const flip = below < 200 && above > below
    const maxH = Math.max(96, Math.min(MAX_H, flip ? above : below))
    const width = Math.min(Math.max(r.width, MIN_MENU_W), window.innerWidth - EDGE * 2)
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - EDGE - width))
    setPos({ top: flip ? r.top - GAP - maxH : r.bottom + GAP, left, width, maxH, flip, anchor: r.top })
  }, [])

  useLayoutEffect(() => {
    // Cleared on close so a reopen can't paint one frame at the position the
    // trigger occupied last time (the page may have scrolled since).
    if (!open) {
      setPos(null)
      return
    }
    place()
  }, [open, place])

  // When the list has to scroll, end the menu on a whole option instead of
  // slicing the last visible one through its text.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!pos || !menu || menu.scrollHeight <= pos.maxH + 1) return
    // Options can wrap to two lines, so snap to the real bottom of the last
    // option that fits rather than a fixed row height.
    const padB = parseFloat(getComputedStyle(menu).paddingBottom) + menu.offsetHeight - menu.clientHeight
    let h = 0
    for (const li of menu.children) {
      const bottom = li.offsetTop + li.offsetHeight + padB
      if (bottom > pos.maxH) break
      h = bottom
    }
    if (!h) return
    if (Math.abs(h - pos.maxH) < 1) return
    setPos((p) => ({ ...p, maxH: h, top: p.flip ? p.anchor - GAP - h : p.top }))
  }, [pos])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Capture phase so the menu follows the trigger even when the thing
    // scrolling is an inner container (a modal body, a table wrapper) rather
    // than the document.
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const opts = Children.toArray(children)
    .filter(isValidElement)
    .map((el) => ({
      value: el.props.value !== undefined ? el.props.value : el.props.children,
      label: el.props.children,
      disabled: el.props.disabled
    }))

  const current = opts.find((o) => String(o.value) === String(value))
  const shown = current ? current.label : placeholder || opts[0]?.label

  const choose = (v) => {
    onChange?.({ target: { value: v } })
    setOpen(false)
  }

  return (
    <div className={`ui-select${className ? ` ${className}` : ''}${disabled ? ' disabled' : ''}`} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        className="ui-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        {...rest}
      >
        <span className="ui-select-value" title={shown}>{shown}</span>
        <Icon icon={faChevronDown} size={13} aria-hidden="true" className="ui-select-caret" />
      </button>
      {open && pos
        ? createPortal(
            <ul
              ref={menuRef}
              className="ui-select-menu"
              role="listbox"
              aria-labelledby={id}
              /* Measurements are handed to CSS as custom properties rather
                 than as inline top/left/width, so the stylesheet stays in
                 charge of layout — that's what lets the mobile rule go
                 full-bleed instead of inheriting the trigger's width. */
              style={{
                '--sel-top': `${pos.top}px`,
                '--sel-left': `${pos.left}px`,
                '--sel-width': `${pos.width}px`,
                '--sel-max-h': `${pos.maxH}px`
              }}
            >
              {opts.map((o, i) => (
                <li key={`${o.value}-${i}`} role="option" aria-selected={String(o.value) === String(value)}>
                  <button
                    type="button"
                    className={`ui-select-opt${String(o.value) === String(value) ? ' active' : ''}`}
                    disabled={o.disabled}
                    onClick={() => choose(o.value)}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  )
}
