import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faFlask } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { getSdb, setSdbDemo } from '../../data/sdb'

// Prototype-only: switching between demo participants/scenarios. Kept
// deliberately separate from the real account menu (Settings/Help/Sign out
// in Header.jsx) so it reads as what it is — a demo control, not a
// production feature — and out of the way in a corner rather than
// competing with real navigation. Mirrors the same control on the login
// page (Login.jsx), so it's the one consistent place this lives across the
// whole app, logged in or not.
export default function DemoScenarioSwitcher() {
  const { participant, participants, selectParticipant } = useParticipant()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sdbOn, setSdbOn] = useState(() => !!getSdb().enabled)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="demo-switcher" ref={ref}>
      <button
        type="button"
        className={`demo-switcher-toggle${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon={faFlask} size={14} />
        <span>Prototype demo</span>
      </button>
      {open && (
        <div className="demo-switcher-menu" role="listbox" aria-label="Switch participant scenario">
          <div className="demo-switcher-label">Participants</div>
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`demo-switcher-row${p.id === participant.id ? ' on' : ''}`}
              role="option"
              aria-selected={p.id === participant.id}
              onClick={() => {
                selectParticipant(p.id)
                setOpen(false)
                navigate('/', { replace: true })
              }}
            >
              <img src={p.avatar} alt="" width={26} height={26} />
              <span className="demo-switcher-text">
                <strong>{p.name}</strong>
                <small>{p.scenario}</small>
              </span>
            </button>
          ))}
          <div className="demo-switcher-label">Self-Directed Brokerage</div>
          {[
            [true, 'Opted in', 'Active brokerage with holdings'],
            [false, 'Not opted in', 'Shows the opt-in prompt']
          ].map(([val, label, hint]) => (
            <button
              key={label}
              type="button"
              className={`demo-switcher-row${sdbOn === val ? ' on' : ''}`}
              role="option"
              aria-selected={sdbOn === val}
              onClick={() => {
                setSdbDemo(val)
                setSdbOn(val)
                setOpen(false)
              }}
            >
              <span className="demo-switcher-text">
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
