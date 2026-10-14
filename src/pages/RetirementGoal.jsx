import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../lib/icons'
import {
  faMoneyBillWave,
  faCalendarAlt,
  faCheckCircle,
  faDollarSign,
  faMapMarkerAlt,
  faTrophy,
  faExclamationTriangle,
  faUmbrella
} from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { isNotEligibleUser } from '../data/participants'
import { DisclaimerModal, ReadinessChart } from '../components/dashboard/ReadinessVisuals.jsx'
import Select, { Option } from '../components/common/Select.jsx'
import {
  LOCATION_DEFAULTS,
  LOCATIONS,
  PREFS_KEY,
  READINESS_KEY,
  ageFromDob,
  clamp,
  goalDiff,
  hydratePrefs,
  money,
  parseMoney,
  scoreGoal,
  setRateOn,
  writeMap
} from '../lib/retirementGoal'

function useAnimatedNumber(value) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 420)
      const eased = 1 - (1 - t) * (1 - t)
      const next = Math.round(from + (value - from) * eased)
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return shown
}

function TargetCard({ icon, label, hint, children }) {
  return (
    <div className="rg-target">
      <div className="rg-target-head">
        <span className="rg-target-ico" aria-hidden="true">
          <Icon icon={icon} size={16} />
        </span>
        <div className="rg-target-copy">
          <span>{label}</span>
          {hint && <small>{hint}</small>}
        </div>
      </div>
      <div className="rg-target-ctrl">{children}</div>
    </div>
  )
}

function MoneyInput({ value, onChange, ariaLabel }) {
  return (
    <span className="rg-affix">
      <em>$</em>
      <input
        inputMode="numeric"
        value={value ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
        onChange={(e) => onChange(parseMoney(e.target.value))}
        aria-label={ariaLabel}
      />
    </span>
  )
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const drift = (i % 2 === 0 ? 1 : -1) * (10 + (i % 9) * 6)
        return {
          left: `${(i * 17 + (i % 5) * 4) % 100}%`,
          delay: `${(i % 12) * 0.08}s`,
          duration: `${2.2 + (i % 5) * 0.25}s`,
          // Same shared chart palette as everywhere else (styles/
          // index.css --chart-1..7) -- var() resolves fine in inline
          // style values, same as in CSS, so this stays in sync with
          // --brand on any tenant.
          color: ['var(--semantics-success-text)', 'var(--semantics-warning-text)', 'var(--semantics-critical-text)', 'var(--chart-5)'][i % 4],
          size: 6 + (i % 4) * 2,
          round: i % 3 === 0,
          spin: (i % 2 === 0 ? 1 : -1) * (200 + (i % 7) * 36),
          drift: `${drift}px`
        }
      }),
    []
  )
  return (
    <div className="rg-confetti loop" aria-hidden="true">
      {bits.map((bit, i) => (
        <i
          key={i}
          className={bit.round ? 'round' : ''}
          style={{
            left: bit.left,
            width: bit.size,
            height: bit.round ? bit.size : bit.size * (i % 3 === 0 ? 1.7 : 1),
            background: bit.color,
            animationDelay: bit.delay,
            animationDuration: bit.duration,
            '--spin': `${bit.spin}deg`,
            '--drift': bit.drift
          }}
        />
      ))}
    </div>
  )
}

function RangeField({ min, max, value, origin, onChange, step = 1, ariaLabel }) {
  const span = Math.max(1, max - min)
  const valuePct = ((value - min) / span) * 100
  const originPct = ((origin - min) / span) * 100
  const changed = Number(value) !== Number(origin)
  const direction = Number(value) > Number(origin) ? 'up' : Number(value) < Number(origin) ? 'down' : 'same'
  return (
    <div className={`rg-range${changed ? ` changed rg-range--${direction}` : ''}`}>
      <span className="rg-range-fill" style={{ width: `${valuePct}%` }} />
      {changed && (
        <span
          className="rg-range-origin"
          style={{ left: `${originPct}%` }}
          title={`Current setting ${origin}%`}
        />
      )}
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} aria-label={ariaLabel} />
      {changed && (
        <small className="rg-range-note">
          <em>Current {origin}%</em>
          <b className={`rg-range-new rg-range-new--${direction}`}>New {value}%</b>
        </small>
      )}
    </div>
  )
}

function AutoIncreaseRow({ label, hint, inc, cap, onInc, onCap }) {
  const capMin = Math.min(15, Math.max(1, inc + 1))
  // The max limit input used to silently clamp any out-of-range typing back
  // to a valid value on every keystroke, so an entry at/under the deferral
  // rate above it could never actually be seen or explained -- it just
  // snapped. This keeps what's typed on screen and shows a real inline
  // error instead, only committing the clamped value once the field loses
  // focus (or immediately, for a value that's already valid).
  const [capDraft, setCapDraft] = useState(String(cap))
  useEffect(() => {
    setCapDraft(String(cap))
  }, [cap])
  const capDraftNum = Math.round(+capDraft || 0)
  const capInvalid = capDraft !== '' && capDraftNum <= inc
  return (
    <div className="ai-row">
      <span className="ai-source">
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <span className="sval">
        <input
          type="number"
          value={inc}
          min={1}
          max={5}
          onChange={(e) => onInc(Math.min(5, Math.max(1, Math.round(+e.target.value || 1))))}
        />
        <span className="pct">%</span>
      </span>
      <span className="ai-cap-wrap">
        <span className="sval">
          <input
            type="number"
            className={capInvalid ? 'invalid' : ''}
            value={capDraft}
            min={capMin}
            max={15}
            aria-invalid={capInvalid}
            aria-describedby={capInvalid ? `${label}-cap-error` : undefined}
            onChange={(e) => setCapDraft(e.target.value)}
            onBlur={() => onCap(Math.min(15, Math.max(capMin, capDraftNum || capMin)))}
          />
          <span className="pct">%</span>
        </span>
        {capInvalid && (
          <small id={`${label}-cap-error`} className="ai-cap-error" role="alert">
            Max limit must be greater than the deferral rate ({inc}%).
          </small>
        )}
      </span>
    </div>
  )
}

function AutoIncreaseBlock({ state, onChange }) {
  const pctPre = Math.max(1, +state.pctPre || 1)
  const capPre = Math.max(pctPre, +state.capPre || 10)
  const pctRoth = Math.max(1, +state.pctRoth || pctPre)
  const capRoth = Math.max(pctRoth, +state.capRoth || capPre)
  return (
    <>
      <label className={`rg-toggle${state.on ? ' on' : ''}`}>
        <input type="checkbox" checked={!!state.on} onChange={(e) => onChange('on', e.target.checked)} />
        <span>
          <b>Auto increase {state.on ? `· +${pctPre}% / year` : '· Off'}</b>
          {state.on
            ? `Deferral rises ${pctPre}% each year until it reaches ${capPre}%.`
            : 'Typical plan setting is +1% each year until 10%.'}
        </span>
      </label>
      {state.on && (
        <div className="rg-auto">
          {/* The auto-increase frequency/cycle is set by the plan at
              enrollment and can't be changed from this screen -- shown as
              plain read-only text, same non-editable pattern the
              enrollment flow uses for it (a "Cycle" label + value, no
              control). */}
          <div className="ai-row">
            <span>Cycle</span>
            <b>Calendar year</b>
          </div>
          <div className="ai-source-table">
            <div className="ai-row head">
              <span>Source</span>
              <span>Increment</span>
              <span>Max limit</span>
            </div>
            <AutoIncreaseRow
              label="Pre-Tax"
              hint="Applies to your Pre-Tax deferral rate."
              inc={pctPre}
              cap={capPre}
              onInc={(v) => onChange('pctPre', clamp(v, 1, 5))}
              onCap={(v) => onChange('capPre', clamp(v, pctPre + 1, 15))}
            />
            <AutoIncreaseRow
              label="Roth"
              hint="Applies to your Roth deferral rate."
              inc={pctRoth}
              cap={capRoth}
              onInc={(v) => onChange('pctRoth', clamp(v, 1, 5))}
              onCap={(v) => onChange('capRoth', clamp(v, pctRoth + 1, 15))}
            />
          </div>
        </div>
      )}
    </>
  )
}

const AUTO_FIELD_MAP = { on: 'autoOn', pctPre: 'autoPct', capPre: 'autoCap', pctRoth: 'autoPctRoth', capRoth: 'autoCapRoth' }

function PctInput({ value, onChange, min = 0, max = 15, ariaLabel }) {
  return (
    <span className="rg-affix pct">
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      <em>%</em>
    </span>
  )
}

const canDefer = (plan) => /401\(k\)/i.test(plan.type || '')
const isParticipatingPlan = (plan) => /enrolled|participating/i.test(`${plan.badge} ${plan.details?.status || ''}`)
const isEligibleOnlyPlan = (plan) => plan.badge === 'Eligible' || plan.badgeClass === 'eligible'

function deferralPlansFor(participant) {
  return (participant.plans || []).filter((p) => canDefer(p) && (isParticipatingPlan(p) || isEligibleOnlyPlan(p)))
}

function initialShares(plans, seedPre, seedRoth) {
  const shares = {}
  plans.forEach((p, i) => {
    shares[p.id] = i === 0 ? { pre: seedPre || 0, roth: seedRoth || 0 } : { pre: 0, roth: 0 }
  })
  return shares
}

function sumShares(shares) {
  return Object.values(shares).reduce(
    (acc, s) => ({ pre: acc.pre + (+s.pre || 0), roth: acc.roth + (+s.roth || 0) }),
    { pre: 0, roth: 0 }
  )
}

const blankAuto = () => ({ on: false, pctPre: 1, capPre: 10, pctRoth: 1, capRoth: 10 })

// Shared by both the single-plan (draft/baseline) and multi-plan
// (planShares/baselineShares) branches of the pre-save confirmation
// diff -- same comparison logic, just fed different before/after
// shapes, so the two branches can't silently drift out of sync with
// each other the way they did when this was duplicated inline (the
// single-plan branch was missing entirely, which is why the modal
// always said "No deferral changes to confirm" for anyone on a single
// plan -- the overwhelmingly common case).
function pushDeferralDiffRows(rows, before, after, beforeAuto, afterAuto, prefix) {
  if ((before.pre || 0) !== (after.pre || 0)) {
    rows.push({ label: `${prefix}Pre-Tax %`, was: `${before.pre || 0}%`, now: `${after.pre || 0}%` })
  }
  if ((before.roth || 0) !== (after.roth || 0)) {
    rows.push({ label: `${prefix}Roth %`, was: `${before.roth || 0}%`, now: `${after.roth || 0}%` })
  }
  if (!!beforeAuto.on !== !!afterAuto.on) {
    rows.push({ label: `${prefix}Auto increase`, was: beforeAuto.on ? 'Yes' : 'No', now: afterAuto.on ? 'Yes' : 'No' })
  }
  if (afterAuto.on && (beforeAuto.pctPre !== afterAuto.pctPre || beforeAuto.capPre !== afterAuto.capPre)) {
    rows.push({
      label: `${prefix}Auto increase rate (Pre-Tax)`,
      was: `+${beforeAuto.pctPre}% to ${beforeAuto.capPre}%`,
      now: `+${afterAuto.pctPre}% to ${afterAuto.capPre}%`
    })
  }
  if (afterAuto.on && (beforeAuto.pctRoth !== afterAuto.pctRoth || beforeAuto.capRoth !== afterAuto.capRoth)) {
    rows.push({
      label: `${prefix}Auto increase rate (Roth)`,
      was: `+${beforeAuto.pctRoth}% to ${beforeAuto.capRoth}%`,
      now: `+${afterAuto.pctRoth}% to ${afterAuto.capRoth}%`
    })
  }
}

function initialAuto(plans, seed) {
  const auto = {}
  plans.forEach((p, i) => {
    auto[p.id] =
      i === 0
        ? {
            on: !!seed.autoOn,
            pctPre: Math.max(1, +seed.autoPct || 1),
            capPre: Math.max(1, +seed.autoCap || 10),
            pctRoth: Math.max(1, +seed.autoPctRoth || +seed.autoPct || 1),
            capRoth: Math.max(1, +seed.autoCapRoth || +seed.autoCap || 10)
          }
        : blankAuto()
  })
  return auto
}

function aggregateAuto(auto) {
  const on = Object.values(auto).some((a) => a.on)
  const enabled = Object.values(auto).filter((a) => a.on)
  const pick = (key) => (enabled.length ? Math.max(...enabled.map((a) => +a[key] || 0)) : 1)
  return {
    autoOn: on,
    autoPct: pick('pctPre'),
    autoCap: Math.max(pick('pctPre'), pick('capPre')),
    autoPctRoth: pick('pctRoth'),
    autoCapRoth: Math.max(pick('pctRoth'), pick('capRoth'))
  }
}

export default function RetirementGoal() {
  const { participant } = useParticipant()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => hydratePrefs(participant))
  const [baseline, setBaseline] = useState(() => hydratePrefs(participant))
  const deferralPlans = useMemo(() => deferralPlansFor(participant), [participant])
  const multiPlan = deferralPlans.length > 1
  const [activePlanId, setActivePlanId] = useState(() => deferralPlans[0]?.id)
  const [planShares, setPlanShares] = useState(() => initialShares(deferralPlans, draft.pre, draft.roth))
  const [baselineShares, setBaselineShares] = useState(() => initialShares(deferralPlans, draft.pre, draft.roth))
  const [planAuto, setPlanAuto] = useState(() => initialAuto(deferralPlans, draft))
  const [baselineAuto, setBaselineAuto] = useState(() => initialAuto(deferralPlans, draft))
  const [open, setOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const savedTrapRef = useFocusTrap(savedOpen)
  useEscapeToClose(savedOpen, () => navigate('/', { state: { goalSaved: true } }))
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const [changes, setChanges] = useState([])
  const [delta, setDelta] = useState(null)
  // Captured at save time, before `baseline` resets to the new draft — used
  // to gate the confetti on an actual score increase this edit session,
  // not just on the resulting tier. Without this, a score that *dropped*
  // but stayed in the same good/ok tier still triggered confetti.
  const [saveScoreDelta, setSaveScoreDelta] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const prevScore = useRef(null)

  useEffect(() => {
    if (isNotEligibleUser(participant)) {
      navigate('/', { replace: true })
    }
  }, [participant, navigate])

  useEffect(() => {
    const next = hydratePrefs(participant)
    setDraft(next)
    setBaseline(next)
    const plans = deferralPlansFor(participant)
    const shares = initialShares(plans, next.pre, next.roth)
    const auto = initialAuto(plans, next)
    setActivePlanId(plans[0]?.id)
    setPlanShares(shares)
    setBaselineShares(shares)
    setPlanAuto(auto)
    setBaselineAuto(auto)
  }, [participant.id])

  const setPlanRate = (planId, key, value) => {
    const next = Math.max(0, Math.min(12, Math.round(+value || 0)))
    setPlanShares((prev) => {
      const updated = { ...prev, [planId]: { ...prev[planId], [key]: next } }
      const totals = sumShares(updated)
      setDraft((d) => ({ ...d, pre: totals.pre, roth: totals.roth }))
      return updated
    })
  }

  const setPlanAutoField = (planId, key, value) => {
    setPlanAuto((prev) => {
      const updated = { ...prev, [planId]: { ...(prev[planId] || blankAuto()), [key]: value } }
      setDraft((d) => ({ ...d, ...aggregateAuto(updated) }))
      return updated
    })
  }

  const currentAge = ageFromDob(participant.profile?.dob)
  const balance = parseMoney(participant.overall?.total)
  const live = useMemo(
    () => scoreGoal({ prefs: draft, currentAge, balance }),
    [draft, currentAge, balance]
  )
  const shownScore = useAnimatedNumber(live.score)

  useEffect(() => {
    const prev = prevScore.current
    if (prev == null) {
      prevScore.current = live.score
      return
    }
    if (live.score !== prev) {
      setDelta({ value: live.score - prev, key: Date.now() })
      if (prev < 80 && live.score >= 80) setCelebrate(true)
      prevScore.current = live.score
    }
  }, [live.score])

  useEffect(() => {
    if (!celebrate) return
    const t = window.setTimeout(() => setCelebrate(false), 2200)
    return () => window.clearTimeout(t)
  }, [celebrate])

  const setDraftField = (key, value) => setDraft((p) => ({ ...p, [key]: value }))
  const setRate = (key, value) => setDraft((p) => setRateOn(p, key, value))

  const startScore = useMemo(
    () => scoreGoal({ prefs: baseline, currentAge, balance }).score,
    [baseline, currentAge, balance]
  )

  const save = () => {
    writeMap(PREFS_KEY, participant.id, draft)
    writeMap(READINESS_KEY, participant.id, true)
    setChanges(goalDiff(baseline, draft, startScore, live.score))
    setSaveScoreDelta(live.score - startScore)
    setBaseline(draft)
    setBaselineShares(planShares)
    setBaselineAuto(planAuto)
    setSavedOpen(true)
  }

  // Deferral rate / auto-increase edits affect the participant's actual
  // paycheck deductions, so "Confirm changes" shows a before/after
  // comparison table before committing instead of saving immediately.
  const requestSave = () => setConfirmSaveOpen(true)
  const confirmSave = () => {
    setConfirmSaveOpen(false)
    save()
  }
  const confirmTrapRef = useFocusTrap(confirmSaveOpen)
  useEscapeToClose(confirmSaveOpen, () => setConfirmSaveOpen(false))

  // Deferral-only diff for the pre-save confirmation table -- unlike
  // goalDiff() (used for the post-save "what changed" summary, which also
  // covers goal inputs like location/salary), this looks only at what this
  // screen's Deferrals panel can actually change: per-plan Pre-Tax/Roth
  // rates and auto-increase on/off + rate. The auto-increase cycle itself
  // is never editable here, so it's never part of this diff.
  const deferralChangeRows = multiPlan
    ? deferralPlans.reduce((rows, p) => {
        const before = baselineShares[p.id] || { pre: 0, roth: 0 }
        const after = planShares[p.id] || { pre: 0, roth: 0 }
        const beforeAuto = baselineAuto[p.id] || blankAuto()
        const afterAuto = planAuto[p.id] || blankAuto()
        pushDeferralDiffRows(rows, before, after, beforeAuto, afterAuto, `${p.name} - `)
        return rows
      }, [])
    : (() => {
        const rows = []
        const before = { pre: baseline.pre || 0, roth: baseline.roth || 0 }
        const after = { pre: draft.pre || 0, roth: draft.roth || 0 }
        const beforeAuto = {
          on: baseline.autoOn,
          pctPre: baseline.autoPct,
          capPre: baseline.autoCap,
          pctRoth: baseline.autoPctRoth,
          capRoth: baseline.autoCapRoth
        }
        const afterAuto = {
          on: draft.autoOn,
          pctPre: draft.autoPct,
          capPre: draft.autoCap,
          pctRoth: draft.autoPctRoth,
          capRoth: draft.autoCapRoth
        }
        pushDeferralDiffRows(rows, before, after, beforeAuto, afterAuto, '')
        return rows
      })()

  const autoPct = Math.max(1, +draft.autoPct || 1)
  const autoCap = Math.max(autoPct, +draft.autoCap || 10)
  const autoPctRoth = Math.max(1, +draft.autoPctRoth || autoPct)
  const autoCapRoth = Math.max(autoPctRoth, +draft.autoCapRoth || autoCap)
  const spendHint = LOCATION_DEFAULTS[draft.location]?.monthlySpend
  const annualSpend = money((+draft.monthlySpend || 0) * 12)
  const saveTone = live.score >= 80 ? 'good' : live.score >= 55 ? 'ok' : 'warn'
  const saveIcon = saveTone === 'warn' ? faExclamationTriangle : saveTone === 'good' ? faTrophy : faCheckCircle
  const scoreRow = changes.find((row) => row.label === 'Readiness Score')
  const inputChanges = changes.filter((row) => row.label !== 'Readiness Score')
  const scoreWas = scoreRow ? parseInt(scoreRow.was, 10) : live.score
  const scoreNow = live.score
  const scoreDelta = scoreNow - scoreWas

  if (isNotEligibleUser(participant)) return null

  return (
    <div className="page-body rg-page">
      <div className="hi-bar">
        <div>
          <Link className="text-link rg-back" to="/">
            Back to dashboard
          </Link>
          <h1>Retirement readiness</h1>
        </div>
      </div>

      <div className="rg-shell">
        <aside className={`panel rg-live${celebrate ? ' win' : ''}`} aria-live="polite">
          <ReadinessChart
            score={shownScore}
            expense={live.expense}
            income={live.income}
            shortfall={live.shortfall}
            large
          />
          {delta && (
            <span key={delta.key} className={`rg-delta ${delta.value >= 0 ? 'up' : 'down'}`}>
              {delta.value >= 0 ? '+' : ''}
              {delta.value}
            </span>
          )}
          <dl className="rg-facts">
            <div>
              <dt>Retirement age</dt>
              <dd>{draft.retireAge}</dd>
            </div>
            <div>
              <dt>Years remaining</dt>
              <dd>{live.years}</dd>
            </div>
            {multiPlan ? (
              deferralPlans.map((plan) => {
                const share = planShares[plan.id] || { pre: 0, roth: 0 }
                return (
                  <div key={plan.id}>
                    <dt>{plan.name} deferral</dt>
                    <dd>{(share.pre || 0) + (share.roth || 0)}%</dd>
                  </div>
                )
              })
            ) : (
              <div>
                <dt>Deferrals</dt>
                <dd>{(draft.pre || 0) + (draft.roth || 0)}% of pay</dd>
              </div>
            )}
            <div>
              <dt>Auto increase</dt>
              <dd>{draft.autoOn ? `+${autoPct}% each year` : 'Off'}</dd>
            </div>
          </dl>
          <p className="rg-disc">
            <span className="rr-foot-note">*Not guaranteed results.</span>
            <button type="button" className="text-link rr-disclaimer-link rg-disc-top" onClick={() => setOpen(true)}>
              Disclaimer
            </button>
          </p>
        </aside>

        <div className="rg-work">
          <section className="panel rg-inputs">
            <h2>Retirement target</h2>
            <div className="rg-targets">
              <TargetCard icon={faMapMarkerAlt} label="Retirement location" hint="This information is used to determine the state tax">
                <Select
                  value={draft.location}
                  onChange={(e) => {
                    const location = e.target.value
                    const next = LOCATION_DEFAULTS[location] || LOCATION_DEFAULTS.Other
                    setDraft((p) => ({ ...p, location, monthlySpend: next.monthlySpend }))
                  }}
                  aria-label="Retirement location"
                >
                  {LOCATIONS.map((loc) => (
                    <Option key={loc}>{loc}</Option>
                  ))}
                </Select>
              </TargetCard>
              <TargetCard icon={faUmbrella} label="Planned retirement age" hint={`About ${live.years} years from now`}>
                <span className="rg-step">
                  <button
                    type="button"
                    aria-label="Lower age"
                    onClick={() => setDraftField('retireAge', clamp((+draft.retireAge || 67) - 1, 50, 80))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={50}
                    max={80}
                    value={draft.retireAge}
                    onChange={(e) => setDraftField('retireAge', clamp(Math.round(+e.target.value || 67), 50, 80))}
                    aria-label="Planned retirement age"
                  />
                  <button
                    type="button"
                    aria-label="Raise age"
                    onClick={() => setDraftField('retireAge', clamp((+draft.retireAge || 67) + 1, 50, 80))}
                  >
                    +
                  </button>
                </span>
              </TargetCard>
              <TargetCard
                icon={faCalendarAlt}
                label="Monthly spending"
                hint={spendHint ? `About ${annualSpend} a year · typical here is ${money(spendHint)}` : `${annualSpend} a year`}
              >
                <MoneyInput
                  value={draft.monthlySpend}
                  onChange={(n) => setDraftField('monthlySpend', Math.max(0, n))}
                  ariaLabel="Monthly spending"
                />
              </TargetCard>
              <TargetCard icon={faMoneyBillWave} label="Annual salary" hint="Drives how much each deferral percent saves">
                <MoneyInput value={draft.salary} onChange={(n) => setDraftField('salary', Math.max(0, n))} ariaLabel="Annual salary" />
              </TargetCard>
              <TargetCard
                icon={faDollarSign}
                label="Savings outside your 401(k)"
                hint="Brokerage, IRAs, and cash you expect to use in retirement"
              >
                <MoneyInput value={draft.outside} onChange={(n) => setDraftField('outside', Math.max(0, n))} ariaLabel="Savings outside your 401(k)" />
              </TargetCard>
            </div>
          </section>

          <section className="panel rg-inputs">
            {deferralPlans[0] && (
              // One common dropdown for every case — disabled when there's
              // only one deferral-eligible plan (nothing to choose between),
              // enabled when there's more than one, so the plan a
              // participant is editing is always explicit instead of
              // implied by a bare "Deferrals" heading. Placed above the
              // heading (rather than inside the panel body) and styled as
              // a clearly-bordered control so it doesn't read as plain text.
              <label className="rg-plan-single rg-plan-single--top">
                <span>Plan</span>
                <Select
                  value={activePlanId || deferralPlans[0].id}
                  disabled={!multiPlan}
                  onChange={(e) => setActivePlanId(e.target.value)}
                  aria-label="Plan"
                >
                  {deferralPlans.map((plan) => (
                    <Option key={plan.id} value={plan.id}>
                      {plan.name}
                    </Option>
                  ))}
                </Select>
              </label>
            )}
            <h2>Deferrals</h2>
            {multiPlan && (
              <p className="rg-plan-note">
                Select a plan to update its deferral rate. Changes will affect your paycheck deductions.
              </p>
            )}
            {(() => {
              const plan = multiPlan ? deferralPlans.find((p) => p.id === activePlanId) || deferralPlans[0] : deferralPlans[0]
              if (!plan) return null
              const share = multiPlan ? planShares[plan.id] || { pre: 0, roth: 0 } : { pre: draft.pre || 0, roth: draft.roth || 0 }
              const baseShare = multiPlan
                ? baselineShares[plan.id] || { pre: 0, roth: 0 }
                : { pre: baseline.pre || 0, roth: baseline.roth || 0 }
              const onPre = (v) => (multiPlan ? setPlanRate(plan.id, 'pre', v) : setRate('pre', v))
              const onRoth = (v) => (multiPlan ? setPlanRate(plan.id, 'roth', v) : setRate('roth', v))
              const autoState = multiPlan
                ? planAuto[plan.id] || blankAuto()
                : { on: draft.autoOn, pctPre: autoPct, capPre: autoCap, pctRoth: autoPctRoth, capRoth: autoCapRoth }
              const onAutoChange = (key, val) =>
                multiPlan ? setPlanAutoField(plan.id, key, val) : setDraftField(AUTO_FIELD_MAP[key], val)
              return (
                <div key={plan.id}>
                  <div className="rg-source">
                    <div className="rg-source-h">
                      <span>
                        <b>Pre-tax deferral</b>
                        <small>Goes in before taxes and can lower taxable income today.</small>
                      </span>
                      <PctInput value={share.pre || 0} onChange={onPre} max={12} ariaLabel="Pre-tax deferral rate" />
                    </div>
                    <RangeField
                      min={0}
                      max={12}
                      value={share.pre || 0}
                      origin={baseShare.pre || 0}
                      onChange={(e) => onPre(e.target.value)}
                      ariaLabel="Pre-tax deferral rate"
                    />
                  </div>
                  <div className="rg-source">
                    <div className="rg-source-h">
                      <span>
                        <b>Roth deferral</b>
                        <small>Goes in after taxes. Qualified withdrawals can come out tax-free.</small>
                      </span>
                      <PctInput value={share.roth || 0} onChange={onRoth} max={12} ariaLabel="Roth deferral rate" />
                    </div>
                    <RangeField
                      min={0}
                      max={12}
                      value={share.roth || 0}
                      origin={baseShare.roth || 0}
                      onChange={(e) => onRoth(e.target.value)}
                      ariaLabel="Roth deferral rate"
                    />
                  </div>
                  <AutoIncreaseBlock state={autoState} onChange={onAutoChange} />
                </div>
              )
            })()}
          </section>
        </div>
      </div>

      <div className="rg-nav">
        <button type="button" className="btn btn-primary" onClick={requestSave}>
          Update
        </button>
        <Link className="text-link" to="/">
          Cancel
        </Link>
      </div>

      {confirmSaveOpen && (
        <div className="enroll-modal-bg" role="presentation" onClick={() => setConfirmSaveOpen(false)}>
          <div
            ref={confirmTrapRef}
            className="enroll-modal rr-modal rg-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rg-confirm-save-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="rg-confirm-save-title">Confirm your deferral changes</h4>
            <p>
              You are trying to update your deferral settings. The changes shown below will update your current
              enrollment settings and will be reflected in your future paycheck deductions.
            </p>
            {deferralChangeRows.length ? (
              <div className="rg-confirm-table-wrap">
                <table className="rg-confirm-table">
                  <thead>
                    <tr>
                      <th scope="col">Deferrals</th>
                      <th scope="col">Previous value</th>
                      <th scope="col">Updated value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deferralChangeRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.was}</td>
                        <td>{row.now}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No deferral changes to confirm.</p>
            )}
            <div className="rg-confirm-actions">
              <button type="button" className="btn btn-primary" onClick={confirmSave}>
                Confirm changes
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmSaveOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {open && <DisclaimerModal onClose={() => setOpen(false)} />}

      {savedOpen && (
        <div className="enroll-modal-bg rg-save-bg" role="presentation">
          {/* Only celebrate an actual improvement — a score that dropped but
              stayed in the good/ok tier shouldn't still get confetti. */}
          {saveTone !== 'warn' && saveScoreDelta > 0 && <Confetti />}
          <div
            ref={savedTrapRef}
            className={`enroll-modal rr-modal rg-save rg-save--big ${saveTone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rg-saved-title"
            tabIndex={-1}
          >
            <div className="rg-save-hero">
              <span className="rg-save-mark" aria-hidden="true">
                <Icon icon={saveIcon} size={26} />
              </span>
              <h4 id="rg-saved-title">Goal saved</h4>
            </div>
            <div
              className="rg-save-score"
              aria-label={
                scoreDelta
                  ? `Readiness score ${scoreWas} percent to ${scoreNow} percent`
                  : `Readiness score ${scoreNow} percent`
              }
            >
              <div className="rg-save-score-row">
                {scoreRow && scoreDelta !== 0 && (
                  <>
                    <span>{scoreWas}%</span>
                    <em aria-hidden="true">→</em>
                  </>
                )}
                <b>{scoreNow}%</b>
              </div>
            </div>
            {inputChanges.length ? (
              <div className="rg-confirm-table-wrap">
                <table className="rg-confirm-table">
                  <thead>
                    <tr>
                      <th scope="col">Setting</th>
                      <th scope="col">Previous value</th>
                      <th scope="col">Updated value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputChanges.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{row.was}</td>
                        <td>{row.now}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No inputs changed. Your current goal is saved.</p>
            )}
            <div className="enroll-modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/', { state: { goalSaved: true } })}>
                Go to dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
