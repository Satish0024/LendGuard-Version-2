import { Fragment, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faRocket, faBalanceScale, faShieldAlt, faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { INVESTMENT_KEY, readSession, writeSession } from '../data/participants'
import { PLAN_FUNDS, PLAN_COL_LABELS } from '../data/portfolio'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { RISK_LEVELS, getRiskLevel, getRiskProfileId } from '../lib/riskProfile'
import FundDetailDialog from '../components/common/FundDetailDialog.jsx'
import Select, { Option } from '../components/common/Select.jsx'
import '../styles/portfolio.css'

const ENROLL_FUNDS = PLAN_FUNDS.filter((f) => f.cat !== 'Target-Date')
const FUNDS = ENROLL_FUNDS.map((f) => f.name)
const emptyAlloc = () => Object.fromEntries(FUNDS.map((name) => [name, 0]))
const PLAN_ALLOC = {
  'Vanguard Institutional Index Fund Admiral Shares': 30,
  'Fidelity 500 Index Fund Institutional Class': 30,
  'Vanguard Total Bond Market Index Fund Admiral Shares': 20,
  'Fidelity U.S. Bond Index Fund Institutional Premium': 20
}
const PLAN_FUNDS_LIST = ENROLL_FUNDS.filter((f) => PLAN_ALLOC[f.name])
// One preset fund mix per measured risk level — same four-fund lineup as
// PLAN_ALLOC, just weighted toward bonds or equities to match the level's
// stated split (see RISK_LEVELS' insights copy in lib/riskProfile.js).
const RISK_ALLOC = {
  conservative: {
    'Vanguard Institutional Index Fund Admiral Shares': 15,
    'Fidelity 500 Index Fund Institutional Class': 15,
    'Vanguard Total Bond Market Index Fund Admiral Shares': 35,
    'Fidelity U.S. Bond Index Fund Institutional Premium': 35
  },
  moderate: {
    'Vanguard Institutional Index Fund Admiral Shares': 25,
    'Fidelity 500 Index Fund Institutional Class': 25,
    'Vanguard Total Bond Market Index Fund Admiral Shares': 25,
    'Fidelity U.S. Bond Index Fund Institutional Premium': 25
  },
  aggressive: {
    'Vanguard Institutional Index Fund Admiral Shares': 45,
    'Fidelity 500 Index Fund Institutional Class': 45,
    'Vanguard Total Bond Market Index Fund Admiral Shares': 5,
    'Fidelity U.S. Bond Index Fund Institutional Premium': 5
  }
}
const RISK_LEVEL_ICON = { conservative: faShieldAlt, moderate: faBalanceScale, aggressive: faRocket }
const riskAlloc = (levelId) => ({ ...emptyAlloc(), ...RISK_ALLOC[levelId] })
const planAlloc = () => ({ ...emptyAlloc(), ...PLAN_ALLOC })
const sumAlloc = (alloc, names = FUNDS) => names.reduce((sum, name) => sum + (+alloc?.[name] || 0), 0)
const SOURCES = [
  { id: 'pre', label: 'Pre-Tax' },
  { id: 'roth', label: 'Roth' }
]
const blankBySource = () => Object.fromEntries(SOURCES.map((s) => [s.id, emptyAlloc()]))
const fillBySource = (alloc) => Object.fromEntries(SOURCES.map((s) => [s.id, { ...alloc }]))
const parsePct = (s) => parseFloat(String(s).replace(/[^0-9.-]/g, '')) || 0
const assetClass = (f) => ((f.cat || '').toLowerCase().includes('bond') ? 'Bond' : 'Equity')
const ASSET_CLASSES = [...new Set(ENROLL_FUNDS.map(assetClass))]
const byPerformance = (a, b) => parsePct(b.y1) - parsePct(a.y1)
const fundsFromNames = (names) =>
  ENROLL_FUNDS.filter((f) => names.includes(f.name)).sort(byPerformance)

const pruneAlloc = (alloc, names) => {
  const next = emptyAlloc()
  names.forEach((name) => {
    next[name] = +alloc?.[name] || 0
  })
  return next
}

export function InvestmentEditor({
  embedded = false,
  saveLabel = 'Continue',
  riskReturnPath = '/enrollment/investments',
  onComplete,
  onCancel
}) {
  const { participant } = useParticipant()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const saved = useMemo(() => readSession(INVESTMENT_KEY), [])
  const [mode, setMode] = useState(() => (embedded ? saved?.mode || 'plan' : ''))
  const [riskLevelId, setRiskLevelId] = useState(() => saved?.riskLevelId || '')
  const [applyAll, setApplyAll] = useState(saved?.applyAll !== false)
  const [bySource, setBySource] = useState(() => ({
    ...blankBySource(),
    ...(saved?.bySource || (embedded ? fillBySource(planAlloc()) : {}))
  }))
  const [picked, setPicked] = useState(() => saved?.picked || [])
  const [error, setError] = useState('')
  const [fundsOpen, setFundsOpen] = useState(false)
  const [riskConsentOpen, setRiskConsentOpen] = useState(false)
  useEscapeToClose(riskConsentOpen, () => setRiskConsentOpen(false))
  const riskConsentTrapRef = useFocusTrap(riskConsentOpen)

  const usingCustom = mode === 'custom'
  const usingPlan = mode === 'plan'
  const usingRisk = mode === 'risk'
  const sharedAlloc = bySource[SOURCES[0].id] || emptyAlloc()
  const customFunds = fundsFromNames(picked)
  const measuredLevel = riskLevelId ? getRiskLevel(riskLevelId) : null

  // Returning from the risk questionnaire (?riskDone=1): read back the level
  // it just measured and apply that level's fund mix, then strip the query
  // param so refreshing this page doesn't re-trigger it.
  useEffect(() => {
    if (params.get('riskDone') !== '1') return
    const levelId = getRiskProfileId(participant)
    setMode('risk')
    setRiskLevelId(levelId)
    setApplyAll(true)
    setBySource(fillBySource(riskAlloc(levelId)))
    setError('')
    navigate(location.pathname, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const setPct = (src, name, val) => {
    const next = Math.max(0, Math.min(100, Math.round(+val || 0)))
    setError('')
    setBySource((prev) => {
      const updated = { ...prev[src], [name]: next }
      if (applyAll) return fillBySource(updated)
      return { ...prev, [src]: updated }
    })
  }

  const choosePlan = () => {
    setMode('plan')
    setApplyAll(true)
    setBySource(fillBySource(planAlloc()))
    setError('')
  }

  const chooseCustom = () => {
    if (mode !== 'custom') {
      setBySource(blankBySource())
      setApplyAll(true)
      setPicked([])
    }
    setMode('custom')
    setFundsOpen('select')
    setError('')
  }

  // Clicking "Not sure? Take our risk questionnaire" (or "Retake
  // questionnaire") asks for confirmation first — only navigates to the
  // questionnaire once the participant agrees to proceed.
  const chooseRisk = () => setRiskConsentOpen(true)
  const confirmChooseRisk = () => {
    setRiskConsentOpen(false)
    const here = `${location.pathname}${location.search}`
    navigate(`/risk-check-in?return=${encodeURIComponent(riskReturnPath || here)}`)
  }

  const toggleApplyAll = () => {
    setError('')
    if (!applyAll) {
      setBySource(fillBySource(sharedAlloc))
      setApplyAll(true)
      return
    }
    setApplyAll(false)
  }

  const applyPicks = (names) => {
    setPicked(names)
    setBySource((prev) => {
      if (applyAll) return fillBySource(pruneAlloc(prev[SOURCES[0].id], names))
      return Object.fromEntries(SOURCES.map((s) => [s.id, pruneAlloc(prev[s.id], names)]))
    })
    setFundsOpen(false)
    setError('')
  }

  const reset = (src) => {
    setError('')
    const next = pruneAlloc({}, picked)
    if (applyAll) setBySource(fillBySource(next))
    else setBySource((prev) => ({ ...prev, [src]: next }))
  }

  const continueStep = () => {
    if (!mode) {
      setError('Choose how you want new contributions invested.')
      return
    }
    if (usingCustom && !picked.length) {
      setError('Select at least one investment before you continue.')
      return
    }
    const names = usingCustom ? picked : FUNDS
    if (usingPlan || usingRisk || applyAll) {
      if (sumAlloc(sharedAlloc, names) !== 100) {
        setError('Allocations must add up to 100% before you continue.')
        return
      }
    } else if (SOURCES.some((s) => sumAlloc(bySource[s.id], names) !== 100)) {
      setError('Each source must add up to 100% before you continue.')
      return
    }
    const savedSources = usingPlan || usingRisk || applyAll ? fillBySource(sharedAlloc) : bySource
    writeSession(INVESTMENT_KEY, {
      mode,
      riskLevelId: usingRisk ? riskLevelId : '',
      applyAll: usingPlan || usingRisk ? true : applyAll,
      picked: usingCustom ? picked : FUNDS.filter((name) => (usingRisk ? RISK_ALLOC[riskLevelId]?.[name] : PLAN_ALLOC[name])),
      alloc: savedSources[SOURCES[0].id],
      bySource: savedSources,
      total: 100
    })
    onComplete?.()
  }

  return (
    <div className={embedded ? 'enroll-embed enroll-simple' : 'detail-body enroll-simple'}>
      <div className="section-top">
        <div>
          <h3 className="section-title">{embedded ? 'Edit investments' : 'Investment election'}</h3>
          <p className="section-sub">Choose how the deferrals are invested. The allocations must total to 100%.</p>
        </div>
        <button type="button" className="text-link optout-link" onClick={() => setFundsOpen('view')}>
          View plan investments
        </button>
      </div>

      <div className="choice-list" role="radiogroup" aria-label="Investment election">
        <button
          type="button"
          className={`choice${usingPlan ? ' on' : ''}`}
          role="radio"
          aria-checked={usingPlan}
          onClick={choosePlan}
        >
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <b>Use plan-selected investments</b>
            <small>Investments will be made in the plan&apos;s default selection unless preferred investments are selected.</small>
          </span>
        </button>
        <button
          type="button"
          className={`choice${usingCustom ? ' on' : ''}`}
          role="radio"
          aria-checked={usingCustom}
          onClick={chooseCustom}
        >
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <b>Select my own investments</b>
            <small>Select preferred investments and set the allocation.</small>
          </span>
        </button>
        <button
          type="button"
          className={`choice${usingRisk ? ' on' : ''}`}
          role="radio"
          aria-checked={usingRisk}
          onClick={chooseRisk}
        >
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <b>Match my investments to my risk style</b>
            <small>Answer a few questions and we&apos;ll set your allocation to match your risk tolerance.</small>
          </span>
        </button>
      </div>

      {usingPlan && (
        <div className="inv-panel">
          <AllocPanel title="All sources" funds={PLAN_FUNDS_LIST} alloc={sharedAlloc} locked />
        </div>
      )}

      {usingRisk && measuredLevel && (
        <div className="inv-panel">
          {/* Item #77's banner copy: this used to live in RiskMeterV2.jsx,
              a component with no remaining render call-sites (removed
              from the Dashboard per item #77b) -- so the message was
              never actually visible to anyone. This is the real place a
              participant sees their measured investment style, so the
              badge and the banner were merged into one card instead of
              two stacked, visually disconnected boxes. */}
          <div className="inv-risk-card" style={{ '--risk-color': measuredLevel.color }}>
            <div className="inv-risk-card-head">
              <span className="inv-risk-card-ico" aria-hidden="true">
                <Icon icon={RISK_LEVEL_ICON[measuredLevel.id]} size={20} />
              </span>
              <span className="inv-risk-card-label">{measuredLevel.label}</span>
              <button type="button" className="text-btn" onClick={chooseRisk}>
                View/Edit questionnaire
              </button>
            </div>
            <p>
              <Icon icon={faCircleInfo} size={14} aria-hidden="true" />
              Your investment style is based on your questionnaire responses. View or edit your responses to
              reassess your style.
            </p>
          </div>
          <AllocPanel
            title="All sources"
            funds={fundsFromNames(FUNDS.filter((name) => RISK_ALLOC[measuredLevel.id]?.[name] > 0))}
            alloc={sharedAlloc}
            locked
          />
        </div>
      )}

      {usingCustom && (
        <div className="inv-panel">
          <div className="inv-toolbar">
            <button type="button" className="text-btn" onClick={() => setFundsOpen('select')}>
              {picked.length ? 'Add or edit investments' : 'Add investments'}
            </button>
            <label className={`inv-toggle${applyAll ? ' on' : ''}`}>
              <input type="checkbox" checked={applyAll} onChange={toggleApplyAll} />
              <span className="switch" aria-hidden="true" />
              Apply to all sources
            </label>
          </div>
          {!picked.length ? (
            <div className="inv-empty">
              <p>Select investments, then set each percent so the total is 100%.</p>
              <button type="button" className="btn btn-primary" onClick={() => setFundsOpen('select')}>
                Select investments
              </button>
            </div>
          ) : applyAll ? (
            <AllocPanel
              title="All sources"
              funds={customFunds}
              alloc={sharedAlloc}
              showReset
              onChange={(name, val) => setPct(SOURCES[0].id, name, val)}
              onReset={() => reset(SOURCES[0].id)}
            />
          ) : (
            <div className="inv-stack">
              {SOURCES.map((s) => (
                <AllocPanel
                  key={s.id}
                  title={s.label}
                  funds={customFunds}
                  alloc={bySource[s.id]}
                  showReset
                  onChange={(name, val) => setPct(s.id, name, val)}
                  onReset={() => reset(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="enroll-error" role="alert">{error}</p>}

      <div className="enroll-nav">
        <button className="btn btn-primary" type="button" onClick={continueStep}>
          {saveLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      {fundsOpen && (
        <FundsModal
          selectable={fundsOpen === 'select'}
          selected={picked}
          onApply={applyPicks}
          onClose={() => setFundsOpen(false)}
        />
      )}

      {riskConsentOpen && (
        <div className="enroll-modal-bg" role="presentation" onClick={() => setRiskConsentOpen(false)}>
          <div
            ref={riskConsentTrapRef}
            className="enroll-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="risk-consent-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="risk-consent-title">Consent to take the risk questionnaire</h4>
            <p>
              A few quick questions will match you to a Conservative, Moderate, or Aggressive investment style, and
              set your election to that mix. Do you consent to continue?
            </p>
            <div className="enroll-modal-actions">
              <button type="button" className="btn btn-primary" onClick={confirmChooseRisk}>
                I consent, continue
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setRiskConsentOpen(false)}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AllocPanel({ title, funds, alloc, locked, showReset, onChange, onReset }) {
  const names = funds.map((f) => f.name)
  const total = sumAlloc(alloc, names)
  const [openFund, setOpenFund] = useState(null)
  return (
    <div className="inv-form">
      {title && <h4 className="inv-source-title">{title}</h4>}
      <div className="fund-list-head inv-col-head">
        <span>Investment</span>
        <span>Election Percentage</span>
      </div>
      <div className={`enroll-form${locked ? ' locked' : ''}`}>
        {funds.map((f) => (
          <div className="source" key={f.name}>
            <div className="srow">
              <span className="smeta">
                <button type="button" className="text-link fund-link sname" onClick={() => setOpenFund(f)}>
                  {f.name}
                </button>
                <span className="shelp">{f.cat}</span>
              </span>
              <span className="sval">
                <input
                  type="number"
                  value={alloc[f.name] ?? 0}
                  min={0}
                  max={100}
                  readOnly={locked}
                  disabled={locked}
                  onChange={(e) => onChange?.(f.name, e.target.value)}
                />
                <span className="pct">%</span>
              </span>
            </div>
          </div>
        ))}
        <div className={`totalbar${total === 100 ? ' ok' : ''}`}>
          {showReset ? (
            <button type="button" className="text-btn" onClick={onReset}>
              Reset
            </button>
          ) : (
            <span />
          )}
          <span className="tval-wrap">
            <span>Total</span>
            <span className="tval">{total}%</span>
          </span>
        </div>
      </div>
      {openFund && (
        <FundDetailDialog
          name={openFund.name}
          onClose={() => setOpenFund(null)}
          fields={[
            { label: 'Category', value: openFund.cat },
            { label: 'Return YTD', value: openFund.ytd },
            { label: '1 yr. return', value: openFund.y1 },
            { label: '5 yr. return', value: openFund.y5 },
            { label: '10 yr. return', value: openFund.y10 },
            { label: 'Total expense ratio', value: openFund.exp }
          ]}
        />
      )}
    </div>
  )
}

function FundsModal({ selectable, selected, onApply, onClose }) {
  const [query, setQuery] = useState('')
  const [asset, setAsset] = useState('all')
  const [picks, setPicks] = useState(() => selected || [])
  const [modalError, setModalError] = useState('')
  useEscapeToClose(true, onClose)
  const trapRef = useFocusTrap(true)
  const funds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ENROLL_FUNDS.filter((f) => {
      if (asset !== 'all' && assetClass(f) !== asset) return false
      if (q && !f.name.toLowerCase().includes(q)) return false
      return true
    }).sort(byPerformance)
  }, [query, asset])

  const toggle = (name) => {
    setModalError('')
    setPicks((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const apply = () => {
    if (!picks.length) {
      setModalError('Select at least one investment to apply.')
      return
    }
    onApply(picks)
  }

  return (
    <div className="enroll-modal-bg" role="presentation" onClick={onClose}>
      <div
        ref={trapRef}
        className="enroll-modal funds-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="funds-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="review-h">
          <h4 id="funds-title">{selectable ? 'Select investments' : 'Plan investments'}</h4>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="funds-filters">
          <label className="funds-field search">
            Search
            <input
              type="search"
              placeholder="Investment name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="funds-field asset">
            Asset class
            <Select value={asset} onChange={(e) => setAsset(e.target.value)}>
              <Option value="all">All asset classes</Option>
              {ASSET_CLASSES.map((cls) => (
                <Option key={cls} value={cls}>
                  {cls}
                </Option>
              ))}
            </Select>
          </label>
        </div>
        <p>
          Sorted by highest 1-year return.
          {selectable ? ' Check the investments you want, then apply them to your allocation.' : ' Compare performance, expenses, and fees.'}
        </p>
        <div className="table-wrap">
          <table className="plan-table t-stack">
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" className="check-col" rowSpan={2}>
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th scope="col" className="fund-col" rowSpan={2}>
                  Fund name / category
                </th>
                <th scope="col" rowSpan={2}>
                  Return YTD
                </th>
                <th scope="col" className="group-h" colSpan={4}>
                  Average annual total return
                </th>
                <th scope="col" className="group-h" colSpan={2}>
                  Total expense ratio
                </th>
                <th scope="col" rowSpan={2}>
                  Shareholder-
                  <br />
                  type fees
                </th>
              </tr>
              <tr>
                <th scope="col" className="sub-h">1 yr.</th>
                <th scope="col" className="sub-h">5 yr.</th>
                <th scope="col" className="sub-h">10 yr.</th>
                <th scope="col" className="sub-h">Since inception</th>
                <th scope="col" className="sub-h">As a %</th>
                <th scope="col" className="sub-h">Per $1,000</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const on = picks.includes(f.name)
                return (
                  <Fragment key={f.name}>
                    <tr
                      className={`fund-row${selectable ? ' pickable' : ''}${on ? ' on' : ''}`}
                      onClick={selectable ? () => toggle(f.name) : undefined}
                    >
                      {selectable && (
                        <td className="check-col">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(f.name)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${f.name}`}
                          />
                        </td>
                      )}
                      <td className="fund-cell">
                        <div className="fund-title">{f.name}</div>
                        <div className="fund-meta">
                          <span className="fund-cat">{f.cat}</span>
                        </div>
                      </td>
                      {[f.ytd, f.y1, f.y5, f.y10, f.si, f.exp, f.perK, f.fees].map((v, i) => (
                        <td key={`${f.name}-v-${i}`} data-label={PLAN_COL_LABELS[i]}>
                          {v}
                        </td>
                      ))}
                    </tr>
                    <tr className="bench-row group-end">
                      {selectable && <td className="check-col" />}
                      <td className="fund-cell">
                        <div className="fund-title">{f.bench}</div>
                      </td>
                      {/* Benchmarks only carry the return columns, so the
                          trailing expense/fee cells are padded out to keep both
                          rows aligned to the same header set. */}
                      {[...f.b, '—', '—', 'N/A'].map((v, i) => (
                        <td key={`${f.name}-b-${i}`} data-label={PLAN_COL_LABELS[i]}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
              {!funds.length && (
                <tr>
                  <td colSpan={selectable ? 10 : 9}>No investments match this search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {selectable && (
          <div className="funds-modal-foot">
            <span className="funds-count">
              {picks.length} selected
              {modalError ? ` · ${modalError}` : ''}
            </span>
            <div className="enroll-modal-actions">
              <button type="button" className="btn btn-primary" onClick={apply}>
                Apply
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Investments() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo =
    params.get('return')?.startsWith('/') && !params.get('return')?.startsWith('//') ? params.get('return') : ''
  return (
    <InvestmentEditor
      saveLabel={returnTo ? 'Save changes' : 'Continue'}
      onComplete={() => navigate(returnTo || '/enrollment/summary')}
      onCancel={() => navigate(returnTo || '/')}
    />
  )
}
