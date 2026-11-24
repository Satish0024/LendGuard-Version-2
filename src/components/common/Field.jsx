import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../lib/icons'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'

// An info icon that reveals its message on hover/focus. The bubble is
// portalled to <body> with fixed positioning so slide-overs and scrolling
// cards can't clip it. `placement` is top (default), right, bottom or left;
// it flips to the opposite side when there isn't room. Text wraps once it
// reaches the CORE tooltip max width (240px).
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
const GAP = 8
const EDGE = 8

function FieldTip({ tooltip, id, placement = 'top' }) {
  const btnRef = useRef(null)
  const bubbleRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !bubbleRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const b = bubbleRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const fits = {
      top: r.top - GAP - b.height >= EDGE,
      bottom: r.bottom + GAP + b.height <= vh - EDGE,
      left: r.left - GAP - b.width >= EDGE,
      right: r.right + GAP + b.width <= vw - EDGE
    }
    const side = fits[placement] || !fits[OPPOSITE[placement]] ? placement : OPPOSITE[placement]
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let left
    let top
    if (side === 'top' || side === 'bottom') {
      left = Math.min(Math.max(cx - b.width / 2, EDGE), vw - EDGE - b.width)
      top = side === 'top' ? r.top - GAP - b.height : r.bottom + GAP
    } else {
      left = side === 'left' ? r.left - GAP - b.width : r.right + GAP
      top = Math.min(Math.max(cy - b.height / 2, EDGE), vh - EDGE - b.height)
    }
    // Arrow keeps pointing at the icon even when the bubble is nudged inside the viewport.
    const arrow = side === 'top' || side === 'bottom' ? cx - left : cy - top
    setPos({ side, left, top, arrow })
  }, [open, placement, tooltip])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!tooltip) return null
  // Position is cleared on hide, not on show: hover and focus can both call
  // show while already open, and the layout effect only reruns when `open` flips.
  const show = () => setOpen(true)
  const hide = () => {
    setOpen(false)
    setPos(null)
  }
  return (
    <span className="field-tip">
      <button
        ref={btnRef}
        type="button"
        className="field-tip-btn"
        aria-describedby={id}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Icon icon={faInfoCircle} size={13} aria-hidden="true" />
        <span className="sr-only">More info</span>
      </button>
      {/* Hidden but still read via aria-describedby, and kept out of the label's name. */}
      <span hidden id={id}>
        {tooltip}
      </span>
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            className={`field-tip-bubble is-${pos?.side || placement}`}
            aria-hidden="true"
            style={pos ? { left: pos.left, top: pos.top, '--tip-arrow': `${pos.arrow}px` } : { left: -9999, top: -9999 }}
          >
            <span className="field-tip-text">{tooltip}</span>
          </span>,
          document.body
        )}
    </span>
  )
}

// Helper/error text under a control. Errors follow the CORE style guide: plain
// red text (no icon), announced as an alert and paired with the field's red border.
const isErrNote = (note, noteClass) => Boolean(note) && Boolean(noteClass?.split(' ').includes('err'))

function FieldNote({ note, noteClass, id }) {
  if (!note) return null
  const isErr = isErrNote(note, noteClass)
  return (
    <span id={id} className={`note${noteClass ? ` ${noteClass}` : ''}`} role={isErr ? 'alert' : undefined}>
      {note}
    </span>
  )
}

// A labelled form row. Generates an id and wires the <label> to the control,
// so assistive tech announces them together — the plain sibling
// <label> + <input> pattern this replaces left the control unlabelled.
export default function Field({ label, required, note, noteClass, tooltip, tooltipPlacement, children }) {
  const id = useId()
  const tipId = useId()
  const noteId = useId()
  // CORE error field: the control is marked invalid (red border via CSS) and
  // points at the error message so screen readers read it with the field.
  const invalid = isErrNote(note, noteClass)
  return (
    <div className="txn-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="sr-only"> (required)</span>}
        <FieldTip tooltip={tooltip} id={tipId} placement={tooltipPlacement} />
      </label>
      {cloneElement(children, {
        id,
        ...(required ? { required: true } : null),
        ...(invalid ? { 'aria-invalid': true, 'aria-describedby': noteId } : null)
      })}
      <FieldNote note={note} noteClass={noteClass} id={noteId} />
    </div>
  )
}

// Grouped controls (radios, checkboxes, or a multi-input row like a term
// split across years/months). A fieldset+legend is what lets a screen reader
// announce the group's name before each individual option.
export function FieldGroup({ label, required, note, noteClass, tooltip, tooltipPlacement, children }) {
  const tipId = useId()
  const noteId = useId()
  return (
    <fieldset className="txn-field txn-fieldset">
      <legend>
        {label}
        {required && <span className="sr-only"> (required)</span>}
        <FieldTip tooltip={tooltip} id={tipId} placement={tooltipPlacement} />
      </legend>
      {children}
      <FieldNote note={note} noteClass={noteClass} id={noteId} />
    </fieldset>
  )
}
