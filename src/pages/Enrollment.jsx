import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faCalendar, faLandmark, faTriangleExclamation, faUser } from '@fortawesome/free-solid-svg-icons'
import {
  AUTO_INCREASE_KEY,
  DEFERRAL_KEY,
  isEnrolledUser, isNotEligibleUser,
  readSession,
  writeSession
} from '../data/participants'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

const PLAN_PRE = 6
const PLAN_ROTH = 2
const DEFAULT_INC = 1
const DEFAULT_CAP = 10
const SALARY = 85000
const PERIODS = 26
const CYCLES = {
  calendar: { title: 'Calendar year', nextLabel: 'January 1, 2027', nextShort: 'Jan 1, 2027' },
  participant: { title: 'Plan participant date', nextLabel: 'August 15, 2027', nextShort: 'Aug 15, 2027' },
  planyear: { title: 'Plan year', nextLabel: 'April 1, 2027', nextShort: 'Apr 1, 2027' }
}

const pct = (n) => Math.round((+n || 0) * 10) / 10 + '%'
const payFromPct = (rate) => Math.round((SALARY * (+rate || 0)) / 100 / PERIODS)
const pctFromPay = (dollars) => Math.round(((Math.max(0, +dollars || 0) * PERIODS) / SALARY) * 1000) / 10
const clampPct = (n, max = 75) => Math.max(0, Math.min(max, Math.round((+n || 0) * 10) / 10))

function formatValue(rate, unit) {
  return unit === '$' ? payFromPct(rate) : Math.round((+rate || 0) * 10) / 10
}

export function DeferralEditor({
  embedded = false,
  showOptOut = true,
  saveLabel = 'Continue',
  onComplete,
  onCancel
}) {
  const { participant } = useParticipant()
  const notEligible = isNotEligibleUser(participant)
  // #85: opting out only applies to someone already enrolled (e.g. auto
  // enrolled) -- not to a participant who is enrolling for the first time.
  const canOptOut = showOptOut && !notEligible && isEnrolledUser(participant)
  const savedDeferral = useMemo(() => readSession(DEFERRAL_KEY), [])
  const savedAi = useMemo(() => readSession(AUTO_INCREASE_KEY), [])

  const [unit, setUnit] = useState(savedDeferral?.unit === '$' ? '$' : '%')
  const [pre, setPre] = useState(Number.isFinite(+savedDeferral?.pre) ? +savedDeferral.pre : embedded ? PLAN_PRE : 0)
  const [roth, setRoth] = useState(Number.isFinite(+savedDeferral?.roth) ? +savedDeferral.roth : embedded ? PLAN_ROTH : 0)
  const [aiMode, setAiMode] = useState(() => {
    if (savedAi?.mode === 'do' || savedAi?.mode === 'skip') return savedAi.mode
    return embedded ? 'do' : ''
  })
  const [incPre, setIncPre] = useState(Number.isFinite(+savedAi?.incPre) ? +savedAi.incPre : Number.isFinite(+savedAi?.inc) ? +savedAi.inc : DEFAULT_INC)
  const [capPre, setCapPre] = useState(Number.isFinite(+savedAi?.capPre) ? +savedAi.capPre : Number.isFinite(+savedAi?.cap) ? +savedAi.cap : DEFAULT_CAP)
  const [incRoth, setIncRoth] = useState(Number.isFinite(+savedAi?.incRoth) ? +savedAi.incRoth : DEFAULT_INC)
  const [capRoth, setCapRoth] = useState(Number.isFinite(+savedAi?.capRoth) ? +savedAi.capRoth : DEFAULT_CAP)
  const [cycle, setCycle] = useState(savedAi?.cycle && CYCLES[savedAi.cycle] ? savedAi.cycle : 'calendar')
  const [error, setError] = useState('')
  const [optOutOpen, setOptOutOpen] = useState(false)
  useEscapeToClose(optOutOpen, () => setOptOutOpen(false))
  const optOutTrapRef = useFocusTrap(optOutOpen)

  const setSource = (src, val) => {
    const next = unit === '$' ? pctFromPay(val) : clampPct(val)
    setError('')
    if (src === 'pre') setPre(next)
    if (src === 'roth') setRoth(next)
  }

  const usePlanRates = () => {
    setPre(PLAN_PRE)
    setRoth(PLAN_ROTH)
    setError('')
  }

  const resetForm = () => {
    setPre(0)
    setRoth(0)
    setError('')
  }

  const total = pre + roth
  const usingPlan = pre === PLAN_PRE && roth === PLAN_ROTH
  const skipping = aiMode === 'skip'
  const usingAi = aiMode === 'do'
  const cy = CYCLES[cycle]

  const saveDeferral = (optedOut = false) => {
    writeSession(DEFERRAL_KEY, {
      mode: optedOut ? 'optout' : usingPlan ? 'plan' : 'custom',
      optedOut,
      unit,
      pre: optedOut ? 0 : pre,
      roth: optedOut ? 0 : roth,
      aftertax: 0,
      total: optedOut ? 0 : total
    })
    writeSession(AUTO_INCREASE_KEY, {
      skipped: optedOut || skipping || !usingAi,
      mode: optedOut ? 'skip' : aiMode || 'skip',
      cycle,
      incPre,
      capPre,
      incRoth,
      capRoth,
      inc: incPre,
      cap: capPre,
      startRate: optedOut ? 0 : total
    })
  }

  const continueEnrollment = () => {
    if (!aiMode) {
      setError('Choose whether to use auto increase before you continue.')
      return
    }
    if (usingAi && (capPre <= pre || capRoth <= roth)) {
      setError('Each max limit must be greater than its deferral rate before you continue.')
      return
    }
    saveDeferral(false)
    onComplete?.(false)
  }

  const confirmOptOut = () => {
    saveDeferral(true)
    setOptOutOpen(false)
    onComplete?.(true)
  }

  return (
    <div className={embedded ? 'enroll-embed enroll-simple' : 'detail-body enroll-simple'}>
      <div className="enroll-narrow">
        <div className="section-top">
          <div>
            <h3 className="section-title">{embedded ? 'Edit deferral' : 'Set my deferral rate'}</h3>
          </div>
          {canOptOut && (
            <button type="button" className="text-link optout-link" onClick={() => setOptOutOpen(true)}>
              Opt out
            </button>
          )}
        </div>

        <div className="enroll-form">
          <div className="enroll-form-head">
            <div className="form-head-left">
              <span>Deferral by source</span>
              <button type="button" className={`plan-chip${usingPlan ? ' on' : ''}`} onClick={usePlanRates}>
                Use plan deferral rate
              </button>
            </div>
            <div className="form-head-actions">
              <div className="unit-toggle" role="group" aria-label="Amount format">
                <button type="button" className={unit === '%' ? 'on' : ''} onClick={() => setUnit('%')}>
                  %
                </button>
                <button type="button" className={unit === '$' ? 'on' : ''} onClick={() => setUnit('$')}>
                  $
                </button>
              </div>
            </div>
          </div>
          <SourceRow
            label="Pre-Tax"
            help="Pre-tax employee deferrals lower current year taxes. The deferrals and earnings on the deferrals are taxable when withdrawn and not taxable when it is rolled over."
            unit={unit}
            value={formatValue(pre, unit)}
            onChange={(v) => setSource('pre', v)}
          />
          <SourceRow
            label="Roth"
            help="Roth employee deferrals are taxable in the year contributed, but not when withdrawn. Earnings will not be taxable if certain age and holding period requirements are met."
            unit={unit}
            value={formatValue(roth, unit)}
            onChange={(v) => setSource('roth', v)}
          />
          <div className="totalbar">
            <button type="button" className="text-btn" onClick={resetForm}>
              Reset
            </button>
            <span className="tval-wrap">
              <span>Total deferral</span>
              <span className="tval">{unit === '$' ? `$${payFromPct(total)}` : pct(total)}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="ai-block" id="auto-increase">
          <h3 className="section-title">Auto increase</h3>
          <p className="section-sub">
            Automatically increase the deferral rate over time to grow the retirement savings.
          </p>

          <div className="choice-list" role="radiogroup" aria-label="Auto increase">
            <button
              type="button"
              className={`choice${aiMode === 'do' ? ' on' : ''}`}
              role="radio"
              aria-checked={aiMode === 'do'}
              onClick={() => {
                setAiMode('do')
                setError('')
              }}
            >
              <span className="choice-dot" aria-hidden="true" />
              <span>
                <b>Use auto increase</b>
                <small>Set the annual auto deferral rate increase.</small>
              </span>
            </button>
            <button
              type="button"
              className={`choice${aiMode === 'skip' ? ' on' : ''}`}
              role="radio"
              aria-checked={aiMode === 'skip'}
              onClick={() => {
                setAiMode('skip')
                setError('')
              }}
            >
              <span className="choice-dot" aria-hidden="true" />
              <span>
                <b>Don&apos;t use auto increase</b>
                <small>Keep the same deferral rate in effect each year</small>
              </span>
            </button>
          </div>

          {skipping && (
            <div className="warn">
              <div className="warn-head">
                <span className="warn-ico" aria-hidden="true"><Icon icon={faTriangleExclamation} size={20} /></span>
                <div>
                  <h4>Keep the current deferral rate</h4>
                  <p>
                    This means the elected deferral rate of <b>{unit === '$' ? `$${payFromPct(total)}` : pct(total)}</b>{' '}
                    will remain the same each year unless edited.
                  </p>
                </div>
              </div>
              <button type="button" className="warn-switch" onClick={() => setAiMode('do')}>
                Use auto increase instead
              </button>
            </div>
          )}

          {usingAi && (
            <div className="ai-setup">
              <div className="cycle-block">
                <div className="cycle-h">Increment cycle</div>
                <div className="cycle-cards" role="radiogroup" aria-label="Increment cycle">
                  {[
                    ['calendar', 'Calendar year', 'Every January 1', 'Next: Jan 1, 2027', faCalendar],
                    ['participant', 'Plan participant date', 'On your enrollment date', 'Next: Aug 15, 2027', faUser],
                    ['planyear', 'Plan year', 'Every April 1', 'Next: Apr 1, 2027', faLandmark]
                  ].map(([value, title, sub, next, icon]) => (
                    <button
                      key={value}
                      type="button"
                      className={`cycle-card${cycle === value ? ' on' : ''}`}
                      role="radio"
                      aria-checked={cycle === value}
                      onClick={() => setCycle(value)}
                    >
                      <Icon icon={icon} size={18} />
                      <span>
                        <b>{title}</b>
                        <small>{sub}</small>
                        <em>{next}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai-source-table">
                <div className="ai-row head">
                  <span>Source</span>
                  <span>Increment</span>
                  <span>Max limit</span>
                </div>
                <AiSourceRow
                  label="Pre-Tax"
                  current={pre}
                  unit={unit}
                  inc={incPre}
                  cap={capPre}
                  onInc={setIncPre}
                  onCap={setCapPre}
                  nextLabel={cy.nextShort}
                />
                <AiSourceRow
                  label="Roth"
                  current={roth}
                  unit={unit}
                  inc={incRoth}
                  cap={capRoth}
                  onInc={setIncRoth}
                  onCap={setCapRoth}
                  nextLabel={cy.nextShort}
                />
              </div>
            </div>
          )}
      </div>

      <div className="enroll-narrow">
        {error && <p className="enroll-error" role="alert">{error}</p>}

        <div className="enroll-nav">
          <button className="btn btn-primary" type="button" onClick={continueEnrollment}>
            {saveLabel}
          </button>
          {onCancel && (
            <button className="btn btn-ghost" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

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
              <button type="button" className="btn btn-ghost" onClick={() => setOptOutOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SourceRow({ label, help, value, onChange, unit }) {
  return (
    <div className="source">
      <div className="srow">
        <span className="smeta">
          <span className="sname">{label}</span>
          {help && <span className="shelp">{help}</span>}
        </span>
        <span className="sval">
          {unit === '$' && <span className="pct">$</span>}
          <input
            type="number"
            value={value}
            min={0}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} deferral rate${unit === '$' ? ' (dollars)' : ' (percent)'}`}
          />
          {unit === '%' && <span className="pct">%</span>}
        </span>
      </div>
    </div>
  )
}

function AiSourceRow({ label, current, unit, inc, cap, onInc, onCap, nextLabel }) {
  const capMin = Math.min(15, Math.max(1, current + 1))
  const capInvalid = cap <= current
  const nextPct = current >= cap ? current : Math.min(cap, current + inc)
  return (
    <div className="ai-row">
      <span className="ai-source">
        <b>{label}</b>
        <small>
          Now {unit === '$' ? `$${payFromPct(current)}` : pct(current)} · next {unit === '$' ? `$${payFromPct(nextPct)}` : pct(nextPct)} on {nextLabel}
        </small>
      </span>
      <span className="sval">
        <input
          type="number"
          value={inc}
          min={1}
          max={5}
          onChange={(e) => onInc(Math.min(5, Math.max(1, Math.round(+e.target.value || 1))))}
          aria-label={`${label} auto increase amount (percent)`}
        />
        <span className="pct">%</span>
      </span>
      {/* #84: the max limit must be above this source's deferral rate. Typed
          values are kept (not silently snapped up) and an inline error explains
          what's wrong; it also re-checks if the deferral rate is raised later. */}
      <span className="ai-cap-wrap">
        <span className="sval">
          <input
            type="number"
            className={capInvalid ? 'invalid' : ''}
            value={cap}
            min={capMin}
            max={15}
            onChange={(e) => onCap(Math.min(15, Math.max(0, Math.round(+e.target.value || 0))))}
            aria-label={`${label} auto increase cap (percent)`}
            aria-invalid={capInvalid}
            aria-describedby={capInvalid ? `${label}-cap-error` : undefined}
          />
          <span className="pct">%</span>
        </span>
        {capInvalid && (
          <small id={`${label}-cap-error`} className="ai-cap-error" role="alert">
            Max limit must be greater than the deferral rate ({pct(current)}).
          </small>
        )}
      </span>
    </div>
  )
}

function safeReturn(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : ''
}

export default function Enrollment() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturn(params.get('return'))
  return (
    <DeferralEditor
      saveLabel={returnTo ? 'Save changes' : 'Continue'}
      onComplete={() => navigate(returnTo || '/enrollment/investments')}
      onCancel={() => navigate(returnTo || '/')}
    />
  )
}
