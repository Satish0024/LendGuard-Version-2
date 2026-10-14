import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faInfoCircle, faSlidersH } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { isEligibleNotEnrolledUser, isNotEligibleUser, isOptedOutUser } from '../../data/participants'
import {
  READINESS_KEY,
  ageFromDob,
  hydratePrefs,
  money,
  parseMoney,
  readMap,
  scoreGoal
} from '../../lib/retirementGoal'
import { DisclaimerModal } from './ReadinessVisuals.jsx'

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

// A single clean progress ring: a full-circle track plus one gradient arc
// with a rounded cap, drawn to the score. This replaces the previous
// scatter of dotted rings, broken arc fragments and floating particles,
// which read as unfinished noise rather than intent.
//
// aria-hidden: the percentage is real text rendered on top of this, and
// the wrapper carries its own aria-label, so nothing here is needed to
// read the widget.
function ScoreRing({ pct }) {
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * RING_C
  return (
    <svg className="rgs-orbit-rings" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <circle cx="64" cy="64" r={RING_R} fill="none" stroke="var(--neutral-surface-layer-03)" strokeWidth="8" />
      <circle
        cx="64"
        cy="64"
        r={RING_R}
        fill="none"
        stroke="var(--brand-text-primary-default)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${RING_C}`}
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dasharray .5s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  )
}

function DecorLayers() {
  return (
    <>
      <span className="rgs-noise" aria-hidden="true" />
      <svg className="rgs-wave" viewBox="0 0 360 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path
          d="M-10 220 C 70 190, 130 260, 210 210 S 340 150, 380 190"
          fill="none"
          strokeWidth="1.5"
        />
        <path
          d="M-10 260 C 60 250, 140 300, 220 250 S 330 210, 380 240"
          fill="none"
          strokeWidth="1.5"
        />
      </svg>
    </>
  )
}

// Retirement Readiness sidebar widget: a premium dark glass panel
// where the goal percentage is set as large real text (not a chart) and a
// translucent snapshot lists expense/income/shortfall.
export default function ReadinessScoreCard() {
  const { participant } = useParticipant()
  const location = useLocation()
  const [started, setStarted] = useState(() => !!(participant.showSimulator || readMap(READINESS_KEY)[participant.id]))
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(() => hydratePrefs(participant))

  useEffect(() => {
    setStarted(!!(participant.showSimulator || readMap(READINESS_KEY)[participant.id]))
    setPrefs(hydratePrefs(participant))
  }, [participant.id, participant.showSimulator])

  useEffect(() => {
    if (!location.state?.goalSaved) return
    setStarted(true)
    setPrefs(hydratePrefs(participant))
  }, [location.state, participant])

  const currentAge = ageFromDob(participant.profile?.dob)
  const balance = parseMoney(participant.overall?.total)
  const { score, income, expense, shortfall } = useMemo(
    () => scoreGoal({ prefs, currentAge, balance }),
    [prefs, currentAge, balance]
  )
  const pct = Math.max(0, Math.min(100, Math.round(score)))

  // Not eligible or opted out: the widget has nothing to offer this
  // participant (they either can't participate or have declined to), so it
  // doesn't render at all rather than showing a dead-end CTA.
  if (isNotEligibleUser(participant) || isOptedOutUser(participant)) return null

  return (
    <section className="rgs" aria-label="Retirement Readiness">
      <header className="rgs-banner">
        <div className="rgs-banner-copy">
          <h3 className="rgs-eyebrow">Retirement Readiness</h3>
          <p className="rgs-headline">See how your inputs affect your savings, income, risk.</p>
        </div>
        <img className="rgs-banner-art" src="/readiness-banner.png" alt="" aria-hidden="true" />
      </header>

      <DecorLayers />
      <div className="rgs-body">
        {started ? (
          <>
            <div className="rgs-main">
              <div className="rgs-orbit-wrap">
                <div className="rgs-orbit" role="img" aria-label={`${pct}% of your retirement goal`}>
                  <ScoreRing pct={pct} />
                  <div className="rgs-orbit-value">
                    <b>{pct}%</b>
                  </div>
                </div>
                <p className="rgs-goal-label">of your goal</p>
              </div>

              <dl className="rgs-snap">
                <div className="rgs-snap-row expense">
                  <dt className="rgs-snap-label">Expected expense</dt>
                  <dd>
                    <b>{money(expense)}</b>
                  </dd>
                </div>
                <div className="rgs-snap-div" aria-hidden="true" />
                <div className="rgs-snap-row income">
                  <dt className="rgs-snap-label">
                    <span className="rgs-dot" aria-hidden="true" />
                    All income
                  </dt>
                  <dd>
                    <b>{money(income)}</b>
                  </dd>
                </div>
                <div className="rgs-snap-row shortfall">
                  <dt className="rgs-snap-label">
                    <span className="rgs-dot" aria-hidden="true" />
                    Short fall
                  </dt>
                  <dd>
                    <b>{money(shortfall)}</b>
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : (
          <div className="rgs-intro">
            {isEligibleNotEnrolledUser(participant) ? (
              <>
                <p>Please enroll to get started with your retirement readiness set up.</p>
                <span className="rgs-primary-cta rgs-primary-cta--disabled" aria-disabled="true">
                  Get started
                </span>
              </>
            ) : (
              <>
                <p>
                  This estimates how much of your retirement spending is covered by your savings, using your deferrals, age,
                  and location.
                </p>
                <Link className="rgs-primary-cta" to="/retirement-goal">
                  Get started
                </Link>
              </>
            )}
          </div>
        )}

        <div className="rgs-foot">
          <p className="rgs-foot-note">
            <Icon icon={faInfoCircle} size={13} aria-hidden="true" />
            <span>
              Not guaranteed results.{' '}
              <button type="button" className="text-link rgs-disclaimer-link" onClick={() => setOpen(true)}>
                Disclaimer
              </button>
            </span>
          </p>
          {/* Only once the widget is started -- before that, "Get started"
              above is the single call to action. */}
          {started && (
            <Link className="rgs-foot-link" to="/retirement-goal">
              <Icon icon={faSlidersH} size={12} aria-hidden="true" />
              Adjust deferral rate and goal
            </Link>
          )}
        </div>
      </div>

      {open && <DisclaimerModal onClose={() => setOpen(false)} />}
    </section>
  )
}
