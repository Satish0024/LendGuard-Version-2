import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faExclamationTriangle, faSearch, faArrowRight, faInfoCircle, faTrash } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import Toast from '../common/Toast.jsx'
import TruncateTooltip from '../common/TruncateTooltip.jsx'
import { formatMoney } from '../../lib/accountSummary'
import { AVAILABLE_INVESTMENTS, sourcesFor, recordRequest, generateTransactionId } from '../../data/transactions.js'
import { useParticipant } from '../../context/ParticipantContext.jsx'
import { HOLDINGS } from '../../data/portfolio.js'

// Participant version of the admin "Transfer Request v3" flow: pick one or
// more funds to sell, say how much (by %, units or $ -- whole fund or per
// money source), choose the funds it buys and their split, then review.

const BY = [
  ['pct', 'Percentage'],
  ['amount', 'Amount']
]
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const r2 = (n) => Math.round((+n || 0) * 100) / 100
const r4 = (n) => Math.round((+n || 0) * 10000) / 10000
const pctText = (n) => `${r2(n).toFixed(2)}%`
const unitsText = (n) => r4(n).toFixed(4)

// Demo CUSIP for funds the portfolio data doesn't carry one for: stable per
// fund name so the same fund always shows the same identifier.
function cusipFor(name) {
  const known = HOLDINGS.find((h) => h.name === name)?.cusip
  if (known) return known
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return String(h).padStart(9, '0').slice(-9)
}

function holdingsFor(plan) {
  const sources = sourcesFor(plan)
  const sourceTotal = sources.reduce((s, x) => s + x.amount, 0)
  return (plan.investments || []).map((i) => {
    const amount = i.amount || 0
    const nav = i.price || (i.units ? amount / i.units : 1)
    return {
      id: slug(i.name),
      name: i.name,
      asset: i.asset || '—',
      cusip: cusipFor(i.name),
      nav,
      amount,
      units: i.units || (nav ? amount / nav : 0),
      // Each fund is held across the plan's money sources in the same
      // proportion as the sources themselves (demo data has no per-source
      // holdings), so per-source availability always sums to the fund total.
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        amount: r2(sourceTotal ? (amount * s.amount) / sourceTotal : 0)
      }))
    }
  })
}

function buyOptionsFor(plan) {
  const held = (plan.investments || []).map((i) => ({
    id: slug(i.name),
    name: i.name,
    asset: i.asset || '—',
    cusip: cusipFor(i.name),
    nav: i.price || 1
  }))
  const extra = AVAILABLE_INVESTMENTS.map((i) => ({
    id: i.id,
    name: i.name,
    asset: 'Equity',
    cusip: cusipFor(i.name),
    nav: i.nav || 1,
    restricted: !!i.restricted
  }))
  return [...held, ...extra.filter((e) => !held.some((h) => h.id === e.id))]
}

// Value typed in the "by" unit -> dollars, capped at what's available.
function toDollars(value, by, available, nav) {
  const v = +value || 0
  if (by === 'pct') return (available * v) / 100
  if (by === 'units') return v * nav
  return v
}
// Max rounds down so "Max" can never land a hair over what's available.
const floor2 = (n) => Math.floor((+n || 0) * 100 + 1e-9) / 100
const floor4 = (n) => Math.floor((+n || 0) * 10000 + 1e-9) / 10000
function maxFor(by, available, nav) {
  if (by === 'pct') return 100
  if (by === 'units') return floor4(available / (nav || 1))
  return floor2(available)
}

// Keep only digits and one dot, limit decimals (4 for units, 2 otherwise) and
// never let a percentage go over 100 -- the previous value is kept instead.
function cleanNumber(raw, prev, by) {
  let v = String(raw).replace(/[^0-9.]/g, '')
  const dot = v.indexOf('.')
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
  const places = by === 'units' ? 4 : 2
  if (dot !== -1 && v.length - dot - 1 > places) return prev
  if (by === 'pct' && +v > 100) return prev
  return v
}

// Design-system confirm text for leaving with unsaved work.
const LOST_CHANGES = { title: 'Are you sure?', body: 'Your changes may be lost. Do you want to continue?', confirmLabel: 'Okay', cancelLabel: 'Cancel' }

export function blankTransfer() {
  return { by: 'pct', sourceWise: false, sells: {} }
}

// Dollars a configured sell moves, overall and per source.
function sellBreakdown(sell, holding, by, sourceWise) {
  if (!sell) return { total: 0, bySource: [] }
  if (!sourceWise) {
    const total = r2(toDollars(sell.value, by, holding.amount, holding.nav))
    return { total, bySource: [] }
  }
  const bySource = holding.sources
    .filter((s) => sell.sources?.[s.id]?.on)
    .map((s) => ({ ...s, moved: r2(toDollars(sell.sources[s.id].value, by, s.amount, holding.nav)) }))
  return { total: r2(bySource.reduce((t, s) => t + s.moved, 0)), bySource }
}

const buysFor = (sell, srcId) => (sell.sameBuys !== false || !srcId ? sell.buys?.all : sell.buys?.[srcId]) || []
const sumPct = (rows) => r2(rows.reduce((t, r) => t + (+r.pct || 0), 0))

function sellErrors(sell, holding, by, sourceWise) {
  const errs = []
  const { total, bySource } = sellBreakdown(sell, holding, by, sourceWise)
  if (sourceWise) {
    if (!bySource.length) errs.push('Check at least one source to move from.')
    holding.sources.forEach((s) => {
      const row = sell.sources?.[s.id]
      if (!row?.on) return
      if (!(+row.value > 0)) errs.push(`Enter how much to move out of ${s.name}.`)
      else if (+row.value > maxFor(by, s.amount, holding.nav) + 1e-9) errs.push(`${s.name} is over its available amount.`)
    })
  } else if (!(+sell.value > 0)) errs.push('Enter how much to move out.')
  else if (+sell.value > maxFor(by, holding.amount, holding.nav) + 1e-9) errs.push('Transfer value is more than available.')
  const groups = sourceWise && sell.sameBuys === false ? bySource.map((s) => [s.name, buysFor(sell, s.id)]) : [[null, buysFor(sell)]]
  groups.forEach(([name, rows]) => {
    const where = name ? ` for ${name}` : ''
    if (!rows.length) errs.push(`Add at least one investment to buy${where}.`)
    else if (Math.abs(sumPct(rows) - 100) > 0.01) errs.push(allocMessage(sumPct(rows), where))
  })
  if (!errs.length && total <= 0) errs.push('Enter a transfer value.')
  return errs
}

function allocMessage(total, where = '') {
  return total > 100
    ? `Over by ${pctText(total - 100)}. Allocations${where} must add up to 100%.`
    : `${pctText(100 - total)} left to allocate${where}. Allocations must add up to 100%.`
}

// Spread a removed fund's share over the rest so the split stays at 100%:
// an even split stays even, otherwise shares grow in proportion.
function renormalise(list, wasEven) {
  if (!list.length) return list
  if (wasEven) return evenSplit(list)
  const t = sumPct(list)
  if (!t) return evenSplit(list)
  const out = list.map((r) => ({ ...r, pct: r2(((+r.pct || 0) * 100) / t) }))
  out[out.length - 1].pct = r2(100 - sumPct(out.slice(0, -1)))
  return out
}
function evenSplit(list) {
  const e = r2(100 / (list.length || 1))
  return list.map((r, i) => ({ ...r, pct: i === list.length - 1 ? r2(100 - e * (list.length - 1)) : e }))
}
const isEven = (list) => list.length > 0 && evenSplit(list).every((r, i) => Math.abs(r.pct - (+list[i].pct || 0)) < 0.011)

// On save, drop sources that aren't moving anything and buy lists that no
// longer belong to a checked source.
function pruneSell(sell, sourceWise) {
  if (!sourceWise) return { ...sell, sources: {}, buys: { all: sell.buys?.all || [] } }
  const sources = Object.fromEntries(Object.entries(sell.sources || {}).filter(([, v]) => v.on && +v.value > 0))
  const buys = sell.sameBuys === false
    ? Object.fromEntries(Object.entries(sell.buys || {}).filter(([k, v]) => sources[k] && v.length))
    : { all: sell.buys?.all || [] }
  return { ...sell, sources, buys }
}

// Every fund a sell buys into, with the dollars it receives (summed across
// sources), largest first.
function movedTargets(sell, holding, t, total, bySource) {
  const acc = {}
  const add = (b, d) => (acc[b.id] = { ...b, amount: (acc[b.id]?.amount || 0) + (d * (+b.pct || 0)) / 100 })
  if (t.sourceWise) bySource.forEach((s) => buysFor(sell, s.id).forEach((b) => add(b, s.moved)))
  else buysFor(sell).forEach((b) => add(b, total))
  return Object.values(acc).sort((a, b) => b.amount - a.amount)
}

export default function TransferFlow({ step, plan, form, set, onNext }) {
  const navigate = useNavigate()
  const holdings = useMemo(() => holdingsFor(plan), [plan])
  const buyOptions = useMemo(() => buyOptionsFor(plan), [plan])
  const t = form.transfer || blankTransfer()
  const setT = (patch) => set((f) => ({ transfer: { ...(f.transfer || blankTransfer()), ...(typeof patch === 'function' ? patch(f.transfer || blankTransfer()) : patch) } }))
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [details, setDetails] = useState(null)

  const configured = holdings.filter((h) => t.sells[h.id])
  const errorsById = Object.fromEntries(configured.map((h) => [h.id, sellErrors(t.sells[h.id], h, t.by, t.sourceWise)]))
  const ready = configured.length > 0 && configured.every((h) => !errorsById[h.id].length)
  // Projected balances once the saved transfers run: money out of each sold
  // fund, money into any held fund that is also bought.
  const flow = {}
  configured.forEach((h) => {
    const sell = t.sells[h.id]
    const { total, bySource } = sellBreakdown(sell, h, t.by, t.sourceWise)
    flow[h.id] = (flow[h.id] || 0) - total
    movedTargets(sell, h, t, total, bySource).forEach((x) => (flow[x.id] = (flow[x.id] || 0) + x.amount))
  })

  const removeSell = (h) => {
    setT((cur) => {
      const sells = { ...cur.sells }
      delete sells[h.id]
      return { sells }
    })
  }

  const changeMode = (patch) => {
    if (!configured.length) {
      setT(patch)
      return
    }
    setConfirm({
      title: 'Change transfer settings?',
      body: 'Changing these settings will clear the transfer you have setup. Do you wish to continue?',
      confirmLabel: 'Okay',
      cancelLabel: 'Cancel',
      onConfirm: () => {
        setT({ ...patch, sells: {} })
        setConfirm(null)
      }
    })
  }


  const discard = () =>
    configured.length ? setConfirm({ ...LOST_CHANGES, onConfirm: () => navigate('/transactions') }) : navigate('/transactions')

  const dialogs = (
    <>
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      <TruncateTooltip />
    </>
  )

  const [submitted, setSubmitted] = useState(false)
  const { participant } = useParticipant()
  const infoLine = (
    <p className="hint tf-info">
      <Icon icon={faInfoCircle} size={13} /> The available amount is reported as of {new Date().toLocaleDateString('en-US')} and may change due
      to market fluctuations.
    </p>
  )

  if (step === 'summary') {
    return (
      <div className="txn-card tf-page">
        <div className="tf-page-head">
          <h3>Transfer Summary</h3>
          <div className="tf-page-actions">
            <button type="button" className="btn btn-secondary" onClick={discard} disabled={submitted}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitted}
              onClick={() => {
                const total = configured.reduce((sum, h) => sum + sellBreakdown(t.sells[h.id], h, t.by, t.sourceWise).total, 0)
                recordRequest(participant.id, { id: generateTransactionId(), type: 'transfer', typeLabel: 'Transfer', plan: plan.name, amount: formatMoney(total) })
                setSubmitted(true)
              }}
            >
              {submitted ? 'Submitted' : 'Submit'}
            </button>
          </div>
        </div>
        {infoLine}
        {configured.map((h) => (
          <SellReview key={h.id} holding={h} sell={t.sells[h.id]} t={t} flowIn={flow[h.id] || 0} />
        ))}
        {submitted && (
          <div className="tf-toast">
            <Toast message="Transfer request submitted successfully" duration={8000} onDismiss={() => navigate('/transactions')} />
          </div>
        )}
        {dialogs}
      </div>
    )
  }

  return (
    <div className="txn-card tf-page">
      <div className="tf-page-head">
        <h3>New Transfer Request</h3>
        <div className="tf-page-actions">
          <button type="button" className="btn btn-secondary" onClick={discard}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
      {infoLine}

      <div className="tf-controls">
        <div className="tf-control">
          <span className="tf-label" id="tf-by">
            Transfer by
          </span>
          <div className="period" role="radiogroup" aria-labelledby="tf-by">
            {BY.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={t.by === id}
                className={t.by === id ? 'on' : ''}
                onClick={() => t.by !== id && changeMode({ by: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="tf-control">
          <span className="tf-label" id="tf-sw">
            Source wise transfer
          </span>
          <label className={`inv-toggle${t.sourceWise ? ' on' : ''}`}>
            <input
              type="checkbox"
              role="switch"
              aria-labelledby="tf-sw"
              checked={t.sourceWise}
              onChange={() => changeMode({ sourceWise: !t.sourceWise })}
            />
            <span className="switch" aria-hidden="true" />
          </label>
        </div>
      </div>

      <p className="tf-count">
        <b>
          {String(holdings.length).padStart(2, '0')}/{String(holdings.length).padStart(2, '0')}
        </b>{' '}
        record(s) found
      </p>
      <div className="table-wrap">
        <table className="alloc-table table-grouped tf-table">
          <thead>
            <tr>
              <th scope="col" className="tf-c-name">Investment name</th>
              <th scope="col" className="tf-c-act">Action</th>
              <th scope="col" className="tf-c-to">Transfer to</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const sell = t.sells[h.id]
              const { total, bySource } = sellBreakdown(sell, h, t.by, t.sourceWise)
              const errs = sell ? errorsById[h.id] : []
              const bal = h.amount + (flow[h.id] || 0)
              const targets = sell ? movedTargets(sell, h, t, total, bySource) : []
              // Figma: every buy line counts, so a fund bought from two sources counts twice.
              const buyCount = sell ? (t.sourceWise ? bySource.reduce((n, s) => n + buysFor(sell, s.id).length, 0) : buysFor(sell).length) : 0
              return (
                <tr key={h.id} className={sell ? 'tf-on' : undefined}>
                  <td className="alloc-name-col">
                    {sell && <span className="badge red tf-sell-tag">Sell</span>}
                    <button type="button" className="text-link tf-fund-link" data-full={h.name} onClick={() => setEditing(h.id)}>
                      {h.name}
                    </button>
                    <span className="tf-meta">
                      Balance <b>{formatMoney(bal)}</b> and <b>{r2(bal / h.nav).toLocaleString('en-US')}</b> Units
                    </span>
                  </td>
                  <td className="tf-c-act">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(h.id)} aria-label={`${sell ? 'Edit' : 'Add'} transfer from ${h.name}`}>
                      {sell ? 'Edit' : 'Add'}
                    </button>
                  </td>
                  <td>
                    {sell && total > 0 ? (
                      <div className="tf-mc">
                        <span className="badge green tf-sell-tag">Buy</span>
                        <p className="tf-mc-h">
                          <b>{formatMoney(total)}</b>
                          <span>| {buyCount} Investment(s)</span>
                        </p>
                        <span className="tf-chips">
                          <span className="tf-chip-track">
                          {targets.slice(0, 2).map((x) => (
                            <span key={x.id} className="badge navy tf-chip" data-full={x.name}>
                              <span className="tf-chip-name">{x.name}</span>
                              <b>{Math.round((x.amount / (total || 1)) * 100)}%</b>
                            </span>
                          ))}
                          </span>
                          {targets.length > 2 && <span className="badge navy">+{targets.length - 2}</span>}
                          <button type="button" className="text-link" onClick={() => setDetails(h.id)}>
                            View details
                          </button>
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {details && t.sells[details] && (
        <TransferDetails holding={holdings.find((h) => h.id === details)} sell={t.sells[details]} t={t} onClose={() => setDetails(null)} />
      )}
      {editing && (
        <EditSell
          holding={holdings.find((h) => h.id === editing)}
          sell={t.sells[editing]}
          t={t}
          holdings={holdings}
          buyOptions={buyOptions}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            const id = editing
            if (next) setT((cur) => ({ sells: { ...cur.sells, [id]: pruneSell(next, cur.sourceWise) } }))
            else removeSell(holdings.find((h) => h.id === id))
            setEditing(null)
          }}
        />
      )}
      {dialogs}
    </div>
  )
}

const valueText = (by, v) => (by === 'pct' ? pctText(v) : by === 'units' ? `${unitsText(v)} units` : formatMoney(v))

// Figma "Investment Transfer" slide-over: 1. Transfer from (fund card, or one
// checkbox card per source), 2. Choose buy investment(s) as cards with Select,
// 3. Set allocation as cards grouped per source. Save stays disabled until
// the transfer is complete; saving an emptied transfer removes it.
function EditSell({ holding, sell, t, holdings, buyOptions, onClose, onSave }) {
  const [initial] = useState(() =>
    JSON.stringify({
      value: '',
      sources: {},
      buys: { all: [] },
      ...(sell ? JSON.parse(JSON.stringify(sell)) : {}),
      sameBuys: !t.sourceWise
    })
  )
  const [draft, setDraft] = useState(() => JSON.parse(initial))
  const [query, setQuery] = useState('')
  const [addedQuery, setAddedQuery] = useState('')
  const unit = { pct: '%', units: 'units', amount: '$' }[t.by]
  const noUnits = t.by === 'units' && !(holding.units > 0)
  const { bySource } = sellBreakdown(draft, holding, t.by, t.sourceWise)
  const errs = noUnits ? ['Units not available. Choose Percentage or Amount.'] : sellErrors(draft, holding, t.by, t.sourceWise)
  const [activeSrc, setActiveSrc] = useState(() => (t.sourceWise ? Object.keys(draft.sources || {}).find((k) => draft.sources[k]?.on) || null : null))

  const overMax = (value, available) => +value > maxFor(t.by, available, holding.nav) + 1e-9
  // Which money pot columns 2 and 3 are working on right now.
  const key = t.sourceWise ? activeSrc : 'all'
  const keyValue = t.sourceWise ? draft.sources[activeSrc]?.value : draft.value
  const keyAvailable = t.sourceWise ? holding.sources.find((s) => s.id === activeSrc)?.amount || 0 : holding.amount
  const canPick = !noUnits && !!key && +keyValue > 0 && !overMax(keyValue, keyAvailable)
  const rows = (key && draft.buys[key]) || []

  const isEmpty =
    !(+draft.value > 0) && !Object.values(draft.sources || {}).some((s) => s.on) && !Object.values(draft.buys || {}).some((l) => l.length)
  const canSave = !errs.length || (isEmpty && !!sell)

  const setSrc = (id, patch) => setDraft((d) => ({ ...d, sources: { ...d.sources, [id]: { on: false, value: '', ...d.sources[id], ...patch } } }))
  const toggleSrc = (id, on) => {
    setDraft((d) => {
      if (on) return { ...d, sources: { ...d.sources, [id]: { on: true, value: d.sources[id]?.value || '' } } }
      const buys = { ...d.buys }
      delete buys[id]
      return { ...d, sources: { ...d.sources, [id]: { on: false, value: '' } }, buys }
    })
    if (on) setActiveSrc(id)
    else if (activeSrc === id) setActiveSrc(Object.keys(draft.sources).find((k) => k !== id && draft.sources[k]?.on) || null)
  }
  const setRowsFor = (k, fn) => setDraft((d) => ({ ...d, buys: { ...d.buys, [k]: fn(d.buys[k] || []) } }))
  const q = query.trim().toLowerCase()
  const options = buyOptions.filter(
    (o) => o.id !== holding.id && !rows.some((r) => r.id === o.id) && (!q || o.name.toLowerCase().includes(q) || o.cusip.toLowerCase().includes(q))
  )
  const aq = addedQuery.trim().toLowerCase()
  const groups = t.sourceWise
    ? holding.sources.filter((s) => draft.sources[s.id]?.on).map((s) => ({ key: s.id, title: s.name, moved: bySource.find((b) => b.id === s.id)?.moved || 0 }))
    : [{ key: 'all', title: null, moved: sellBreakdown(draft, holding, t.by, false).total }]
  const heldAmount = (id) => holdings.find((h) => h.id === id)?.amount
  // Trash sits on the input row; when the fund is already held it moves down
  // to the "Current balance" row, matching Figma.
  const trash = (k, r) => (
    <button
      type="button"
      className="icon-btn tf-trash"
      aria-label={`Remove ${r.name}`}
      onClick={() => setRowsFor(k, (cur) => renormalise(cur.filter((x) => x.id !== r.id), isEven(cur)))}
    >
      <Icon icon={faTrash} size={13} />
    </button>
  )

  const doneLine = (k, value) => {
    const list = draft.buys[k] || []
    if (!(+value > 0) || !list.length || Math.abs(sumPct(list) - 100) > 0.01) return null
    return (
      <p className="tf-from-done">
        {valueText(t.by, value)} into {String(list.length).padStart(2, '0')} investment{list.length === 1 ? '' : 's'}
      </p>
    )
  }

  const [leaving, setLeaving] = useState(false)
  // Only ask when something in the panel actually changed.
  const dirty = JSON.stringify(draft) !== initial
  const requestClose = () => (dirty ? setLeaving(true) : onClose())
  const save = () => canSave && onSave(isEmpty ? null : draft)

  return (
    <Slideover
      title="Investment Transfer"
      width="full"
      onClose={requestClose}
      closeButton={false}
      actions={
        <>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
            Save
          </button>
          <button type="button" className="btn btn-secondary" onClick={requestClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="tf-cols">
        <section className="tf-col" aria-labelledby="tf-c1">
          <h4 className="tf-col-title" id="tf-c1">
            1. Transfer from
          </h4>
          {noUnits && <div className="wd-note">Units not available. Choose Percentage or Amount.</div>}
          {!t.sourceWise && !noUnits && (
            <div className="tf-src-card on active">
              <span className="tf-src-name" data-full={holding.name}>{holding.name}</span>
              <span className="tf-src-meta">
                Balance: <b>{formatMoney(holding.amount)}</b> Units: <b>{r2(holding.units).toLocaleString('en-US')}</b>
              </span>
              <AmountField
                label="Amount to move"
                by={t.by}
                unit={unit}
                value={draft.value}
                max={maxFor(t.by, holding.amount, holding.nav)}
                onChange={(v) => setDraft((d) => ({ ...d, value: v }))}
                onMax={() => setDraft((d) => ({ ...d, value: String(maxFor(t.by, holding.amount, holding.nav)) }))}
              />
              {doneLine('all', draft.value)}
            </div>
          )}
          {t.sourceWise &&
            !noUnits &&
            holding.sources.map((s) => {
              const row = draft.sources[s.id] || {}
              return (
                <div
                  key={s.id}
                  className={`tf-src-card${row.on ? ' on' : ''}${activeSrc === s.id ? ' active' : ''}`}
                  onFocusCapture={() => row.on && setActiveSrc(s.id)}
                  onClick={() => row.on && setActiveSrc(s.id)}
                >
                  <label className="tf-src-pick">
                    <input type="checkbox" checked={!!row.on} onChange={(e) => toggleSrc(s.id, e.target.checked)} />
                    <span className="tf-src-name" data-full={s.name}>{s.name}</span>
                  </label>
                  <span className="tf-src-meta">
                    Balance: <b>{formatMoney(s.amount)}</b> Units: <b>{r2(s.amount / holding.nav).toLocaleString('en-US')}</b>
                  </span>
                  <AmountField
                    label={`${s.name} amount`}
                    by={t.by}
                    unit={unit}
                    value={row.value ?? ''}
                    max={maxFor(t.by, s.amount, holding.nav)}
                    disabled={!row.on}
                    onChange={(v) => setSrc(s.id, { value: v })}
                    onMax={() => setSrc(s.id, { value: String(maxFor(t.by, s.amount, holding.nav)) })}
                  />
                  {row.on && doneLine(s.id, row.value)}
                </div>
              )
            })}
        </section>

        <section className="tf-col" aria-labelledby="tf-c2">
          <h4 className="tf-col-title" id="tf-c2">
            2. Choose buy investment(s)
          </h4>
          <div className="add-inv-search">
            <Icon icon={faSearch} size={15} />
            <input type="search" aria-label="Search by Investments" placeholder="Search by Investments" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <p className="add-inv-count">
            <b>{String(options.length).padStart(2, '0')}</b> Investment(s)
          </p>
          <ul className="tf-fund-cards">
            {options.map((o) => (
              <li key={o.id} className={`tf-fund-card${o.restricted ? ' restricted' : ''}`}>
                <span className="tf-fund-meta">
                  <span>
                    CUSIP: <b>{o.cusip}</b>
                  </span>
                  <span>
                    Type: <b>{o.asset}</b>
                  </span>
                </span>
                <span className="tf-fund-row">
                  <b className="tf-fund-name" data-full={o.name}>{o.name}</b>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={o.restricted || !canPick}
                    title={o.restricted ? 'Not available for transfer' : undefined}
                    aria-label={`Select ${o.name}`}
                    onClick={() => setRowsFor(key, (cur) => evenSplit([...cur, { id: o.id, name: o.name, asset: o.asset, cusip: o.cusip, nav: o.nav, pct: 0 }]))}
                  >
                    Select
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="tf-col" aria-labelledby="tf-c3">
          <h4 className="tf-col-title" id="tf-c3">
            3. Set allocation
          </h4>
          <div className="add-inv-search">
            <Icon icon={faSearch} size={15} />
            <input
              type="search"
              aria-label="Search selected Investments"
              placeholder="Search selected Investments"
              value={addedQuery}
              onChange={(e) => setAddedQuery(e.target.value)}
            />
          </div>
          {!groups.length && (
            <p className="add-inv-count">
              <b>0</b> Investment(s) added
            </p>
          )}
          {groups.map((g) => {
            const list = draft.buys[g.key] || []
            const shown = aq ? list.filter((r) => r.name.toLowerCase().includes(aq)) : list
            const total = sumPct(list)
            return (
              <div key={g.key} className={`tf-alloc-group${t.sourceWise && activeSrc === g.key ? ' active' : ''}`}>
                {g.title && <p className="tf-group-title">{g.title}</p>}
                <div className="tf-alloc-bar">
                  <span>
                    <b>{list.length ? String(list.length).padStart(2, '0') : 0}</b> Investment(s) added
                  </span>
                  {list.length > 1 && (
                    <button type="button" className="text-link" onClick={() => setRowsFor(g.key, evenSplit)}>
                      Split evenly
                    </button>
                  )}
                </div>
                <ul className="tf-fund-cards">
                  {shown.map((r) => (
                    <li key={r.id} className="tf-fund-card">
                      <span className="tf-fund-meta">
                        <span>
                          CUSIP: <b>{r.cusip}</b>
                        </span>
                        <span>
                          Type: <b>{r.asset}</b>
                        </span>
                      </span>
                      <b className="tf-fund-name" data-full={r.name}>{r.name}</b>
                      <span className="tf-alloc-row">
                        <span className={`alloc-pct-input${list.length && Math.abs(total - 100) > 0.01 ? ' tf-bad' : ''}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Allocation for ${r.name}`}
                            value={r.pct}
                            onChange={(e) =>
                              setRowsFor(g.key, (cur) => cur.map((x) => (x.id === r.id ? { ...x, pct: cleanNumber(e.target.value, x.pct, 'pct') } : x)))
                            }
                          />
                          <i>%</i>
                        </span>
                        <b>{formatMoney((g.moved * (+r.pct || 0)) / 100)}</b>
                        {heldAmount(r.id) == null && trash(g.key, r)}
                      </span>
                      {heldAmount(r.id) != null && (
                        <span className="tf-fund-foot">
                          <span>
                            Current balance: <b>{formatMoney(heldAmount(r.id))}</b>
                          </span>
                          {trash(g.key, r)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      </div>

      {leaving && <ConfirmDialog {...LOST_CHANGES} onConfirm={onClose} onCancel={() => setLeaving(false)} />}
    </Slideover>
  )
}

function AmountField({ label, by, unit, value, max, onChange, onMax, disabled }) {
  const over = !disabled && +value > max + 1e-9
  return (
    <span className="tf-amount-wrap">
      <span className="tf-amount">
        <span className={`alloc-pct-input${over ? ' tf-bad' : ''}`}>
          {unit === '$' && <i>$</i>}
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            aria-invalid={over || undefined}
            placeholder={by === 'units' ? '0.0000' : '0.00'}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(cleanNumber(e.target.value, value, by))}
          />
          {unit !== '$' && <i>{unit}</i>}
        </span>
        <button type="button" className="text-link" onClick={onMax} disabled={disabled}>
          Max
        </button>
      </span>
    </span>
  )
}

// Figma "Transfer details": read-only, Cancel only. Sell cell spans its buys.
function TransferDetails({ holding, sell, t, onClose }) {
  const { total, bySource } = sellBreakdown(sell, holding, t.by, t.sourceWise)
  const groups = t.sourceWise
    ? bySource.map((s) => ({ key: s.id, title: s.name, moved: s.moved, rows: buysFor(sell, s.id) }))
    : [{ key: 'all', title: null, moved: total, rows: buysFor(sell) }]
  return (
    <Slideover
      title="Transfer details"
      width="wide"
      onClose={onClose}
      closeButton={false}
      actions={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="table-wrap tf-detail-group">
        <table className="alloc-table table-grouped tf-detail-table">
          <thead>
            <tr>
              <th scope="col">Sell Investment</th>
              <th scope="col">Buy investment(s)</th>
              <th scope="col" className="num">
                Allocation
              </th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              g.rows.map((r, i) => (
                <tr key={`${g.key}-${r.id}`} className={i === g.rows.length - 1 ? 'group-end' : undefined}>
                  {i === 0 && (
                    <td rowSpan={g.rows.length} className="group-head tf-detail-sell">
                      <span className="tf-detail-arrow static" aria-hidden="true">
                        <Icon icon={faArrowRight} size={12} />
                      </span>
                      <b className="tf-detail-src" data-full={holding.name}>
                        {holding.name}
                      </b>
                      {g.title && <small>{g.title}</small>}
                      <b className="tf-sell-amt">{formatMoney(g.moved)}</b>
                    </td>
                  )}
                  <td className="alloc-name-col">
                    <span className="alloc-name">{r.name}</span>
                    {g.title && <span className="tf-meta">{g.title}</span>}
                  </td>
                  <td className="num">{pctText(r.pct)}</td>
                  <td className="num">{formatMoney((g.moved * (+r.pct || 0)) / 100)}</td>
                </tr>
              ))
            )}
            <tr className="alloc-total">
              <td colSpan={3}>Total</td>
              <td className="num">{formatMoney(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Slideover>
  )
}

// Figma "Transfer Summary" card: sell panel on the left, buy table(s) right.
function SellReview({ holding, sell, t, flowIn }) {
  const { total, bySource } = sellBreakdown(sell, holding, t.by, t.sourceWise)
  const tables = t.sourceWise
    ? bySource.map((s) => ({ key: s.id, title: s.name, moved: s.moved, pct: (s.moved / (s.amount || 1)) * 100, rows: buysFor(sell, s.id) }))
    : [{ key: 'all', title: null, moved: total, pct: (total / (holding.amount || 1)) * 100, rows: buysFor(sell) }]
  return (
    <div className="tf-review">
      <div className="tf-sell">
        <span className="tf-sell-top">
          <span className="badge red">Sell</span>
          <span className="tf-detail-arrow static" aria-hidden="true">
            <Icon icon={faArrowRight} size={12} />
          </span>
        </span>
        <b className="tf-sell-name">{holding.name}</b>
        <dl className="tf-dl">
          <div>
            <dt>Current balance</dt>
            <dd>{formatMoney(holding.amount + flowIn)}</dd>
          </div>
        </dl>
        <dl className="tf-dl">
          <div>
            <dt>CUSIP</dt>
            <dd>{holding.cusip}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{holding.asset}</dd>
          </div>
        </dl>
        {tables.map((tb) => (
          <dl key={tb.key} className="tf-dl">
            {tb.title && <p className="tf-dl-title">{tb.title}</p>}
            <div>
              <dt>Selling percentage</dt>
              <dd>{pctText(tb.pct)}</dd>
            </div>
            <div>
              <dt>Selling amount</dt>
              <dd>{formatMoney(tb.moved)}</dd>
            </div>
          </dl>
        ))}
      </div>
      <div className="tf-buys">
        <span className="badge green">Buy</span>
        {tables.map((tb, i) => (
          <div key={tb.key} className="tf-buy-table">
            <p className="tf-buy-title">
              {tb.title ? (
                <>
                  <b>{tb.title}</b> {formatMoney(tb.moved)} | {pctText(tb.pct)} | <b>{String(tb.rows.length).padStart(2, '0')}</b> Investment(s)
                </>
              ) : (
                <>
                  <b>{String(tb.rows.length).padStart(2, '0')}</b> Investment(s) | {formatMoney(tb.moved)} | {pctText(tb.pct)}
                </>
              )}
            </p>
            <div className="table-wrap">
              <table className="alloc-table table-grouped">
                <thead>
                  <tr>
                    <th scope="col">Investment name</th>
                    <th scope="col">CUSIP</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Allocation
                    </th>
                    <th scope="col" className="num">
                      Buy amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="alloc-name-col">
                        <span className="alloc-name">{r.name}</span>
                      </td>
                      <td>{r.cusip}</td>
                      <td>{r.asset}</td>
                      <td className="num">{pctText(r.pct)}</td>
                      <td className="num">{formatMoney((tb.moved * (+r.pct || 0)) / 100)}</td>
                    </tr>
                  ))}
                  <tr className="alloc-total">
                    <td colSpan={4}>{i < tables.length - 1 ? 'Total buying' : 'Total'}</td>
                    <td className="num">{formatMoney(tb.moved)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
