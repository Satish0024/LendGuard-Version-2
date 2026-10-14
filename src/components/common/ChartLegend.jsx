// Asset-class performance can show up to 11 series. Rather than hiding them
// behind a dropdown, every series gets its own checkbox laid out in a
// wrapping row below the chart -- always visible, one click to toggle.
export default function ChartLegend({ items, onToggle, label = 'Asset classes' }) {
  return (
    <div className="legend-row" role="group" aria-label={label}>
      {items.map((item) => (
        <LegendItem key={item.key} item={item} onToggle={onToggle} />
      ))}
    </div>
  )
}

function LegendItem({ item, onToggle }) {
  const cls = ['legend-chip', item.checked && 'on', item.disabled && 'disabled'].filter(Boolean).join(' ')
  return (
    <label className={cls} style={{ '--series-color': item.color }}>
      <input
        type="checkbox"
        checked={item.checked}
        disabled={item.disabled}
        onChange={() => onToggle(item.key)}
      />
      {/* A short sample of the series' own line: colour + dash pattern are
          unique per series, where the 4 marker shapes had to repeat. */}
      <svg className="legend-line" width="24" height="10" viewBox="0 0 24 10" aria-hidden="true">
        <line
          x1="1"
          y1="5"
          x2="23"
          y2="5"
          style={{ stroke: item.stroke || item.color }}
          strokeWidth={item.key === 'total' ? 3 : 2.5}
          strokeLinecap="round"
          strokeDasharray={item.dash?.length ? item.dash.join(' ') : undefined}
        />
      </svg>
      {item.label}
    </label>
  )
}
