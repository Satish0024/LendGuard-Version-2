import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faTachometerAlt } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { isNotEligibleUser } from '../../data/participants'
import {
  READINESS_KEY,
  ageFromDob,
  hydratePrefs,
  parseMoney,
  readMap,
  scoreGoal,
  statusCopy
} from '../../lib/retirementGoal'
import { DisclaimerModal, ReadinessChart } from './ReadinessVisuals.jsx'

export default function RetirementGoalSimulator() {
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
  const excellent = score >= 80
  const tone = excellent ? 'good' : score >= 55 ? 'ok' : 'warn'

  if (isNotEligibleUser(participant)) return null

  return (
    <section className={`rr-card${started ? '' : ' fresh'}`} aria-label="Retirement Goal Simulator">
      <div className="rr-head">
        <span className="rr-ico" aria-hidden="true">
          <Icon icon={faTachometerAlt} size={18} />
        </span>
        <div className="rr-copy">
          <span className="rr-tag">Goal Setting</span>
          <h3>Retirement Readiness</h3>
        </div>
      </div>

      {started ? (
        <>
          <ReadinessChart score={score} expense={expense} income={income} shortfall={shortfall} />
          <div className={`rr-status ${tone}`}>
            <div className="rr-status-copy">
              <b>{status.title}</b>
              <span>{status.body}</span>
              {updated && <em>Updated just now</em>}
            </div>
            <Link className="rr-status-link" to="/retirement-goal">
              Adjust your goal
            </Link>
          </div>
        </>
      ) : (
        <div className="rr-intro">
          <p className="rr-lead">
            This estimates how much of your retirement spending is covered by your savings, by using deferrals, age, and location.
          </p>
          <Link className="btn btn-primary" to="/retirement-goal">
            Get started
          </Link>
        </div>
      )}

      <div className="rr-foot">
        <span className="rr-foot-note">*Not guaranteed results.</span>
        <button type="button" className="text-link rr-disclaimer-link" onClick={() => setOpen(true)}>
          Disclaimer
        </button>
      </div>

      {open && <DisclaimerModal onClose={() => setOpen(false)} />}
    </section>
  )
}
