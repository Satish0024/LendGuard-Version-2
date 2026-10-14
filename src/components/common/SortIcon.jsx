// CORE .cds-sort-icon: both triangles are always drawn. At rest both sit at
// 35% opacity; on the sorted column the icon turns brand-coloured and the
// active direction goes to full opacity while the other stays at 35%.
export default function SortIcon({ direction }) {
  const active = direction === 'asc' || direction === 'desc'
  return (
    <svg
      className={`sort-icon${active ? ' sort-icon--active' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 0L9 4.5H1L5 0Z" fill="currentColor" opacity={direction === 'asc' ? 1 : 0.35} />
      <path d="M5 12L1 7.5H9L5 12Z" fill="currentColor" opacity={direction === 'desc' ? 1 : 0.35} />
    </svg>
  )
}
