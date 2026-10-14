import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faRocket, faBalanceScale, faShieldAlt, faMagic } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { isNotEligibleUser } from '../../data/participants'
import { RISK_PROFILE_UPDATED_EVENT, getRiskLevel, getRiskProfileId } from '../../lib/riskProfile'

const LEVEL_ICON = { conservative: faShieldAlt, moderate: faBalanceScale, aggressive: faRocket }

export default function RiskMeter() {
  const { participant } = useParticipant()
  const [levelId, setLevelId] = useState(() => getRiskProfileId(participant))

  // Stay in sync even when the questionnaire is completed elsewhere (e.g.
  // the sidebar's "Risk check-in" page instead of this widget).
  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail?.participantId === participant.id) setLevelId(e.detail.levelId)
    }
    window.addEventListener(RISK_PROFILE_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(RISK_PROFILE_UPDATED_EVENT, onUpdate)
  }, [participant.id])

  if (isNotEligibleUser(participant)) return null

  const level = getRiskLevel(levelId)
  const levelIcon = LEVEL_ICON[level.id]
  // Map the 0-100 score to a -90..90deg rotation around the gauge center so
  // the marker sits on the arc: 0 = far left (conservative), 100 = far
  // right (aggressive).
  const angle = (level.score / 100) * 180 - 90

  return (
    <section className="risk-card" aria-label="Investment risk profile">
      <div className="risk-head">
        <span className="risk-ico" aria-hidden="true">
          <Icon icon={faShieldAlt} size={18} />
        </span>
        <div className="risk-copy">
          <span className="risk-tag">Risk Level</span>
          <h3>{level.label}</h3>
        </div>
      </div>

      <div className="risk-body">
        <div className="risk-gauge-wrap">
          <svg className="risk-gauge" viewBox="0 0 200 115" role="img" aria-label={`${level.badge} risk level`}>
            <defs>
              <linearGradient id="risk-arc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--semantics-success-text)" />
                <stop offset="50%" stopColor="var(--semantics-warning-text)" />
                <stop offset="100%" stopColor="var(--semantics-critical-text)" />
              </linearGradient>
            </defs>
            <path d="M10 100A90 90 0 0 1 190 100" fill="none" stroke="url(#risk-arc)" strokeWidth="14" strokeLinecap="round" />
            <g className="risk-marker" style={{ transform: `rotate(${angle}deg)` }}>
              <circle cx="100" cy="14" r="9" fill="var(--neutral-surface-layer-01)" stroke={level.color} strokeWidth="4" />
            </g>
          </svg>
          <div className="risk-center">
            <span key={level.id} className="risk-center-ico" style={{ color: level.color }}>
              <Icon icon={levelIcon} size={30} />
            </span>
            <b style={{ color: level.color }}>{level.badge}</b>
            <span>Your risk level</span>
          </div>
        </div>

        <div className="risk-side">
          <p>{level.copy}</p>
          <p className="risk-hint">Want to change it? Retake the risk check-in questionnaire.</p>
          <Link to="/risk-check-in" className="risk-edit-btn">
            <Icon icon={faMagic} size={15} />
            Edit Preferences
          </Link>
        </div>
      </div>
    </section>
  )
}
