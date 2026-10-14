// Animated books + plant + sparkles illustration for the Learning Portal
// dashboard card. Inline SVG (not a raster asset) so it re-themes with the
// active brand color and can be animated with plain CSS.
export default function LearningIllustration() {
  return (
    <svg className="learn-illo" viewBox="0 0 160 120" role="img" aria-label="Stack of books beside a potted plant">
      <defs>
        <linearGradient id="learn-book-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-text-primary-active)" />
          <stop offset="100%" stopColor="var(--brand-text-primary-default)" />
        </linearGradient>
      </defs>

      <circle className="learn-illo-glow" cx="96" cy="60" r="46" fill="var(--brand-background-primary-light)" />

      <g className="learn-illo-sparkle learn-illo-sparkle-a">
        <path d="M118 20l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" fill="var(--brand-text-primary-active)" />
      </g>
      <g className="learn-illo-sparkle learn-illo-sparkle-b">
        <path d="M138 42l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="var(--brand-text-primary-default)" />
      </g>
      <g className="learn-illo-sparkle learn-illo-sparkle-c">
        <path d="M100 14l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="var(--brand-text-primary-active)" />
      </g>

      <g className="learn-illo-plant">
        <rect x="118" y="78" width="30" height="24" rx="4" fill="var(--brand-text-primary-hover)" />
        <rect x="121" y="74" width="24" height="8" rx="3" fill="var(--brand-text-primary-default)" />
        <path d="M133 74c0-14-14-16-16-28 12 2 18 12 18 22 6-8 4-18-2-24 10 4 14 16 10 26z" fill="var(--semantics-success-text)" />
      </g>

      <g className="learn-illo-books">
        <rect x="70" y="88" width="66" height="16" rx="4" fill="var(--semantics-success-text)" />
        <rect x="70" y="88" width="66" height="4" rx="2" fill="var(--neutral-surface-layer-01)" opacity="0.35" />
        <g transform="rotate(-6 100 76)">
          <rect x="66" y="66" width="68" height="20" rx="5" fill="url(#learn-book-a)" />
          <rect x="66" y="66" width="68" height="5" rx="2.5" fill="var(--neutral-surface-layer-01)" opacity="0.4" />
          <rect x="72" y="76" width="30" height="3" rx="1.5" fill="var(--neutral-surface-layer-01)" opacity="0.55" />
        </g>
      </g>
    </svg>
  )
}
