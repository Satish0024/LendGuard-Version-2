import { cloneElement, useId } from 'react'
import { Icon } from '../../lib/icons'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'

// An info icon that reveals its message on hover/focus, via CSS rather than
// JS state — keeps it keyboard-accessible (focusable button, shown on
// :focus-within) without a portal or positioning library.
function FieldTip({ tooltip, id }) {
  if (!tooltip) return null
  return (
    <span className="field-tip">
      <button type="button" className="field-tip-btn" aria-describedby={id}>
        <Icon icon={faInfoCircle} size={13} aria-hidden="true" />
        <span className="sr-only">More info</span>
      </button>
      <span className="field-tip-bubble" role="tooltip" id={id}>
        {tooltip}
      </span>
    </span>
  )
}

// A labelled form row. Generates an id and wires the <label> to the control,
// so assistive tech announces them together — the plain sibling
// <label> + <input> pattern this replaces left the control unlabelled.
export default function Field({ label, required, note, noteClass, tooltip, children }) {
  const id = useId()
  const tipId = useId()
  return (
    <div className="txn-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="sr-only"> (required)</span>}
        <FieldTip tooltip={tooltip} id={tipId} />
      </label>
      {cloneElement(children, { id, ...(required ? { required: true } : null) })}
      {note && <span className={`note${noteClass ? ` ${noteClass}` : ''}`}>{note}</span>}
    </div>
  )
}

// Grouped controls (radios, checkboxes, or a multi-input row like a term
// split across years/months). A fieldset+legend is what lets a screen reader
// announce the group's name before each individual option.
export function FieldGroup({ label, required, note, noteClass, tooltip, children }) {
  const tipId = useId()
  return (
    <fieldset className="txn-field txn-fieldset">
      <legend>
        {label}
        {required && <span className="sr-only"> (required)</span>}
        <FieldTip tooltip={tooltip} id={tipId} />
      </legend>
      {children}
      {note && <span className={`note${noteClass ? ` ${noteClass}` : ''}`}>{note}</span>}
    </fieldset>
  )
}
