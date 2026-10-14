import { Icon } from '../../lib/icons'
import { faRocket, faBalanceScale, faShieldAlt } from '@fortawesome/free-solid-svg-icons'

const LEVEL_ICON = { conservative: faShieldAlt, moderate: faBalanceScale, aggressive: faRocket }

// A small stacked-stones ("cairn") illustration representing balance —
// used by the Risk Meter v2 widget. The stones stay on-brand (gradient of
// --brand/--accent) so it re-themes per client; the badge on the top stone
// swaps per risk level so the scenario is still visually distinct.
export default function RiskCairnIllustration({ levelId, color }) {
  const levelIcon = LEVEL_ICON[levelId] || faBalanceScale

  return (
    <svg className="risk-cairn" viewBox="0 0 140 130" role="img" aria-label="Illustration of balanced stacked stones">
      <defs>
        <linearGradient id="cairn-stone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-text-primary-active)" />
          <stop offset="100%" stopColor="var(--brand-text-primary-default)" />
        </linearGradient>
      </defs>

      <circle className="risk-cairn-glow" cx="70" cy="72" r="52" fill="var(--brand-background-primary-light)" />

      <g className="risk-cairn-sparkle risk-cairn-sparkle-a">
        <path d="M112 30l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="var(--brand-text-primary-active)" />
      </g>
      <g className="risk-cairn-sparkle risk-cairn-sparkle-b">
        <circle cx="24" cy="50" r="2.6" fill="var(--brand-text-primary-default)" />
      </g>

      <g className="risk-cairn-leaf risk-cairn-leaf-a">
        <path d="M30 108c-14-4-20-18-16-32 14 2 24 12 26 26 1 3 -3 7 -10 6z" fill="var(--semantics-success-text)" opacity="0.7" />
      </g>
      <g className="risk-cairn-leaf risk-cairn-leaf-b">
        <path d="M112 104c11-5 15-17 10-28-11 3-19 12-20 23-1 3 3 6 10 5z" fill="var(--semantics-success-text)" opacity="0.6" />
      </g>

      <g className="risk-cairn-stack">
        <ellipse cx="70" cy="106" rx="34" ry="15" fill="url(#cairn-stone)" />
        <ellipse cx="70" cy="106" rx="34" ry="15" fill="var(--neutral-text-default)" opacity="0.06" />
        <ellipse cx="70" cy="78" rx="25" ry="13" fill="url(#cairn-stone)" />
        <ellipse cx="66" cy="73" rx="9" ry="5" fill="var(--neutral-surface-layer-01)" opacity="0.18" />
        <circle cx="70" cy="52" r="16" fill="url(#cairn-stone)" />
        <ellipse cx="65" cy="47" rx="5" ry="3.4" fill="var(--neutral-surface-layer-01)" opacity="0.22" />
        <circle className="risk-cairn-badge" cx="70" cy="52" r="11" fill="var(--neutral-surface-layer-01)" />
        <foreignObject x="59" y="41" width="22" height="22">
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color }}>
            <Icon icon={levelIcon} size={14} />
          </div>
        </foreignObject>
      </g>
    </svg>
  )
}
