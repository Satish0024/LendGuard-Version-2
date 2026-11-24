import { useState } from 'react'
import { Icon } from '../../lib/icons'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import Select, { Option } from '../common/Select.jsx'
import { ssnDigitsOnlyError } from '../../lib/profileDetails'

export function Row({ label, value, hint, children }) {
  const empty = value == null || String(value).trim() === ''
  return (
    <div className="pr-row">
      <span>{label}</span>
      <div>
        {children || <b className={empty ? 'empty' : ''}>{empty ? '—' : value}</b>}
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  )
}

export function SsnRow({ label, value, revealed, onToggle }) {
  return (
    <div className="pr-row">
      <span>{label}</span>
      <div>
        <b className="pr-ssn">
          {value}
          <button type="button" className="pr-eye inline" aria-label={revealed ? `Hide ${label}` : `Show ${label}`} onClick={onToggle}>
            {revealed ? <Icon icon={faEyeSlash} size={14} /> : <Icon icon={faEye} size={14} />}
          </button>
        </b>
      </div>
    </div>
  )
}

export function TextField({ label, value, onChange, required, placeholder, type = 'text', hint, wide }) {
  return (
    <label className={`pr-field${wide ? ' wide' : ''}`}>
      <span>
        {label}
      </span>
      <div>
        <input type={type} value={value} placeholder={placeholder || ''} onChange={(e) => onChange(e.target.value)} />
        {hint ? <small>{hint}</small> : null}
      </div>
    </label>
  )
}

export function NameFields({ first, middle, last, onFirst, onMiddle, onLast }) {
  return (
    <div className="pr-field">
      <span>Name</span>
      <div className="pr-name-trio">
        <input value={first} placeholder="First" aria-label="First Name" onChange={(e) => onFirst(e.target.value)} />
        <input value={middle} placeholder="Middle" aria-label="Middle Name" onChange={(e) => onMiddle(e.target.value)} />
        <input value={last} placeholder="Last" aria-label="Last Name" onChange={(e) => onLast(e.target.value)} />
      </div>
    </div>
  )
}

export function SplitField({ label, left, right }) {
  return (
    <div className="pr-field">
      <span>{label}</span>
      <div className="pr-pair">
        <input
          value={left.value}
          placeholder={left.placeholder || ''}
          aria-label={left.aria}
          onChange={(e) => left.onChange(e.target.value)}
        />
        <input
          value={right.value}
          placeholder={right.placeholder || ''}
          aria-label={right.aria}
          onChange={(e) => right.onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

export function SelectField({ label, value, onChange, options, required, placeholder, wide }) {
  return (
    <label className={`pr-field${wide ? ' wide' : ''}`}>
      <span>
        {label}
      </span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder ? <Option value="">{placeholder}</Option> : null}
        {options.map((opt) => (
          <Option key={opt} value={opt}>
            {opt}
          </Option>
        ))}
      </Select>
    </label>
  )
}

export function SsnField({ label, value, revealed, onToggle, onChange, required, placeholder, error }) {
  const [typedError, setTypedError] = useState('')
  const message = error || typedError
  return (
    <label className="pr-field">
      <span>
        {label}
      </span>
      <div>
        <div className={`pr-input-ico${message ? ' is-invalid' : ''}`}>
          <input
            type={revealed ? 'text' : 'password'}
            value={value}
            placeholder={placeholder || ''}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? 'ssn-digits-error' : undefined}
            onChange={(e) => {
              const next = e.target.value
              onChange(next)
              setTypedError(ssnDigitsOnlyError(next))
            }}
          />
          <button type="button" className="pr-eye" aria-label={revealed ? 'Hide SSN' : 'Show SSN'} onClick={onToggle}>
            {revealed ? <Icon icon={faEyeSlash} size={16} /> : <Icon icon={faEye} size={16} />}
          </button>
        </div>
        {message ? (
          <small id="ssn-digits-error" className="pr-field-error" role="alert">
            {message}
          </small>
        ) : null}
      </div>
    </label>
  )
}

export function PhoneField({ label, country, number, onCountry, onNumber, required, placeholder }) {
  return (
    <div className="pr-field">
      <span>
        {label}
      </span>
      <div className="pr-phone">
        <input value={country} onChange={(e) => onCountry(e.target.value)} aria-label={`${label || 'Phone'} country code`} />
        <input
          value={number}
          placeholder={placeholder || ''}
          onChange={(e) => onNumber(e.target.value)}
          aria-label={`${label || 'Phone'} number`}
        />
      </div>
    </div>
  )
}

export function RadioYesNo({ label, value, onChange }) {
  const on = value === true || value === 'Yes'
  return (
    <div className="pr-field wide">
      <span>{label}</span>
      <div className="pr-radios">
        {['Yes', 'No'].map((opt) => (
          <label key={opt} className={on === (opt === 'Yes') ? 'on' : ''}>
            <input type="radio" name={label} checked={on === (opt === 'Yes')} onChange={() => onChange(opt === 'Yes')} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

export function ProfileBlock({ title, children, form }) {
  return (
    <section className="pr-block">
      {title ? <h3>{title}</h3> : null}
      {form ? <div className="pr-form">{children}</div> : children}
    </section>
  )
}

export function SectionBar({ title, action }) {
  return (
    <div className="pr-sec-h">
      <h3>{title}</h3>
      {action ? <div className="pr-sec-actions">{action}</div> : null}
    </div>
  )
}

export function Flag({ label, on }) {
  const yes = on === true || on === 'Yes'
  return (
    <span className={`pr-flag${yes ? ' yes' : ''}`}>
      {label}
      <b>{yes ? 'Yes' : 'No'}</b>
    </span>
  )
}
