import { Icon } from '../../lib/icons'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { ASSUMPTIONS, money } from '../../lib/retirementGoal'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

const R = 42
const CIRC = 2 * Math.PI * R

export function GoalDonut({ score, large, empty }) {
  const funded = empty ? 0 : Math.max(0, Math.min(100, score))
  const dash = (funded / 100) * CIRC
  const sw = large ? 7 : 6

  return (
    <div className={`rr-donut${large ? ' large' : ''}`}>
      <svg viewBox="0 0 100 100" role="img" aria-label={`${Math.round(funded)} percent of retirement spend funded`}>
        <circle className="rr-track" cx="50" cy="50" r={R} strokeWidth={sw} />
        <circle
          className="rr-arc"
          cx="50"
          cy="50"
          r={R}
          stroke="currentColor"
          strokeWidth={sw}
          strokeDasharray={`${dash} ${CIRC}`}
        />
      </svg>
      <div className="rr-score">
        <b>{Math.round(funded)}%</b>
        <span>Goal reached</span>
      </div>
    </div>
  )
}

export function Legend({ expense, income, shortfall }) {
  return (
    <ul className="rr-legend">
      <li>
        Expected expense<b>{money(expense)}</b>
      </li>
      <li className="income">
        All income<b>{money(income)}</b>
      </li>
      <li className="short">
        Shortfall<b>{money(shortfall)}</b>
      </li>
    </ul>
  )
}

export function ReadinessChart({ score, expense, income, shortfall, large }) {
  return (
    <div className="rr-visual">
      <div className="rr-chart">
        <GoalDonut score={score} large={large} />
      </div>
      <Legend expense={expense} income={income} shortfall={shortfall} />
    </div>
  )
}

export function SlimDonut(props) {
  return <GoalDonut {...props} empty />
}

export function DisclaimerModal({ onClose }) {
  useEscapeToClose(true, onClose)
  return (
    <div className="enroll-modal-bg" role="presentation" onClick={onClose}>
      <div
        className="enroll-modal rr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rr-disclaimer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rr-modal-h">
          <h4 id="rr-disclaimer-title">Disclaimer</h4>
          <button type="button" className="rr-modal-x" onClick={onClose} aria-label="Close">
            <Icon icon={faTimes} size={18} />
          </button>
        </div>
        <p>
          We make no guarantees regarding the accuracy of the calculator or its impact on your retirement income. We are
          not responsible for any investment losses incurred as a result of using this calculator.
        </p>
        <p className="rr-modal-k">The following assumptions have been made for the calculation:</p>
        <ul>
          {ASSUMPTIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="enroll-modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
