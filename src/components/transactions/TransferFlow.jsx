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
function maxFor(by, available, nav) {
  if (by === 'pct') return 100
  if (by === 'units') return r4(available / (nav || 1))
  return r2(available)
}

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
    else if (Math.abs(sumPct(rows) - 100) > 0.01) errs.push(`Buy allocation${where} must total 100% (now ${pctText(sumPct(rows))}).`)
  })
  if (!errs.length && total <= 0) errs.push('Enter a transfer value.')
  return errs
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

  const changeMode = (patch) => {
    if (!configured.length) {
      setT(patch)
      return
    }
    setConfirm({
      title: 'Change how the transfer is entered?',
      body: 'Switching clears the amounts you have entered so far. Your chosen buy investments are kept.',
      confirmLabel: 'Change',
      onConfirm: () => {
        setT((cur) => ({
          ...patch,
          sells: Object.fromEntries(Object.entries(cur.sells).map(([id, s]) => [id, { ...s, value: '', sources: {} }]))
        }))
        setConfirm(null)
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

  const discard = () =>
    setConfirm({
      title: 'Discard this transfer request?',
      body: 'Everything you have entered for this transfer will be removed.',
      confirmLabel: 'Discard request',
      cancelLabel: 'Keep editing',
      onConfirm: () => {
        clearDraft()
        navigate('/transactions')
      }
    })

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
          <SellReview key={h.id} holding={h} sell={t.sells[h.id]} t={t} buyOptions={buyOptions} />
        ))}
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
          <button type="button" className="btn btn-ghost" onClick={onBack}>
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

      <ol className="plan-notice eligible-notice tf-howto">
        <li>
          <b>1</b> Choose an investment and select <b>Set up transfer</b>
        </li>
        <li>
          <b>2</b> Enter how much to move out
        </li>
        <li>
          <b>3</b> Pick the investments to buy and split the money
        </li>
      </ol>

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

      {overview}

      <div className="table-wrap">
        <table className="alloc-table tf-table">
          <thead>
            <tr>
              <th scope="col" className="tf-c-name">Investment name</th>
              <th scope="col" className="tf-c-move">Moving</th>
              <th scope="col" className="tf-c-to">Transfer to</th>
              <th scope="col" className="num tf-c-act">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const sell = t.sells[h.id]
              const { total } = sellBreakdown(sell, h, t.by, t.sourceWise)
              const perSourceBuys = !!(sell && t.sourceWise && sell.sameBuys === false)
              const buys = !sell
                ? []
                : perSourceBuys
                  ? Object.entries(sell.buys || {})
                      .filter(([k]) => k !== 'all' && sell.sources?.[k]?.on)
                      .flatMap(([k, list]) => list.map((b) => ({ ...b, id: `${k}-${b.id}`, src: h.sources.find((x) => x.id === k)?.name })))
                  : buysFor(sell)
              const errs = sell ? errorsById[h.id] : []
              const status = sellStatus(sell, errs)
              return (
                <tr key={h.id} className={sell ? 'tf-on' : undefined}>
                  <td className="alloc-name-col">
                    <span className="alloc-name">{h.name}</span>
                    <span className="tf-meta">
                      Balance <b>{formatMoney(h.amount)}</b> · Units <b>{unitsText(h.units)}</b>
                    </span>
                    {status && (
                      <span className="tf-tags">
                        <span className="badge red">Sell</span>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    {sell && total > 0 ? (
                      <span className="tf-moving">
                        <b>{formatMoney(total)}</b>
                        <span>
                          {pctText((total / h.amount) * 100)} · {unitsText(total / h.nav)} units
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {buys.length ? (
                      <span className="tf-chips">
                        {buys.map((b) => (
                          <span key={b.id} className="badge navy">
                            {b.src && `${b.src}: `}
                            {b.name} {r2(b.pct)}%
                          </span>
                        ))}
                      </span>
                    ) : (
                      '—'
                    )}
                    {errs.length > 0 && (
                      <span className="alloc-warn tf-row-warn">
                        <Icon icon={faExclamationTriangle} size={12} /> {errs[0]}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <span className="tf-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(h.id)}>
                        {sell ? 'Edit' : 'Set up transfer'}
                      </button>
                      {sell && (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() =>
                            setT((cur) => {
                              const sells = { ...cur.sells }
                              delete sells[h.id]
                              return { sells }
                            })
                          }
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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

      {editing && (
        <EditSell
          holding={holdings.find((h) => h.id === editing)}
          sell={t.sells[editing]}
          t={t}
          buyOptions={buyOptions}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setT((cur) => ({ sells: { ...cur.sells, [editing]: next } }))
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
  const [draft, setDraft] = useState(() => ({
    value: '',
    sources: {},
    sameBuys: true,
    buys: { all: [] },
    ...(sell ? JSON.parse(JSON.stringify(sell)) : {})
  }))
  const [tried, setTried] = useState(false)
  const [query, setQuery] = useState('')
  const unit = { pct: '%', units: 'units', amount: '$' }[t.by]
  const { total, bySource } = sellBreakdown(draft, holding, t.by, t.sourceWise)
  const errs = sellErrors(draft, holding, t.by, t.sourceWise)
  const perSource = t.sourceWise && draft.sameBuys === false
  const [activeSrc, setActiveSrc] = useState(null)
  const curSrc = perSource ? bySource.find((s) => s.id === activeSrc) || bySource[0] : null
  const key = curSrc ? curSrc.id : 'all'
  const moved = curSrc ? curSrc.moved : total
  const rows = draft.buys[key] || []
  const allocTotal = sumPct(rows)

  const fromDone = total > 0 && !errs.some((e) => /move|available|source to move/i.test(e))
  const pickDone = perSource ? bySource.length > 0 && bySource.every((s) => (draft.buys[s.id] || []).length) : rows.length > 0
  const allocDone = perSource
    ? bySource.length > 0 && bySource.every((s) => Math.abs(sumPct(draft.buys[s.id] || []) - 100) < 0.01)
    : rows.length > 0 && Math.abs(allocTotal - 100) < 0.01

  const setSrc = (id, patch) =>
    setDraft((d) => ({ ...d, sources: { ...d.sources, [id]: { on: false, value: '', ...d.sources[id], ...patch } } }))
  const setRows = (fn) => setDraft((d) => ({ ...d, buys: { ...d.buys, [key]: fn(d.buys[key] || []) } }))
  const even = (list) => {
    const e = r2(100 / (list.length || 1))
    return list.map((r, i) => ({ ...r, pct: i === list.length - 1 ? r2(100 - e * (list.length - 1)) : e }))
  }
  const q = query.trim().toLowerCase()
  const options = buyOptions.filter(
    (o) => o.id !== holding.id && !rows.some((r) => r.id === o.id) && (!q || o.name.toLowerCase().includes(q) || o.cusip.includes(q))
  )

  const save = () => {
    setTried(true)
    if (!errs.length) onSave(draft)
  }

  return (
    <Slideover
      title="Investment transfer"
      width="full"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save transfer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
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
            {!t.sourceWise && (
              <AmountField
                label="Amount to move"
                unit={unit}
                value={draft.value}
                onChange={(v) => setDraft((d) => ({ ...d, value: v }))}
                onMax={() => setDraft((d) => ({ ...d, value: String(maxFor(t.by, holding.amount, holding.nav)) }))}
              />
            )}
          </div>
          {t.sourceWise && (
            <ul className="tf-sources">
              {holding.sources.map((s) => {
                const row = draft.sources[s.id] || {}
                return (
                  <li key={s.id} className={row.on ? 'on' : ''}>
                    <label className="tf-source-pick">
                      <input type="checkbox" checked={!!row.on} onChange={(e) => setSrc(s.id, { on: e.target.checked })} />
                      <span>
                        <b>{s.name}</b>
                        <small>
                          {formatMoney(s.amount)} · {unitsText(s.amount / holding.nav)} units
                        </small>
                      </span>
                    </label>
                    <AmountField
                      label={`${s.name} amount`}
                      unit={unit}
                      value={row.value ?? ''}
                      disabled={!row.on}
                      onChange={(v) => setSrc(s.id, { value: v })}
                      onMax={() => setSrc(s.id, { on: true, value: String(maxFor(t.by, s.amount, holding.nav)) })}
                    />
                    <small className="tf-src-status">
                      {row.on ? (+row.value > 0 ? `Moving ${formatMoney(toDollars(row.value, t.by, s.amount, holding.nav))}` : 'Enter an amount') : 'Not included'}
                    </small>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="tf-total">
            Moving <b>{formatMoney(total)}</b>
            <span>
              {pctText(holding.amount ? (total / holding.amount) * 100 : 0)} · {unitsText(total / holding.nav)} units
            </span>
          </p>
        </section>

        <section className="tf-col" aria-label="Step 2, choose investments to buy">
          <ColHead n={2} title="Choose investments to buy" hint="Search and add one or more investments" done={pickDone} />
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
          {perSource && !bySource.length ? (
            <div className="wd-note">Check a source in step 1 to choose its investments.</div>
          ) : (
            <>
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
              <p className="add-inv-count">{String(options.length).padStart(2, '0')} investments</p>
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
                        disabled={o.restricted}
                        onClick={() => setRows((cur) => even([...cur, { id: o.id, name: o.name, asset: o.asset, cusip: o.cusip, nav: o.nav, pct: 0 }]))}
                        aria-label={`Add ${o.name}`}
                      >
                        Add
                      </button>
                    </span>
                  </li>
                ))}
                {!options.length && <li className="add-inv-empty">No investments match that search.</li>}
              </ul>
            </>
          )}
        </section>

        <section className="tf-col" aria-label="Step 3, set allocation">
          <ColHead
            n={3}
            title="Set allocation"
            hint={curSrc ? `${curSrc.name} · moving ${formatMoney(moved)}` : `Split ${formatMoney(moved)} across your picks`}
            done={allocDone}
          />
          {!rows.length ? (
            <div className="wd-note">Investments you add appear here. Enter the share of the money each one gets.</div>
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
              <ul className="tf-alloc">
                {rows.map((r) => (
                  <li key={r.id}>
                    <span>
                      <b>{r.name}</b>
                      <span className="tf-meta">
                        {r.asset} · {formatMoney((moved * (+r.pct || 0)) / 100)}
                      </span>
                    </span>
                    <span className="alloc-pct-input">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        aria-label={`Allocation for ${r.name}`}
                        value={r.pct}
                        onChange={(e) => setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, pct: e.target.value } : x)))}
                      />
                      <i>%</i>
                    </span>
                    <button type="button" className="text-link" onClick={() => setRows((cur) => cur.filter((x) => x.id !== r.id))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={`tf-alloc-total${rows.length && Math.abs(allocTotal - 100) < 0.01 ? ' ok' : ''}`}>
            <span>
              Total <b>{pctText(allocTotal)}</b> · {formatMoney((moved * allocTotal) / 100)}
            </span>
            {rows.length > 1 && (
              <button type="button" className="text-link" onClick={() => setRows(even)}>
                Split evenly
              </button>
            )}
          </div>
        </section>
      </div>

      {tried && errs.length > 0 && (
        <ul className="tf-errors" role="alert">
          {errs.map((e) => (
            <li key={e} className="alloc-warn">
              <Icon icon={faExclamationTriangle} size={12} /> {e}
            </li>
          ))}
        </ul>
      )}
    </Slideover>
  )
}

function AmountField({ label, unit, value, onChange, onMax, disabled }) {
  return (
    <span className="tf-amount">
      <span className="alloc-pct-input">
        {unit === '$' && <i>$</i>}
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label={label}
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit !== '$' && <i>{unit}</i>}
      </span>
      <button type="button" className="text-link" onClick={onMax}>
        Max
      </button>
    </span>
  )
}

function SellReview({ holding, sell, t, buyOptions }) {
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
        <span className="badge red">Sell</span>
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
