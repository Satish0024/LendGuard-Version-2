import { BRAND } from '../../config/brand.js'

// App footer, per the CORE design system's Layout & Grid spec:
// copyright/legal on the left, links on the right, wrapping to stack
// on narrow screens rather than truncating either side. Fixed to the
// viewport (not part of the scrolling document) so it's always visible,
// the same way the header is pinned to the top.
// `full`: pages without the sidebar (Enrich, risk check-in) span the whole width.
export default function Footer({ full = false }) {
  const year = new Date().getFullYear()

  return (
    <footer className={`app-footer${full ? ' app-footer--full' : ''}`}>
      <p className="app-footer-copy">&copy; {year} {BRAND.name}.</p>
      <nav className="app-footer-links" aria-label="Legal">
        <a href={`mailto:${BRAND.supportEmail}`}>Privacy</a>
        <a href={`mailto:${BRAND.supportEmail}`}>Terms</a>
      </nav>
    </footer>
  )
}
