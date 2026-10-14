import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { Icon } from '../lib/icons'
import { faArrowLeft, faChevronDown, faDatabase, faChartPie } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { useSortableRows } from '../hooks/useSortableRows'
import SortTh from '../components/common/SortTh.jsx'
import {
  assetCategory,
  formatMoney,
  formatPct,
  isSummaryPlan,
  planBalance,
  planCode,
  planVested,
  summaryForPlan
} from '../lib/accountSummary'

const CATEGORY_CLASS = { Stock: 'is-stock', Bond: 'is-bond', Other: 'is-other' }

// Funds are priced once per business day, not live — showing when that
// price was struck matters for a NAV figure to be trustworthy.
const NAV_AS_OF = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function formatUnits(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
import '../styles/account-summary.css'

ChartJS.register(ArcElement, Tooltip)

// The old literal "Investments" tab (per-fund rows) was removed — the
// asset-class-grouped view now carries the "Investments" label instead,
// since that's the view participants actually want when they click it.
// Icons use the app's shared Font Awesome set (see lib/icons) -- these two
// were still referencing pre-migration Lucide components (Database,
// PieChart) that no longer exist, which threw at render.
const TABS = [
  { id: 'sources', label: 'Sources', icon: faDatabase },
  { id: 'assetclass', label: 'Investments', icon: faChartPie }
]

export default function AccountSummary() {
  const { participant } = useParticipant()
  const [params] = useSearchParams()
  const plans = useMemo(
    () => participant.plans.filter(isSummaryPlan),
    [participant]
  )
  const requested = params.get('plan')
  const fallback = plans[0]?.id
  const [planId, setPlanId] = useState(
    plans.some((p) => p.id === requested) ? requested : fallback
  )
  const [tab, setTab] = useState('sources')
  const [active, setActive] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)

  const plan = plans.find((p) => p.id === planId) || plans[0]
  const summary = useMemo(
    () => (plan ? summaryForPlan(plan) : { balance: 0, vested: 0, sources: [], investments: [], assetClasses: [] }),
    [plan]
  )
  const rows = tab === 'sources' ? summary.sources : tab === 'investments' ? summary.investments : summary.assetClasses
  const highlight = rows[active] || null
  // Sorting is display-only -- it reorders a copy for the table, not
  // `rows` itself, so the chart (built from `rows` in its original
  // order) and the hover-highlight-by-index below stay correct
  // regardless of how the table is currently sorted.
  const { sortedRows, sortKey, sortDir, toggleSort } = useSortableRows(rows)

  // Segments stay full-color regardless of hover -- no dimming/fade effect
  // on the other slices, per feedback that the hover treatment felt like
  // an unwanted animation.
  const chart = useMemo(() => {
    if (!rows.length) return null
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.amount),
          backgroundColor: rows.map((r) => r.color),
          borderWidth: 0,
          spacing: 0,
          hoverOffset: 0,
          borderRadius: 0
        }
      ]
    }
  }, [rows])

  const options = useMemo(
    () => ({
      cutout: '68%',
      maintainAspectRatio: false,
      layout: { padding: 0 },
      // No animated transition on hover/redraw -- segments and the
      // center label update instantly instead of tweening.
      animation: false,
      hover: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = rows[ctx.dataIndex]
              if (!row) return ''
              return ` ${formatMoney(row.amount)}  ${formatPct(row.pct)}`
            }
          }
        }
      },
      onHover: (_, elements) => {
        const next = elements[0]?.index ?? null
        setActive((prev) => (prev === next ? prev : next))
      }
    }),
    [rows]
  )

  const empty = !rows.length

  return (
    <div className="page-body as-page">
      <div className="hi-bar">
        <div>
          <Link to="/" className="text-link pr-back">
            <Icon icon={faArrowLeft} size={16} />
            Dashboard
          </Link>
          <h1>Account summary</h1>
          <p className="pr-intro">View balances by sources or by investments</p>
        </div>
      </div>

      <div className="as-shell">
        <nav className="as-plans" aria-label="Plans">
          {plans.length === 0 ? (
            <p className="as-plans-empty">No plans with a balance to show.</p>
          ) : (
            plans.map((item) => {
            const on = item.id === plan.id
            const bal = planBalance(item)
            const vest = planVested(item)
            return (
              <button
                key={item.id}
                type="button"
                className={on ? 'on' : ''}
                onClick={() => {
                  setPlanId(item.id)
                  setActive(null)
                  setExpandedRow(null)
                }}
              >
                <div className="as-plan-top">
                  <strong>{item.name}</strong>
                  <span className={`plan-badge ${item.badgeClass || ''}`}>{item.badge}</span>
                </div>
                <div className="as-plan-meta">
                  Plan ID {planCode(item.meta)} · Type {item.type}
                </div>
                <div className="as-plan-stats">
                  <div>
                    <span>Account balance</span>
                    <b>{formatMoney(bal)}</b>
                  </div>
                  <div>
                    <span>Vested balance</span>
                    <b className="vested">{formatMoney(vest)}</b>
                  </div>
                </div>
              </button>
            )
          })
          )}
        </nav>

        {plan ? (
          <section className="panel as-main">
          {/* Plan name, account balance, and vested balance are dropped here —
              they're already shown for this plan in the left-side panel. */}

          <div className="as-tabs" role="tablist" aria-label="Balance view">
            {TABS.map((item) => {
              const on = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={on ? 'on' : ''}
                  onClick={() => {
                    setTab(item.id)
                    setActive(null)
                    setExpandedRow(null)
                  }}
                >
                  <span className="pr-nav-ico" aria-hidden="true">
                    <Icon icon={item.icon} size={15} />
                  </span>
                  {item.label}
                </button>
              )
            })}
          </div>

          {empty ? (
            <div className="as-empty">
              <p>No balance to show for this plan yet.</p>
            </div>
          ) : (
            <>
              <div className="as-viz">
                <div className="as-donut" onMouseLeave={() => setActive(null)}>
                  {/* Chart.js sets role="img" on the canvas automatically
                      but no label, so screen readers announced an empty
                      image (axe-core: role-img-alt). The full breakdown is
                      already in the table below (real accessible data),
                      so this just needs a short description, not a
                      duplicate of every value. */}
                  <Doughnut
                    data={chart}
                    options={options}
                    aria-label={`${tab === 'sources' ? 'Sources' : 'Investments'} balance breakdown chart -- see the table below for exact figures`}
                  />
                  <div className="as-donut-center">
                    <small>{highlight ? highlight.name : 'Account balance'}</small>
                    <b>{formatMoney(highlight ? highlight.amount : summary.balance)}</b>
                    <em>{highlight ? formatPct(highlight.pct) : '100.00%'}</em>
                  </div>
                </div>
              </div>

              <div className="as-table-wrap">
                <table className={tab === 'investments' || tab === 'assetclass' || tab === 'sources' ? 'as-table-accordion' : ''}>
                  <thead>
                    <tr>
                      <SortTh
                        label={tab === 'sources' ? 'Source' : tab === 'assetclass' ? 'Asset class' : 'Investment'}
                        sortKeyName="name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      {tab === 'investments' ? (
                        <SortTh label="Units" sortKeyName="units" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="num" />
                      ) : null}
                      <SortTh label="Balance" sortKeyName="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="num" />
                      <SortTh
                        label={tab === 'investments' ? 'Election Percentage' : 'Percent'}
                        sortKeyName="pct"
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        className="num"
                      />
                      <th scope="col" className="as-chev-col">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, displayIndex) => {
                      const i = rows.indexOf(row)
                      const isInvestment = tab === 'investments'
                      const isAssetClass = tab === 'assetclass'
                      const isSource = tab === 'sources'
                      const isExpandable = isInvestment || isAssetClass || isSource
                      const isOpen = isExpandable && expandedRow === row.id
                      const showHoldings = isOpen && (isSource || isAssetClass)
                      // Striping follows the row's display position, not CSS nth-child: an
                      // expanded row injects a detail <tr> into the same tbody, which flips
                      // the parity of every row below it as sources open and close.
                      const zebra = displayIndex % 2 === 1 ? 'as-row-alt' : ''
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={`${active === i ? 'on' : ''} ${isOpen ? 'as-row-open' : ''} ${isExpandable ? 'as-row-expandable' : ''} ${zebra}`.trim()}
                            onMouseEnter={() => setActive(i)}
                            onMouseLeave={() => setActive(null)}
                            // Whole row is a mouse target; the chevron button in the
                            // last cell is the keyboard / screen-reader control.
                            onClick={isExpandable ? () => setExpandedRow(isOpen ? null : row.id) : undefined}
                          >
                            <td>
                              <span className="as-row-name-cell">
                                <span className="as-swatch" style={{ background: row.color }} aria-hidden="true" />
                                {row.name}
                              </span>
                            </td>
                            {isInvestment ? (
                              <td className="num">{row.units != null ? formatUnits(row.units) : '—'}</td>
                            ) : null}
                            <td className="num">{formatMoney(row.amount)}</td>
                            <td className="num">{formatPct(row.pct)}</td>
                            <td className="as-chev-cell">
                              {isExpandable ? (
                                <button
                                  type="button"
                                  className="as-row-toggle"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedRow(isOpen ? null : row.id)
                                  }}
                                  aria-expanded={isOpen}
                                  aria-controls={`${row.id}-detail`}
                                  aria-label={`${isOpen ? 'Hide' : 'Show'} holdings for ${row.name}`}
                                >
                                  <Icon icon={faChevronDown} size={15} className="as-row-chevron" aria-hidden="true" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          {isOpen && isInvestment ? (
                            <tr className="as-row-detail" id={`${row.id}-detail`}>
                              <td colSpan={5}>
                                <div className="as-detail-grid">
                                  <div>
                                    <span>Asset class</span>
                                    <b>{row.asset || '—'}</b>
                                  </div>
                                  <div>
                                    <span>Category</span>
                                    <b className="as-cat-badges">
                                      {assetCategory(row.asset).map((cat) => (
                                        <span key={cat} className={`as-cat-badge ${CATEGORY_CLASS[cat] || 'is-other'}`}>
                                          {cat}
                                        </span>
                                      ))}
                                    </b>
                                  </div>
                                  <div>
                                    <span>Price per unit</span>
                                    <b>{row.price != null ? formatMoney(row.price) : '—'}</b>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          {showHoldings ? (
                            <tr className="as-row-detail" id={`${row.id}-detail`}>
                              <td colSpan={4}>
                                {/* Funds used to live only under Investments; Sources now
                                    expands to the same NAV / units / balance rows. */}
                                <p className="as-class-asof">NAV as of {NAV_AS_OF}</p>
                                <ul className="as-class-members">
                                  {(row.members || []).map((m) => (
                                    <li key={m.id}>
                                      <span className="as-class-member-name">
                                        {m.name}
                                        {m.price != null && <small className="as-class-member-nav">NAV {formatMoney(m.price)}</small>}
                                      </span>
                                      <span className="as-class-member-units">
                                        {m.units != null ? `${formatUnits(m.units)} units` : ''}
                                      </span>
                                      <b>{formatMoney(m.amount)}</b>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      {tab === 'investments' ? <td /> : null}
                      <td className="num">{formatMoney(summary.balance)}</td>
                      <td className="num">100.00%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </section>
        ) : (
          <section className="panel as-main">
            <div className="as-empty">
              <p>No plans with a balance to show.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
