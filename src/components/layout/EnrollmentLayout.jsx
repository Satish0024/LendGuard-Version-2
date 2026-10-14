import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import '../../styles/enrollment.css'

const STEPS = [
  { n: 1, title: 'Deferral rate', body: 'Specify payroll deferral rates and set up auto increase.', to: '/enrollment' },
  {
    n: 2,
    title: 'Investment election',
    body: 'Choose the investments and its allocation percentages',
    to: '/enrollment/investments'
  },
  { n: 3, title: 'Summary', body: 'Review the elections before confirming.', to: '/enrollment/summary' }
]

function currentStep(pathname) {
  if (pathname.includes('summary')) return 3
  if (pathname.includes('investment')) return 2
  return 1
}

export default function EnrollmentLayout() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const current = currentStep(pathname)
  const returnTo = params.get('return')?.startsWith('/') && !params.get('return')?.startsWith('//') ? params.get('return') : ''

  return (
    <>
      <Header />
      <div className="layout">
        <Sidebar />
        <aside className="steps">
          <Link to={returnTo || '/'} className="text-link back">
            ‹ {returnTo ? 'Back to plan' : 'Back'}
          </Link>
          <h1>{returnTo ? 'Update elections' : 'Plan enrollment'}</h1>
          <div className="divider" />
          {STEPS.map((step) => {
            const complete = step.n < current
            const isCurrent = step.n === current
            const cls = `step${complete ? ' complete' : ''}${isCurrent ? ' current' : ''}`
            return (
              <div
                key={step.n}
                className={cls}
                onClick={() => step.to && navigate({ pathname: step.to, search })}
                onKeyDown={(e) => {
                  if (!step.to) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate({ pathname: step.to, search })
                  }
                }}
                role={step.to ? 'button' : undefined}
                tabIndex={step.to ? 0 : undefined}
              >
                <div className="rail">
                  <div className="num">{complete ? '✓' : step.n}</div>
                  {step.n < STEPS.length && <i className="rail-line" />}
                </div>
                <div className="body">
                  {/* Was an <h3>, but this is a step-list label (nav, not
                      page content) that rendered ahead of the page's real
                      <h2> below, skipping a heading level -- flagged by
                      axe-core's heading-order rule. A styled <p> keeps the
                      exact same look without claiming a heading role. */}
                  <p className="step-title">{step.title}</p>
                  <p>{step.body}</p>
                  {isCurrent && (
                    <span className="step-status">
                      <span className="spinner" /> In progress
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </aside>
        <main className="main">
          <div className="detail-head">
            <div className="eyebrow">Plan details</div>
            <h2>401(k) Company Plan High Returns</h2>
            <div className="plan-meta">
              <span>
                Plan ID <b>124542</b>
              </span>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </>
  )
}
