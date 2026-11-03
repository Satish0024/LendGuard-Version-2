import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faExclamationCircle, faExclamationTriangle, faInfoCircle, faCheck, faChevronDown, faPen, faTrash, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import Field, { FieldGroup } from '../common/Field.jsx'
import Select, { Option } from '../common/Select.jsx'
import DatePicker from '../common/DatePicker.jsx'
import { formatMoney, planBalance, planVested } from '../../lib/accountSummary'
import { parsePlace, splitStreet } from '../../lib/profileDetails.js'
import { downloadDocumentFile } from '../../lib/downloadDocument.js'
import { useTheme } from '../../context/ThemeContext.jsx'
import { sourcesFor, canRequest, investmentsForSource, WITHDRAWAL_TERMS_COPY } from '../../data/transactions.js'

// Participant version of the admin "New Withdrawal Request" prototype. Same
// data points and rules; admin-only overrides (fee, 1099 codes, penalty
// waiver) are shown read-only or left out.

export const WD_PERSONA_KEY = 'lg-wd-persona'
const RMD = { year: 2026, age: 73, factor: 20.2 }
const PENALTY_RATE = 10
const PENALTY_FREE_AGE = 59.5
const PAYMENT_FEE = 5
const MIN_WITHDRAW = 10
const OVERALL_FEE = 50
const MAX_FILE_MB = 2
const ANNUITANT = { lifeExpectancy: 10.2, age: 80, dob: '15/01/1946', rate: 4 }

const TYPES = [
  { id: 'INS', label: 'In-Service', display: 'In-Service - INS' },
  { id: 'RMD', label: 'Required Minimum Distribution', display: 'Required Minimum Distribution - RMD' },
  { id: 'SFS', label: 'Separation from Service', display: 'Separation from Service - SFS' },
  { id: 'HDS', label: 'Hardship', display: 'Hardship - HDS' },
  { id: 'PW', label: 'Permissible Withdrawal', display: 'Permissible Withdrawal - PW' },
  { id: 'FO', label: 'Force Out', display: 'Force Out - FO' },
  { id: 'QBAD', label: 'Qualified Birth and Adoption Distribution', display: 'Qualified Birth and Adoption Distribution - QBAD' }
]
const MODES = [
  { id: 'self', label: 'Distribution to Self', ratio: 1 },
  { id: 'beneficiary', label: 'Distribution to Beneficiary', ratio: 1 },
  { id: 'rothIra', label: 'Rollover to Roth IRA', ratio: 0.6, rollover: true, excludes: 'pre-tax' },
  { id: 'tradIra', label: 'Rollover to Traditional IRA', ratio: 0.7, rollover: true, excludes: 'Roth' },
  { id: 'plan', label: 'Rollover to Another Plan', ratio: 1, rollover: true }
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
  { id: 'spousal', label: 'Spousal Consent', types: ['INS', 'SFS', 'HDS', 'PW', 'QBAD'], required: true },
  { id: 'election', label: 'Distribution Election Form', types: ['INS', 'RMD', 'SFS', 'HDS', 'PW', 'FO', 'QBAD'], required: true },
  { id: 'w4r', label: 'W-4R Withholding Election', types: ['INS', 'RMD', 'HDS', 'PW', 'FO', 'QBAD'], required: false }
]
const fmtAddress = (d) => [d?.line1, d?.line2, d?.city, d?.state, d?.zip].filter(Boolean).join(', ')
const employeeAddress = (participant) => {
  const street = splitStreet(participant.profile?.address || '')
  const place = parsePlace(participant.profile?.city || '')
  return {
    line1: street.line1 || '',
    line2: street.line2 || '',
    city: place.city || '',
    country: place.country || 'USA',
    state: place.stateName || place.state || '',
    zip: place.zip || ''
  }
}
const recordsAddress = (participant) => fmtAddress(employeeAddress(participant))
const BANK = { institution: 'JP Morgan Chase', holder: 'Jordan Hale', type: 'Checking Account', number: '••••••4521', routing: '021000021' }
const ROLLOVER_ON_FILE = {
  rothIra: { planName: 'Fidelity Roth IRA', account: 'RIRA-55120934', trustee: 'Fidelity Management Trust' },
  tradIra: { planName: 'Fidelity Traditional IRA', account: 'TIRA-55120771', trustee: 'Fidelity Management Trust' },
  plan: { planName: 'Acme Corp 401(k) Plan', account: 'PLN-2210457', trustee: 'Empower Trust Company' }
}

const HISTORY = [
  { title: 'Withdrawal Request Submitted', by: 'You' },
  { title: 'Approved by Plan Sponsor', by: 'Plan Sponsor' },
  { title: 'Approved by Plan Administrator', by: 'Plan Administrator' },
  { title: 'Awaiting Trade', by: 'System Generated' },
  { title: 'Completed', by: 'Plan Administrator' }
]
const MAX_CHIPS = 3

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
  const dob = participant.profile?.dob || participant.dob
  return p === 'retired' ? { age: 80, status: 'Terminated', dob: ANNUITANT.dob } : { age: ageFrom(dob), status: 'Active', dob }
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
  // Explicit Yes/No from the allocation form; default matches age/type rules when unset.
  const defaultPenalty = !(rollover || type === 'RMD' || type === 'QBAD' || persona.age >= PENALTY_FREE_AGE)
  const applyPenalty = a.penaltyApply ? a.penaltyApply === 'yes' : defaultPenalty
  const penalty = !rollover && applyPenalty ? (gross * PENALTY_RATE) / 100 : 0
  // Check/EFT fee is plan-set and read-only for participants; comes out of account balance.
  const fee = rollover ? 0 : PAYMENT_FEE
  const fed = (gross * fedPct) / 100
  const state = (gross * statePct) / 100
  const net = gross - fed - state - penalty
  const autoCodes = rollover
    ? a.mode === 'rothIra'
      ? ['H', 'G']
      : ['G', 'G']
    : type === 'QBAD'
      ? ['2', '2']
      : type === 'RMD' || persona.age >= PENALTY_FREE_AGE
        ? ['7', '7']
        : ['1', '1']
  const codes = [a.rothCode || autoCodes[0], a.nonRothCode || autoCodes[1]]
  return { mode, gross, fed, state, penalty, fee, net, codes, rollover, fedPct, statePct }
}
// One row per investment held in a source. A source with no investment lineup
// is treated as a single line so it can still be allocated.
function sourceLines(plan, source) {
  const lines = investmentsForSource(plan, source)
  return lines.length ? lines : [{ id: source.id, name: source.name, amount: source.amount }]
}
const pickKey = (source, line) => `${source.id}::${line.id}`
function linesTotal(plan, sources) {
  return sources.reduce((t, s) => t + sourceLines(plan, s).reduce((x, l) => x + l.amount, 0), 0)
}
function lineGross(a, source, line, total) {
  if (a.sourceMode === 'choose') return +a.picks?.[pickKey(source, line)] || 0
  return total ? ((+a.amount || 0) * line.amount) / total : 0
}

// ---------- main ----------
export default function WithdrawalFlow({ step, plan, plans = [], participant, form, set, onNext, onBack, onSubmit, onEdit, onChangePlan }) {
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
  const [triedDocs, setTriedDocs] = useState(false)
  const [reviewTab, setReviewTab] = useState('summary')
  const [showTerms, setShowTerms] = useState(false)

  const type = TYPES.find((t) => t.id === w.type)
  const isIns = w.type === 'INS'
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
  const changePlan = (id) => {
    if (id === plan.id) return
    if (!w.type) return onChangePlan(id)
    setConfirm({
      title: 'Do you want to proceed?',
      body: 'Changing the plan now will result in losing all your progress.',
      confirmLabel: 'Okay',
      onConfirm: () => {
        setConfirm(null)
        onChangePlan(id)
      }
    })
  }
  const saveAlloc = (a) => {
    setW((cur) => {
      const list = [...cur.allocations]
      if (editing === 'new') list.push(a)
      else list[editing] = a
      return { allocations: list }
    })
    // The new/updated row in the table is confirmation enough; only removal
    // gets a banner, because it carries Undo.
    setNotice(null)
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
          recordsAddr={employeeAddress(participant)}
          takenModes={w.allocations.map((a, i) => (editing !== 'new' && i === editing ? null : a.mode)).filter(Boolean)}
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
          <Field label="Select the Plan" required>
            <Select value={plan.id} onChange={(e) => changePlan(e.target.value)}>
              {plans.map((p) => (
                <Option key={p.id} value={p.id} disabled={!canRequest(p, 'withdrawal')}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </Field>
          <Field label="Company">
            <input type="text" value={participant.profile?.employer || ''} readOnly disabled />
          </Field>
        </div>
        <div className="txn-row spaced">
          <Field label="Withdraw Type" required>
            <Select value={w.type} onChange={(e) => chooseType(e.target.value)} disabled={balance <= 0} placeholder="Select the Withdrawal Type">
              <Option value="">Select the Withdrawal Type</Option>
              {TYPES.map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.label}
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
                <b>Not Eligible for Required Minimum Distribution</b> An RMD can only be requested from age {RMD.age} once you have left
                employment. You are {persona.age} and {persona.status.toLowerCase()}.
              </>
            )}
          </div>
        )}
        {isSfs && persona.status === 'Active' && (
          <div className="plan-notice opted-notice wd2-banner">
            <b>Not Eligible for Separation from Service</b> Separation from Service (including periodic payments) is only available once you
            have left employment. You are currently active.
          </div>
        )}

        {w.type && !blocked && (
          <>
            <div className={isIns ? 'txn-stack spaced' : 'txn-row spaced'}>
              <FieldGroup label="Withdraw As" note={!isSfs && !isIns ? 'Periodic payment is available for Separation from Service only.' : undefined}>
                <div className="period" role="radiogroup" aria-label="Withdraw As">
                  {[
                    ['one', 'One Time Payment'],
                    ['periodic', 'Periodic Payment']
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
                <FieldGroup label="Withdraw Entire Balance" note={tried && !w.entire ? 'Choose Yes or No.' : `Minimum ${money(MIN_WITHDRAW)} / Maximum ${money(balance)}`} noteClass={tried && !w.entire ? 'err' : undefined}>
                  <div className="period" role="radiogroup" aria-label="Withdraw Entire Balance">
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
            </div>

            {isRmd && (
              <div className="txn-row spaced">
                <Field label="RMD Year">
                  <input type="text" value={RMD.year} readOnly disabled />
                </Field>
                <Field label="Required Minimum Amount">
                  <input type="text" value={money(rmdMin)} readOnly disabled />
                </Field>
                {rmdPartial && (
                  <Field
                    label="Withdrawal Amount"
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
                  <Field label="Periodic Payment" required note={tried && pErr.kind} noteClass="err">
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
                      <Field label="Total Available Amount" required note={pErr.total && (tried || w.periodic.total) ? pErr.total : `Up to ${money(balance)}`} noteClass={pErr.total && (tried || w.periodic.total) ? 'err' : undefined}>
                        <input type="text" inputMode="decimal" value={w.periodic.total} onChange={(e) => setP({ total: clean(e.target.value) })} placeholder="0.00" />
                      </Field>
                      {w.periodic.kind === 'dollar' && (
                        <Field label="Installment Amount" required note={pErr.installment && (tried || w.periodic.installment) ? pErr.installment : undefined} noteClass="err">
                          <input type="text" inputMode="decimal" value={w.periodic.installment} onChange={(e) => setP({ installment: clean(e.target.value) })} placeholder="0.00" />
                        </Field>
                      )}
                      {w.periodic.kind === 'tenure' && (
                        <Field label="Specific Tenure" required>
                          <Select value={w.periodic.tenure} onChange={(e) => setP({ tenure: e.target.value })}>
                            <Option value="life">My Life Expectancy</Option>
                            <Option value="other">Other</Option>
                          </Select>
                        </Field>
                      )}
                      {w.periodic.kind === 'tenure' && w.periodic.tenure === 'other' && (
                        <Field label="Number of Years" required note={pErr.years && (tried || w.periodic.years) ? pErr.years : undefined} noteClass="err">
                          <input type="text" inputMode="numeric" value={w.periodic.years} onChange={(e) => setP({ years: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
                        </Field>
                      )}
                      {w.periodic.kind === 'annuity' && (
                        <Field label="Interest Rate (%)" required note={pErr.rate} noteClass="err">
                          <input type="text" inputMode="decimal" value={w.periodic.rate} onChange={(e) => setP({ rate: clean(e.target.value) })} />
                        </Field>
                      )}
                    </div>
                    {(w.periodic.kind === 'annuity' || (w.periodic.kind === 'tenure' && w.periodic.tenure === 'life')) && (
                      <div className="txn-row">
                        <Field label="Life Expectancy (Years)">
                          <input type="text" value={ANNUITANT.lifeExpectancy} readOnly disabled />
                        </Field>
                        <Field label="Current Age">
                          <input type="text" value={persona.age} readOnly disabled />
                        </Field>
                        <Field label="Date of Birth">
                          <input type="text" value={persona.dob} readOnly disabled />
                        </Field>
                      </div>
                    )}
                    <div className="txn-row">
                      <FieldGroup label="Installment Date">
                        <div className="period" role="radiogroup" aria-label="Installment Date">
                          {[
                            ['fixed', 'Fixed Date'],
                            ['custom', 'Custom Date']
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
                        <Field label="First Installment Date" required note={pErr.date && (tried || w.periodic.date) ? pErr.date : undefined} noteClass="err">
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
            disabled={!w.type || blocked || balance <= 0}
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
              {type?.display} · {periodic ? 'Periodic Payment' : 'One Time Payment'} · up to {money(cap)}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" disabled={!canAdd || allocTotal >= cap - 0.009} onClick={() => setEditing('new')}>
            Add Allocation
          </button>
        </div>
        {!w.allocations.length ? (
          <div className="wd-note">
            <Icon icon={faInfoCircle} size={13} />
            <span>Add how the money is paid out: to you, a beneficiary, or rolled over to an IRA or another plan.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="alloc-table wd2-table">
              <thead>
                <tr>
                  <th scope="col">Allocation &amp; Recipient</th>
                  <th scope="col">1099 Codes</th>
                  <th scope="col" className="num">Gross</th>
                  <th scope="col" className="num">State Tax</th>
                  <th scope="col" className="num">Federal Tax</th>
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
                        {c.rollover ? 'Rollover' : money(c.fee)}
                      </td>
                      <td className="num">
                        <b>{money(c.net)}</b>
                      </td>
                      <td className="num">
                        <span className="tf-actions">
                          <button type="button" className="icon-btn" aria-label="Edit Allocation" onClick={() => setEditing(i)}>
                            <Icon icon={faPen} size={13} />
                          </button>
                          <button type="button" className="icon-btn" aria-label="Remove Allocation" onClick={() => removeAlloc(i)}>
                            <Icon icon={faTrash} size={13} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
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
        <p className="wd2-doc-accept">
          <span>Accepted File : PDF</span>
          <span>Max File Size : {MAX_FILE_MB} MB</span>
        </p>
        {docs.map((d) => (
          <DocBlock key={d.id} doc={d} state={w.docs[d.id] || { method: 'docusign' }} error={triedDocs ? docErr(d) : ''} onChange={(s) => setW((cur) => ({ docs: { ...cur.docs, [d.id]: s } }))} />
        ))}
        <div className="txn-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setTriedDocs(true)
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
    ['EFT fee', w.allocations.reduce((t, a, i) => t + (a.payment === 'eft' ? calcs[i].fee : 0), 0)],
    ['Check fee', w.allocations.reduce((t, a, i) => t + (a.payment === 'eft' ? 0 : calcs[i].fee), 0)],
    ['Overall withdraw fee', OVERALL_FEE]
  ].filter(([, v]) => v > 0)
  const totalDed = deductions.reduce((t, [, v]) => t + v, 0)
  const pc = periodic ? periodicCalc(w.periodic) : null
  const lineTotal = linesTotal(plan, sources)
  const sourceRows = sources
    .map((s) => {
      const lines = sourceLines(plan, s)
        .map((l) => ({ ...l, gross: w.allocations.reduce((t, a) => t + lineGross(a, s, l, lineTotal), 0) }))
        .filter((l) => l.gross > 0.004)
      return { id: s.id, name: s.name, lines, total: lines.reduce((t, l) => t + l.gross, 0) }
    })
    .filter((s) => s.lines.length)
  return (
    <div className="txn-card wd2">
      <h3>Review Your Withdrawal</h3>
      <p className="hint">Requests are usually processed within 10 business days after approval.</p>
      <div className="tabs" role="tablist" aria-label="Withdrawal Review">
        {[
          ['summary', 'Request Summary'],
          ['history', 'History']
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`wd-tab-${id}`}
            aria-selected={reviewTab === id}
            aria-controls={`wd-panel-${id}`}
            className={`tab${reviewTab === id ? ' on' : ''}`}
            onClick={() => setReviewTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {reviewTab === 'history' ? (
        <ol className="wd2-hist" role="tabpanel" id="wd-panel-history" aria-labelledby="wd-tab-history">
          <li className="done">
            <b>Request Drafted</b>
            <span>You · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </li>
          {HISTORY.map((h) => (
            <li key={h.title}>
              <b>{h.title}</b>
              <span>{h.by} · Pending</span>
            </li>
          ))}
        </ol>
      ) : (
      <div role="tabpanel" id="wd-panel-summary" aria-labelledby="wd-tab-summary">
      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>Withdrawal Details</h4>
          <button type="button" className="text-link" onClick={() => onEdit?.('details')}>
            Edit
          </button>
        </div>
        <div className="wd2-details-split">
          <ul className="detail-rows wd2-details-col">
            <li>
              <span>Requested Amount</span>
              <b>{money(gross)}</b>
            </li>
            <li>
              <span>Withdrawal Type</span>
              <b>{type?.display || '—'}</b>
            </li>
            <li>
              <span>Withdrawal As</span>
              <b>{periodic ? 'Periodic Payment' : 'One Time Payment'}</b>
            </li>
            {!periodic && (
              <li>
                <span>Withdrawal Entire Balance</span>
                <b>{w.entire === 'yes' ? 'Yes' : 'No'}</b>
              </li>
            )}
          </ul>
          <ul className="detail-rows wd2-details-col">
            <li>
              <span>Gross Withdrawal Amount</span>
              <b>{money(gross)}</b>
            </li>
            <li className="wd2-ded">
              <details>
                <summary>
                  <span>Fee &amp; Tax Details</span>
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
              <span>Net Withdrawal Amount</span>
              <b>{money(gross - totalDed)}</b>
            </li>
          </ul>
        </div>
        {isRmd && (
          <p className="hint">
            RMD {RMD.year}: required minimum {money(rmdMin)} · withdrawing {money(rmdPartial ? rmdAmt : balance)}
          </p>
        )}
      </section>

      {periodic && pc && (
        <section className="wd2-sum">
          <div className="wd2-sum-h">
            <h4>Payment Schedule</h4>
            <button type="button" className="text-link" onClick={() => setSchedule(true)}>
              View Schedule            </button>
          </div>
          <ul className="detail-rows">
            <li>
              <span>Periodic Payment</span>
              <b>{PERIODIC_KINDS.find((k) => k.id === w.periodic.kind)?.label}</b>
            </li>
            <li>
              <span>Total Amount</span>
              <b>{money(w.periodic.total)}</b>
            </li>
            <li>
              <span>Installment Amount</span>
              <b>{money(pc.amount)}</b>
            </li>
            <li>
              <span>Number of Installments</span>
              <b>
                {pc.count} · {FREQ.find((f) => f.id === w.periodic.freq).label}
              </b>
            </li>
            <li>
              <span>Installment Date</span>
              <b>{w.periodic.dateMode === 'fixed' ? '1st of every period' : w.periodic.date}</b>
            </li>
          </ul>
        </section>
      )}

      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>Withdrawal Allocation</h4>
          <button type="button" className="text-link" onClick={() => onEdit?.('allocation')}>
            Edit
          </button>
        </div>
        <div className="table-wrap">
          <table className="alloc-table">
            <thead>
              <tr>
                <th scope="col">Allocation &amp; Recipient</th>
                <th scope="col">1099 Codes</th>
                <th scope="col">Address</th>
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
                    {addressCell(a, calcs[i], recordsAddress(participant))}
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

      {sourceRows.length > 0 && (
        <section className="wd2-sum">
          <div className="wd2-sum-h">
            <h4>Source Withdraw Amount</h4>
          </div>
          <div className="wd2-src-list">
            {sourceRows.map((s) => (
              <SourceSummaryRow key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}

      <section className="wd2-sum">
        <div className="wd2-sum-h">
          <h4>Documents</h4>
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
                <b className="wd2-doc-name">{s.method === 'manual' ? s.file?.name || 'Not Uploaded' : 'Sent via Docusign'}</b>
              </li>
            )
          })}
        </ul>
        {docs.some((d) => (w.docs[d.id]?.method || 'docusign') === 'docusign') && (
          <p className="hint wd2-sum-note">
            <Icon icon={faInfoCircle} size={13} />
            <span>You will receive the Docusign documents by email to sign.</span>
          </p>
        )}
      </section>

      <section className="wd2-terms">
        <h4 className="txn-section-title">Confirm and Submit</h4>
        {/* The link sits outside the <label>: inside it, some browsers route
            the click to the checkbox instead of opening the terms. */}
        <div className="alloc-apply-all tf-ack wd2-ack">
          <input id="wd-terms-ack" type="checkbox" checked={!!w.terms} onChange={(e) => setW({ terms: e.target.checked })} />
          <span>
            <label htmlFor="wd-terms-ack">By checking this box, I declare that I have read the</label>{' '}
            <button
              type="button"
              className="text-link wd2-terms-link"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowTerms(true)
              }}
            >
              Terms &amp; Conditions
            </button>
          </span>
        </div>
      </section>
      {showTerms && (
        <Slideover
          title="Terms & Conditions"
          closeButton={false}
          onClose={() => setShowTerms(false)}
          actions={
            <button type="button" className="btn btn-primary" onClick={() => setShowTerms(false)}>
              Close
            </button>
          }
        >
          <TermsFrame />
        </Slideover>
      )}
      </div>
      )}
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
  if (a.payment === 'check') return `Mail Check · ${a.addressSrc === 'custom' ? 'Custom Address' : 'Address on File'}`
  return `EFT · ${a.bank === 'custom' ? a.customBank?.institution || 'New Bank' : 'Bank on File'}`
}
// The terms document renders in an iframe so it reads as its own
// scrollable page. It can't see the app's CSS, so it takes the active theme.
function TermsFrame() {
  const { theme } = useTheme()
  const [fg, bg] = theme === 'dark' ? ['#EEEEF2', '#1D1C24'] : ['#1D1C24', '#FFFFFF']
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px 20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:${fg};background:${bg}}
ol{margin:0;padding-left:20px}li+li{margin-top:8px}
</style></head><body><ol>${WITHDRAWAL_TERMS_COPY.map((t) => `<li>${t}</li>`).join('')}</ol></body></html>`
  return <iframe className="wd2-terms-frame" title="Terms and Conditions" srcDoc={doc} />
}
// Money / percent control that accepts Field's cloned id/required onto the real input.
function AffixInput({ id, required, prefix, suffix, disabled, invalid, ...rest }) {
  return (
    <span className={`alloc-pct-input wd2-affix${disabled ? ' is-disabled' : ''}${invalid ? ' tf-bad' : ''}`}>
      {prefix != null && <i aria-hidden="true">{prefix}</i>}
      <input id={id} required={required} disabled={disabled} {...rest} />
      {suffix != null && <i aria-hidden="true">{suffix}</i>}
    </span>
  )
}
function addressCell(a, c, onFile) {
  const custom = !c.rollover && a.payment === 'check' && a.addressSrc === 'custom'
  const text = c.rollover ? a.rollover?.trustee : custom ? fmtAddress(a.address) : onFile
  const tag = c.rollover ? 'Rollover Trustee' : custom ? 'Custom Address' : 'As per Your Records'
  return (
    <>
      {text}
      <span className="tf-meta">{tag}</span>
    </>
  )
}

// A plan-level investment restriction counts only while today is on or before `until`.
function activeRestriction(plan) {
  const r = plan?.investmentRestriction
  if (!r?.until) return false
  return new Date(`${r.until}T23:59:59`) >= new Date()
}
const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function SourceSummaryRow({ source }) {
  const [expanded, setExpanded] = useState(false)
  const extra = source.lines.length - MAX_CHIPS
  const shown = expanded ? source.lines : source.lines.slice(0, MAX_CHIPS)
  return (
    <div className="wd2-src-row">
      <div className="wd2-src-name">
        {extra > 0 ? (
          <button type="button" className="text-link wd2-src-link" title={source.name} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {source.name}
          </button>
        ) : (
          <b title={source.name}>{source.name}</b>
        )}
        <span>{money(source.total)}</span>
      </div>
      <div className="wd2-src-chips">
        {shown.map((l) => (
          <span key={l.id} className="wd2-src-chip" title={`${l.name} ${money(l.gross)}`}>
            <span className="wd2-src-chip-name">{l.name}</span>
            <b>{money(l.gross)}</b>
          </span>
        ))}
        {extra > 0 && (
          <button
            type="button"
            className="wd2-more"
            aria-expanded={expanded}
            aria-label={expanded ? `Show fewer for ${source.name}` : `Show ${extra} more for ${source.name}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show Less' : `+${extra}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------- allocation slide-out ----------
function AllocationSlideover({ initial, max, balance, sources, plan, persona, type, recordsAddr, takenModes = [], showSources, onClose, onSave }) {
  const [a, setA] = useState(
    () =>
      initial || {
        mode: '',
        amount: '0.00',
        fedPct: '20.00',
        statePct: '0.00',
        rothCode: '',
        nonRothCode: '',
        penaltyApply: 'no',
        payment: 'check',
        paymentFee: PAYMENT_FEE.toFixed(2),
        addressSrc: 'records',
        address: { line1: '', line2: '', city: '', country: 'USA', state: '', zip: '' },
        bank: 'records',
        customBank: { institution: '', holder: '', type: 'Checking Account', number: '', routing: '', email: '', phone: '' },
        rollover: null,
        delivery: 'check',
        sourceMode: 'prorata',
        picks: {}
      }
  )
  const set = (patch) => setA((cur) => ({ ...cur, ...patch }))
  const mode = MODES.find((m) => m.id === a.mode)
  const modeMax = mode ? r2(Math.min(max, balance * mode.ratio)) : max
  const c = allocCalc(a, persona, type)
  const amt = +a.amount || 0
  const errs = {}
  if (a.amount !== '' && amt > 0 && amt < MIN_WITHDRAW) errs.amount = `Minimum allocation amount is ${money(MIN_WITHDRAW)}.`
  if (a.amount !== '' && amt > modeMax + 1e-9) errs.amount = modeMax <= 0 ? 'No balance left to allocate.' : `Maximum amount available for ${mode?.rollover ? 'rollover' : 'withdrawal'} ${money(modeMax)}`
  if (+a.fedPct > 100 || +a.statePct > 100) errs.tax = 'Enter a rate between 0 and 100%.'
  if (amt > 0 && c.net <= 0) errs.net = 'Deductions are more than the allocation amount. Lower the tax rates.'
  if (mode?.rollover && a.rollover?.account && !/^[A-Za-z0-9-]{5,20}$/.test(a.rollover.account)) errs.account = 'Account / IRA no must be 5 to 20 letters, numbers or dashes.'
  const cb = a.customBank
  const ad = a.address
  const fromRecords = a.addressSrc === 'records'
  const bankFromRecords = a.bank === 'records'
  const recordAddr = recordsAddr || {}
  const isRollover = !!mode?.rollover
  const availableModes = MODES.filter((m) => m.id === a.mode || !takenModes.includes(m.id))
  const customAddress = !isRollover && a.payment === 'check' && a.addressSrc === 'custom'
  if (customAddress && ad.zip && !/^\d{5}$/.test(ad.zip)) errs.zip = 'Zip code must be 5 digits.'
  if (!isRollover && a.payment === 'eft' && a.bank === 'custom') {
    if (cb.number && !/^\d{4,17}$/.test(cb.number)) errs.number = 'Account number must be 4 to 17 digits.'
    if (cb.routing && !/^\d{9}$/.test(cb.routing)) errs.routing = 'ABA routing number must be 9 digits.'
    if (cb.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cb.email)) errs.email = 'Enter a valid email ID, e.g. name@company.com.'
  }
  const lineTotal = linesTotal(plan, sources)
  const srcTotal = r2(Object.values(a.picks || {}).reduce((t, v) => t + (+v || 0), 0))
  sources.forEach((s) => {
    const lines = sourceLines(plan, s)
    const avail = lines.reduce((t, l) => t + l.amount, 0)
    const picked = lines.reduce((t, l) => t + (+a.picks[pickKey(s, l)] || 0), 0)
    if (a.sourceMode === 'choose' && picked > avail + 0.009) errs[`src-${s.id}`] = `More than available ${money(avail)}.`
  })
  // Choose by Sources: the amount typed for a source is spread across its
  // investments pro-rata; the last line takes the rounding remainder.
  const setSourceGross = (s, v) => {
    const val = clean(v)
    const lines = sourceLines(plan, s)
    const avail = lines.reduce((t, l) => t + l.amount, 0)
    const want = +val || 0
    const picks = { ...a.picks }
    let left = r2(want)
    lines.forEach((l, i) => {
      const share = i === lines.length - 1 ? left : r2(avail ? (want * l.amount) / avail : 0)
      picks[pickKey(s, l)] = share > 0 ? share.toFixed(2) : ''
      left = r2(left - share)
    })
    set({ picks, srcPicks: { ...a.srcPicks, [s.id]: val } })
  }
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
      : isRollover && !(a.rollover?.planName && a.rollover?.account && a.rollover?.trustee)
        ? 'Fill in the rollover information'
        : !isRollover && a.payment === 'eft' && a.bank === 'custom' && !(cb.institution && cb.holder && cb.number && cb.routing)
          ? 'Fill in the custom bank details'
          : customAddress && !(ad.line1 && ad.city && ad.state && ad.zip)
            ? 'Fill in the custom address'
            : ''
  const [openSources, setOpenSources] = useState(() => ({ [sources[0]?.id]: true }))
  const canSave = !missing && !Object.keys(errs).length && !srcMsg
  const codeOptions = Object.entries(CODES_1099)

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
        <div className="txn-stack">
          <Field label="Select Distribution Mode">
            <Select
              value={a.mode}
              onChange={(e) => {
                const id = e.target.value
                if (id) pickMode(id)
                else set({ mode: '', rollover: null })
              }}
              placeholder="Select the Distribution Mode"
            >
              {availableModes.map((m) => {
                const off = type === 'RMD' && m.rollover
                return (
                  <Option key={m.id} value={m.id} disabled={off}>
                    {off ? `${m.label} (not available for RMD)` : m.label}
                  </Option>
                )
              })}
            </Select>
          </Field>
          <Field
            label="Allocation Amount"
            note={errs.amount || `Maximum amount available for withdrawal ${money(modeMax)}`}
            noteClass={errs.amount ? 'err' : undefined}
          >
            <AffixInput prefix="$" type="text" inputMode="decimal" value={a.amount} placeholder="0.00" onChange={(e) => set({ amount: clean(e.target.value) })} />
          </Field>
        </div>

        <h4 className="wd2-sub">Tax &amp; Penalty</h4>
        <div className="txn-row">
          <Field label="Select Roth 1099 Code">
            <Select value={a.rothCode} onChange={(e) => set({ rothCode: e.target.value })} placeholder="Select Roth 1099">
              {codeOptions.map(([id, label]) => (
                <Option key={id} value={id}>
                  {id} - {label}
                </Option>
              ))}
            </Select>
          </Field>
          <Field label="Select Non Roth 1099 Code">
            <Select value={a.nonRothCode} onChange={(e) => set({ nonRothCode: e.target.value })} placeholder="Select Non Roth 1099">
              {codeOptions.map(([id, label]) => (
                <Option key={id} value={id}>
                  {id} - {label}
                </Option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="txn-row">
          <Field
            label="Federal Tax"
            tooltip="Federal tax withholding percentage set by your plan."
            note={`${money(c.fed)} tax deduction`}
          >
            <AffixInput suffix="%" type="text" inputMode="decimal" value={a.fedPct} readOnly disabled />
          </Field>
          <Field label="State Tax" tooltip="State tax withholding percentage set by your plan." note={`${money(c.state)} tax deduction`}>
            <AffixInput suffix="%" type="text" inputMode="decimal" value={a.statePct} readOnly disabled />
          </Field>
        </div>
        <FieldGroup
          label="Early Withdraw Penalty"
          noteClass="note-info"
          note={
            <>
              <Icon icon={faInfoCircle} size={13} />
              {a.penaltyApply === 'yes'
                ? 'Early Withdrawal Penalty applies to this transaction. This notice is shared with the participant and the admin.'
                : 'Early Withdrawal Penalty does not apply for this transaction. This notice is shared with the participant and the admin.'}
            </>
          }
        >
          <div className="period" role="radiogroup" aria-label="Early Withdraw Penalty">
            {[
              ['yes', 'Yes'],
              ['no', 'No']
            ].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={a.penaltyApply === id} className={a.penaltyApply === id ? 'on' : ''} onClick={() => set({ penaltyApply: id })}>
                {label}
              </button>
            ))}
          </div>
        </FieldGroup>

        {isRollover ? (
          <>
            <h4 className="wd2-sub">Rollover Information</h4>
            <p className="hint">Pre-filled with the rollover account on file. Update it if it has changed.</p>
            <div className="txn-row">
              <Field label="Plan Name">
                <input type="text" value={a.rollover?.planName || ''} onChange={(e) => set({ rollover: { ...a.rollover, planName: e.target.value } })} />
              </Field>
              <Field label="Account / IRA No" note={errs.account} noteClass="err">
                <input type="text" value={a.rollover?.account || ''} onChange={(e) => set({ rollover: { ...a.rollover, account: e.target.value } })} />
              </Field>
              <Field label="Company / Trustee Name">
                <input type="text" value={a.rollover?.trustee || ''} onChange={(e) => set({ rollover: { ...a.rollover, trustee: e.target.value } })} />
              </Field>
            </div>
            <FieldGroup label="Rollover Delivery">
              <div className="period" role="radiogroup" aria-label="Rollover Delivery">
                {[
                  ['check', 'Check Mailed to Trustee'],
                  ['wire', 'Wire Transfer']
                ].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={a.delivery === id} className={a.delivery === id ? 'on' : ''} onClick={() => set({ delivery: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </FieldGroup>
          </>
        ) : (
          <>
            <h4 className="wd2-sub">Payment Method</h4>
            <FieldGroup label="Choose Payment Method">
              <div className="period" role="radiogroup" aria-label="Payment Method">
                {[
                  ['check', 'Mail Check to Address'],
                  ['eft', 'EFT']
                ].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={a.payment === id} className={a.payment === id ? 'on' : ''} onClick={() => set({ payment: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </FieldGroup>
            <div className="txn-stack">
              <Field
                label={a.payment === 'eft' ? 'EFT Fee' : 'Check Fee'}
                noteClass="note-info"
                note={
                  <>
                    <Icon icon={faInfoCircle} size={13} />
                    Fee will be deducted from account balance
                  </>
                }
              >
                <AffixInput prefix="$" type="text" value={PAYMENT_FEE.toFixed(2)} readOnly disabled />
              </Field>
            </div>
            {a.payment === 'check' ? (
              <>
                <FieldGroup label="Select Address Details">
                  <div className="period" role="radiogroup" aria-label="Address Details">
                    {[
                      ['records', 'As in Employee Records'],
                      ['custom', 'Custom']
                    ].map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={a.addressSrc === id} className={a.addressSrc === id ? 'on' : ''} onClick={() => set({ addressSrc: id })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
                <>
                  <h4 className="wd2-sub">{fromRecords ? 'Address Details (From Employee Records)' : 'Address Details'}</h4>
                  <div className="txn-row spaced">
                    <Field label="Address Line 1">
                      <input
                        type="text"
                        value={fromRecords ? recordAddr.line1 || '' : ad.line1}
                        placeholder="Enter Street Address"
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, line1: e.target.value } })}
                      />
                    </Field>
                    <Field label="Address Line 2">
                      <input
                        type="text"
                        value={fromRecords ? recordAddr.line2 || '' : ad.line2}
                        placeholder={fromRecords ? '' : 'Apartment, suite, unit (optional)'}
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, line2: e.target.value } })}
                      />
                    </Field>
                  </div>
                  <div className="txn-row">
                    <Field label="City">
                      <input
                        type="text"
                        value={fromRecords ? recordAddr.city || '' : ad.city}
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, city: e.target.value } })}
                      />
                    </Field>
                    <Field label="Country">
                      <input
                        type="text"
                        value={(fromRecords ? recordAddr.country : ad.country) || 'USA'}
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, country: e.target.value } })}
                      />
                    </Field>
                  </div>
                  <div className="txn-row">
                    <Field label="State">
                      <input
                        type="text"
                        value={fromRecords ? recordAddr.state || '' : ad.state}
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, state: e.target.value } })}
                      />
                    </Field>
                    <Field label="Zip Code" note={!fromRecords ? errs.zip : undefined} noteClass="err">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fromRecords ? recordAddr.zip || '' : ad.zip}
                        readOnly={fromRecords}
                        disabled={fromRecords}
                        onChange={(e) => set({ address: { ...ad, zip: e.target.value.replace(/\D/g, '').slice(0, 5) } })}
                      />
                    </Field>
                  </div>
                </>
              </>
            ) : (
              <>
                <FieldGroup label="Select Bank Details">
                  <div className="period" role="radiogroup" aria-label="Bank Details">
                    {[
                      ['records', 'As in Employee Records'],
                      ['custom', 'Custom']
                    ].map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={a.bank === id} className={a.bank === id ? 'on' : ''} onClick={() => set({ bank: id })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
                <h4 className="wd2-sub">{bankFromRecords ? 'Bank Details (From Employee Records)' : 'Bank Details'}</h4>
                <div className="txn-row spaced">
                  <Field label="Financial Institution">
                    <input
                      type="text"
                      value={bankFromRecords ? BANK.institution : cb.institution}
                      readOnly={bankFromRecords}
                      disabled={bankFromRecords}
                      onChange={(e) => set({ customBank: { ...cb, institution: e.target.value } })}
                    />
                  </Field>
                  <Field label="Account Holder Name">
                    <input
                      type="text"
                      value={bankFromRecords ? BANK.holder : cb.holder}
                      readOnly={bankFromRecords}
                      disabled={bankFromRecords}
                      onChange={(e) => set({ customBank: { ...cb, holder: e.target.value } })}
                    />
                  </Field>
                </div>
                <div className="txn-row">
                  <Field label="Account Type">
                    {bankFromRecords ? (
                      <input type="text" value={BANK.type} readOnly disabled />
                    ) : (
                      <Select value={cb.type} onChange={(e) => set({ customBank: { ...cb, type: e.target.value } })}>
                        <Option value="Savings Account">Savings Account</Option>
                        <Option value="Checking Account">Checking Account</Option>
                      </Select>
                    )}
                  </Field>
                  <Field label="Account Number" note={!bankFromRecords ? errs.number : undefined} noteClass="err">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bankFromRecords ? BANK.number : cb.number}
                      readOnly={bankFromRecords}
                      disabled={bankFromRecords}
                      onChange={(e) => set({ customBank: { ...cb, number: e.target.value.replace(/\D/g, '').slice(0, 17) } })}
                    />
                  </Field>
                </div>
                <div className="txn-row">
                  <Field label="ABA Routing Number" note={!bankFromRecords ? errs.routing : undefined} noteClass="err">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bankFromRecords ? BANK.routing : cb.routing}
                      readOnly={bankFromRecords}
                      disabled={bankFromRecords}
                      onChange={(e) => set({ customBank: { ...cb, routing: e.target.value.replace(/\D/g, '').slice(0, 9) } })}
                    />
                  </Field>
                  <Field label="Email ID" note={!bankFromRecords ? errs.email : undefined} noteClass="err">
                    <input
                      type="email"
                      value={bankFromRecords ? '' : cb.email}
                      readOnly={bankFromRecords}
                      disabled={bankFromRecords}
                      onChange={(e) => set({ customBank: { ...cb, email: e.target.value } })}
                    />
                  </Field>
                </div>
                {!bankFromRecords && (
                  <div className="txn-row">
                    <Field label="Mobile No">
                      <input type="tel" value={cb.phone} onChange={(e) => set({ customBank: { ...cb, phone: e.target.value.replace(/[^\d+ -]/g, '') } })} />
                    </Field>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {showSources && (
          <>
            <FieldGroup label="Source Details">
              <div className="period" role="radiogroup" aria-label="Source Details">
                {[
                  ['prorata', 'Pro-Rata'],
                  ['choose', 'Allow Me to Choose']
                ].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={a.sourceMode === id} className={a.sourceMode === id ? 'on' : ''} onClick={() => set({ sourceMode: id })}>
                    {label}
                  </button>
                ))}
              </div>
            </FieldGroup>
            {a.sourceMode === 'choose' && (
              // Only choosing by source is supported for now; Investments is shown but disabled.
              <FieldGroup label="Choose By">
                <div className="period" role="radiogroup" aria-label="Choose By">
                  <button type="button" role="radio" aria-checked="true" className="on">
                    Sources
                  </button>
                  <button type="button" role="radio" aria-checked="false" disabled>
                    Investments
                  </button>
                </div>
              </FieldGroup>
            )}
            {a.sourceMode === 'choose' && activeRestriction(plan) && (
              <div className="inline-alert warn wd2-restrict" role="alert">
                <Icon icon={faExclamationCircle} size={16} />
                <span>
                  Investment restriction - {plan.investmentRestriction.name} has an active investment restriction until{' '}
                  {fmtDate(plan.investmentRestriction.until)}
                </span>
              </div>
            )}
            <div className="table-wrap wd2-src">
              <table className="alloc-table">
                <thead>
                  <tr>
                    <th scope="col">Source / Investment</th>
                    <th scope="col" className="num">Available</th>
                    <th scope="col" className="num">Gross Withdrawal</th>
                    <th scope="col" className="num">Net Withdrawal</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => {
                    const lines = sourceLines(plan, s)
                    const keep = c.gross > 0 ? c.net / c.gross : 0
                    const srcGross = lines.reduce((t, l) => t + lineGross(a, s, l, lineTotal), 0)
                    const open = !!openSources[s.id]
                    return (
                      <Fragment key={s.id}>
                        <tr className="wd2-src-head">
                          <td>
                            <button type="button" className="wd2-src-toggle" aria-expanded={open} onClick={() => setOpenSources((o) => ({ ...o, [s.id]: !open }))}>
                              <Icon icon={faChevronDown} size={11} />
                              {s.name}
                            </button>
                          </td>
                              <td className="num">{money(s.amount)}</td>
                              <td className="num">
                                {a.sourceMode === 'choose' ? (
                                  <span className="tf-amount-wrap">
                                    <AffixInput
                                      prefix="$"
                                      invalid={!!errs[`src-${s.id}`]}
                                      type="text"
                                      inputMode="decimal"
                                      aria-label={`${s.name} gross withdrawal`}
                                      placeholder="0.00"
                                      value={a.srcPicks?.[s.id] ?? (srcGross > 0 ? srcGross.toFixed(2) : '')}
                                      onChange={(e) => setSourceGross(s, e.target.value)}
                                    />
                                    {errs[`src-${s.id}`] && <small className="tf-max over">{errs[`src-${s.id}`]}</small>}
                                  </span>
                                ) : (
                                  money(srcGross)
                                )}
                              </td>
                              <td className="num">{money(srcGross * keep)}</td>
                            </tr>
                            {open &&
                              lines.map((l) => {
                                const k = pickKey(s, l)
                                const g = lineGross(a, s, l, lineTotal)
                                return (
                                  <tr key={k} className="wd2-src-line">
                                    <td>{l.name}</td>
                                    <td className="num">{money(l.amount)}</td>
                                    <td className="num">
                                      {money(g)}
                                    </td>
                                    <td className="num">{money(g * keep)}</td>
                                  </tr>
                                )
                              })}
                          </Fragment>
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
          {c.fed > 0 && (
            <li>
              <span>Federal Tax</span>
              <span>−{money(c.fed)}</span>
            </li>
          )}
          {c.state > 0 && (
            <li>
              <span>State Tax</span>
              <span>−{money(c.state)}</span>
            </li>
          )}
          {c.penalty > 0 && (
            <li>
              <span>Early Withdrawal Penalty</span>
              <span>−{money(c.penalty)}</span>
            </li>
          )}
          <li className="wd2-net">
            <span>Net Withdrawal Amount</span>
            <b>{money(c.net)}</b>
          </li>
        </ul>
        {errs.net && (
          <p className="alloc-warn">
            <Icon icon={faExclamationTriangle} size={12} /> {errs.net}
          </p>
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
              <th scope="col">Payment Date</th>
              <th scope="col" className="num">Amount</th>
              <th scope="col" className="num">Remaining Balance</th>
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
  const downloadTemplate = () => {
    downloadDocumentFile({
      name: `${doc.label} Template`,
      type: 'Withdrawal document template',
      date: new Date().toLocaleDateString()
    })
  }
  return (
    // Two columns: label, method and file details on the left; the drop zone
    // fills the right column at full height.
    <div className="wd2-doc">
      <div className="wd2-doc-side">
        <p className="txn-doc-label">
          {doc.label} {!doc.required && <span className="txn-doc-required">(Optional)</span>}
        </p>
        <div className="period" role="radiogroup" aria-label={`${doc.label} method`}>
          {[
            ['manual', 'Upload Manually'],
            ['docusign', 'Use Docusign']
          ].map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={state.method === id} className={state.method === id ? 'on' : ''} onClick={() => onChange({ ...state, method: id })}>
              {label}
            </button>
          ))}
        </div>
        {state.method === 'docusign' ? (
          <div className="wd-note">
            <Icon icon={faInfoCircle} size={13} />
            <span>You will receive this document in your Docusign account to sign electronically.</span>
          </div>
        ) : (
          <>
            <p className="wd2-doc-accept">
              <span>Accepted File : PDF</span>
              <span>Max File Size : {MAX_FILE_MB} MB</span>
            </p>
            {state.file && (
              <div className="wd2-file">
                <span>
                  <Icon icon={faCheck} size={12} /> <b>{state.file.name}</b> · {(state.file.size / 1024).toFixed(0)} KB · Uploaded successfully
                </span>
                <button type="button" className="text-link danger" onClick={() => onChange({ ...state, file: null })}>
                  Remove
                </button>
              </div>
            )}
            <button type="button" className="wd2-doc-template" onClick={downloadTemplate}>
              <Icon icon={faDownload} size={13} /> Download Template
            </button>
          </>
        )}
      </div>
      {state.method !== 'docusign' && !state.file && (
        <label
          className="wd2-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files?.[0])
          }}
        >
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => pick(e.target.files?.[0])} />
          <span className="wd2-drop-title">
            <Icon icon={faUpload} size={16} /> Drag &amp; Drop Here
          </span>
          <span>or</span>
          <u>Browse File</u>
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
