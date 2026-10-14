import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faExclamationTriangle, faBookmark, faChevronRight, faPlus, faChartLine } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { isNotEligibleUser } from '../../data/participants'
import {
  READINESS_KEY,
  ageFromDob,
  hydratePrefs,
  money,
  parseMoney,
  readMap,
  scoreGoal,
  statusCopy
} from '../../lib/retirementGoal'
import { DisclaimerModal } from './ReadinessVisuals.jsx'
import ReadinessSceneV2 from './ReadinessSceneV2.jsx'

// Circular score gauge. The dash array is the full circumference so the
// offset maps 1:1 to "percent remaining", and the whole thing is one
// aria-labelled image rather than a pile of unreadable SVG nodes.
function ProgressRing({ score }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)))
  const radius = 46
  const circumference = 2 * Math.PI * radius

  return (
    <div className="rr3-ring" role="img" aria-label={`${pct}% of your retirement goal reached`}>
      <svg viewBox="0 0 110 110">
        <circle className="rr3-ring-track" cx="55" cy="55" r={radius} />
        <circle
          className="rr3-ring-fill"
          cx="55"
          cy="55"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <b className="rr3-ring-value">
        <span>
          {pct}
          <i>%</i>
        </span>
      </b>
    </div>
  )
}

// Version 2 of the Retirement Readiness dashboard widget — same data and
// CTAs as the original (src/components/dashboard/RetirementGoalSimulator.jsx),
// laid out per the updated design (hero % + animated scene, horizontal
// metric row, status banner) instead of the donut chart.
export default function RetirementGoalSimulatorV2() {
  const { participant } = useParticipant()
  const location = useLocation()
  const [started, setStarted] = useState(() => !!(participant.showSimulator || readMap(READINESS_KEY)[participant.id]))
  const [open, setOpen] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [prefs, setPrefs] = useState(() => hydratePrefs(participant))

  useEffect(() => {
    setStarted(!!(participant.showSimulator || readMap(READINESS_KEY)[participant.id]))
    setPrefs(hydratePrefs(participant))
  }, [participant.id, participant.showSimulator])

  useEffect(() => {
    if (!location.state?.goalSaved) return
    setStarted(true)
    setPrefs(hydratePrefs(participant))
    setUpdated(true)
    const t = window.setTimeout(() => setUpdated(false), 2400)
    return () => window.clearTimeout(t)
  }, [location.state, participant])

  const currentAge = ageFromDob(participant.profile?.dob)
  const balance = parseMoney(participant.overall?.total)
  const result = useMemo(
    () => scoreGoal({ prefs, currentAge, balance }),
    [prefs, currentAge, balance]
  )
  const { score, income, expense, shortfall } = result
  const status = statusCopy(score)
  const tone = score >= 80 ? 'good' : score >= 55 ? 'ok' : 'warn'

  if (isNotEligibleUser(participant)) return null

  return (
    <section className={`rr3 ${tone}`} aria-label="Retirement Readiness">
      <header className="rr3-head">
        <span className="rr3-ico" aria-hidden="true">
          <Icon icon={faBookmark} size={16} />
        </span>
        <span className="rr3-tag">Goal setting</span>
      </header>
      <h3 className="rr3-title">Retirement Readiness</h3>

      {started ? (
        <>
          {/* A progress ring reads the score at a glance and, unlike the old
              hero-percentage-beside-illustration row, stays whole in a
              narrow column. */}
          <ProgressRing score={score} />
          <p className="rr3-ring-caption">
            Goal reached
            {updated && <em className="rr3-updated">Updated just now</em>}
          </p>

          {/* Full-width rows: the previous three-across metric strip truncated
              every figure to "$55…" at this width. */}
          <dl className="rr3-metrics">
            <div className="rr3-metric">
              <dt>
                <span className="rr3-dot expense" aria-hidden="true" />
                Expected expense
              </dt>
              <dd>{money(expense)}</dd>
            </div>
            <div className="rr3-metric">
              <dt>
                <span className="rr3-dot income" aria-hidden="true" />
                All income
              </dt>
              <dd className="income">{money(income)}</dd>
            </div>
            <div className="rr3-metric">
              <dt>
                <span className="rr3-dot shortfall" aria-hidden="true" />
                Shortfall
              </dt>
              <dd className="shortfall">{money(shortfall)}</dd>
            </div>
          </dl>

          <Link className="rr3-status" to="/retirement-goal">
            <span className="rr3-status-copy">
              <b>{status.title}</b>
              <small>{status.body}</small>
            </span>
            <Icon icon={faChevronRight} size={16} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <div className="rr3-intro">
          <ReadinessSceneV2 idle />
          <p className="rr3-lead">
            This estimates how much of your retirement spending is covered by your savings, by using deferrals, age, and
            location.
          </p>
          <Link className="btn btn-primary" to="/retirement-goal">
            Get started
          </Link>
        </div>
      )}

      <p className="rr3-foot">
        <span>*Not guaranteed results.</span>{' '}
        <button type="button" className="text-link rr3-disclaimer-link" onClick={() => setOpen(true)}>
          Disclaimer
        </button>
      </p>

      {open && <DisclaimerModal onClose={() => setOpen(false)} />}
    </section>
  )
}
