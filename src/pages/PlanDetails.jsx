import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faPercent, faChartLine, faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import {
  AUTO_INCREASE_KEY,
  DEFERRAL_KEY,
  INVESTMENT_KEY,
  hasAdvanceElections,
  isAutoEnrolledPlan,
  markPlanManuallyEnrolled,
  planEnrollmentStatus,
  readSession,
  writeSession
} from '../data/participants'
import { PlanStats } from '../components/dashboard/PlanCard.jsx'
import { DeferralEditor } from './Enrollment.jsx'
import { InvestmentEditor } from './Investments.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import '../styles/enrollment.css'

const CYCLES = {
  calendar: 'Calendar year',
  participant: 'Plan participant date',
  planyear: 'Plan year'
}
const DEFAULT_DEFERRAL = { pre: 6, roth: 2, total: 8, optedOut: false }
const DEFAULT_AI = {
  mode: 'do',
  skipped: false,
  cycle: 'calendar',
  incPre: 1,
  capPre: 10,
  incRoth: 1,
  capRoth: 10
}
const DEFAULT_FUNDS = [
  ['Vanguard Institutional Index Fund Admiral Shares', 30],
  ['Fidelity 500 Index Fund Institutional Class', 30],
  ['Vanguard Total Bond Market Index Fund Admiral Shares', 20],
  ['Fidelity U.S. Bond Index Fund Institutional Premium', 20]
]

const pct = (n) => Math.round((+n || 0) * 10) / 10 + '%'
const fundRows = (alloc) => Object.entries(alloc || {}).filter(([, v]) => +v > 0)
const planCode = (meta) => String(meta || '').match(/ID\s+(\d+)/i)?.[1] || '—'
const canDefer = (plan) => /401|deferred/i.test(`${plan.type} ${plan.id}`)
// Exact statuses, not a substring match: 'Eligible — Not Enrolled' contains
// 'Enrolled', which made eligible-only plans (e.g. Roth) read as enrolled and
// offer Opt out (#85).
const isParticipating = (plan) =>
  /participating/i.test(plan.badge || '') || /^(auto )?enrolled$/i.test(plan.details?.status || '')
const isEligibleOnly = (plan) => plan.badge === 'Eligible' || plan.badgeClass === 'eligible'
const electionSnapshot = () => ({
  deferral: readSession(DEFERRAL_KEY),
  autoInc: readSession(AUTO_INCREASE_KEY),
  inv: readSession(INVESTMENT_KEY)
})

export default function PlanDetails() {
  const { planId } = useParams()
  const { participant } = useParticipant()
  const plan = participant.plans.find((p) => p.id === planId)
  const [tick, setTick] = useState(0)
  const savedDeferral = useMemo(() => readSession(DEFERRAL_KEY), [tick])
  const savedAi = useMemo(() => readSession(AUTO_INCREASE_KEY), [tick])
  const savedInv = useMemo(() => readSession(INVESTMENT_KEY), [tick])
  const [optOutOpen, setOptOutOpen] = useState(false)
  const [optedOut, setOptedOut] = useState(!!savedDeferral?.optedOut)
  useEscapeToClose(optOutOpen, () => setOptOutOpen(false))
  const optOutTrapRef = useFocusTrap(optOutOpen)
  const [tab, setTab] = useState('deferral')
  const [editing, setEditing] = useState(false)
  const editSnapshot = useRef(null)
  const [searchParams] = useSearchParams()

  // Coming back from the risk questionnaire (View/Edit questionnaire,
  // opened from this page's Investments edit view): reopen the same
  // Investments tab in edit mode instead of landing on the plain page.
  useEffect(() => {
    if (searchParams.get('openInvestments') === '1') {
      setTab('investments')
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!plan) return <Navigate to="/" replace />

  const deferCapable = canDefer(plan)
  const sessionOptOut = deferCapable && optedOut
  const enrolled = isParticipating(plan) && !sessionOptOut
  const eligible = isEligibleOnly(plan) && !enrolled && !sessionOptOut
  // Not-yet-eligible participants can still "provide elections in advance"
  // (same enrollment wizard, just not applied yet) -- surface what they
  // saved instead of leaving this section a single line of plain notice
  // text with no way to see what they'd actually set up.
  const hasAdvanceSave = !enrolled && !eligible && hasAdvanceElections(participant.id) && !!savedDeferral
  const activeTab = deferCapable ? tab : 'investments'
  // The plan's real balance breakdown (Pre-Tax/Roth/Match/etc. with vested
  // amounts) and current holdings already exist in the data model and are
  // used on Account Summary, but were never surfaced here — a participant
  // looking at "Plan details" would expect to see where their balance
  // (including any employer match) actually came from.

  const deferral = enrolled ? { ...DEFAULT_DEFERRAL, ...(savedDeferral || {}) } : savedDeferral
  const autoInc = enrolled ? { ...DEFAULT_AI, ...(savedAi || {}) } : savedAi
  const skippedAi = !autoInc || autoInc.skipped || autoInc.mode !== 'do'
  const applyAll = savedInv?.applyAll !== false
  const funds =
    fundRows(savedInv?.bySource?.pre || savedInv?.alloc).length
      ? fundRows(applyAll ? savedInv?.bySource?.pre || savedInv?.alloc : null)
      : DEFAULT_FUNDS

  const refresh = () => {
    const before = editSnapshot.current
    if (before && isAutoEnrolledPlan(plan)) {
      const after = electionSnapshot()
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        markPlanManuallyEnrolled(plan.id)
      }
    }
    editSnapshot.current = null
    setEditing(false)
    setTick((n) => n + 1)
  }

  // No confirmation prompt when an auto-enrolled participant moves to a
  // manual deferral rate or investment election change — go straight to
  // editing; refresh() above still tracks the status change on save.
  const beginEdit = () => {
    editSnapshot.current = electionSnapshot()
    setEditing(true)
  }

  const cancelEdit = () => {
    editSnapshot.current = null
    setEditing(false)
  }

  const confirmOptOut = () => {
    writeSession(DEFERRAL_KEY, {
      ...(savedDeferral || DEFAULT_DEFERRAL),
      mode: 'optout',
      optedOut: true,
      pre: 0,
      roth: 0,
      total: 0
    })
    writeSession(AUTO_INCREASE_KEY, {
      ...(savedAi || DEFAULT_AI),
      skipped: true,
      mode: 'skip'
    })
    setOptedOut(true)
    setEditing(false)
    setOptOutOpen(false)
    setTick((n) => n + 1)
  }

  const switchTab = (next) => {
    setTab(next)
    setEditing(false)
  }

  return (
    <div className="page-body">
      <div className="hi-bar">
        <div>
          <Link to="/" className="text-link">
            ‹ Your Plans
          </Link>
          <h1>{plan.name}</h1>
          <span className={`plan-badge ${sessionOptOut ? 'opted' : plan.badgeClass || ''}`}>
            {sessionOptOut ? 'Opted Out' : plan.badge}
          </span>
        </div>
      </div>

      <div className="plan-overview">
        <div className="plan-overview-left">
          <div className="plan-fact">
            Plan Details
            <b>
              {plan.type} · Plan ID {planCode(plan.meta)}
            </b>
          </div>
          <div className="plan-fact">
            Company Name
            <b>{participant.profile.employer}</b>
          </div>
          <div className="plan-fact-row">
            <div className="plan-fact">
              Enrollment Status
              <b>{sessionOptOut ? 'Opted Out' : planEnrollmentStatus(plan)}</b>
            </div>
            <div className="plan-fact">
              SSN
              <b>{participant.profile.ssn}</b>
            </div>
          </div>
        </div>
        <PlanStats stats={plan.stats} />
      </div>

      {sessionOptOut && (
        <section className="panel">
          <h2 className="panel-title">You opted out</h2>
          <p>Paycheck deferrals are stopped for this plan. You can enroll again at any time.</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/enrollment">
              Enroll again
            </Link>
          </div>
        </section>
      )}

      {eligible && (
        <section className="panel">
          <h2 className="panel-title">Not enrolled yet</h2>
          <p>You are eligible to participate. Set a deferral rate and investments to join this plan.</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/enrollment">
              Enroll
            </Link>
          </div>
        </section>
      )}


      {enrolled && (
        <div className="pr-shell">
          <nav className="pr-nav" role="tablist" aria-label="Plan elections">
            {deferCapable && (
              <button
                type="button"
                className={activeTab === 'deferral' ? 'on' : ''}
                role="tab"
                aria-selected={activeTab === 'deferral'}
                onClick={() => switchTab('deferral')}
              >
                <span className="pr-nav-ico" aria-hidden="true">
                  <Icon icon={faPercent} size={16} />
                </span>
                Deferrals
              </button>
            )}
            <button
              type="button"
              className={activeTab === 'investments' ? 'on' : ''}
              role="tab"
              aria-selected={activeTab === 'investments'}
              onClick={() => switchTab('investments')}
            >
              <span className="pr-nav-ico" aria-hidden="true">
                <Icon icon={faChartLine} size={16} />
              </span>
              Investments
            </button>
          </nav>

          <div className="pr-main">
            {activeTab === 'deferral' && deferCapable && (
              <>
                <section className="panel">
                  {editing ? (
                    <DeferralEditor
                      embedded
                      showOptOut={false}
                      saveLabel="Save changes"
                      onCancel={cancelEdit}
                      onComplete={(didOptOut) => {
                        if (didOptOut) setOptedOut(true)
                        refresh()
                      }}
                    />
                  ) : (
                    <>
                      <div className="panel-h">
                        <h2 className="panel-title">Deferral &amp; auto increase</h2>
                        <button type="button" className="text-link" onClick={beginEdit}>
                          Edit
                        </button>
                      </div>
                      <ul className="detail-rows">
                        <li>
                          <span>Pre-Tax</span>
                          <b>
                            {pct(deferral.pre)}
                          </b>
                        </li>
                        <li>
                          <span>Roth</span>
                          <b>
                            {pct(deferral.roth)}
                          </b>
                        </li>
                      </ul>
                      <h3 className="src-label">Auto increase</h3>
                      {skippedAi ? (
                        <p>No automatic increase is turned on.</p>
                      ) : (
                        <ul className="detail-rows">
                          <li>
                            <span>Cycle</span>
                            <b>{CYCLES[autoInc.cycle] || 'Calendar year'}</b>
                          </li>
                          <li>
                            <span>Pre-Tax</span>
                            <b>
                              +{pct(autoInc.incPre ?? autoInc.inc)} until {pct(autoInc.capPre ?? autoInc.cap)}
                            </b>
                          </li>
                          <li>
                            <span>Roth</span>
                            <b>
                              +{pct(autoInc.incRoth ?? autoInc.inc)} until {pct(autoInc.capRoth ?? autoInc.cap)}
                            </b>
                          </li>
                        </ul>
                      )}
                    </>
                  )}
                </section>
                {/* #85: only a plan the participant is enrolled in can be opted out of. */}
                {!editing && enrolled && (
                  <div className="plan-optout">
                    <button type="button" className="text-link danger" onClick={() => setOptOutOpen(true)}>
                      Opt out of paycheck deferral
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'investments' && (
              <section className="panel">
                {editing ? (
                  <InvestmentEditor
                    embedded
                    saveLabel="Save changes"
                    onCancel={cancelEdit}
                    onComplete={refresh}
                    riskReturnPath={`/plans/${plan.id}?openInvestments=1`}
                  />
                ) : (
                  <>
                    <div className="panel-h">
                      <h2 className="panel-title">Investments</h2>
                      <button type="button" className="text-link" onClick={beginEdit}>
                        Edit
                      </button>
                    </div>
                    <p className="panel-note">
                      {savedInv?.mode === 'custom' ? 'Your selection' : 'Plan investments'}
                      {applyAll || !savedInv ? ' · Same for all sources' : ' · By source'}
                    </p>
                    {applyAll || !savedInv ? (
                      <FundList rows={funds} />
                    ) : (
                      ['pre', 'roth'].map((src) => (
                        <div key={src}>
                          <h3 className="src-label">{src === 'pre' ? 'Pre-Tax' : 'Roth'}</h3>
                          <FundList rows={fundRows(savedInv?.bySource?.[src])} />
                        </div>
                      ))
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {!enrolled && !eligible && !sessionOptOut && (
        <section className="panel pd-enrollment">
          <div className="pd-enrollment-notice">
            <span className="pd-enrollment-ico" aria-hidden="true">
              <Icon icon={faCircleInfo} size={18} />
            </span>
            <div>
              <h2 className="panel-title">Enrollment</h2>
              <p>{plan.notice}</p>
            </div>
          </div>

          {hasAdvanceSave && (
            <div className="pd-advance-card">
              <div className="panel-h">
                <div>
                  <h4>Your saved elections</h4>
                  <p className="panel-note">
                    Provided in advance -- these will take effect automatically once you become eligible for this
                    plan.
                  </p>
                </div>
                <Link className="text-link" to="/enrollment">
                  Edit
                </Link>
              </div>
              <ul className="detail-rows">
                <li>
                  <span>Pre-Tax</span>
                  <b>{pct(deferral?.pre)}</b>
                </li>
                <li>
                  <span>Roth</span>
                  <b>{pct(deferral?.roth)}</b>
                </li>
              </ul>
              <h3 className="src-label">Investments</h3>
              <FundList rows={funds} />
            </div>
          )}
        </section>
      )}

      {optOutOpen && (
        <div className="enroll-modal-bg" role="presentation" onClick={() => setOptOutOpen(false)}>
          <div
            ref={optOutTrapRef}
            className="enroll-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="optout-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="optout-title">Are you sure you want to opt out?</h4>
            <p>
              If you opt out, deferrals from your paycheck will stop. You can enroll again later, but you may miss out on
              potential retirement savings growth and any available employer matching contributions.
            </p>
            <div className="enroll-modal-actions">
              <button type="button" className="btn btn-primary" onClick={confirmOptOut}>
                Confirm opt out
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOptOutOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function FundList({ rows }) {
  if (!rows?.length) return <p>No funds selected yet.</p>
  const total = rows.reduce((sum, [, share]) => sum + (+share || 0), 0)
  return (
    <div className="fund-list">
      <div className="fund-list-head">
        <span>Investment</span>
        <span>Election Percentage</span>
      </div>
      <ul className="detail-rows">
        {rows.map(([name, share]) => (
          <li key={name}>
            <span>{name}</span>
            <b>{pct(share)}</b>
          </li>
        ))}
      </ul>
      <div className={`totalbar${Math.round(total) === 100 ? ' ok' : ''}`}>
        <span />
        <span className="tval-wrap">
          Total
          <b className="tval">{pct(total)}</b>
        </span>
      </div>
    </div>
  )
}
