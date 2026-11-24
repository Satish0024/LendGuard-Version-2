import { Link } from 'react-router-dom'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { hasAdvanceElections } from '../../data/participants'

export function PlanStats({ stats }) {
  if (!stats) return null

  return (
    <div className="plan-stats">
      <div className="plan-stat balance">
        <div className="k">Account Balance</div>
        <div className="v">{stats.balance}</div>
      </div>
      <div className="plan-stat vested">
        <div className="k">Vested Balance</div>
        <div className="v">{stats.vested}</div>
      </div>
    </div>
  )
}

export default function PlanCard({ plan }) {
  const { participant } = useParticipant()
  // Once a not-yet-eligible participant has provided elections in advance
  // for this plan, offer to view what was saved instead of prompting them
  // through the same "provide elections" link again.
  const advanceSaved = plan.noticeLink?.label === 'Provide elections in advance' && hasAdvanceElections(participant.id)
  const link = advanceSaved ? { label: 'View Saved Details', details: true } : plan.noticeLink
  const to = link?.details ? `/plans/${plan.id}` : link?.to
  const isCashBalance = plan.type === 'Cash Balance'

  return (
    <article className={`plan-card ${plan.cardClass || ''}`}>
      <div className="pc-top">
        <div className="pc-identity">
          <h3 className="pc-name">{plan.name}</h3>
          <div className="pc-type">{plan.type}</div>
          <div className="pc-meta">{plan.meta}</div>
        </div>
        <span className={`plan-badge ${plan.badgeClass || ''}`}>{plan.badge}</span>
      </div>
      {isCashBalance ? (
        <p className="plan-cash-note">
          Cash balance benefit is <b>{plan.cashBenefit}</b>. This is a notional value, tracked separately, and is
          removed from the account balances shown above.
        </p>
      ) : (
        <>
          <p className={`plan-notice ${plan.noticeClass || ''}`}>
            {plan.notice}{' '}
            {to ? <Link to={to}>{link.label}</Link> : null}
          </p>
          <PlanStats stats={plan.stats} />
        </>
      )}
    </article>
  )
}
