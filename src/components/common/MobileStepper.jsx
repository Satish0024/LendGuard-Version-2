import { useEffect, useId, useRef, useState } from 'react'

// CORE "Mobile Stepper" (style guide > Components > Stepper > Mobile Stepper).
// Shown instead of the full step list at <=768px -- i.e. phones and desktop
// at 250%+ zoom -- so the stepper is one ~64px row however many steps the
// flow has (3 today, 5-10 later) and never pushes the form off-screen
// (WCAG 1.4.10 Reflow). "View all steps" expands the full list on demand so
// users can still jump back to completed steps.
//
// steps: [{ id, title, state? }]  state: 'warning' | 'error' (optional)
// current: index of the current step
// isEnabled(i): whether step i can be opened from the list
// onSelect(i): open step i
const STATE_TEXT = { warning: 'Review needed', error: 'Required' }

export default function MobileStepper({ steps, current, isEnabled = () => false, onSelect }) {
  const total = steps.length
  const step = steps[current] || steps[0]
  const next = steps[current + 1]
  const [open, setOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const listId = useId()
  const first = useRef(true)

  const statusOf = (i) =>
    steps[i]?.state ? STATE_TEXT[steps[i].state] : i < current ? 'Completed' : i === current ? 'In progress' : 'Not started'

  // Announce step changes (not the initial render) for screen-reader users.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setOpen(false)
    setAnnounce(`Step ${current + 1} of ${total}: ${step.title}`)
  }, [current, total, step.title])

  const R = 22
  const C = 2 * Math.PI * R
  const frac = (current + 1) / total
  const tone = step.state || (current === total - 1 ? 'done' : 'progress')

  return (
    <nav className="mstep" aria-label="Progress">
      <div className="mstep-row">
        <div className={`mstep-ring tone-${tone}`} aria-hidden="true">
          <svg viewBox="0 0 52 52" width="52" height="52">
            <circle className="mstep-track" cx="26" cy="26" r={R} />
            <circle
              className="mstep-bar"
              cx="26"
              cy="26"
              r={R}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              transform="rotate(-90 26 26)"
            />
          </svg>
          <span className="mstep-count">
            {current + 1} of {total}
          </span>
        </div>
        <div className="mstep-text">
          <p className="mstep-title">
            <span className="sr-only">{`Step ${current + 1} of ${total}: `}</span>
            {step.title}
            <span className="sr-only">{`, ${statusOf(current)}.`}</span>
          </p>
          <p className="mstep-next">{next ? `Next: ${next.title}` : 'Last step'}</p>
          {step.state && <p className={`mstep-state tone-${step.state}`}>{STATE_TEXT[step.state]}</p>}
        </div>
      </div>
      <button
        type="button"
        className="mstep-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide all steps' : 'View all steps'}
      </button>
      <ol id={listId} className="mstep-list" hidden={!open}>
        {steps.map((s, i) => {
          const enabled = i !== current && isEnabled(i)
          const st = statusOf(i)
          return (
            <li key={s.id ?? i}>
              <button
                type="button"
                className={`mstep-item${i < current ? ' complete' : ''}${i === current ? ' current' : ''}`}
                aria-current={i === current ? 'step' : undefined}
                disabled={i !== current && !enabled}
                onClick={() => {
                  if (enabled) onSelect?.(i)
                  else setOpen(false)
                }}
              >
                <span className="mstep-num" aria-hidden="true">
                  {i < current && !s.state ? '✓' : i + 1}
                </span>
                <span className="mstep-item-text">
                  <span className="mstep-item-title">
                    <span className="sr-only">{`Step ${i + 1} of ${total}: `}</span>
                    {s.title}
                  </span>
                  <span className="mstep-item-state">{st}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </nav>
  )
}
