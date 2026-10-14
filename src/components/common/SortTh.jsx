import SortIcon from './SortIcon.jsx'

// A <th> whose whole label is a click/keyboard-accessible sort toggle.
// Shared across every data table so sort affordance (icon, aria-sort,
// active-column styling) stays identical app-wide instead of each
// table re-implementing its own.
export default function SortTh({ label, sortKeyName, sortKey, sortDir, onSort, className, scope = 'col' }) {
  const active = sortKey === sortKeyName
  return (
    <th scope={scope} className={className} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`th-sort${active ? ' active' : ''}`} onClick={() => onSort(sortKeyName)}>
        {label}
        <SortIcon direction={active ? sortDir : null} />
      </button>
    </th>
  )
}
