import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faExclamationTriangle, faInfoCircle, faCheck, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import Field, { FieldGroup } from '../common/Field.jsx'
import Select, { Option } from '../common/Select.jsx'
import DatePicker from '../common/DatePicker.jsx'
import { formatMoney, planBalance, planVested } from '../../lib/accountSummary'
import { sourcesFor, activeLoanFor } from '../../data/transactions.js'

// Participant version of the admin "New Withdrawal Request" prototype. Same
// data points and rules; admin-only overrides (fee, 1099 codes, penalty
// waiver, custom mailing address) are shown read-only or left out.

export const WD_PERSONA_KEY = 'lg-wd-persona'
const RMD = { year: 2026, age: 73, factor: 20.2 }
const PENALTY_RATE = 10
const PENALTY_FREE_AGE = 59.5
const ETF_FEE = 5
const OVERALL_FEE = 50
const MAX_FILE_MB = 2
const ANNUITANT = { lifeExpectancy: 10.2, age: 80, dob: '15/01/1946', rate: 4 }

const TYPES = [
  { id: 'INS', label: 'In-Service', display: 'In-Service - INS' },
  { id: 'RMD', label: 'Required Minimum Distribution', display: 'Required Minimum Distribution - RMD' },
  { id: 'SFS', label: 'Separation from Service', display: 'Separation from Service - SFS' },
  { id: 'hardship', label: 'Hardship', disabled: true },
  { id: 'permissible', label: 'Permissible Withdrawal', disabled: true },
  { id: 'forceout', label: 'Force out', disabled: true },
  { id: 'qbad', label: 'Qualified Birth and Adoption Distribution', disabled: true }
]
const MODES = [
  { id: 'self', label: 'Distribution to self', ratio: 1 },
  { id: 'beneficiary', label: 'Distribution to beneficiary', ratio: 1 },
  { id: 'rothIra', label: 'Rollover to Roth IRA', ratio: 0.6, rollover: true, excludes: 'pre-tax' },
  { id: 'tradIra', label: 'Rollover to Traditional IRA', ratio: 0.7, rollover: true, excludes: 'Roth' },
  { id: 'plan', label: 'Rollover to another plan', ratio: 1, rollover: true }
]
const CODES_1099 = { 1: 'Early distribution', 2: 'Early dist. exception', 7: 'Normal distribution', G: 'Direct rollover', H: 'Roth IRA rollover' }
const PERIODIC_KINDS = [
  { id: 'dollar', label: 'Specific Dollar' },
  { id: 'tenure', label: 'Specific Tenure' },
  { id: 'annuity', label: 'Annuitization' },
  { id: 'amort', label: 'Amortization', disabled: true }
]
const FREQ = [
  { id: 'monthly', label: 'Monthly', perYear: 12 },
  { id: 'quarterly', label: 'Quarterly', perYear: 4 },
  { id: 'semi', label: 'Semi-annually', perYear: 2 },
  { id: 'annual', label: 'Annually', perYear: 1 }
]
const DOCS = [
  { id: 'spousal', label: 'Spousal consent', types: ['INS', 'SFS'], required: true },
  { id: 'election', label: 'Distribution election form', types: ['INS', 'RMD', 'SFS'], required: true },
  { id: 'w4r', label: 'W-4R withholding election', types: ['INS', 'RMD'], required: false }
]
const ADDRESS = '2450 Mission Street, Apt 4B, San Francisco, CA 94110'
const BANK = { institution: 'JP Morgan Chase', type: 'Checking Account', number: '••••••4521', routing: '021000021' }
const ROLLOVER_ON_FILE = {
  rothIra: { planName: 'Fidelity Roth IRA', account: 'RIRA-55120934', trustee: 'Fidelity Management Trust' },
  tradIra: { planName: 'Fidelity Traditional IRA', account: 'TIRA-55120771', trustee: 'Fidelity Management Trust' },
  plan: { planName: 'Acme Corp 401(k) Plan', account: 'PLN-2210457', trustee: 'Empower Trust Company' }
}

const r2 = (n) => Math.round((+n || 0) * 100) / 100
const money = (n) => formatMoney(r2(n))
const clean = (v) => {
  let s = String(v).replace(/[^0-9.]/g, '')
  const d = s.indexOf('.')
  if (d !== -1) s = s.slice(0, d + 1) + s.slice(d + 1).replace(/\./g, '').slice(0, 2)
  return s
}
function ageFrom(dob) {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return 40
  const now = new Date()
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0)
}
// Prototype demo switch: the reference has an active (52) and a retired (80)
// participant so RMD / Separation from Service can be shown.
export function wdPersona(participant) {
  let p = null
  try {
    p = sessionStorage.getItem(WD_PERSONA_KEY)
  } catch {
    /* ignore */
  }
  return p === 'retired' ? { age: 80, status: 'Terminated' } : { age: ageFrom(participant.dob), status: 'Active' }
}

export function blankWithdrawal() {
  return {
    type: '',
    withdrawAs: 'one',
    entire: '',
    rmdAmount: '',
    periodic: { kind: '', total: '', installment: '', tenure: 'life', years: '', rate: '4.00', dateMode: 'fixed', date: '', freq: 'monthly' },
    allocations: [],
    docs: {},
    terms: false
  }
}

// ---------- calculations ----------
function periodicCalc(p) {
  const total = +p.total || 0
  const perYear = FREQ.find((f) => f.id === p.freq)?.perYear || 12
  if (p.kind === 'dollar') {
    const inst = +p.installment || 0
    return inst > 0 ? { count: Math.ceil(total / inst), amount: inst, perYear } : null
  }
  if (p.kind === 'tenure') {
    const years = p.tenure === 'life' ? ANNUITANT.lifeExpectancy : +p.years || 0
    const count = Math.round(years * perYear)
    return count > 0 ? { count, amount: total / count, perYear, years } : null
  }
  if (p.kind === 'annuity') {
    const n = Math.round(ANNUITANT.lifeExpectancy * perYear)
    const i = (+p.rate || 0) / 100 / perYear
    const amount = i ? (total * i) / (1 - Math.pow(1 + i, -n)) : total / n
    return n > 0 ? { count: n, amount, perYear } : null
  }
  return null
}
function periodicErrors(p, available) {
  const e = {}
  if (!p.kind) e.kind = 'Select the periodic payment type.'
  const total = +p.total || 0
  if (!(total > 0)) e.total = 'Enter an amount greater than $0.00.'
  else if (total > available + 1e-9) e.total = `Maximum amount available for withdrawal ${money(available)}`
  if (p.kind === 'dollar') {
    if (!(+p.installment > 0)) e.installment = 'Enter an installment amount greater than $0.00.'
    else if (+p.installment > total) e.installment = `Installment can't be more than the total amount ${money(total)}.`
  }
  if (p.kind === 'tenure' && p.tenure === 'other') {
    const y = +p.years
    if (!Number.isInteger(y) || y < 1 || y > 50) e.years = 'Enter whole years between 1 and 50.'
  }
  if (p.kind === 'annuity' && +p.rate > 20) e.rate = 'Interest rate must be 20% or less.'
  if (p.dateMode === 'custom') {
    if (!p.date) e.date = 'Select the first installment date.'
    else if (new Date(p.date) <= new Date()) e.date = 'Choose a date after today.'
  }
  return e
}
function scheduleRows(p) {
  const c = periodicCalc(p)
  if (!c) return []
  const months = 12 / c.perYear
  const start = p.dateMode === 'custom' && p.date ? new Date(p.date) : (() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 1)
  })()
  let remaining = +p.total || 0
  const rows = []
  for (let k = 0; k < Math.min(c.count, 600) && remaining > 0.004; k += 1) {
    const amt = Math.min(c.amount, remaining)
    remaining = r2(remaining - amt)
    const d = new Date(start.getFullYear(), start.getMonth() + k * months, start.getDate())
    rows.push({ n: k + 1, date: d.toLocaleDateString('en-US'), amt, remaining })
  }
  return rows
}
export function allocCalc(a, persona, type) {
  const mode = MODES.find((m) => m.id === a.mode)
  const gross = +a.amount || 0
  const rollover = !!mode?.rollover
  const fedPct = rollover ? 0 : +a.fedPct || 0
  const statePct = rollover ? 0 : +a.statePct || 0
  const penaltyFree = rollover || type === 'RMD' || persona.age >= PENALTY_FREE_AGE
  const penalty = penaltyFree ? 0 : (gross * PENALTY_RATE) / 100
  const fee = !rollover && a.payment === 'etf' ? ETF_FEE : 0
  const fed = (gross * fedPct) / 100
  const state = (gross * statePct) / 100
  const net = gross - fed - state - penalty - fee
  const codes = rollover
    ? a.mode === 'rothIra' ? ['H', 'G'] : ['G', 'G']
    : type === 'RMD' || persona.age >= PENALTY_FREE_AGE ? ['7', '7'] : ['1', '1']
  return { mode, gross, fed, state, penalty, fee, net, codes, rollover, fedPct, statePct }
}

// ---------- main ----------
export default function WithdrawalFlow({ step, plan, participant, form, set, onNext, onBack, onSubmit, onEdit }) {
  const navigate = useNavigate()
  const w = form.withdrawal || blankWithdrawal()
  const setW = (patch) =>
    set((f) => {
      const cur = f.withdrawal || blankWithdrawal()
      return { withdrawal: { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) } }
    })
  // Re-read when the Prototype demo switch changes the persona.
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('lg-wd-persona', on)
    return () => window.removeEventListener('lg-wd-persona', on)
  }, [])
  const persona = wdPersona(participant)
  const balance = planVested(plan)
  const accountBalance = planBalance(plan)
  const sources = sourcesFor(plan)
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null) // index or 'new'
  const [schedule, setSchedule] = useState(false)
  const [notice, setNotice] = useState(null)
  const [tried, setTried] = useState(false)

  const type = TYPES.find((t) => t.id === w.type)
  const isRmd = w.type === 'RMD'
  const isSfs = w.type === 'SFS'
  const periodic = isSfs && w.withdrawAs === 'periodic'
  const rmdMin = r2(balance / RMD.factor)
  const rmdEligible = persona.age >= RMD.age && persona.status !== 'Active'
  const blocked = (isRmd && !rmdEligible) || (isSfs && persona.status === 'Active')
  const rmdPartial = isRmd && w.entire === 'no'
  const rmdAmt = +w.rmdAmount || 0
  const rmdAmountErr = !rmdPartial
    ? ''
    : !(rmdAmt > 0)
      ? 'Enter the withdrawal amount.'
      : rmdAmt < rmdMin - 1e-9
        ? `Withdrawal amount must be at least the required minimum ${money(rmdMin)}.`
        : rmdAmt > balance + 1e-9
          ? `Maximum amount available for withdrawal ${money(balance)}`
          : ''
  const pErr = periodic ? periodicErrors(w.periodic, balance) : {}
  const periodicOk = !periodic || !Object.keys(pErr).length
  const cap = periodic ? +w.periodic.total || 0 : rmdPartial ? rmdAmt : balance
  const allocTotal = r2(w.allocations.reduce((t, a) => t + (+a.amount || 0), 0))
  const mustCover = !periodic && (w.entire === 'yes' || rmdPartial)
  const coverErr =
    mustCover && w.allocations.length && Math.abs(allocTotal - cap) > 0.009
      ? rmdPartial
        ? `The allocation amount (${money(allocTotal)}) must add up to the withdrawal amount (${money(cap)}). Update the allocation(s) or the withdrawal amount.`
        : `The allocation amount (${money(allocTotal)}) does not cover the entire account balance (${money(cap)}). Update the allocation(s) to withdraw the full balance, or choose No for a partial withdrawal.`
      : ''
  const canAdd = !!w.type && !blocked && periodicOk && !rmdAmountErr && (periodic || !!w.entire)
  const detailsOk = !!w.type && !blocked && periodicOk && !rmdAmountErr && (periodic || !!w.entire) && balance > 0
  const loan = activeLoanFor(participant, plan)

  const chooseType = (id) => {
    const wasRmd = w.type === 'RMD'
    setW((cur) => ({
      type: id,
      withdrawAs: id === 'SFS' ? cur.withdrawAs : 'one',
      entire: id === 'RMD' ? 'no' : 'yes',
      rmdAmount: id === 'RMD' ? String(r2(balance / RMD.factor)) : '',
      allocations: wasRmd !== (id === 'RMD') ? [] : cur.allocations
    }))
  }
  const setP = (patch) => setW((cur) => ({ periodic: { ...cur.periodic, ...patch } }))
  const saveAlloc = (a) => {
    setW((cur) => {
      const list = [...cur.allocations]
      if (editing === 'new') list.push(a)
      else list[editing] = a
      return { allocations: list }
    })
    setNotice(editing === 'new' ? { text: `Allocation of ${money(a.amount)} added.` } : { text: 'Allocation updated.' })
    setEditing(null)
  }
  const removeAlloc = (i) => {
    const removed = w.allocations[i]
    setW((cur) => ({ allocations: cur.allocations.filter((_, k) => k !== i) }))
    setNotice({
      text: `Removed ${MODES.find((m) => m.id === removed.mode)?.label} ${money(removed.amount)}.`,
      undo: () => setW((cur) => {
        const list = [...cur.allocations]
        list.splice(i, 0, removed)
        return { allocations: list }
      })
    })
  }
  const cancelRequest = () => {
    if (!w.type && !w.allocations.length) return navigate('/transactions')
    setConfirm({
      title: 'Discard this request?',
      body: 'You will lose the inputs and allocations you have added.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      onConfirm: () => navigate('/transactions')
    })
  }

  const docs = DOCS.filter((d) => d.types.includes(w.type))
  const docErr = (d) => {
    const s = w.docs[d.id] || { method: 'docusign' }
    return d.required && s.method === 'manual' && !s.file ? `${d.label} is required. Upload the PDF or switch to Use docusign.` : ''
  }

  const notesBar = notice && (
    <div className="plan-notice eligible-notice tf-notice" role="status">
      <span>{notice.text}</span>
      {notice.undo && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            notice.undo()
            setNotice(null)
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
  const dialogs = (
    <>
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      {editing !== null && (
        <AllocationSlideover
          initial={editing === 'new' ? null : w.allocations[editing]}
          max={r2(cap - allocTotal + (editing === 'new' ? 0 : +w.allocations[editing].amount || 0))}
          balance={balance}
          sources={sources}
          plan={plan}
          persona={persona}
          type={w.type}
          showSources={!periodic}
          onClose={() => setEditing(null)}
          onSave={saveAlloc}
        />
      )}
      {schedule && <ScheduleSlideover p={w.periodic} onClose={() => setSchedule(false)} />}
    </>
  )

  // ---------- step 1: details ----------
  if (step === 'details') {
    const pc = periodicCalc(w.periodic)
    const kindLabel = PERIODIC_KINDS.find((k) => k.id === w.periodic.kind)?.label
    return (
      <div className="txn-card wd2">
        <h3>Distribution Inputs</h3>
        <p className="hint">
          <Icon icon={faInfoCircle} size={13} /> The available amount ({money(balance)} vested of {money(accountBalance)}) is reported as of
          today and may change due to market fluctuations.
        </p>
        {balance <= 0 && (
          <div className="plan-notice opted-notice">{plan.name} has $0.00 available. Choose another plan to request a withdrawal.</div>
        )}
        <div className="txn-row">
          <Field label="Withdraw Type" required>
            <Select value={w.type} onChange={(e) => chooseType(e.target.value)} disabled={balance <= 0} placeholder="Select the withdrawal type">
              <Option value="">Select the withdrawal type</Option>
              {TYPES.map((t) => (
                <Option key={t.id} value={t.id} disabled={t.disabled}>
                  {t.disabled ? `${t.label} (not available)` : t.label}
                </Option>
              ))}
            </Select>
          </Field>
        </div>

        {isRmd && (
          <div className={`plan-notice ${rmdEligible ? 'eligible-notice' : 'opted-notice'} wd2-banner`}>
            {rmdEligible ? (
              <>
                <b>Eligible for Required Minimum Distribution</b> You are {persona.age} years old and {persona.status.toLowerCase()}, so you can
                request your {RMD.year} RMD.
              </>
            ) : (
              <>
                <b>Not eligible for Required Minimum Distribution</b> An RMD can only be requested from age {RMD.age} once you have left
                employment. You are {persona.age} and {persona.status.toLowerCase()}.
              </>
            )}
          </div>
        )}
        {isSfs && persona.status === 'Active' && (
          <div className="plan-notice opted-notice wd2-banner">
            <b>Not eligible for Separation from Service</b> Separation from Service (including periodic payments) is only available once you
            have left employment. You are currently active.
          </div>
        )}

        {w.type && !blocked && (
          <>
            <div className="txn-row spaced">
              <FieldGroup label="Withdraw as" note={!isSfs ? 'Periodic payment is available for Separation from Service only.' : undefined}>
                <div className="period" role="radiogroup" aria-label="Withdraw as">
                  {[
                    ['one', 'One time payment'],
                    ['periodic', 'Periodic payment']
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={w.withdrawAs === id}
                      className={w.withdrawAs === id ? 'on' : ''}
                      disabled={id === 'periodic' && !isSfs}
                      onClick={() => setW({ withdrawAs: id, allocations: [] })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FieldGroup>
              {!periodic && (
                <FieldGroup label="Withdraw Entire Balance">
                  <div className="period" role="radiogroup" aria-label="Withdraw entire balance">
                    {[
                      ['yes', 'Yes'],
                      ['no', 'No']
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={w.entire === id}
                        className={w.entire === id ? 'on' : ''}
                        onClick={() => setW({ entire: id })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              )}
              <Field label="Overall Withdraw Fee" tooltip="Set by your plan. Deducted once from the total withdrawal.">
                <input type="text" value={money(OVERALL_FEE)} readOnly disabled />
              </Field>
            </div>

            {w.entire === 'yes' && loan && !periodic && (
              <div className="wd-note">
                You have an outstanding loan on this plan. Withdrawing your entire balance applies the default loan treatment first.
              </div>
            )}

            {isRmd && (
              <div className="txn-row spaced">
                <Field label="RMD year">
                  <input type="text" value={RMD.year} readOnly disabled />
                </Field>
                <Field label="Required minimum amount">
                  <input type="text" value={money(rmdMin)} readOnly disabled />
                </Field>
                {rmdPartial && (
                  <Field
                    label="Withdrawal amount"
                    required
                    note={rmdAmountErr || `Minimum ${money(rmdMin)} (prior year-end balance ÷ IRS factor ${RMD.factor}). You can withdraw more, up to ${money(balance)}.`}
                    noteClass={rmdAmountErr ? 'err' : undefined}
                  >
                    <input type="text" inputMode="decimal" value={w.rmdAmount} onChange={(e) => setW({ rmdAmount: clean(e.target.value) })} />
                  </Field>
                )}
              </div>
            )}

            {periodic && (
              <div className="wd2-periodic">
                <div className="txn-row spaced">
                  <Field label="Periodic payment" required note={tried && pErr.kind} noteClass="err">
                    <Select value={w.periodic.kind} onChange={(e) => setP({ kind: e.target.value })} placeholder="Select">
                      <Option value="">Select</Option>
                      {PERIODIC_KINDS.map((k) => (
                        <Option key={k.id} value={k.id} disabled={k.disabled}>
                          {k.disabled ? `${k.label} (not available yet)` : k.label}
                        </Option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {w.periodic.kind && (
                  <>
                    <h4 className="wd2-sub">{kindLabel} Details</h4>
                    <div className="txn-row">
                      <Field label="Total available amount" required note={pErr.total && (tried || w.periodic.total) ? pErr.total : `Up to ${money(balance)}`} noteClass={pErr.total && (tried || w.periodic.total) ? 'err' : undefined}>
                        <input type="text" inputMode="decimal" value={w.periodic.total} onChange={(e) => setP({ total: clean(e.target.value) })} placeholder="0.00" />
                      </Field>
                      {w.periodic.kind === 'dollar' && (
                        <Field label="Installment amount" required note={pErr.installment && (tried || w.periodic.installment) ? pErr.installment : undefined} noteClass="err">
                          <input type="text" inputMode="decimal" value={w.periodic.installment} onChange={(e) => setP({ installment: clean(e.target.value) })} placeholder="0.00" />
                        </Field>
                      )}
                      {w.periodic.kind === 'tenure' && (
                        <Field label="Specific Tenure" required>
                          <Select value={w.periodic.tenure} onChange={(e) => setP({ tenure: e.target.value })}>
                            <Option value="life">My life expectancy</Option>
                            <Option value="other">Other</Option>
                          </Select>
                        </Field>
                      )}
                      {w.periodic.kind === 'tenure' && w.periodic.tenure === 'other' && (
                        <Field label="Number of years" required note={pErr.years && (tried || w.periodic.years) ? pErr.years : undefined} noteClass="err">
                          <input type="text" inputMode="numeric" value={w.periodic.years} onChange={(e) => setP({ years: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                        </Field>
                      )}
                      {w.periodic.kind === 'annuity' && (
                        <Field label="Interest rate (%)" required note={pErr.rate} noteClass="err">
                          <input type="text" inputMode="decimal" value={w.periodic.rate} onChange={(e) => setP({ rate: clean(e.target.value) })} />
                        </Field>
                      )}
                    </div>
                    {(w.periodic.kind === 'annuity' || (w.periodic.kind === 'tenure' && w.periodic.tenure === 'life')) && (
                      <div className="txn-row">
                        <Field label="Life expectancy (years)">
                          <input type="text" value={ANNUITANT.lifeExpectancy} readOnly disabled />
                        </Field>
                        <Field label="Current age">
                          <input type="text" value={persona.age} readOnly disabled />
                        </Field>
                        <Field label="Date of birth">
                          <input type="text" value={participant.dob || ANNUITANT.dob} readOnly disabled />
                        </Field>
                      </div>
                    )}
                    <div className="txn-row">
                      <FieldGroup label="Installment date">
                        <div className="period" role="radiogroup" aria-label="Installment date">
                          {[
                            ['fixed', 'Fixed date'],
                            ['custom', 'Custom date']
                          ].map(([id, label]) => (
                            <button key={id} type="button" role="radio" aria-checked={w.periodic.dateMode === id} className={w.periodic.dateMode === id ? 'on' : ''} onClick={() => setP({ dateMode: id })}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </FieldGroup>
                      {w.periodic.dateMode === 'fixed' ? (
                        <Field label="Date">
                          <input type="text" value="1st of every period" readOnly disabled />
                        </Field>
                      ) : (
                        <Field label="First installment date" required note={pErr.date && (tried || w.periodic.date) ? pErr.date : undefined} noteClass="err">
                          <DatePicker value={w.periodic.date} onChange={(v) => setP({ date: v })} />
                        </Field>
                      )}
                      <Field label="Disbursement Frequency" required>
                        <Select value={w.periodic.freq} onChange={(e) => setP({ freq: e.target.value })}>
                          {FREQ.map((f) => (
                            <Option key={f.id} value={f.id}>
                              {f.label}
                            </Option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    {pc && !pErr.total && (
                      <p className="wd2-result">
                        {money(pc.amount)} {FREQ.find((f) => f.id === w.periodic.freq).label.toLowerCase()} · {pc.count} installments ·{' '}
                        <button type="button" className="text-link" onClick={() => setSchedule(true)} disabled={!periodicOk}>
                          View payment schedule →
                        </button>
                      </p>
                    )}
                    {!periodicOk && <p className="hint">Complete the periodic payment details to view the schedule.</p>}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div className="txn-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!detailsOk}
            onClick={() => {
              setTried(true)
              if (detailsOk) onNext()
            }}
          >
            Continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancelRequest}>
            Cancel
          </button>
        </div>
        {dialogs}
      </div>
    )
  }

  // ---------- step 2: allocation ----------
  if (step === 'allocation') {
    const ok = w.allocations.length > 0 && !coverErr
    return (
      <div className="txn-card wd2">
        <div className="wd2-head">
          <div>
            <h3>Withdrawal Allocation</h3>
            <p className="hint">
              {type?.display} · {periodic ? 'Periodic payment' : 'One time payment'} · up to {money(cap)}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" disabled={!canAdd || allocTotal >= cap - 0.009} onClick={() => setEditing('new')}>
            Add Allocation
          </button>
        </div>
        {!w.allocations.length ? (
          <div className="wd-note">Add how the money is paid out: to you, a beneficiary, or rolled over to an IRA or another plan.</div>
        ) : (
          <div className="table-wrap">
            <table className="alloc-table wd2-table">
              <thead>
                <tr>
                  <th scope="col">Allocation &amp; Payment</th>
                  <th scope="col">1099 codes</th>
                  <th scope="col" className="num">Gross</th>
                  <th scope="col" className="num">State tax</th>
                  <th scope="col" className="num">Federal tax</th>
                  <th scope="col" className="num">Penalty</th>
                  <th scope="col" className="num">Fee</th>
                  <th scope="col" className="num">Net</th>
                  <th scope="col" className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {w.allocations.map((a, i) => {
                  const c = allocCalc(a, persona, w.type)
                  return (
                    <tr key={i}>
                      <td className="alloc-name-col">
                        <span className="alloc-name">{c.mode.label}</span>
                        <span className="tf-meta">{paymentLine(a, c, plan)}</span>
                      </td>
                      <td>
                        Roth {c.codes[0]}
                        <small className="wd2-pct">Non Roth {c.codes[1]}</small>
                      </td>
                      <td className="num">{money(c.gross)}</td>
                      <td className="num">
                        {money(c.state)}
                        <small className="wd2-pct">{c.statePct}%</small>
                      </td>
                      <td className="num">
                        {money(c.fed)}
                        <small className="wd2-pct">{c.fedPct}%</small>
                      </td>
                      <td className="num">
                        {c.rollover ? 'Rollover' : c.penalty ? money(c.penalty) : 'None'}
                        {c.penalty > 0 && <small className="wd2-pct">{PENALTY_RATE}%</small>}
                      </td>
                      <td className="num">
                        {c.rollover ? 'Rollover' : c.fee ? money(c.fee) : 'No fee'}
                        {c.fee > 0 && <small className="wd2-pct">ETF fee</small>}
                      </td>
                      <td className="num">
                        <b>{money(c.net)}</b>
                      </td>
                      <td className="num">
                        <span className="tf-actions">
                          <button type="button" className="icon-btn" aria-label="Edit allocation" onClick={() => setEditing(i)}>
                            <Icon icon={faPen} size={13} />
                          </button>
                          <button type="button" className="icon-btn" aria-label="Remove allocation" onClick={() => removeAlloc(i)}>
                            <Icon icon={faTrash} size={13} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
                <tr className="alloc-total">
                  <td colSpan={2}>Total</td>
                  <td className="num">{money(allocTotal)}</td>
                  <td colSpan={6} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {coverErr && (
          <p className="alloc-warn" role="alert">
            <Icon icon={faExclamationTriangle} size={12} /> {coverErr}
          </p>
        )}
        {notesBar}
        <div className="txn-actions">
          <button type="button" className="btn btn-primary" disabled={!ok} onClick={onNext}>
            Continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
        </div>
        {dialogs}
      </div>
    )
  }

  // ---------- step 3: documents ----------
  if (step === 'documents') {
    const ok = docs.every((d) => !docErr(d))
    return (
      <div className="txn-card wd2">
        <h3>Required Documents</h3>
        <p className="hint">Accepted file: PDF · Max file size: {MAX_FILE_MB} MB</p>
        {docs.map((d) => (
          <DocBlock key={d.id} doc={d} state={w.docs[d.id] || { method: 'docusign' }} error={tried ? docErr(d) : ''} onChange={(s) => setW((cur) => ({ docs: { ...cur.docs, [d.id]: s } }))} />
        ))}
        <div className="txn-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setTried(true)
              if (ok) onNext()
            }}
          >
            Continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    )
  }

  // ---------- step 4: review ----------
  const calcs = w.allocations.map((a) => allocCalc(a, persona, w.type))
  const sum = (k) => calcs.reduce((t, c) => t + c[k], 0)
  const gross = sum('gross')
  const deductions = [
    ['Federal tax', sum('fed')],
    ['State tax', sum('state')],
    ['Early withdrawal penalty', sum('penalty')],
    ['ETF fee', sum('fee')],
    ['Overall withdraw fee', OVERALL_FEE]
  ].filter(([, v]) => v > 0)
  const totalDed = deductions.reduce((t, [, v]) => t + v, 0)
  const pc = periodic ? periodicCalc(w.periodic) : null
  return (
    <div className="txn-card wd2">
      <h3>Review your withdrawal</h3>
      <p className="hint">Requests are usually processed within 10 business days after approval.</p>

      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>
            <span className="tf-col-num">1</span> Withdrawal Details
          </h4>
          <button type="button" className="text-link" onClick={() => onEdit?.('details')}>
            Edit
          </button>
        </div>
        <p className="wd2-tags">
          <span className="badge navy">{type?.display}</span>
          <span className="badge navy">{periodic ? 'Periodic payment' : 'One time payment'}</span>
          {!periodic && <span className="badge navy">Withdraw entire balance: {w.entire === 'yes' ? 'Yes' : 'No'}</span>}
        </p>
        <ul className="detail-rows">
          <li>
            <span>Gross withdrawal amount</span>
            <b>{money(gross)}</b>
          </li>
          <li className="wd2-ded">
            <details>
              <summary>
                <span>Fee &amp; Tax details</span>
                <b>−{money(totalDed)}</b>
              </summary>
              <ul>
                {deductions.map(([k, v]) => (
                  <li key={k}>
                    <span>{k}</span>
                    <span>−{money(v)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
          <li className="wd2-net">
            <span>Net withdrawal amount</span>
            <b>{money(gross - totalDed)}</b>
          </li>
        </ul>
        {isRmd && (
          <p className="hint">
            RMD {RMD.year}: required minimum {money(rmdMin)} · withdrawing {money(rmdPartial ? rmdAmt : balance)}
          </p>
        )}
      </section>

      {periodic && pc && (
        <section className="wd2-sum">
          <div className="wd2-sum-h">
            <h4>
              <span className="tf-col-num">2</span> Payment schedule
            </h4>
            <button type="button" className="text-link" onClick={() => setSchedule(true)}>
              View schedule
            </button>
          </div>
          <ul className="detail-rows">
            <li>
              <span>Periodic payment</span>
              <b>{PERIODIC_KINDS.find((k) => k.id === w.periodic.kind)?.label}</b>
            </li>
            <li>
              <span>Total amount</span>
              <b>{money(w.periodic.total)}</b>
            </li>
            <li>
              <span>Installment amount</span>
              <b>{money(pc.amount)}</b>
            </li>
            <li>
              <span>Number of installments</span>
              <b>
                {pc.count} · {FREQ.find((f) => f.id === w.periodic.freq).label}
              </b>
            </li>
            <li>
              <span>Installment date</span>
              <b>{w.periodic.dateMode === 'fixed' ? '1st of every period' : w.periodic.date}</b>
            </li>
          </ul>
        </section>
      )}

      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>
            <span className="tf-col-num">{periodic ? 3 : 2}</span> Withdrawal Allocation
          </h4>
          <button type="button" className="text-link" onClick={() => onEdit?.('allocation')}>
            Edit
          </button>
        </div>
        <div className="table-wrap">
          <table className="alloc-table">
            <thead>
              <tr>
                <th scope="col">Allocation &amp; Payment</th>
                <th scope="col">1099 codes</th>
                <th scope="col">Source</th>
                <th scope="col" className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {w.allocations.map((a, i) => (
                <tr key={i}>
                  <td className="alloc-name-col">
                    <span className="alloc-name">{calcs[i].mode.label}</span>
                    <span className="tf-meta">{paymentLine(a, calcs[i], plan)}</span>
                  </td>
                  <td>
                    Roth {calcs[i].codes[0]} · Non Roth {calcs[i].codes[1]}
                  </td>
                  <td>
                    <span className="tf-chips">
                      {a.sourceMode === 'choose'
                        ? Object.entries(a.sources || {})
                            .filter(([, v]) => +v > 0)
                            .map(([id, v]) => (
                              <span key={id} className="badge navy">
                                {sources.find((s) => s.id === id)?.name} {money(v)}
                              </span>
                            ))
                        : <span className="badge navy">Pro-rata across sources</span>}
                    </span>
                  </td>
                  <td className="num">
                    <b>{money(calcs[i].net)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>
            <span className="tf-col-num">{periodic ? 4 : 3}</span> Documents
          </h4>
          <button type="button" className="text-link" onClick={() => onEdit?.('documents')}>
            Edit
          </button>
        </div>
        <ul className="detail-rows">
          {docs.map((d) => {
            const s = w.docs[d.id] || { method: 'docusign' }
            return (
              <li key={d.id}>
                <span>{d.label}</span>
                <b>{s.method === 'manual' ? s.file?.name || 'Not uploaded' : 'Sent via Docusign'}</b>
              </li>
            )
          })}
        </ul>
        {docs.some((d) => (w.docs[d.id]?.method || 'docusign') === 'docusign') && (
          <p className="hint">You will receive the Docusign documents by email to sign.</p>
        )}
      </section>

      <label className="alloc-apply-all tf-ack">
        <input type="checkbox" checked={!!w.terms} onChange={(e) => setW({ terms: e.target.checked })} />
        <span>By checking this box, I declare that I have read the Terms &amp; Conditions.</span>
      </label>
      <div className="txn-actions">
        <button type="button" className="btn btn-primary" disabled={!w.terms} onClick={onSubmit}>
          Submit Request
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setW({ terms: false })
            onBack()
          }}
        >
          Back
        </button>
      </div>
      {dialogs}
    </div>
  )
}

function paymentLine(a, c, plan) {
  if (c.rollover) return `${a.delivery === 'wire' ? 'Wire transfer' : 'Check mailed to trustee'} · ${a.rollover?.planName || plan.name}`
  return a.payment === 'check' ? 'Mail check · Address on file' : `ETF · ${a.bank === 'custom' ? a.customBank?.institution || 'New bank' : 'Bank on file'}`
}

// ---------- allocation slide-out ----------
function AllocationSlideover({ initial, max, balance, sources, plan, persona, type, showSources, onClose, onSave }) {
  const [a, setA] = useState(
    () =>
      initial || {
        mode: '',
        amount: '',
        fedPct: '20',
        statePct: '0',
        payment: 'etf',
        bank: 'records',
        customBank: { institution: '', holder: '', type: 'Checking Account', number: '', routing: '', email: '', phone: '' },
        rollover: null,
        delivery: 'check',
        sourceMode: 'prorata',
        sources: {}
      }
  )
  const set = (patch) => setA((cur) => ({ ...cur, ...patch }))
  const mode = MODES.find((m) => m.id === a.mode)
  const modeMax = mode ? r2(Math.min(max, balance * mode.ratio)) : max
  const c = allocCalc(a, persona, type)
  const amt = +a.amount || 0
  const errs = {}
  if (a.amount !== '' && amt > modeMax + 1e-9) errs.amount = modeMax <= 0 ? 'No balance left to allocate.' : `Maximum amount available for ${mode?.rollover ? 'rollover' : 'withdrawal'} ${money(modeMax)}`
  if (+a.fedPct > 100 || +a.statePct > 100) errs.tax = 'Enter a rate between 0 and 100%.'
  if (amt > 0 && c.net <= 0) errs.net = 'Deductions are more than the allocation amount. Lower the tax rates.'
  if (mode?.rollover && a.rollover?.account && !/^[A-Za-z0-9-]{5,20}$/.test(a.rollover.account)) errs.account = 'Account / IRA no must be 5 to 20 letters, numbers or dashes.'
  const cb = a.customBank
  if (!mode?.rollover && a.payment === 'etf' && a.bank === 'custom') {
    if (cb.number && !/^\d{4,17}$/.test(cb.number)) errs.number = 'Account number must be 4 to 17 digits.'
    if (cb.routing && !/^\d{9}$/.test(cb.routing)) errs.routing = 'ABA routing number must be 9 digits.'
    if (cb.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cb.email)) errs.email = 'Enter a valid email ID, e.g. name@company.com.'
  }
  const srcTotal = r2(Object.values(a.sources || {}).reduce((t, v) => t + (+v || 0), 0))
  sources.forEach((s) => {
    if (a.sourceMode === 'choose' && +a.sources[s.id] > s.amount + 1e-9) errs[`src-${s.id}`] = `More than available ${money(s.amount)}.`
  })
  const srcMsg =
    showSources && a.sourceMode === 'choose' && amt > 0 && Math.abs(srcTotal - amt) > 0.009
      ? srcTotal < amt
        ? `${money(amt - srcTotal)} left to allocate. Sources must add up to ${money(amt)}.`
        : `Over by ${money(srcTotal - amt)}. Sources must add up to ${money(amt)}.`
      : ''
  const missing = !a.mode
    ? 'Select the distribution mode'
    : !(amt > 0)
      ? 'Enter the allocation amount'
      : mode.rollover && !(a.rollover?.planName && a.rollover?.account && a.rollover?.trustee)
        ? 'Fill in the rollover information'
        : !mode.rollover && a.payment === 'etf' && a.bank === 'custom' && !(cb.institution && cb.holder && cb.number && cb.routing)
          ? 'Fill in the custom bank details'
          : ''
  const canSave = !missing && !Object.keys(errs).length && !srcMsg

  const pickMode = (id) => {
    const m = MODES.find((x) => x.id === id)
    set({ mode: id, rollover: m.rollover ? { ...ROLLOVER_ON_FILE[id] } : null })
  }

  return (
    <Slideover
      title={initial ? 'Edit Withdrawal Allocation' : 'Add Withdrawal Allocation'}
      width="wide"
      closeButton={false}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-primary" disabled={!canSave} title={missing || undefined} onClick={() => onSave(a)}>
            Save
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="wd2-so">
        <h4 className="wd2-sub">Distribution</h4>
        <FieldGroup label="Select distribution mode" required>
          <div className="choice-list wd2-modes" role="radiogroup">
            {MODES.map((m) => {
              const off = type === 'RMD' && m.rollover
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={a.mode === m.id}
                  className={`choice${a.mode === m.id ? ' on' : ''}`}
                  disabled={off}
                  onClick={() => pickMode(m.id)}
                >
                  <span className="choice-dot" aria-hidden="true" />
                  <span>
                    <b>{m.label}</b>
                    <small>{off ? "RMD amounts can't be rolled over" : `Available ${money(Math.min(max, balance * m.ratio))}${m.excludes ? ` (excludes ${m.excludes} balance)` : ''}`}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </FieldGroup>
        <div className="txn-row spaced">
          <Field label="Allocation amount" required note={errs.amount || (mode ? `Maximum amount available for ${mode.rollover ? 'rollover' : 'withdrawal'} ${money(modeMax)}` : undefined)} noteClass={errs.amount ? 'err' : undefined}>
            <input type="text" inputMode="decimal" value={a.amount} disabled={!a.mode} placeholder="0.00" onChange={(e) => set({ amount: clean(e.target.value) })} />
          </Field>
        </div>

        {mode && (
          <>
            <h4 className="wd2-sub">Tax &amp; Penalty</h4>
            <div className="txn-row">
              <Field label="1099 code (Roth)">
                <input type="text" value={`${c.codes[0]} - ${CODES_1099[c.codes[0]]}`} readOnly disabled />
              </Field>
              <Field label="1099 code (Non Roth)">
                <input type="text" value={`${c.codes[1]} - ${CODES_1099[c.codes[1]]}`} readOnly disabled />
              </Field>
            </div>
            {!mode.rollover && (
              <div className="txn-row">
                <Field label="Federal tax withholding (%)" note={errs.tax || `${money(c.fed)} tax deduction`} noteClass={errs.tax ? 'err' : undefined}>
                  <input type="text" inputMode="decimal" value={a.fedPct} onChange={(e) => set({ fedPct: clean(e.target.value) })} />
                </Field>
                <Field label="State tax withholding (%)" note={`${money(c.state)} tax deduction`}>
                  <input type="text" inputMode="decimal" value={a.statePct} onChange={(e) => set({ statePct: clean(e.target.value) })} />
                </Field>
              </div>
            )}
            {c.penalty > 0 && (
              <div className="wd-note">
                <b>Early withdrawal penalty applies.</b> You are under 59½, so a {PENALTY_RATE}% early withdrawal penalty ({money(c.penalty)}) will be
                deducted.
              </div>
            )}

            {!mode.rollover ? (
              <>
                <h4 className="wd2-sub">Payment method</h4>
                <div className="period" role="radiogroup" aria-label="Payment method">
                  {[
                    ['check', 'Mail check to address'],
                    ['etf', 'ETF']
                  ].map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={a.payment === id} className={a.payment === id ? 'on' : ''} onClick={() => set({ payment: id })}>
                      {label}
                    </button>
                  ))}
                </div>
                {a.payment === 'check' ? (
                  <ul className="detail-rows wd2-ro">
                    <li>
                      <span>Mailing address (as in your records)</span>
                      <b>{ADDRESS}</b>
                    </li>
                  </ul>
                ) : (
                  <>
                    <ul className="detail-rows wd2-ro">
                      <li>
                        <span>ETF fee</span>
                        <b>{money(ETF_FEE)}</b>
                      </li>
                    </ul>
                    <FieldGroup label="Select bank details">
                      <div className="period" role="radiogroup" aria-label="Bank details">
                        {[
                          ['records', 'As in my records'],
                          ['custom', 'Custom']
                        ].map(([id, label]) => (
                          <button key={id} type="button" role="radio" aria-checked={a.bank === id} className={a.bank === id ? 'on' : ''} onClick={() => set({ bank: id })}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>
                    {a.bank === 'records' ? (
                      <ul className="detail-rows wd2-ro">
                        <li>
                          <span>Bank</span>
                          <b>{BANK.institution}</b>
                        </li>
                        <li>
                          <span>Account</span>
                          <b>
                            {BANK.type} {BANK.number}
                          </b>
                        </li>
                        <li>
                          <span>Routing number</span>
                          <b>{BANK.routing}</b>
                        </li>
                      </ul>
                    ) : (
                      <>
                        <div className="txn-row spaced">
                          <Field label="Financial institution" required>
                            <input type="text" value={cb.institution} onChange={(e) => set({ customBank: { ...cb, institution: e.target.value } })} />
                          </Field>
                          <Field label="Account holder name" required>
                            <input type="text" value={cb.holder} onChange={(e) => set({ customBank: { ...cb, holder: e.target.value } })} />
                          </Field>
                        </div>
                        <div className="txn-row">
                          <Field label="Account type" required>
                            <Select value={cb.type} onChange={(e) => set({ customBank: { ...cb, type: e.target.value } })}>
                              <Option value="Savings Account">Savings Account</Option>
                              <Option value="Checking Account">Checking Account</Option>
                            </Select>
                          </Field>
                          <Field label="Account number" required note={errs.number} noteClass="err">
                            <input type="text" inputMode="numeric" value={cb.number} onChange={(e) => set({ customBank: { ...cb, number: e.target.value.replace(/\D/g, '').slice(0, 17) } })} />
                          </Field>
                          <Field label="ABA routing number" required note={errs.routing} noteClass="err">
                            <input type="text" inputMode="numeric" value={cb.routing} onChange={(e) => set({ customBank: { ...cb, routing: e.target.value.replace(/\D/g, '').slice(0, 9) } })} />
                          </Field>
                        </div>
                        <div className="txn-row">
                          <Field label="Email ID" note={errs.email} noteClass="err">
                            <input type="email" value={cb.email} onChange={(e) => set({ customBank: { ...cb, email: e.target.value } })} />
                          </Field>
                          <Field label="Mobile No">
                            <input type="tel" value={cb.phone} onChange={(e) => set({ customBank: { ...cb, phone: e.target.value.replace(/[^\d+ -]/g, '') } })} />
                          </Field>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <h4 className="wd2-sub">Rollover Information</h4>
                <p className="hint">Pre-filled with the rollover account on file. Update it if it has changed.</p>
                <div className="txn-row">
                  <Field label="Plan name" required>
                    <input type="text" value={a.rollover?.planName || ''} onChange={(e) => set({ rollover: { ...a.rollover, planName: e.target.value } })} />
                  </Field>
                  <Field label="Account / IRA no" required note={errs.account} noteClass="err">
                    <input type="text" value={a.rollover?.account || ''} onChange={(e) => set({ rollover: { ...a.rollover, account: e.target.value } })} />
                  </Field>
                  <Field label="Company / Trustee name" required>
                    <input type="text" value={a.rollover?.trustee || ''} onChange={(e) => set({ rollover: { ...a.rollover, trustee: e.target.value } })} />
                  </Field>
                </div>
                <FieldGroup label="Rollover delivery">
                  <div className="period" role="radiogroup" aria-label="Rollover delivery">
                    {[
                      ['check', 'Check mailed to trustee'],
                      ['wire', 'Wire transfer']
                    ].map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={a.delivery === id} className={a.delivery === id ? 'on' : ''} onClick={() => set({ delivery: id })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              </>
            )}

            {showSources && (
              <>
                <h4 className="wd2-sub">Source details</h4>
                <div className="period" role="radiogroup" aria-label="Source selection">
                  {[
                    ['prorata', 'Pro-Rata'],
                    ['choose', 'Allow me to choose']
                  ].map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={a.sourceMode === id} className={a.sourceMode === id ? 'on' : ''} onClick={() => set({ sourceMode: id })}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="table-wrap wd2-src">
                  <table className="alloc-table">
                    <thead>
                      <tr>
                        <th scope="col">Source</th>
                        <th scope="col" className="num">Available</th>
                        <th scope="col" className="num">Gross withdrawal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => {
                        const total = sources.reduce((t, x) => t + x.amount, 0) || 1
                        return (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td className="num">{money(s.amount)}</td>
                            <td className="num">
                              {a.sourceMode === 'choose' ? (
                                <span className="tf-amount-wrap">
                                  <span className={`alloc-pct-input${errs[`src-${s.id}`] ? ' tf-bad' : ''}`}>
                                    <i>$</i>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      aria-label={`${s.name} gross withdrawal`}
                                      value={a.sources[s.id] || ''}
                                      onChange={(e) => set({ sources: { ...a.sources, [s.id]: clean(e.target.value) } })}
                                    />
                                  </span>
                                  {errs[`src-${s.id}`] && <small className="tf-max over">{errs[`src-${s.id}`]}</small>}
                                </span>
                              ) : (
                                money((amt * s.amount) / total)
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {srcMsg && (
                  <p className="alloc-warn">
                    <Icon icon={faExclamationTriangle} size={12} /> {srcMsg}
                  </p>
                )}
              </>
            )}

            <ul className="detail-rows wd2-calc">
              <li>
                <span>Gross</span>
                <b>{money(c.gross)}</b>
              </li>
              {c.fed > 0 && (
                <li>
                  <span>Federal tax</span>
                  <span>−{money(c.fed)}</span>
                </li>
              )}
              {c.state > 0 && (
                <li>
                  <span>State tax</span>
                  <span>−{money(c.state)}</span>
                </li>
              )}
              {c.penalty > 0 && (
                <li>
                  <span>Early withdrawal penalty</span>
                  <span>−{money(c.penalty)}</span>
                </li>
              )}
              {c.fee > 0 && (
                <li>
                  <span>ETF fee</span>
                  <span>−{money(c.fee)}</span>
                </li>
              )}
              <li className="wd2-net">
                <span>Net Withdrawal amount</span>
                <b>{money(c.net)}</b>
              </li>
            </ul>
            {errs.net && (
              <p className="alloc-warn">
                <Icon icon={faExclamationTriangle} size={12} /> {errs.net}
              </p>
            )}
          </>
        )}
        {missing && (
          <p className="hint wd2-missing">
            <Icon icon={faInfoCircle} size={12} /> {missing} to save.
          </p>
        )}
      </div>
    </Slideover>
  )
}

function ScheduleSlideover({ p, onClose }) {
  const rows = scheduleRows(p)
  return (
    <Slideover
      title="Payment Schedule"
      width="wide"
      closeButton={false}
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="table-wrap">
        <table className="alloc-table">
          <thead>
            <tr>
              <th scope="col">Installment</th>
              <th scope="col">Payment date</th>
              <th scope="col" className="num">Amount</th>
              <th scope="col" className="num">Remaining balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td>{r.date}</td>
                <td className="num">{money(r.amt)}</td>
                <td className="num">{money(r.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Slideover>
  )
}

function DocBlock({ doc, state, error, onChange }) {
  const [fileErr, setFileErr] = useState('')
  const pick = (file) => {
    if (!file) return
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return setFileErr(`Only PDF files are accepted. "${file.name}" is not a PDF.`)
    const mb = file.size / 1024 / 1024
    if (mb > MAX_FILE_MB) return setFileErr(`File is ${mb.toFixed(1)} MB. Upload a PDF of ${MAX_FILE_MB} MB or less.`)
    setFileErr('')
    onChange({ ...state, file: { name: file.name, size: file.size } })
  }
  return (
    <div className="wd2-doc">
      <p className="txn-doc-label">
        {doc.label} <span className="txn-doc-required">{doc.required ? '(Required)' : '(Optional)'}</span>
      </p>
      <div className="period" role="radiogroup" aria-label={`${doc.label} method`}>
        {[
          ['manual', 'Upload manually'],
          ['docusign', 'Use docusign']
        ].map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={state.method === id} className={state.method === id ? 'on' : ''} onClick={() => onChange({ ...state, method: id })}>
            {label}
          </button>
        ))}
      </div>
      {state.method === 'docusign' ? (
        <div className="wd-note">You will receive this document in your Docusign account to sign electronically.</div>
      ) : state.file ? (
        <div className="wd2-file">
          <span>
            <Icon icon={faCheck} size={12} /> <b>{state.file.name}</b> · {(state.file.size / 1024).toFixed(0)} KB · Uploaded successfully
          </span>
          <button type="button" className="text-link danger" onClick={() => onChange({ ...state, file: null })}>
            Remove
          </button>
        </div>
      ) : (
        <label className="wd2-drop">
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0])} />
          <span>
            Drag and drop or <u>browse</u> a PDF (max {MAX_FILE_MB} MB)
          </span>
        </label>
      )}
      {(fileErr || error) && (
        <p className="alloc-warn">
          <Icon icon={faExclamationTriangle} size={12} /> {fileErr || error}
        </p>
      )}
    </div>
  )
}
