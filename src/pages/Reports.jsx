import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { DOCUMENT_TYPES, PLAN_DOCS, STATEMENTS } from '../data/documents.js'
import { addGeneratedStatement, getGeneratedStatements } from '../lib/generatedStatements.js'
import { downloadDocumentFile } from '../lib/downloadDocument.js'
import Toast from '../components/common/Toast.jsx'
import Select, { Option } from '../components/common/Select.jsx'
import DatePicker from '../components/common/DatePicker.jsx'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import '../styles/documents.css'

const STATEMENT_PERIODS = [
  { id: '1m', label: 'Last month' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' }
]

function toDateInput(d) {
  return d.toISOString().slice(0, 10)
}

function MultiSelect({ label, options, selected, onChange, getLabel = (o) => o, getSub, getKey = (o) => o }) {
  const [open, setOpen] = useState(false)
  const labelId = useId()
  const ref = useRef(null)

  const allChecked = options.length > 0 && selected.length === options.length
  const summary = selected.length === 0 || allChecked ? 'All' : selected.length === 1 ? getLabel(selected[0]) : `${selected.length} selected`

  const toggle = (key) => {
    onChange(selected.some((s) => getKey(s) === key) ? selected.filter((s) => getKey(s) !== key) : [...selected, options.find((o) => getKey(o) === key)])
  }
  const toggleAll = () => onChange(allChecked ? [] : [...options])

  // Close on outside click - use mousedown to catch before any focus change
  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    // Use mousedown instead of click to fire before focus changes
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <div className="multi-select" ref={ref}>
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="multi-select-btn"
        aria-labelledby={`${labelId} ${labelId}-value`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span id={`${labelId}-value`}>{summary}</span>
        <Icon icon={faChevronDown} size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="multi-select-menu" role="listbox" aria-labelledby={labelId}>
          <label className="multi-select-row all">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            Select All
          </label>
          {options.map((opt) => {
            const key = getKey(opt)
            return (
              <label className="multi-select-row" key={key}>
                <input type="checkbox" checked={selected.some((s) => getKey(s) === key)} onChange={() => toggle(key)} />
                <span>
                  <b>{getLabel(opt)}</b>
                  {getSub ? <small>{getSub(opt)}</small> : null}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatementModal({ plans, onClose, onGenerate }) {
  const [planId, setPlanId] = useState('')
  const [period, setPeriod] = useState('3m')
  const trapRef = useFocusTrap(true)
  useEscapeToClose(true, onClose)

  return (
    <div className="enroll-modal-bg" role="presentation" onClick={onClose}>
      <div ref={trapRef} className="enroll-modal" role="dialog" aria-modal="true" aria-labelledby="stmt-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h4 id="stmt-title">Generate new statement</h4>
        <div className="pr-form">
          <div className="pr-field">
            <label htmlFor="stmt-plan">
              Plan Name/ID
              <span className="sr-only"> (required)</span>
            </label>
            <Select id="stmt-plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <Option value="">Select</Option>
              {plans.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </div>
          <div className="pr-field">
            <label htmlFor="stmt-period">Statement Period</label>
            <Select id="stmt-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {STATEMENT_PERIODS.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.label}
                </Option>
              ))}
            </Select>
          </div>
        </div>
        <div className="enroll-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!planId}
            onClick={() => {
              const plan = plans.find((p) => p.id === planId)
              const periodLabel = STATEMENT_PERIODS.find((p) => p.id === period)?.label
              onGenerate(plan, periodLabel)
              onClose()
            }}
          >
            Generate &amp; Download
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  const { participant } = useParticipant()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 6)
    return toDateInput(d)
  })
  const [to, setTo] = useState(() => toDateInput(new Date()))
  // "Generate Statement" elsewhere in the app (e.g. the Transactions page)
  // navigates here with this flag set, so the modal is already open on
  // arrival instead of landing on a plain Documents page.
  const [statementOpen, setStatementOpen] = useState(() => !!location.state?.openStatement)
  const [toast, setToast] = useState(null)
  const resultsRef = useRef(null)
  // Every "Generate" click adds a real record (persisted per participant,
  // same sessionStorage pattern as lib/riskProfile.js) instead of replaying
  // a fixed mock list -- generatedTick just forces this component to
  // re-read it after a write.
  const [generatedTick, setGeneratedTick] = useState(0)
  const showToast = (message, tone = 'success') => setToast({ id: Date.now(), message, tone })
  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    if (location.state?.openStatement) setStatementOpen(true)
  }, [location.state])

  const handleGenerate = (plan, periodLabel) => {
    try {
      addGeneratedStatement(participant.id, { planName: plan?.name, periodLabel })
      setGeneratedTick((t) => t + 1)
      downloadDocumentFile({ name: `${plan.name} Statement`, type: 'Quarterly Fee Disclosure', plan: plan.name, date: new Date().toLocaleDateString() })
      showToast('New statement generated and downloaded.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not generate that statement. Please try again.', 'error')
    }
  }

  const handleDownload = (doc) => {
    try {
      downloadDocumentFile(doc)
      showToast('Downloaded successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Download failed. Please try again.', 'error')
    }
  }

  const allDocs = useMemo(() => {
    const personal = STATEMENTS[participant.id] || []
    const generated = getGeneratedStatements(participant.id)
    return [...generated, ...personal, ...PLAN_DOCS]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, generatedTick])

  const docs = useMemo(() => {
    return allDocs.filter((d) => {
      const nameOk = !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase())
      const planOk = !planFilter.length || planFilter.some((p) => p.name === d.plan)
      const typeOk = !typeFilter.length || typeFilter.includes(d.type)
      const docDate = new Date(d.date)
      const dateOk = (!from || docDate >= new Date(from)) && (!to || docDate <= new Date(to))
      return nameOk && planOk && typeOk && dateOk
    })
  }, [allDocs, search, planFilter, typeFilter, from, to])

  // Search is a no-op with nothing to search on -- keep it disabled until
  // the participant has actually entered a name or picked a plan/type
  // filter, rather than letting it sit active over the default (unfiltered)
  // state. Date range is excluded since it always carries a default value.
  const hasSearchCriteria = search.trim() !== '' || planFilter.length > 0 || typeFilter.length > 0

  const reset = () => {
    setSearch('')
    setPlanFilter([])
    setTypeFilter([])
    const d = new Date()
    d.setMonth(d.getMonth() - 6)
    setFrom(toDateInput(d))
    setTo(toDateInput(new Date()))
  }

  return (
    <div className="page-body">
      <div className="hi-bar">
        <div>
          <h1>Documents</h1>
          <p className="pr-intro">Access, download, and generate important plan documents and disclosures</p>
        </div>
      </div>
      <section className="panel doc-page">
        <div className="doc-filters">
          <div className="doc-field">
            <label className="field-label" htmlFor="doc-search">
              Search
            </label>
            <input
              id="doc-search"
              type="text"
              placeholder="Document name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MultiSelect
            label="Plan Name/ID"
            options={participant.plans}
            selected={planFilter}
            onChange={setPlanFilter}
            getKey={(p) => p.id}
            getLabel={(p) => p.name}
            getSub={(p) => p.meta}
          />
          <MultiSelect
            label="Document Type"
            options={DOCUMENT_TYPES}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          <div className="doc-field">
            <label className="field-label" htmlFor="doc-from">
              Documented from
            </label>
            <DatePicker id="doc-from" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="doc-field">
            <label className="field-label" htmlFor="doc-to">
              Documented to
            </label>
            <DatePicker id="doc-to" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="doc-field doc-field-reset">
            <span className="field-label" aria-hidden="true">
              &nbsp;
            </span>
            <div className="doc-filter-actions">
              <button type="button" className="text-btn doc-reset" onClick={reset}>
                Reset
              </button>
              <button
                type="button"
                className="btn btn-primary doc-search-btn"
                disabled={!hasSearchCriteria}
                onClick={() => resultsRef.current?.focus()}
              >
                Search
              </button>
            </div>
          </div>
        </div>

        <div className="doc-results-head">
          <span className="doc-count" ref={resultsRef} tabIndex={-1}>
            {docs.length.toString().padStart(2, '0')} - Record{docs.length === 1 ? '' : 's'} found
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setStatementOpen(true)}>
            Generate new statement
          </button>
        </div>

        {!docs.length ? (
          <div className="tx-empty">No documents match these filters.</div>
        ) : (
          <div className="doc-list">
            {docs.map((d) => (
              <article className="doc-row" key={d.id}>
                <div className="doc-copy">
                  <h2 className="doc-name">{d.name}</h2>
                  <p>
                    {d.type} · {d.date}
                  </p>
                </div>
                <span className="doc-plan">{d.plan}</span>
                <button type="button" className="doc-dl" onClick={() => handleDownload(d)}>
                  Download
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {statementOpen && (
        <StatementModal
          plans={participant.plans}
          onClose={() => setStatementOpen(false)}
          onGenerate={handleGenerate}
        />
      )}
      <Toast key={toast?.id} message={toast?.message || ''} tone={toast?.tone} onDismiss={dismissToast} />
    </div>
  )
}
