import { useState } from 'react'
import { Icon } from '../../lib/icons'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { ACCOUNT_TYPES, RELATIONSHIPS, emptyBeneficiary, ssnDigitsOnlyError } from '../../lib/profileDetails'
import { PhoneField, SelectField, SsnField, TextField } from './ProfileFields.jsx'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useFocusTrap } from '../../hooks/useFocusTrap'

const STEPS = [
  { id: 'basic', title: 'Basic details', hint: 'Specify the basic details of the beneficiary.' },
  { id: 'contact', title: 'Contact details', hint: 'Update the correct contact details to reach beneficiary.' },
  { id: 'bank', title: 'Bank details', hint: 'Specify the active bank details of the beneficiary.' }
]

export default function AddBeneficiary({ initial, onCancel, onSave }) {
  const editing = Boolean(initial)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => (initial ? { ...emptyBeneficiary(), ...initial } : emptyBeneficiary()))
  const [showSsn, setShowSsn] = useState(false)
  const [error, setError] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  useEscapeToClose(leaveOpen, () => setLeaveOpen(false))
  const leaveTrapRef = useFocusTrap(leaveOpen)

  const set = (key, value) => {
    setError('')
    setDraft((p) => ({ ...p, [key]: value }))
  }

  const validate = (i) => {
    if (i === 0) {
      if (!draft.name.trim()) return 'Enter beneficiary name.'
      const ssnMsg = ssnDigitsOnlyError(draft.ssn, { required: true })
      if (ssnMsg) return ssnMsg
      if (!draft.dob.trim()) return 'Enter date of birth.'
    }
    if (i === 1) {
      if (!draft.email.trim()) return 'Enter email ID.'
      if (!draft.phone.trim()) return 'Enter phone number.'
    }
    if (i === 2) {
      if (!draft.accountNumber.trim()) return 'Enter bank account number.'
      if (!draft.holderName.trim()) return 'Enter account holder name.'
      if (!draft.bankName.trim()) return 'Enter bank name.'
      if (!draft.routing.trim()) return 'Enter ABA routing number.'
    }
    return ''
  }

  const next = () => {
    const msg = validate(step)
    if (msg) {
      setError(msg)
      return
    }
    if (step < 2) setStep(step + 1)
    else onSave(draft)
  }

  const goStep = (i) => {
    if (i > step) return
    setError('')
    setStep(i)
  }

  return (
    <>
      <div className="hi-bar">
        <div>
          <button type="button" className="text-link pr-back" onClick={() => setLeaveOpen(true)}>
            Back
          </button>
          <h1>{editing ? 'Edit beneficiary' : 'Add beneficiary'}</h1>
        </div>
      </div>

      <div className="pr-shell">
        {/* Visually hidden: the step panels' titles render as <h3>
            ("Basic details" etc.) directly after this page's <h1>,
            skipping a heading level (axe-core: heading-order). Same fix
            as Settings.jsx. */}
        <h2 className="sr-only">Beneficiary form sections</h2>
        <ol className="pr-steps" aria-label="Beneficiary steps">
          {STEPS.map((item, i) => {
            const done = i < step
            const on = i === step
            return (
              <li key={item.id} className={done ? 'done' : on ? 'on' : ''}>
                <button type="button" onClick={() => goStep(i)} disabled={i > step}>
                  <b>{done ? <Icon icon={faCheck} size={14} /> : i + 1}</b>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.hint}</p>
                    {done ? <em className="ok">Completed</em> : on ? <em>In progress</em> : null}
                  </div>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="pr-main">
          <section className="panel pr-panel">
            {step === 0 && (
              <>
                <h3>Basic details</h3>
                <div className="pr-form">
                  <div className="pr-field">
                    <span>Beneficiary type</span>
                    <div className="pr-radios">
                      {['Primary', 'Contingent'].map((opt) => (
                        <label key={opt} className={draft.type === opt ? 'on' : ''}>
                          <input
                            type="radio"
                            name="bene-type"
                            checked={draft.type === opt}
                            onChange={() => set('type', opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                  <TextField
                    label="Beneficiary Name"
                    required
                    value={draft.name}
                    placeholder="Enter beneficiary name"
                    onChange={(v) => set('name', v)}
                  />
                  <SelectField
                    label="Relationship"
                    required
                    value={draft.relationship}
                    options={RELATIONSHIPS}
                    onChange={(v) => set('relationship', v)}
                  />
                  <SsnField
                    label="Social Security Number"
                    required
                    revealed={showSsn}
                    value={draft.ssn}
                    placeholder="Enter social security number"
                    error={/social security/i.test(error) ? error : ''}
                    onToggle={() => setShowSsn((v) => !v)}
                    onChange={(v) => set('ssn', v)}
                  />
                  <TextField
                    label="Date Of Birth"
                    required
                    value={draft.dob}
                    placeholder="MM-DD-YYYY"
                    onChange={(v) => set('dob', v)}
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h3>Contact details</h3>
                <div className="pr-form">
                  <TextField
                    label="Email ID"
                    required
                    type="email"
                    value={draft.email}
                    placeholder="Enter email ID"
                    onChange={(v) => set('email', v)}
                  />
                  <PhoneField
                    label="Phone Number"
                    required
                    country={draft.phoneCountry}
                    number={draft.phone}
                    placeholder="Enter phone number"
                    onCountry={(v) => set('phoneCountry', v)}
                    onNumber={(v) => set('phone', v)}
                  />
                  <TextField
                    label="Address Line 1"
                    value={draft.address1}
                    placeholder="Enter address line 1"
                    onChange={(v) => set('address1', v)}
                  />
                  <TextField
                    label="Address Line 2"
                    value={draft.address2}
                    placeholder="Enter address line 2"
                    onChange={(v) => set('address2', v)}
                  />
                  <TextField label="City" value={draft.city} placeholder="Enter city" onChange={(v) => set('city', v)} />
                  <TextField label="Zip Code" value={draft.zip} placeholder="Enter zip code" onChange={(v) => set('zip', v)} />
                  <SelectField
                    label="Country"
                    value={draft.country}
                    placeholder="Select an option"
                    options={['USA', 'Canada']}
                    onChange={(v) => set('country', v)}
                  />
                  <TextField label="State" value={draft.state} placeholder="Select an option" onChange={(v) => set('state', v)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h3>Bank details</h3>
                <div className="pr-form">
                  <TextField
                    label="Bank Account Number"
                    required
                    value={draft.accountNumber}
                    placeholder="Enter account number"
                    onChange={(v) => set('accountNumber', v)}
                  />
                  <TextField
                    label="Account Holder Name"
                    required
                    value={draft.holderName}
                    placeholder="Enter account holder name"
                    onChange={(v) => set('holderName', v)}
                  />
                  <TextField
                    label="Bank Name"
                    required
                    value={draft.bankName}
                    placeholder="Enter bank name"
                    onChange={(v) => set('bankName', v)}
                  />
                  <TextField
                    label="ABA Routing Number"
                    required
                    value={draft.routing}
                    placeholder="Enter ABA routing number"
                    onChange={(v) => set('routing', v)}
                  />
                  <SelectField
                    label="Type Of Account"
                    required
                    value={draft.accountType}
                    options={ACCOUNT_TYPES}
                    onChange={(v) => set('accountType', v)}
                  />
                </div>
              </>
            )}

            {error && <p className="pr-error">{error}</p>}
            <div className="pr-savebar">
              <button type="button" className="btn btn-primary" onClick={next}>
                {step === 2 ? 'Save' : 'Next'}
              </button>
              {step > 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                  Previous
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setLeaveOpen(true)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      </div>

      {leaveOpen && (
        <div className="enroll-modal-bg" role="presentation" onClick={() => setLeaveOpen(false)}>
          <div
            ref={leaveTrapRef}
            className="enroll-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pr-leave-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="pr-leave-title">Leave Without Saving?</h4>
            <p>
              {editing
                ? 'If you leave now, changes to this beneficiary will not be saved.'
                : 'If you leave now, the beneficiary details you entered will not be saved.'}
            </p>
            <div className="enroll-modal-actions">
              <button type="button" className="btn btn-primary" onClick={onCancel}>
                Leave
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setLeaveOpen(false)}>
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
