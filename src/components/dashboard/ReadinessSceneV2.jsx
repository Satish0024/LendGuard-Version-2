// Animated sky/mountain/balloon illustration for the Retirement Readiness
// widget (v2). Pure inline SVG + CSS animation so it re-themes with the
// active brand color automatically (no raster asset to swap per client).
export default function ReadinessSceneV2({ idle = false }) {
  return (
    <svg
      className={`rr2-scene${idle ? ' idle' : ''}`}
      viewBox="0 0 240 130"
      role="img"
      aria-label="Illustration of a hot air balloon rising over mountains"
    >
      <defs>
        <linearGradient id="rr2-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-background-primary-light)" />
          <stop offset="100%" stopColor="var(--neutral-surface-layer-01)" />
        </linearGradient>
        <linearGradient id="rr2-balloon-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-text-primary-active)" />
          <stop offset="100%" stopColor="var(--brand-text-primary-default)" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="240" height="130" rx="12" fill="url(#rr2-sky)" />

      <g className="rr2-cloud rr2-cloud-a" opacity="0.9">
        <ellipse cx="34" cy="34" rx="22" ry="10" fill="var(--neutral-surface-layer-01)" />
        <ellipse cx="52" cy="30" rx="16" ry="9" fill="var(--neutral-surface-layer-01)" />
        <ellipse cx="18" cy="30" rx="12" ry="8" fill="var(--neutral-surface-layer-01)" />
      </g>
      <g className="rr2-cloud rr2-cloud-b" opacity="0.75">
        <ellipse cx="172" cy="20" rx="20" ry="9" fill="var(--neutral-surface-layer-01)" />
        <ellipse cx="188" cy="17" rx="13" ry="7" fill="var(--neutral-surface-layer-01)" />
        <ellipse cx="158" cy="18" rx="11" ry="7" fill="var(--neutral-surface-layer-01)" />
      </g>

      <g className="rr2-balloon">
        <line x1="120" y1="70" x2="112" y2="94" stroke="var(--brand-text-primary-default)" strokeWidth="1.4" opacity="0.6" />
        <line x1="130" y1="72" x2="132" y2="94" stroke="var(--brand-text-primary-default)" strokeWidth="1.4" opacity="0.6" />
        <rect x="110" y="94" width="24" height="14" rx="3" fill="var(--brand-text-primary-hover)" />
        <ellipse cx="122" cy="55" rx="26" ry="30" fill="url(#rr2-balloon-a)" />
        <path d="M100 45a26 30 0 0 1 12-14 34 38 0 0 0-8 24z" fill="var(--neutral-surface-layer-01)" opacity="0.28" />
        <path d="M96 55h52M100 40h44M92 68h60" stroke="var(--neutral-surface-layer-01)" strokeOpacity="0.35" strokeWidth="3" />
        <path d="M122 82c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z" fill="var(--brand-text-primary-hover)" />
      </g>

      <path d="M0 130V88l32-30 26 20 30-38 40 34 26-16 46 30 40-24v46z" fill="var(--brand-background-primary-light)" />
      <path d="M0 130V104l46-26 42 22 52-30 50 28 50-20v52z" fill="var(--brand-text-primary-default)" opacity="0.55" />
      <path d="M0 130v-18l58-20 46 18 60-24 46 20 30-12v36z" fill="var(--brand-text-primary-hover)" opacity="0.85" />
    </svg>
  )
}
