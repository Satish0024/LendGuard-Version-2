import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faExclamationTriangle, faPrint, faSearch, faArrowRight, faCheck } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import { formatMoney } from '../../lib/accountSummary'
import { AVAILABLE_INVESTMENTS, sourcesFor } from '../../data/transactions.js'
import { HOLDINGS } from '../../data/portfolio.js'

// Participant version of the admin "Transfer Request v3" flow: pick one or
// more funds to sell, say how much (by %, units or $ -- whole fund or per
// money source), choose the funds it buys and their split, then review.

const DRAFT_KEY = 'lg-transfer-draft'
const BY = [
  ['pct', 'Percentage'],
  ['units', 'Units'],
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
const maxText = (by, max) => (by === 'pct' ? pctText(max) : by === 'units' ? `${unitsText(max)} units` : formatMoney(max))

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

// Funds with trading rules the review has to call out before submitting.
const BUY_RULES = {
  'zetex-equity': 'Zetex Equity has a 30-day round-trip rule: money moved in can\'t be moved out again for 30 days.'
}
const SELL_FEE_PCT = 0.5 // short-term redemption fee some funds charge on a sell

export function blankTransfer() {
  return { by: 'pct', sourceWise: false, sells: {}, ack: false }
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

function sellStatus(sell, errs) {
  if (!sell) return null
  return errs.length ? { cls: 'amber', label: 'Needs attention' } : { cls: 'green', label: 'Ready' }
}

export default function TransferFlow({ step, plan, form, set, onNext, onBack, onSubmit }) {
  const navigate = useNavigate()
  const holdings = useMemo(() => holdingsFor(plan), [plan])
  const buyOptions = useMemo(() => buyOptionsFor(plan), [plan])
  const t = form.transfer || blankTransfer()
  const setT = (patch) => set((f) => ({ transfer: { ...(f.transfer || blankTransfer()), ...(typeof patch === 'function' ? patch(f.transfer || blankTransfer()) : patch) } }))
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)
  const [details, setDetails] = useState(null)
  // Short-lived status line (cleared transfers, removed fund + Undo).
  const flash = (text, undo) => setNotice({ text, undo, at: Date.now() })
  useEffect(() => {
    if (!notice) return undefined
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])
  const [resume, setResume] = useState(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
      return d && d.planId === plan.id && Object.keys(d.transfer?.sells || {}).length ? d.transfer : null
    } catch {
      return null
    }
  })

  // Draft: keep the in-progress request so leaving the page doesn't lose it.
  useEffect(() => {
    if (resume) return
    try {
      if (Object.keys(t.sells).length) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ planId: plan.id, transfer: t }))
    } catch {
      /* storage unavailable: draft is a convenience only */
    }
  }, [t, plan.id, resume])

  const configured = holdings.filter((h) => t.sells[h.id])
  const errorsById = Object.fromEntries(configured.map((h) => [h.id, sellErrors(t.sells[h.id], h, t.by, t.sourceWise)]))
  const ready = configured.length > 0 && configured.every((h) => !errorsById[h.id].length)
  const totalMoving = configured.reduce((s, h) => s + sellBreakdown(t.sells[h.id], h, t.by, t.sourceWise).total, 0)
  const buyingInto = new Set(
    configured.flatMap((h) => {
      const sell = t.sells[h.id]
      return Object.values(sell.buys || {}).flat().map((b) => b.id)
    })
  ).size

  // Review-time warnings: redemption fee on every sell, trading rules on buys.
  const feeTotal = r2((totalMoving * SELL_FEE_PCT) / 100)
  const warnings = configured.length
    ? [
        `Some investments charge a short-term redemption fee of up to ${SELL_FEE_PCT}% when sold. Up to ${formatMoney(feeTotal)} may be deducted from the amount moved.`,
        ...[
          ...new Set(
            configured.flatMap((h) =>
              Object.values(t.sells[h.id].buys || {})
                .flat()
                .map((b) => BUY_RULES[b.id])
                .filter(Boolean)
            )
          )
        ]
      ]
    : []

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
    const prev = t.sells[h.id]
    setT((cur) => {
      const sells = { ...cur.sells }
      delete sells[h.id]
      return { sells }
    })
    flash(`Transfer from ${h.name} removed`, () => setT((cur) => ({ sells: { ...cur.sells, [h.id]: prev } })))
  }

  const changeMode = (patch) => {
    if (!configured.length) {
      setT(patch)
      return
    }
    setConfirm({
      title: 'Change transfer settings?',
      body: `Changing this clears the ${configured.length} transfer${configured.length > 1 ? 's' : ''} you have set up, because amounts and sources are entered differently.`,
      confirmLabel: 'Change and clear',
      cancelLabel: 'Keep current',
      onConfirm: () => {
        setT({ ...patch, sells: {}, ack: false })
        setConfirm(null)
        flash(`${configured.length} saved transfer${configured.length > 1 ? 's' : ''} cleared`)
      }
    })
  }

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  const discard = () => {
    if (!configured.length) {
      clearDraft()
      navigate('/transactions')
      return
    }
    setConfirm({
      title: 'Discard this transfer request?',
      body: `The ${configured.length} transfer${configured.length > 1 ? 's' : ''} you have set up will be removed.`,
      confirmLabel: 'Discard request',
      cancelLabel: 'Keep editing',
      onConfirm: () => {
        clearDraft()
        navigate('/transactions')
      }
    })
  }

  const overview = (
    <div className="tf-overview" aria-live="polite">
      <div>
        <span>Investments selling</span>
        <b>
          {String(configured.length).padStart(2, '0')} of {String(holdings.length).padStart(2, '0')}
        </b>
      </div>
      <div>
        <span>Total moving</span>
        <b>{formatMoney(totalMoving)}</b>
      </div>
      <div>
        <span>Buying into</span>
        <b>{String(buyingInto).padStart(2, '0')} investments</b>
      </div>
      <div>
        <span>Transfer by</span>
        <b>
          {BY.find(([id]) => id === t.by)[1]}
          {t.sourceWise ? ' · source wise' : ''}
        </b>
      </div>
    </div>
  )

  const dialogs = (
    <>
      {resume && (
        <ConfirmDialog
          title="Continue your saved transfer?"
          body="You have a transfer request in progress for this plan. Continue where you left off, or start over."
          confirmLabel="Continue"
          cancelLabel="Start over"
          onConfirm={() => {
            set({ transfer: resume })
            setResume(null)
          }}
          onCancel={() => {
            clearDraft()
            setResume(null)
          }}
        />
      )}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </>
  )

  if (step === 'summary') {
    return (
      <div className="txn-card">
        <div className="txn-summary-head">
          <h3>Review your transfer</h3>
          <button type="button" className="icon-btn" data-tip="Print" aria-label="Print" onClick={() => window.print()}>
            <Icon icon={faPrint} size={17} />
          </button>
        </div>
        <p className="hint">Check what you are selling and where the money goes. Values are estimates until the trades are placed.</p>
        {overview}
        {configured.map((h) => (
          <SellReview
            key={h.id}
            holding={h}
            sell={t.sells[h.id]}
            t={t}
            buyOptions={buyOptions}
            onEdit={() => {
              setT({ ack: false })
              setEditing(h.id)
              onBack()
            }}
          />
        ))}
        {warnings.length > 0 && (
          <div className="wd-note tf-warnings" role="note">
            <b>Before you submit</b>
            <ul>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <label className="alloc-apply-all tf-ack">
          <input type="checkbox" checked={!!t.ack} onChange={(e) => setT({ ack: e.target.checked })} />
          <span>
            I understand these trades are placed at the next market close, so the final units and amounts may differ from the
            estimates shown.
          </span>
        </label>
        <div className="txn-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!t.ack}
            onClick={() => {
              clearDraft()
              onSubmit()
            }}
          >
            Submit Request
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setT({ ack: false })
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

  return (
    <div className="txn-card">
      <h3>Investments to move</h3>
      <p className="hint">Sell from one or more investments and choose where the money goes.</p>

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
        <label className={`inv-toggle${t.sourceWise ? ' on' : ''}`}>
          <input type="checkbox" checked={t.sourceWise} onChange={() => changeMode({ sourceWise: !t.sourceWise })} />
          <span className="switch" aria-hidden="true" />
          Source wise transfer
        </label>
      </div>

      <p className="tf-count">
        <b>
          {String(configured.length).padStart(2, '0')}/{String(holdings.length).padStart(2, '0')}
        </b>{' '}
        investments set up
      </p>
      <div className="table-wrap">
        <table className="alloc-table tf-table">
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
              const status = sellStatus(sell, errs)
              const flowIn = flow[h.id] || 0
              const bal = h.amount + flowIn
              const targets = sell ? movedTargets(sell, h, t, total, bySource) : []
              const groups = sell && t.sourceWise ? bySource.filter((s) => buysFor(sell, s.id).length && s.moved > 0) : []
              return (
                <tr key={h.id} className={sell ? 'tf-on' : undefined}>
                  <td className="alloc-name-col">
                    <span className="alloc-name">{h.name}</span>
                    <span className="tf-meta">
                      Account balance <b>{formatMoney(bal)}</b> · Available units <b>{unitsText(bal / h.nav)}</b>
                    </span>
                    {status && (
                      <span className="tf-tags">
                        <span className="badge red">Sell</span>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </span>
                    )}
                  </td>
                  <td className="tf-c-act">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(h.id)}>
                      {sell ? 'Edit' : 'Set up transfer'}
                    </button>
                  </td>
                  <td>
                    {sell && total > 0 ? (
                      <div className="tf-mc">
                        <p className="tf-mc-h">
                          <b>{formatMoney(total)}</b>
                          <span>{t.sourceWise ? `${groups.length} source${groups.length === 1 ? '' : 's'}` : pctText((total / h.amount) * 100)}</span>
                          <span>{unitsText(total / h.nav)} units</span>
                          transfer to {targets.length} investment{targets.length === 1 ? '' : 's'}
                        </p>
                        <span className="tf-chips">
                          {t.sourceWise
                            ? groups.slice(0, 2).map((g) => (
                                <span key={g.id} className="badge navy" title={`${g.name} · ${formatMoney(g.moved)}`}>
                                  {g.name} {formatMoney(g.moved)}
                                </span>
                              ))
                            : targets.slice(0, 2).map((x) => (
                                <span key={x.id} className="badge navy" title={`${x.name} · ${formatMoney(x.amount)}`}>
                                  {x.name} {Math.round((x.amount / (total || 1)) * 100)}%
                                </span>
                              ))}
                          {(t.sourceWise ? groups.length : targets.length) > 2 && (
                            <span className="badge navy">+{(t.sourceWise ? groups.length : targets.length) - 2}</span>
                          )}
                          <button type="button" className="text-link" onClick={() => setDetails(h.id)}>
                            View details
                          </button>
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                    {errs.length > 0 && (
                      <span className="alloc-warn tf-row-warn">
                        <Icon icon={faExclamationTriangle} size={12} /> {errs[0]}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {notice && (
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
      )}

      <div className="txn-actions">
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={onNext}>
          Review transfer
        </button>
        <button type="button" className="btn btn-ghost" onClick={discard}>
          Cancel
        </button>
      </div>
      {!ready && configured.length > 0 && (
        <p className="alloc-warn tf-continue-warn">Fix the investments marked "Needs attention" to continue.</p>
      )}

      {details && t.sells[details] && (
        <TransferDetails
          holding={holdings.find((h) => h.id === details)}
          sell={t.sells[details]}
          t={t}
          onClose={() => setDetails(null)}
          onEdit={() => {
            const id = details
            setDetails(null)
            setEditing(id)
          }}
          onRemove={() => {
            const h = holdings.find((x) => x.id === details)
            setDetails(null)
            removeSell(h)
          }}
        />
      )}
      {editing && (
        <EditSell
          holding={holdings.find((h) => h.id === editing)}
          sell={t.sells[editing]}
          t={t}
          buyOptions={buyOptions}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setT((cur) => ({ sells: { ...cur.sells, [editing]: pruneSell(next, cur.sourceWise) } }))
            setEditing(null)
          }}
        />
      )}
      {dialogs}
    </div>
  )
}

function ColHead({ n, title, hint, done }) {
  return (
    <div className="tf-col-head">
      <span className={`tf-col-num${done ? ' done' : ''}`} aria-hidden="true">
        {done ? <Icon icon={faCheck} size={11} /> : n}
      </span>
      <span>
        <b>{title}</b>
        {hint && <small>{hint}</small>}
        {done && <span className="sr-only"> (complete)</span>}
      </span>
    </div>
  )
}

function EditSell({ holding, sell, t, buyOptions, onClose, onSave }) {
  const [initial] = useState(() =>
    JSON.stringify({ value: '', sources: {}, sameBuys: true, buys: { all: [] }, ...(sell ? JSON.parse(JSON.stringify(sell)) : {}) })
  )
  const [draft, setDraft] = useState(() => JSON.parse(initial))
  const [query, setQuery] = useState('')
  const [addedQuery, setAddedQuery] = useState('')
  const [leaving, setLeaving] = useState(false)
  const dirty = JSON.stringify(draft) !== initial
  const unit = { pct: '%', units: 'units', amount: '$' }[t.by]
  const noUnits = t.by === 'units' && !(holding.units > 0)
  const { total, bySource } = sellBreakdown(draft, holding, t.by, t.sourceWise)
  const errs = noUnits ? ['Units not available. Choose Percentage or Amount.'] : sellErrors(draft, holding, t.by, t.sourceWise)
  const perSource = t.sourceWise && draft.sameBuys === false
  const [activeSrc, setActiveSrc] = useState(null)
  const curSrc = perSource ? bySource.find((s) => s.id === activeSrc) || bySource[0] : null
  const key = curSrc ? curSrc.id : 'all'
  const moved = curSrc ? curSrc.moved : total
  const rows = draft.buys[key] || []
  const allocTotal = sumPct(rows)

  // Step 1 is valid when every included amount is entered and within limits.
  const overMax = (value, available) => +value > maxFor(t.by, available, holding.nav) + 1e-9
  const fromDone =
    !noUnits &&
    total > 0 &&
    (t.sourceWise
      ? bySource.length > 0 && bySource.every((s) => +draft.sources[s.id]?.value > 0 && !overMax(draft.sources[s.id].value, s.amount))
      : !overMax(draft.value, holding.amount))
  const pickDone = perSource ? bySource.length > 0 && bySource.every((s) => (draft.buys[s.id] || []).length) : rows.length > 0
  const allocDone = perSource
    ? bySource.length > 0 && bySource.every((s) => Math.abs(sumPct(draft.buys[s.id] || []) - 100) < 0.01)
    : rows.length > 0 && Math.abs(allocTotal - 100) < 0.01
  const canSave = !errs.length

  const setSrc = (id, patch) =>
    setDraft((d) => ({ ...d, sources: { ...d.sources, [id]: { on: false, value: '', ...d.sources[id], ...patch } } }))
  // Unchecking a source clears what was entered for it, including its buys,
  // and hands the step 2/3 focus to the next checked source.
  const toggleSrc = (id, on) => {
    setDraft((d) => {
      if (on) return { ...d, sources: { ...d.sources, [id]: { on: true, value: d.sources[id]?.value || '' } } }
      const buys = { ...d.buys }
      delete buys[id]
      const sources = { ...d.sources, [id]: { on: false, value: '' } }
      // Shared buys go too once no source is left to fund them.
      if (!Object.values(sources).some((x) => x.on)) buys.all = []
      return { ...d, sources, buys }
    })
    if (!on && activeSrc === id) setActiveSrc(null)
  }
  const setRows = (fn) => setDraft((d) => ({ ...d, buys: { ...d.buys, [key]: fn(d.buys[key] || []) } }))
  const q = query.trim().toLowerCase()
  const options = buyOptions.filter(
    (o) => o.id !== holding.id && !rows.some((r) => r.id === o.id) && (!q || o.name.toLowerCase().includes(q) || o.cusip.includes(q))
  )
  const aq = addedQuery.trim().toLowerCase()
  const shownRows = aq ? rows.filter((r) => r.name.toLowerCase().includes(aq)) : rows
  const lockHint = t.sourceWise && !bySource.length ? 'Choose a source first' : `Enter the transfer ${{ pct: 'percentage', units: 'units', amount: 'amount' }[t.by]} first`

  const requestClose = () => (dirty ? setLeaving(true) : onClose())
  const save = () => canSave && onSave(draft)

  return (
    <Slideover
      title="Investment transfer"
      width="full"
      onClose={requestClose}
      closeButton={false}
      actions={
        <>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}>
            Save transfer
          </button>
          <button type="button" className="btn btn-ghost" onClick={requestClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="tf-cols">
        <section className="tf-col" aria-label="Step 1, transfer from">
          <ColHead
            n={1}
            title="Transfer from"
            hint={t.sourceWise ? 'Check the sources to include, then enter the amount' : 'Enter the amount to move'}
            done={fromDone}
          />
          <div className="tf-from">
            <b>{holding.name}</b>
            <span>
              {formatMoney(holding.amount)} · {unitsText(holding.units)} units
            </span>
            {noUnits && <div className="wd-note">Units not available. Choose Percentage or Amount.</div>}
            {!t.sourceWise && !noUnits && (
              <AmountField
                label="Amount to move"
                by={t.by}
                unit={unit}
                value={draft.value}
                max={maxFor(t.by, holding.amount, holding.nav)}
                onChange={(v) => setDraft((d) => ({ ...d, value: v }))}
                onMax={() => setDraft((d) => ({ ...d, value: String(maxFor(t.by, holding.amount, holding.nav)) }))}
              />
            )}
          </div>
          {t.sourceWise && !noUnits && (
            <ul className="tf-sources">
              {holding.sources.map((s) => {
                const row = draft.sources[s.id] || {}
                const srcBuys = (draft.buys[perSource ? s.id : 'all'] || []).length
                return (
                  <li
                    key={s.id}
                    className={`${row.on ? 'on' : ''}${curSrc?.id === s.id ? ' active' : ''}`}
                    onFocusCapture={() => row.on && setActiveSrc(s.id)}
                  >
                    <label className="tf-source-pick">
                      <input type="checkbox" checked={!!row.on} onChange={(e) => toggleSrc(s.id, e.target.checked)} />
                      <span>
                        <b>{s.name}</b>
                        <small>
                          {formatMoney(s.amount)} · {unitsText(s.amount / holding.nav)} units
                        </small>
                      </span>
                    </label>
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
                    <small className="tf-src-status">
                      {!row.on
                        ? 'Not included'
                        : +row.value > 0
                          ? `${formatMoney(toDollars(row.value, t.by, s.amount, holding.nav))} into ${srcBuys} investment${srcBuys === 1 ? '' : 's'}`
                          : 'Enter how much to move out'}
                    </small>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="tf-total">
            {total > 0 ? (
              <>
                <span>Will be moved</span>
                <b>≈ {formatMoney(total)}</b>
                <span>
                  {pctText(holding.amount ? (total / holding.amount) * 100 : 0)} · {unitsText(total / holding.nav)} units
                </span>
              </>
            ) : (
              'Enter how much to move out'
            )}
          </p>
        </section>

        <section className={`tf-col${fromDone ? '' : ' tf-locked'}`} aria-label="Step 2, choose investments to buy">
          <ColHead n={2} title="Choose investments to buy" hint="Search and add one or more investments" done={pickDone} />
          {!fromDone && (
            <div className="wd-note" role="status">
              {lockHint} to add investments.
            </div>
          )}
          {t.sourceWise && (
            <label className={`inv-toggle tf-same${!perSource ? ' on' : ''}`}>
              <input type="checkbox" checked={!perSource} onChange={() => setDraft((d) => ({ ...d, sameBuys: d.sameBuys === false }))} />
              <span className="switch" aria-hidden="true" />
              Same investments for all sources
            </label>
          )}
          {perSource && bySource.length > 0 && (
            <div className="period tf-src-tabs" role="tablist" aria-label="Source">
              {bySource.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={curSrc?.id === s.id}
                  className={curSrc?.id === s.id ? 'on' : ''}
                  onClick={() => setActiveSrc(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="add-inv-search">
            <Icon icon={faSearch} size={15} />
            <input
              type="search"
              aria-label="Search investments to buy"
              placeholder="Search by name or CUSIP"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="add-inv-count">
            {String(options.length).padStart(2, '0')} investment{options.length === 1 ? '' : 's'}
          </p>
          <ul className="add-inv-list tf-options">
            {options.map((o) => (
              <li key={o.id} className={o.restricted ? 'restricted' : ''}>
                <span className="tf-option">
                  <span>
                    <b>{o.name}</b>
                    {o.restricted ? (
                      <small>
                        <Icon icon={faExclamationTriangle} size={12} /> Not available for transfer
                      </small>
                    ) : (
                      <span className="tf-meta">
                        {o.asset} · CUSIP {o.cusip}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={o.restricted || !fromDone}
                    title={o.restricted ? 'Not available' : !fromDone ? lockHint : undefined}
                    onClick={() => setRows((cur) => evenSplit([...cur, { id: o.id, name: o.name, asset: o.asset, cusip: o.cusip, nav: o.nav, pct: 0 }]))}
                    aria-label={`Add ${o.name}`}
                  >
                    Add
                  </button>
                </span>
              </li>
            ))}
            {!options.length && (
              <li className="add-inv-empty">{q ? `No investments match "${query.trim()}".` : 'All available investments are added.'}</li>
            )}
          </ul>
        </section>

        <section className="tf-col" aria-label="Step 3, set allocation">
          <ColHead
            n={3}
            title="Set allocation"
            hint={curSrc ? `${curSrc.name} · moving ${formatMoney(moved)}` : `Split ${formatMoney(moved)} across your picks`}
            done={allocDone}
          />
          {!rows.length ? (
            <div className="wd-note">
              {perSource && curSrc ? `Add investments for ${curSrc.name} from column 2.` : 'Investments you add appear here. Enter the share of the money each one gets.'}
            </div>
          ) : (
            <>
              <div className="tf-alloc-bar">
                <span>
                  <b>{String(rows.length).padStart(2, '0')}</b> added
                </span>
                <button type="button" className="text-link" onClick={() => setRows(() => [])}>
                  Remove all
                </button>
              </div>
              {rows.length > 3 && (
                <div className="add-inv-search">
                  <Icon icon={faSearch} size={15} />
                  <input
                    type="search"
                    aria-label="Search added investments"
                    placeholder="Search added investments"
                    value={addedQuery}
                    onChange={(e) => setAddedQuery(e.target.value)}
                  />
                </div>
              )}
              <ul className="tf-alloc">
                {shownRows.map((r) => (
                  <li key={r.id}>
                    <span>
                      <b>{r.name}</b>
                      <span className="tf-meta">
                        {r.asset} · {formatMoney((moved * (+r.pct || 0)) / 100)}
                      </span>
                    </span>
                    <span className={`alloc-pct-input${Math.abs(allocTotal - 100) > 0.01 ? ' tf-bad' : ''}`}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Allocation for ${r.name}`}
                        value={r.pct}
                        onChange={(e) =>
                          setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, pct: cleanNumber(e.target.value, x.pct, 'pct') } : x)))
                        }
                      />
                      <i>%</i>
                    </span>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setRows((cur) => renormalise(cur.filter((x) => x.id !== r.id), isEven(cur)))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
                {!shownRows.length && <li className="add-inv-empty">No match for "{addedQuery.trim()}".</li>}
              </ul>
            </>
          )}
          <div className={`tf-alloc-total${rows.length && Math.abs(allocTotal - 100) < 0.01 ? ' ok' : rows.length ? ' bad' : ''}`}>
            <span>
              Total <b>{pctText(allocTotal)}</b> · {formatMoney((moved * allocTotal) / 100)}
            </span>
            {rows.length > 1 && (
              <button type="button" className="text-link" onClick={() => setRows(evenSplit)}>
                Split evenly
              </button>
            )}
          </div>
          {rows.length > 0 && Math.abs(allocTotal - 100) > 0.01 && (
            <p className="alloc-warn tf-alloc-msg" role="status">
              <Icon icon={faExclamationTriangle} size={12} /> {allocMessage(allocTotal)}
            </p>
          )}
        </section>
      </div>

      {leaving && (
        <ConfirmDialog
          title="Discard your changes?"
          body="The changes you made to this transfer will be lost."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={onClose}
          onCancel={() => setLeaving(false)}
        />
      )}
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
      {!disabled && <small className={`tf-max${over ? ' over' : ''}`}>Max {maxText(by, max)}</small>}
    </span>
  )
}

// Read-only list of everything one sell moves into, with Edit / Remove.
function TransferDetails({ holding, sell, t, onClose, onEdit, onRemove }) {
  const { total, bySource } = sellBreakdown(sell, holding, t.by, t.sourceWise)
  // Reference layout: one block per sell (or per source when source wise),
  // the sell on the left and every fund it buys on the right.
  const groups = t.sourceWise
    ? bySource.map((s) => ({ key: s.id, title: s.name, moved: s.moved, rows: buysFor(sell, s.id) }))
    : [{ key: 'all', title: holding.name, moved: total, rows: buysFor(sell) }]
  return (
    <Slideover
      title="Transfer details"
      width="wide"
      onClose={onClose}
      closeButton={false}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="tf-from">
        <b>{holding.name}</b>
        <span>
          {formatMoney(total)} moving{t.sourceWise ? ` from ${bySource.length} source${bySource.length === 1 ? '' : 's'}` : ''} · balance{' '}
          {formatMoney(holding.amount)} · {unitsText(holding.units)} units
        </span>
      </div>
      <div className="table-wrap tf-detail-group">
        <table className="alloc-table table-grouped tf-detail-table">
          <thead>
            <tr>
              <th scope="col">Sell investment</th>
              <th scope="col">Buy investment(s)</th>
              <th scope="col" className="num">Allocation</th>
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              g.rows.map((r, i) => (
                <tr key={`${g.key}-${r.id}`} className={i === g.rows.length - 1 ? 'group-end' : undefined}>
                  {i === 0 && (
                    <td rowSpan={g.rows.length} className="group-head tf-detail-sell">
                      <span className="badge red">Sell</span>
                      <b>{g.title}</b>
                      <b className="tf-sell-amt">{formatMoney(g.moved)}</b>
                      <small>moving</small>
                      <span className="tf-detail-arrow" aria-hidden="true">
                        <Icon icon={faArrowRight} size={12} />
                      </span>
                    </td>
                  )}
                  <td className="alloc-name-col">
                    <span className="alloc-name">{r.name}</span>
                    <span className="tf-meta">CUSIP {r.cusip}</span>
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
      <button type="button" className="text-link danger tf-details-remove" onClick={onRemove}>
        Remove this transfer
      </button>
    </Slideover>
  )
}

function SellReview({ holding, sell, t, buyOptions, onEdit }) {
  const { total, bySource } = sellBreakdown(sell, holding, t.by, t.sourceWise)
  const perSource = t.sourceWise && sell.sameBuys === false
  // One buy table per source when sources have their own split; otherwise a
  // single table, with per-source amounts listed under the sell card.
  const tables = perSource
    ? bySource.map((s) => ({ key: s.id, title: s.name, moved: s.moved, rows: buysFor(sell, s.id) }))
    : [{ key: 'all', title: null, moved: total, rows: buysFor(sell) }]
  return (
    <div className="tf-review">
      <div className="tf-sell">
        <span className="tf-sell-top">
          <span className="badge red">Sell</span>
          <button type="button" className="text-link" onClick={onEdit} aria-label={`Edit transfer from ${holding.name}`}>
            Edit
          </button>
        </span>
        <b className="tf-sell-name">{holding.name}</b>
        <b className="tf-sell-amt">{formatMoney(total)}</b>
        <span className="tf-meta">
          {pctText((total / holding.amount) * 100)} of {formatMoney(holding.amount)} · {unitsText(total / holding.nav)} units
        </span>
        <dl className="tf-dl">
          <div>
            <dt>CUSIP</dt>
            <dd>{holding.cusip}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{holding.asset}</dd>
          </div>
          {t.sourceWise &&
            bySource.map((s) => (
              <div key={s.id}>
                <dt>{s.name}</dt>
                <dd>{formatMoney(s.moved)}</dd>
              </div>
            ))}
        </dl>
      </div>
      <span className="tf-arrow" aria-hidden="true">
        <Icon icon={faArrowRight} size={14} />
      </span>
      <div className="tf-buys">
        {tables.map((tb) => (
          <div key={tb.key} className="tf-buy-table">
            <p className="tf-buy-title">
              <span className="badge green">Buy</span>
              {tb.title ? <b>{tb.title}</b> : <b>Buy investments</b>}
              <span>{String(tb.rows.length).padStart(2, '0')} investments</span>
            </p>
            <div className="table-wrap">
              <table className="alloc-table">
                <thead>
                  <tr>
                    <th scope="col">Investment name</th>
                    <th scope="col">CUSIP</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Units
                    </th>
                    <th scope="col" className="num">
                      Buy %
                    </th>
                    <th scope="col" className="num">
                      Buy amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tb.rows.map((r) => {
                    const amt = (tb.moved * (+r.pct || 0)) / 100
                    const nav = r.nav || buyOptions.find((o) => o.id === r.id)?.nav || 1
                    return (
                      <tr key={r.id}>
                        <td className="alloc-name-col">
                          <span className="alloc-name">{r.name}</span>
                        </td>
                        <td>{r.cusip}</td>
                        <td>{r.asset}</td>
                        <td className="num">{unitsText(amt / nav)}</td>
                        <td className="num">{pctText(r.pct)}</td>
                        <td className="num">{formatMoney(amt)}</td>
                      </tr>
                    )
                  })}
                  <tr className="alloc-total">
                    <td colSpan={4}>Total buying</td>
                    <td className="num">{pctText(sumPct(tb.rows))}</td>
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
