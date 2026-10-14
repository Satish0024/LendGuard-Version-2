import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AUTO_INCREASE_KEY,
  DEFERRAL_KEY,
  INVESTMENT_KEY,
  isNotEligibleUser,
  markAdvanceElections,
  readSession
} from '../data/participants'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { loadProfile } from '../lib/profileDetails'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

const CYCLES = {
  calendar: { title: 'Calendar year', next: 'January 1, 2027' },
  participant: { title: 'Plan participant date', next: 'August 15, 2027' },
  planyear: { title: 'Plan year', next: 'April 1, 2027' }
}
const SALARY = 85000
const PERIODS = 26
const SOURCE_LABEL = { pre: 'Pre-Tax', roth: 'Roth' }

const pct = (n) => Math.round((+n || 0) * 10) / 10 + '%'
const payFromPct = (rate) => Math.round((SALARY * (+rate || 0)) / 100 / PERIODS)
const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fundRows = (alloc) => Object.entries(alloc || {}).filter(([, v]) => +v > 0)

export default function EnrollmentSummary() {
  const navigate = useNavigate()
  const { participant } = useParticipant()
  const notEligible = isNotEligibleUser(participant)
  // Item #92/49/50/51: the success popup's beneficiary card reads
  // differently once the participant already has a beneficiary on file --
  // reusing the same loadProfile() source the Profile beneficiary tab
  // renders from, so this reflects real saved beneficiaries, not just the
  // static seed data.
  const hasBeneficiary = useMemo(() => {
    const benes = loadProfile(participant).beneficiaries
    return !!((benes?.primary?.length || 0) + (benes?.contingent?.length || 0))
  }, [participant])
  const deferral = useMemo(() => readSession(DEFERRAL_KEY), [])
  // #93: show each deferral only in the unit the participant chose (% or $
  // per paycheck), not both side by side.
  const showAmount = (rate) => (deferral?.unit === '$' ? money(payFromPct(rate)) : pct(rate))
  const autoInc = useMemo(() => readSession(AUTO_INCREASE_KEY), [])
  const investment = useMemo(() => readSession(INVESTMENT_KEY), [])

  const [done, setDone] = useState(false)

  const optedOut = !!(deferral?.optedOut || deferral?.mode === 'optout')
  const skippedAi = optedOut || autoInc?.skipped || autoInc?.mode !== 'do'
  const applyAll = investment?.applyAll !== false
  const cycle = CYCLES[autoInc?.cycle] || CYCLES.calendar
  const usingPlan = investment?.mode === 'plan'

  const confirm = () => {
    // Any plan that still offers "Provide elections in advance" should switch
    // to "View Saved Details" after confirm — including eligible participants
    // who only have that link on a not-yet-eligible plan (e.g. Deferred Comp).
    const hasAdvanceLink = (participant.plans || []).some(
      (plan) => plan.noticeLink?.label === 'Provide elections in advance'
    )
    if (notEligible || hasAdvanceLink) markAdvanceElections(participant.id)
    setDone(true)
  }
  const goHome = () => navigate('/', { replace: true })
  const successTrapRef = useFocusTrap(done)
  useEscapeToClose(done, goHome)

  return (
    <div className="detail-body enroll-simple">
      <div className="summary-page">
        <h3 className="section-title">Review and confirm</h3>
        <p className="section-sub">
          {notEligible
            ? "You're almost done. Review your elections and confirm to save them."
            : "You're almost done. Review your selections and confirm to enroll."}
        </p>

        <article className="review-card">
          <div className="review-h">
            <div className="review-title">
              <h4>Deferral rate</h4>
              <small>{optedOut ? 'No paycheck deferral' : 'From each paycheck'}</small>
            </div>
            <button type="button" className="text-btn" onClick={() => navigate('/enrollment')}>
              Edit
            </button>
          </div>
          {optedOut ? (
            <p>You opted out of contributing from your paycheck.</p>
          ) : (
            <>
              <ul className="review-rows">
                <li>
                  <span>Pre-Tax</span>
                  <b>{showAmount(deferral?.pre)}</b>
                </li>
                <li>
                  <span>Roth</span>
                  <b>{showAmount(deferral?.roth)}</b>
                </li>
              </ul>
              <div className="review-sources review-divider">
                <div>
                  <h5>Auto increase{skippedAi ? '' : ` · ${cycle.title}`}</h5>
                  {skippedAi ? (
                    <p>The elected deferral rate will remain the same each year.</p>
                  ) : (
                    <ul className="review-rows">
                      <li>
                        <span>Next increase</span>
                        <b>{cycle.next}</b>
                      </li>
                      <li>
                        <span>Pre-Tax</span>
                        <b>
                          +{pct(autoInc?.incPre ?? autoInc?.inc)}
                          <small>until {pct(autoInc?.capPre ?? autoInc?.cap)}</small>
                        </b>
                      </li>
                      <li>
                        <span>Roth</span>
                        <b>
                          +{pct(autoInc?.incRoth ?? autoInc?.inc)}
                          <small>until {pct(autoInc?.capRoth ?? autoInc?.cap)}</small>
                        </b>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </article>

        <article className="review-card">
          <div className="review-h">
            <div className="review-title">
              <h4>Investment election</h4>
              <small>{usingPlan ? 'Plan-selected investments' : 'Own election'}</small>
            </div>
            <button type="button" className="text-btn" onClick={() => navigate('/enrollment/investments')}>
              Edit
            </button>
          </div>
          {applyAll ? (
            <FundList alloc={investment?.bySource?.pre || investment?.alloc} />
          ) : (
            <div className="review-sources">
              {['pre', 'roth'].map((src) => (
                <div key={src}>
                  <h5>{SOURCE_LABEL[src]}</h5>
                  <FundList alloc={investment?.bySource?.[src]} />
                </div>
              ))}
            </div>
          )}
        </article>

        <p className="summary-note">You can update the enrollment selections any time.</p>
        <div className="enroll-nav">
          <button className="btn btn-primary" type="button" onClick={confirm}>
            {notEligible ? 'Confirm elections' : 'Confirm enrollment'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={goHome}>
            Cancel
          </button>
        </div>
      </div>

      {done && (
        <div className="enroll-modal-bg success-bg" role="presentation">
          <div
            ref={successTrapRef}
            className="enroll-modal success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-title"
            tabIndex={-1}
          >
            <div className="enroll-success">
              <div className="success-burst" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="success-mark" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle className="success-ring" cx="26" cy="26" r="24" />
                  <path className="success-check" d="M15.5 27.2l7.2 7.2 14.6-16" />
                </svg>
              </div>
              <h3 id="success-title">{notEligible ? 'Your Elections Are Saved' : "You're Enrolled"}</h3>
              <p className="success-lead">
                {hasBeneficiary
                  ? 'Your enrollment preferences are saved. Take a moment to review your beneficiary information and help ensure your savings go to the right person.'
                  : notEligible
                  ? "The enrollment preferences have been saved and will take effect once you're eligible for the plan. Take a moment to designate a beneficiary and help ensure your savings go to the right person."
                  : 'Your enrollment preferences are saved. Take a moment to designate a beneficiary and help ensure your savings go to the right person.'}
              </p>

              <div className="success-next">
                <div>
                  <b>{hasBeneficiary ? 'View beneficiary' : 'Add a beneficiary'}</b>
                  <span>Recommended to ensure your account passes to someone you choose.</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    navigate(hasBeneficiary ? '/profile?section=beneficiary' : '/profile?section=beneficiary&add=1')
                  }
                >
                  {hasBeneficiary ? 'View beneficiary' : 'Add beneficiary'}
                </button>
              </div>

              <div className="success-actions">
                <button type="button" className="btn btn-ghost" onClick={goHome}>
                  I&apos;ll do this later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FundList({ alloc }) {
  const rows = fundRows(alloc)
  if (!rows.length) return <p>No funds selected yet.</p>
  return (
    <div className="fund-list">
      <div className="fund-list-head">
        <span>Investment</span>
        <span>Election Percentage</span>
      </div>
      <ul className="review-funds">
        {rows.map(([name, share]) => (
          <li key={name}>
            <span>{name}</span>
            <b>{pct(share)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

