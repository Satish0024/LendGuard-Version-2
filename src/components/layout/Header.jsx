import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faQuestionCircle, faSignOutAlt, faMoon, faKey, faSun } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { BRAND } from '../../config/brand.js'

export default function Header() {
  const { participant, logout } = useParticipant()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
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
    <header className="topbar">
      <div className="brand">
        <img src={theme === 'dark' ? BRAND.logoOnDark || BRAND.logo : BRAND.logo} alt={BRAND.name} />
      </div>
      <div className="top-right">
        <button
          type="button"
          className="icon-btn help-btn"
          aria-label="Get help"
          data-tip="Get help"
        >
          <Icon icon={faQuestionCircle} size={19} />
        </button>
        <button
          type="button"
          className="icon-btn theme-toggle"
          onClick={toggle}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          data-tip={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Icon icon={faSun} size={19} /> : <Icon icon={faMoon} size={19} />}
        </button>
        <div className="user-menu" ref={menuRef}>
          <button
            type="button"
            className={`user-chip avatar-only${open ? ' open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`Account menu for ${participant.name}`}
            onClick={() => setOpen((v) => !v)}
          >
            <img src={participant.avatar} alt="" />
          </button>
          <div className={`user-dropdown${open ? ' open' : ''}`} role="menu" aria-label="Account">
            <div className="user-dropdown-email" role="presentation">
              <span className="label">Username</span>
              <span className="value">{participant.profile?.email}</span>
            </div>
            <button
              type="button"
              className="user-option"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/settings')
              }}
            >
              <span className="sign-out-ico" aria-hidden="true">
                <Icon icon={faKey} size={16} />
              </span>
              <span className="meta">
                <span className="name">Change Password</span>
              </span>
            </button>
            <button
              type="button"
              className="user-option sign-out"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <span className="sign-out-ico" aria-hidden="true">
                <Icon icon={faSignOutAlt} size={16} />
              </span>
              <span className="meta">
                <span className="name">Log out</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
