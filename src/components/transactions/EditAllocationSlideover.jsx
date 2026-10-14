import { useMemo, useState } from 'react'
import { Icon } from '../../lib/icons'
import { faChevronDown, faChevronUp, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import Select, { Option } from '../common/Select.jsx'
import {
  ACCOUNT_TYPES,
  ADDRESS_OPTIONS,
  BANK_ON_FILE,
  BANK_OPTIONS,
  CHOOSE_FROM_OPTIONS,
  DISTRIBUTION_MODES,
  PAYMENT_METHODS,
  SOURCE_OPTIONS,
  computeWithdrawalFees,
  formatMoney,
  investmentsForSource,
  sourcesFor
} from '../../data/transactions.js'

// Fee Details aside — Requested Amount, collapsible Tax Deduction tree
// (withdrawal fee + federal tax), collapsible Penalty tree (early withdrawal
// penalty), and Gross Withdrawal amount. Matches Figma node 2:18843.
export function FeeAndTaxPanel({ fees, title = 'Fee Details' }) {
  const [taxOpen, setTaxOpen] = useState(true)
  const [penaltyOpen, setPenaltyOpen] = useState(true)

  return (
    <>
      {title ? <span className="edit-alloc-fee-title">{title}</span> : null}
      <div className="edit-alloc-fee-row">
        <span>Requested Amount</span>
        <b>{formatMoney(fees.requested)}</b>
      </div>

      <button type="button" className="wd-fee-expand" onClick={() => setTaxOpen((v) => !v)} aria-expanded={taxOpen}>
        {taxOpen ? <Icon icon={faMinus} size={13} /> : <Icon icon={faPlus} size={13} />}
        <span>Tax Deduction</span>
        <b>{formatMoney(fees.taxDeduction ?? fees.feeAndTax)}</b>
      </button>
      {taxOpen && (
        <div className="wd-fee-subrows">
          <div className="edit-alloc-fee-row sub">
            <span>Withdrawal fee</span>
            <b>{fees.withdrawalFee > 0 ? formatMoney(fees.withdrawalFee) : '0%'}</b>
          </div>
          {fees.checkFee > 0 && (
            <div className="edit-alloc-fee-row sub">
              <span>Check fee</span>
              <b>{formatMoney(fees.checkFee)}</b>
            </div>
          )}
          <div className="edit-alloc-fee-row sub">
            <span>Federal tax</span>
            <b>{fees.federalTaxPct}%</b>
          </div>
        </div>
      )}

      {(fees.penaltyPct > 0 || fees.penalty > 0) && (
        <>
          <button
            type="button"
            className="wd-fee-expand"
            onClick={() => setPenaltyOpen((v) => !v)}
            aria-expanded={penaltyOpen}
          >
            {penaltyOpen ? <Icon icon={faMinus} size={13} /> : <Icon icon={faPlus} size={13} />}
            <span>Penalty</span>
            <b>{formatMoney(fees.penalty)}</b>
          </button>
          {penaltyOpen && (
            <div className="wd-fee-subrows">
              <div className="edit-alloc-fee-row sub">
                <span>Early withdrawal penalty</span>
                <b>{fees.penaltyPct}%</b>
              </div>
            </div>
          )}
        </>
      )}

      {fees.redemptionFee > 0 && (
        <div className="edit-alloc-fee-row">
          <span>Redemption fee</span>
          <b>{formatMoney(fees.redemptionFee)}</b>
        </div>
      )}

      <div className="edit-alloc-fee-row total">
        <span>Gross Withdrawal amount</span>
        <b>{formatMoney(fees.grossAmount)}</b>
      </div>
    </>
  )
}

function SourceInvestmentsPanel({ plan, draft, patch, fees }) {
  const sources = useMemo(() => sourcesFor(plan), [plan])
  const [openIds, setOpenIds] = useState(() => new Set(sources.slice(0, 1).map((s) => s.id)))
  const chooseFrom = draft.chooseFrom || 'source'
  const requested = +draft.amount || 0

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const setSourceNet = (sourceId, value) => {
    patch({ sourceAmounts: { ...(draft.sourceAmounts || {}), [sourceId]: value } })
  }

  // Split requested amount across selected sources when the user hasn't typed
  // per-source nets yet — keeps the table populated for the Figma review state.
  const defaultNet = sources.length ? round2(requested / sources.length) : 0

  if (!plan || !sources.length) {
    return <div className="wd-note">No plan sources available for this allocation.</div>
  }

  return (
    <div className="wd-source-panel">
      <h4>{chooseFrom === 'investments' ? 'Investments' : 'Sources'}</h4>
      <div className="wd-source-list">
        {sources.map((source) => {
          const rows = investmentsForSource(plan, source)
          const open = openIds.has(source.id)
          const net = draft.sourceAmounts?.[source.id] ?? (requested ? String(defaultNet) : '')
          const gross = net ? round2((+net || 0) + (fees.taxDeduction || 0) / Math.max(sources.length, 1)) : 0
          return (
            <div key={source.id} className="wd-source-card">
              <button type="button" className="wd-source-head" onClick={() => toggle(source.id)} aria-expanded={open}>
                <b>{source.name}</b>
                {open ? <Icon icon={faChevronUp} size={16} /> : <Icon icon={faChevronDown} size={16} />}
              </button>
              <div className="wd-source-metrics">
                <div>
                  <span>Balance</span>
                  <b>{formatMoney(source.amount)}</b>
                </div>
                <div>
                  <span>Gross withdrawal</span>
                  <b>{formatMoney(gross || source.amount)}</b>
                </div>
                <div>
                  <span>Net withdrawal</span>
                  {chooseFrom === 'source' ? (
                    <input
                      type="number"
                      value={net}
                      onChange={(e) => setSourceNet(source.id, e.target.value)}
                      aria-label={`${source.name} net withdrawal`}
                    />
                  ) : (
                    <b>{formatMoney(+net || 0)}</b>
                  )}
                </div>
              </div>
              {open && rows.length > 0 && (
                <div className="wd-source-funds">
                  {rows.map((row) => (
                    <div key={row.id} className="wd-source-fund">
                      <div className="wd-source-fund-name">
                        <b>{row.name}</b>
                        <span>
                          Units {row.units} · Nav {formatMoney(row.nav)}
                        </span>
                      </div>
                      <div className="wd-source-metrics">
                        <div>
                          <span>Balance</span>
                          <b>{formatMoney(row.amount)}</b>
                        </div>
                        <div>
                          <span>Gross withdrawal</span>
                          <b>{formatMoney(row.amount)}</b>
                        </div>
                        <div>
                          <span>Net withdrawal</span>
                          <b>{formatMoney(round2(row.amount * 0.7))}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100
}

// Wide slideover for editing a single withdrawal recipient's allocation —
// recipient, distribution mode, payment method, address/bank, and source
// selection, with a live fee/tax preview. Matches Figma Withdrawal Allocation
// editor variants (check vs EFT, prorata vs choose Source/Investments).
export default function EditAllocationSlideover({
  allocation,
  withdrawalTypeId,
  legalName,
  originalAddress,
  plan,
  isNew,
  onClose,
  onSave
}) {
  const [draft, setDraft] = useState(allocation)
  const patch = (p) => setDraft((d) => ({ ...d, ...p }))
  const fees = computeWithdrawalFees(draft.amount, withdrawalTypeId, draft.paymentMethod)
  const bankOnFile = {
    ...BANK_ON_FILE,
    accountHolder: legalName || BANK_ON_FILE.accountHolder
  }

  const canSave =
    draft.mode &&
    draft.amount &&
    (!isNew || draft.name.trim()) &&
    (draft.paymentMethod !== 'eft' ||
      draft.bankOption !== 'custom' ||
      (draft.bankName && draft.accountHolder && draft.accountNumber && draft.routingNo))

  return (
    <Slideover
      title={isNew ? 'Add Allocation' : 'Edit Allocation'}
      width="wide"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => onSave(draft)}>
            Save
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="edit-alloc">
        <div className="edit-alloc-main">
          {isNew && (
            <>
              <h4>Recipient</h4>
              <div className="txn-row">
                <div className="txn-field">
                  <label htmlFor="edit-alloc-recipient-name">Recipient name</label>
                  <input
                    id="edit-alloc-recipient-name"
                    type="text"
                    placeholder="e.g. Taylor Hale"
                    value={draft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          <h4>Withdrawal details</h4>
          <div className="txn-row">
            <div className="txn-field">
              <label htmlFor="edit-alloc-mode">Select distribution mode</label>
              <Select id="edit-alloc-mode" value={draft.mode} onChange={(e) => patch({ mode: e.target.value })}>
                <Option value="">Select</Option>
                {DISTRIBUTION_MODES.map((m) => (
                  <Option key={m.id} value={m.id}>
                    {m.label}
                  </Option>
                ))}
              </Select>
            </div>
            <div className="txn-field">
              <label htmlFor="edit-alloc-amount">Withdrawal amount</label>
              <input id="edit-alloc-amount" type="number" value={draft.amount} onChange={(e) => patch({ amount: e.target.value })} />
            </div>
          </div>

          <h4>Payment details</h4>
          <div className="txn-field">
            <label>Choose payment method</label>
            <div className="txn-choice-list">
              {PAYMENT_METHODS.map((m) => (
                <label key={m.id} className={`txn-choice${draft.paymentMethod === m.id ? ' on' : ''}`}>
                  <input
                    type="radio"
                    checked={draft.paymentMethod === m.id}
                    onChange={() => patch({ paymentMethod: m.id })}
                  />
                  <span>
                    <b>{m.label}</b>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {draft.paymentMethod === 'check' && (
            <>
              <h4>Address details</h4>
              <div className="txn-field">
                <label>Select address</label>
                <div className="txn-choice-list">
                  {ADDRESS_OPTIONS.map((a) => (
                    <label key={a.id} className={`txn-choice${draft.addressOption === a.id ? ' on' : ''}`}>
                      <input
                        type="radio"
                        checked={draft.addressOption === a.id}
                        onChange={() => patch({ addressOption: a.id })}
                      />
                      <span>
                        <b>{a.label}</b>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="edit-alloc-readcard edit-alloc-bankcard">
                <div>
                  <span>Check payable to</span>
                  <b>{legalName || '—'}</b>
                </div>
                <div>
                  <span>Address</span>
                  <b>
                    {draft.addressOption === 'custom' && draft.customAddress ? draft.customAddress : originalAddress}
                  </b>
                </div>
              </div>
              {draft.addressOption === 'custom' && (
                <div className="txn-row">
                  <div className="txn-field">
                    <label htmlFor="edit-alloc-custom-address">Address</label>
                    <input
                      id="edit-alloc-custom-address"
                      type="text"
                      placeholder={originalAddress}
                      value={draft.customAddress}
                      onChange={(e) => patch({ customAddress: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {draft.paymentMethod === 'eft' && (
            <>
              <h4>Bank details</h4>
              <div className="txn-field">
                <label>Select Bank details</label>
                <div className="txn-choice-list">
                  {BANK_OPTIONS.map((a) => (
                    <label key={a.id} className={`txn-choice${(draft.bankOption || 'onfile') === a.id ? ' on' : ''}`}>
                      <input
                        type="radio"
                        checked={(draft.bankOption || 'onfile') === a.id}
                        onChange={() => patch({ bankOption: a.id })}
                      />
                      <span>
                        <b>{a.label}</b>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {(draft.bankOption || 'onfile') === 'onfile' ? (
                <div className="edit-alloc-readcard edit-alloc-bankcard">
                  <div>
                    <span>Account holder</span>
                    <b>{bankOnFile.accountHolder}</b>
                  </div>
                  <div>
                    <span>Bank name</span>
                    <b>{bankOnFile.bankName}</b>
                  </div>
                  <div>
                    <span>Routing number</span>
                    <b>{bankOnFile.routingNo}</b>
                  </div>
                  <div>
                    <span>Account number</span>
                    <b>{bankOnFile.accountNumber}</b>
                  </div>
                </div>
              ) : (
                <>
                  <div className="txn-row">
                    <div className="txn-field">
                      <label htmlFor="edit-alloc-bank-name">Name of the Financial Institution</label>
                      <input
                        id="edit-alloc-bank-name"
                        type="text"
                        value={draft.bankName || ''}
                        onChange={(e) => patch({ bankName: e.target.value })}
                      />
                    </div>
                    <div className="txn-field">
                      <label htmlFor="edit-alloc-account-holder">Account holder name</label>
                      <input
                        id="edit-alloc-account-holder"
                        type="text"
                        value={draft.accountHolder || ''}
                        onChange={(e) => patch({ accountHolder: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="txn-field" style={{ marginTop: 'var(--core-space-3)' }}>
                    <label>Type of account</label>
                    <div className="txn-choice-list">
                      {ACCOUNT_TYPES.map((t) => (
                        <label
                          key={t.id}
                          className={`txn-choice${(draft.accountType || 'checking') === t.id ? ' on' : ''}`}
                        >
                          <input
                            type="radio"
                            checked={(draft.accountType || 'checking') === t.id}
                            onChange={() => patch({ accountType: t.id })}
                          />
                          <span>
                            <b>{t.label}</b>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="txn-row">
                    <div className="txn-field">
                      <label htmlFor="edit-alloc-account-number">Account Number</label>
                      <input
                        id="edit-alloc-account-number"
                        type="text"
                        value={draft.accountNumber || ''}
                        onChange={(e) => patch({ accountNumber: e.target.value })}
                      />
                    </div>
                    <div className="txn-field">
                      <label htmlFor="edit-alloc-routing-number">Routing Number</label>
                      <input
                        id="edit-alloc-routing-number"
                        type="text"
                        value={draft.routingNo || ''}
                        onChange={(e) => patch({ routingNo: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <h4>Source details</h4>
          <div className="txn-field">
            <label>Select source</label>
            <div className="txn-choice-list">
              {SOURCE_OPTIONS.map((s) => (
                <label key={s.id} className={`txn-choice${draft.source === s.id ? ' on' : ''}`}>
                  <input type="radio" checked={draft.source === s.id} onChange={() => patch({ source: s.id })} />
                  <span>
                    <b>{s.label}</b>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {draft.source === 'choose' && (
            <>
              <div className="txn-field" style={{ marginTop: 'var(--core-space-3)' }}>
                <label>Allow me to choose from</label>
                <div className="txn-choice-list">
                  {CHOOSE_FROM_OPTIONS.map((o) => (
                    <label key={o.id} className={`txn-choice${(draft.chooseFrom || 'source') === o.id ? ' on' : ''}`}>
                      <input
                        type="radio"
                        checked={(draft.chooseFrom || 'source') === o.id}
                        onChange={() => patch({ chooseFrom: o.id })}
                      />
                      <span>
                        <b>{o.label}</b>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <SourceInvestmentsPanel plan={plan} draft={draft} patch={patch} fees={fees} />
            </>
          )}
        </div>

        <aside className="edit-alloc-fee">
          <FeeAndTaxPanel fees={fees} />
        </aside>
      </div>
    </Slideover>
  )
}
