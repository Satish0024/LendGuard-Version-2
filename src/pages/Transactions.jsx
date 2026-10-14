import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faExchangeAlt, faLandmark, faBalanceScale, faRandom, faArrowDown } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { formatMoney, planBalance, planVested } from '../lib/accountSummary'
import { TRANSACTION_TYPES, canRequest, requestStatusTone, requestsFor, transactablePlans } from '../data/transactions.js'
import LoanCalculatorSlideover from '../components/transactions/LoanCalculatorSlideover.jsx'
import Select, { Option } from '../components/common/Select.jsx'
import '../styles/documents.css'
import '../styles/transactions.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'deferral', label: 'My Deferral' },
  { id: 'employer', label: 'Employer' },
  { id: 'other', label: 'Other' }
]

const TYPE_ICON = { loan: faLandmark, withdrawal: faArrowDown, transfer: faRandom, rebalance: faBalanceScale, rollover: faExchangeAlt }

function NewRequestMenu({ plan, disabled }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="tx-new-request" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || !plan}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        New request
      </button>
      {open && plan && (
        <div className="tx-new-request-menu" role="menu" aria-label="Request type">
          {TRANSACTION_TYPES.map((t) => {
            const icon = TYPE_ICON[t.id]
            const enabled = canRequest(plan, t.id)
            return (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                className="tx-new-request-item"
                disabled={!enabled}
                title={enabled ? undefined : 'Not available for this plan right now'}
                onClick={() => {
                  setOpen(false)
                  navigate(t.to(plan.id))
                }}
              >
                <span className="quick-action-ico" aria-hidden="true">
                  <Icon icon={icon} size={16} />
                </span>
                <span>
                  <b>{t.label}</b>
                  <small>{t.hint}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QuickActions({ plan }) {
  const navigate = useNavigate()

  return (
    <div className="quick-actions">
      <span className="quick-actions-label">Quick links</span>
      <div className="quick-actions-grid" role="group" aria-label="Start a transaction request">
        {TRANSACTION_TYPES.map((t) => {
          const icon = TYPE_ICON[t.id]
          const enabled = canRequest(plan, t.id)
          return (
            <button
              key={t.id}
              type="button"
              className="quick-action"
              disabled={!enabled}
              title={enabled ? undefined : 'Not available for this plan right now'}
              onClick={() => navigate(t.to(plan.id))}
            >
              <span className="quick-action-ico" aria-hidden="true">
                <Icon icon={icon} size={18} />
              </span>
              <span className="quick-action-copy">
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RequestsPanel({ participant, planId, onPlanChange }) {
  const plans = useMemo(() => transactablePlans(participant), [participant])
  const plan = plans.find((p) => p.id === planId) || plans[0]
  const requests = useMemo(() => requestsFor(participant), [participant])
  const [calcLoan, setCalcLoan] = useState(null)

  if (!plans.length) {
    return (
      <div className="tx-empty">
        You don&apos;t have a plan balance to raise a transaction request against yet.
      </div>
    )
  }

  return (
    <>
      <div className="req-plan-tabs" role="tablist" aria-label="Plan">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === plan.id ? 'on' : ''}
            role="tab"
            aria-selected={p.id === plan.id}
            onClick={() => onPlanChange(p.id)}
          >
            <span className="req-plan-badge">Plan ID {p.meta?.match(/ID\s+(\S+)/i)?.[1] || p.id}</span>
            {p.name}
          </button>
        ))}
      </div>

      <div className="req-plan-strip">
        <div>
          <span className="eyebrow">Plan details</span>
          <h2>{plan.name}</h2>
          <p className="plan-meta">
            Plan ID {plan.meta?.match(/ID\s+(\S+)/i)?.[1] || plan.id} · Type {plan.type}
          </p>
        </div>
        <div className="req-plan-stats">
          <div>
            <span>Plan balance</span>
            <b>{formatMoney(planBalance(plan))}</b>
          </div>
          <div>
            <span>Vested balance</span>
            <b>{formatMoney(planVested(plan))}</b>
          </div>
        </div>
      </div>

      {/* Quick Actions is hidden per feedback — kept in code (not deleted)
          in case it comes back. Use "New request" above to start a
          transaction instead. */}
      {false && <QuickActions plan={plan} />}

      {!requests.length ? (
        <div className="tx-empty">No transaction requests yet for this plan.</div>
      ) : (
        <>
          <span className="quick-actions-label">Recent requests</span>
          <div className="table-wrap t-stack-wrap">
          <table className="tx-table t-stack">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Plan</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Amount</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td data-label="Type">{r.typeLabel}</td>
                  <td data-label="Plan">{r.plan}</td>
                  <td data-label="Date">{r.date}</td>
                  <td data-label="Status">
                    <span className={`req-status ${requestStatusTone(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="num" data-label="Amount">{r.amount}</td>
                  {/* No data-label: this is the row's action slot, not a
                      label/value pair, so it goes full width on mobile. */}
                  <td className="num">
                    {r.type === 'loan' && r.status === 'Approved' && (
                      <button type="button" className="text-link tx-calc-link" onClick={() => setCalcLoan(r)}>
                        Calculate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      {calcLoan && <LoanCalculatorSlideover loan={calcLoan} onClose={() => setCalcLoan(null)} />}
    </>
  )
}

function HistoryPanel({ participant }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [plan, setPlan] = useState('all')

  const plans = useMemo(() => {
    const names = [...new Set(participant.transactions.map((t) => t.plan))]
    return names
  }, [participant])

  const rows = useMemo(() => {
    return participant.transactions.filter((t) => {
      const kindOk =
        filter === 'all' ||
        (filter === 'other' ? !['deferral', 'employer'].includes(t.kind) : t.kind === filter)
      const planOk = plan === 'all' || t.plan === plan
      return kindOk && planOk
    })
  }, [participant, filter, plan])

  return (
    <>
      <div className="tx-toolbar">
        {/* Filter-chip group (narrows the table below), not a tabs widget
            with separate panels -- same correction as Portfolio.jsx's
            chart-period selector. */}
        <div className="tx-filters" aria-label="Transaction type">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? 'on' : ''}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="tx-toolbar-actions">
          <Select
            className="tx-plan-select"
            aria-label="Filter by plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            <Option value="all">All plans</Option>
            {plans.map((name) => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Select>
          <button
            type="button"
            className="text-link"
            onClick={() => navigate('/reports', { state: { openStatement: true } })}
          >
            Generate statement
          </button>
        </div>
      </div>

      {!rows.length ? (
        <div className="tx-empty">No transactions yet.</div>
      ) : (
        <div className="table-wrap t-stack-wrap">
          <table className="tx-table t-stack">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Plan</th>
                <th scope="col" className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.date}-${r.type}-${i}`} className={r.kind}>
                  <td data-label="Date">{r.date}</td>
                  <td data-label="Type">{r.type}</td>
                  <td data-label="Plan">{r.plan}</td>
                  <td className={`num tx-amt ${r.kind}`} data-label="Amount">{r.amt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function Transactions() {
  const { participant } = useParticipant()
  const plans = useMemo(() => transactablePlans(participant), [participant])
  const [tab, setTab] = useState('requests')
  const [planId, setPlanId] = useState(plans[0]?.id)
  const plan = plans.find((p) => p.id === planId) || plans[0]

  useEffect(() => {
    if (!plans.length) return
    if (!plans.some((p) => p.id === planId)) setPlanId(plans[0].id)
  }, [plans, planId])

  return (
    <div className="page-body">
      <div className="hi-bar">
        <div>
          <h1>Transactions</h1>
          <p className="pr-intro">View, edit, and raise transaction requests</p>
        </div>
        <div className="hi-actions">
          <NewRequestMenu plan={plan} disabled={!plans.length} />
        </div>
      </div>

      <section className="panel tx-page">
        <div className="tabs" role="tablist" aria-label="Transactions view">
          <button
            type="button"
            role="tab"
            id="tx-tab-requests"
            aria-selected={tab === 'requests'}
            aria-controls="tx-panel-requests"
            tabIndex={tab === 'requests' ? 0 : -1}
            className={`tab${tab === 'requests' ? ' on' : ''}`}
            onClick={() => setTab('requests')}
          >
            Requests
          </button>
          <button
            type="button"
            role="tab"
            id="tx-tab-history"
            aria-selected={tab === 'history'}
            aria-controls="tx-panel-history"
            tabIndex={tab === 'history' ? 0 : -1}
            className={`tab${tab === 'history' ? ' on' : ''}`}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>

        {tab === 'requests' ? (
          <div role="tabpanel" id="tx-panel-requests" aria-labelledby="tx-tab-requests">
            <RequestsPanel participant={participant} planId={plan?.id} onPlanChange={setPlanId} />
          </div>
        ) : (
          <div role="tabpanel" id="tx-panel-history" aria-labelledby="tx-tab-history">
            <HistoryPanel participant={participant} />
          </div>
        )}
      </section>
    </div>
  )
}
