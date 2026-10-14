import { useEffect } from 'react'
import { Icon } from '../../lib/icons'
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import '../../styles/toast.css'

// CORE .cds-toast: 28px tinted icon badge, bold title with optional body
// text, and a dismiss button. tone: 'success' (default) or 'error'.
export default function Toast({ message, body, tone = 'success', onDismiss, duration = 3500 }) {
  useEffect(() => {
    if (!message) return undefined
    const id = window.setTimeout(() => onDismiss?.(), duration)
    return () => window.clearTimeout(id)
  }, [message, duration, onDismiss])

  if (!message) return null

  const isError = tone === 'error'
  return (
    <div
      className={`toast ${isError ? 'toast--danger' : 'toast--success'}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="toast-ico" aria-hidden="true">
        <Icon icon={isError ? faCircleExclamation : faCircleCheck} size={16} />
      </span>
      <div className="toast-content">
        <strong className="toast-title">{message}</strong>
        {body ? <div className="toast-body">{body}</div> : null}
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss?.()}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
