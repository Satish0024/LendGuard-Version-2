import { useMemo, useState, Fragment } from 'react'
import { Icon } from '../lib/icons'
import SortIconCore from '../components/common/SortIcon.jsx'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { HOLDINGS, PLAN_FUNDS, PLAN_STATS, PLAN_COL_LABELS, cumSeries, labelsFor, ENDS, money } from '../data/portfolio'
import { ASSET_CLASS_ORDER, chartTokenForAsset } from '../lib/chartPalette.js'
import { useTheme } from '../context/ThemeContext.jsx'
import FundDetailDialog from '../components/common/FundDetailDialog.jsx'
import ChartLegend from '../components/common/ChartLegend.jsx'
import Select, { Option } from '../components/common/Select.jsx'
import { exportCsv } from '../lib/exportCsv.js'
import '../styles/documents.css'
import '../styles/portfolio.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// 'si' (Since inception) stays out of the graph's own period toggle — it's
// still available as a column in the holdings table below.
const PERIODS = ['1m', '3m', '6m', 'ytd', '1y', '3y', '5y', '10y']
const PERIOD_LABELS = { '1m': '1M', '3m': '3M', '6m': '6M', ytd: 'YTD', '1y': '1Y', '3y': '3Y', '5y': '5Y', '10y': '10Y' }

// Each series carries its own dash pattern, not just a color — a
// color-blind or low-vision reader (or a black-and-white printout) can
// still tell the lines apart. Chart.js applies `dash` as `borderDash`; the
// legend draws the same colour + dash as a line sample so the key matches.
// Color is resolved from the live CSS custom properties at render time
// (see the `chartOptions`-style useMemo below) instead of being a fixed
// hex here -- Chart.js/canvas can't read var() directly, so it needs the
// browser-resolved value, but the value itself still tracks --brand/
// --green/--red/--amber like everything else in the app.
// Asset-class lines are told apart by colour + a dash pattern that is unique
// per series (and never solid, which is reserved for Total portfolio). Only
// Total draws point markers: 4 marker shapes across 12 lines had to repeat.
const DASHES = [[12, 3], [7, 4], [2, 3], [9, 3, 2, 3], [4, 3], [1, 3], [6, 3], [8, 4], [3, 2, 1, 2], [5, 4], [10, 3]]

const SERIES_META = [
  { key: 'total', label: 'Total portfolio', token: '--neutral-text-default', dash: [], markers: true },
  ...ASSET_CLASS_ORDER.map((label, i) => ({
    key: `ac-${i}`,
    label,
    token: chartTokenForAsset(label, i),
    dash: DASHES[i] || [4, 3],
    endScale: [1, 0.78, 0.92, 1.08, 0.95, 0.34, 0.28, 0.41, 0.68, 0.55, 0.18][i],
    seed: 11 + i * 3
  }))
]

const COLS = {
  name: { key: 'name', type: 'text' },
  asset: { key: 'asset', type: 'text' },
  cusip: { key: 'cusip', type: 'text' },
  return: { key: 'returnPct', type: 'num' },
  invested: { key: 'invested', type: 'num' },
  current: { key: 'current', type: 'num' },
  gain: { key: 'gain', type: 'num' },
  units: { key: 'units', type: 'num' }
}

export default function Portfolio() {
  const { theme } = useTheme()
  const [tab, setTab] = useState('overview')
  const [openFund, setOpenFund] = useState(null)
  const [period, setPeriod] = useState('1y')
  const [planId, setPlanId] = useState('lendguard-401k')
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [ytdDir, setYtdDir] = useState(null)
  const [holdingsQuery, setHoldingsQuery] = useState('')
  const [planQuery, setPlanQuery] = useState('')
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(SERIES_META.map((s) => [s.key, s.key === 'total' || s.key === 'ac-0' || s.key === 'ac-5' || s.key === 'ac-8']))
  )
  const plan = PLAN_STATS[planId]

  // Re-read the resolved CSS variables whenever the theme flips so the grid
  // lines and axis labels stay legible instead of the old hardcoded
  // light-mode-only palette.
  const chartOptions = useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    return buildChartOptions({
      axisTitle: css.getPropertyValue('--neutral-text-subtle').trim() || '#5C5C6B',
      gridLine: css.getPropertyValue('--neutral-border-light').trim() || '#787887',
      tick: css.getPropertyValue('--neutral-text-subtle-light').trim() || '#5C5C6B'
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // Same brand-derived-not-fixed-hex reasoning as chartOptions above.
  const SERIES = useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    return SERIES_META.map((s) => ({ ...s, color: css.getPropertyValue(s.token).trim() || '#5C5C6B' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  const holdings = useMemo(() => {
    // #97: live search on investment name or CUSIP, applied before sorting.
    const q = holdingsQuery.trim().toLowerCase()
    const rows = HOLDINGS.filter((h) => !q || h.name.toLowerCase().includes(q) || h.cusip.toLowerCase().includes(q))
    if (!sort.key) return rows
    const col = COLS[sort.key]
    rows.sort((a, b) => {
      const av = a[col.key]
      const bv = b[col.key]
      if (col.type === 'num') return (av - bv) * sort.dir
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * sort.dir
    })
    return rows
  }, [sort, holdingsQuery])

  const planFunds = useMemo(() => {
    const q = planQuery.trim().toLowerCase()
    const rows = PLAN_FUNDS.filter((f) => !q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q))
    if (!ytdDir) return rows
    rows.sort((a, b) => (parsePct(a.ytd) - parsePct(b.ytd)) * ytdDir)
    return rows
  }, [ytdDir, planQuery])

  // #95 / #96: export exactly what the table shows (current search + sort).
  const exportHoldings = () =>
    exportCsv(
      'my-portfolio-investments.csv',
      ['Investment name', 'Asset class', 'CUSIP', 'Fund return YTD', 'Invested balance', 'Current balance', 'Gain/loss', 'Unit balance'],
      holdings.map((h) => [h.name, h.asset, h.cusip, `${h.returnPct.toFixed(2)}%`, money(h.invested), money(h.current), money(h.gain), h.units.toFixed(2)])
    )
  const exportPlanFunds = () =>
    exportCsv(
      'plan-investments.csv',
      ['Fund name', 'Category', ...PLAN_COL_LABELS],
      planFunds.flatMap((f) => [
        [f.name, f.cat, f.ytd, f.y1, f.y5, f.y10, f.si, f.exp, f.perK, f.fees],
        [f.bench, 'Benchmark', ...f.b, '—', '—', 'N/A']
      ])
    )

  const chart = useMemo(() => {
    const ends = ENDS[period]
    const labs = labelsFor(period)
    const n = labs.length
    const equity = cumSeries(n, ends.equity, 1)
    const bond = cumSeries(n, ends.bond, 4)
    const target = cumSeries(n, ends.target, 7)
    const total = equity.map((e, i) => Math.round((e * 0.64 + bond[i] * 0.23 + target[i] * 0.13) * 100) / 100)
    const dataByKey = { total, equity, bond, target }
    SERIES_META.forEach((s) => {
      if (dataByKey[s.key]) return
      dataByKey[s.key] = cumSeries(n, ends.equity * (s.endScale ?? 0.7), s.seed ?? 9)
    })
    return {
      labels: labs,
      datasets: SERIES.map((s) => line(s, dataByKey[s.key], s.key === 'total' ? 0 : undefined, !visible[s.key]))
    }
  }, [period, visible, SERIES])

  const toggleSeries = (key) => {
    setVisible((v) => {
      if (key === 'total') {
        return { ...v, total: !v.total }
      }
      return { ...v, [key]: !v[key] }
    })
  }

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir * -1 } : { key, dir: 1 }))
  }

  const SortIcon = ({ active, dir }) => <SortIconCore direction={active ? (dir === 1 ? 'asc' : 'desc') : null} />

  const toggleYtd = () => {
    setYtdDir((d) => (d === 1 ? -1 : 1))
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head-row">
          <h1>Investment portfolio</h1>
          <div className="plan-select-wrap">
            <Select
              className="plan-select"
              aria-label="Select plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {Object.entries(PLAN_STATS).map(([id, p]) => (
                <Option key={id} value={id}>
                  {p.label}
                </Option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Portfolio views">
        <button
          type="button"
          role="tab"
          id="portfolio-tab-overview"
          aria-selected={tab === 'overview'}
          aria-controls="portfolio-panel-overview"
          tabIndex={tab === 'overview' ? 0 : -1}
          className={`tab${tab === 'overview' ? ' on' : ''}`}
          onClick={() => setTab('overview')}
        >
          My portfolio
        </button>
        <button
          type="button"
          role="tab"
          id="portfolio-tab-investments"
          aria-selected={tab === 'investments'}
          aria-controls="portfolio-panel-investments"
          tabIndex={tab === 'investments' ? 0 : -1}
          className={`tab${tab === 'investments' ? ' on' : ''}`}
          onClick={() => setTab('investments')}
        >
          Plan investments
        </button>
      </div>
      <div className="page-body">
        {tab === 'overview' && (
          <div className="tab-panel on" role="tabpanel" id="portfolio-panel-overview" aria-labelledby="portfolio-tab-overview">
            <div className="overview-row">
              <aside className="overall-card" aria-label="Portfolio summary">
                <div className="overall-body">
                  <div className="stat-block hero">
                    <div className="stat-k">Current balance</div>
                    <div className="stat-v">{plan.current}</div>
                  </div>
                  <div className="overall-grid">
                    <div className="stat-block">
                      <div className="stat-k">Invested balance</div>
                      <div className="stat-v">{plan.invested}</div>
                    </div>
                    <div className="stat-block">
                      <div className="stat-k">Gain / loss</div>
                      <div className="stat-v pos">{plan.gain}</div>
                    </div>
                    <div className="stat-block">
                      <div className="stat-k">YTD return</div>
                      <div className="stat-v pos" aria-label={`${plan.ret} year to date`}>
                        {plan.ret}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
              <section className="chart-panel">
                <div className="chart-top">
                  <h2>Asset class performance</h2>
                </div>
                {/* Filter-chip group re-scaling the one chart above, not a
                    tabs widget switching between separate panels -- same
                    correction as Enrich.jsx's topic filter (role="tablist"
                    needs role="tab" children plus a tabpanel, neither of
                    which existed here). aria-pressed is the correct toggle
                    semantics for this pattern. */}
                <div className="period" aria-label="Chart period">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={period === p ? 'on' : ''}
                      aria-pressed={period === p}
                      onClick={() => setPeriod(p)}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
                <div className="chart-wrap">
                  {/* Same fix as AccountSummary's donut: Chart.js sets
                      role="img" automatically with no label (axe-core:
                      role-img-alt). The holdings table below already has
                      the real per-fund figures. */}
                  <Line data={chart} options={chartOptions} aria-label="Asset class performance line chart -- see the investments table below for exact figures" />
                </div>
                <ChartLegend
                  label="Asset classes"
                  items={SERIES.map((s) => ({
                    key: s.key,
                    label: s.label,
                    color: s.color,
                    dash: s.dash,
                    stroke: `var(${s.token})`,
                    checked: visible[s.key]
                  }))}
                  onToggle={toggleSeries}
                />
              </section>
            </div>
            <section className="section">
              <h2>Investments</h2>
              <div className="table-tools">
                {/* Same search field + plain secondary button as Documents. */}
                <div className="doc-field table-search">
                  <label className="field-label" htmlFor="holdingsQuery-search">
                    Search
                  </label>
                  <input
                    id="holdingsQuery-search"
                    type="text"
                    value={holdingsQuery}
                    onChange={(e) => setHoldingsQuery(e.target.value)}
                    placeholder="Search investment name or CUSIP"
                  />
                </div>
                <button type="button" className="btn btn-secondary table-export" onClick={exportHoldings}>
                  Export
                </button>
              </div>
              <div className="table-wrap t-stack-wrap">
                <table className="holdings-table t-stack">
                  <thead>
                    <tr>
                      {[
                        ['name', 'Investment name', 'text'],
                        ['asset', 'Asset class', 'text'],
                        ['cusip', 'CUSIP', 'text'],
                        ['return', 'Fund return YTD', 'num']
                      ].map(([key, label, type]) => {
                        const active = sort.key === key
                        return (
                          <th scope="col"
                            key={key}
                            className={`sortable${type === 'num' ? ' num' : ''}${active ? (sort.dir === 1 ? ' asc' : ' desc') : ''}`}
                            aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                          >
                            <button type="button" onClick={() => toggleSort(key)}>
                              {label}
                              <SortIcon active={active} dir={sort.dir} />
                            </button>
                          </th>
                        )
                      })}
                      {[
                        ['invested', 'Invested balance', 'num'],
                        ['current', 'Current balance', 'num'],
                        ['gain', 'Gain/loss', 'num'],
                        ['units', 'Unit balance', 'num']
                      ].map(([key, label, type]) => {
                        const active = sort.key === key
                        return (
                          <th scope="col"
                            key={key}
                            className={`sortable${type === 'num' ? ' num' : ''}${active ? (sort.dir === 1 ? ' asc' : ' desc') : ''}`}
                            aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                          >
                            <button type="button" onClick={() => toggleSort(key)}>
                              {label}
                              <SortIcon active={active} dir={sort.dir} />
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {!holdings.length && (
                      <tr>
                        <td colSpan={8} className="table-empty">No record(s) found</td>
                      </tr>
                    )}
                    {holdings.map((h) => (
                      <tr key={h.cusip}>
                        {/* The fund name is the card's title on mobile, so it
                            stays unlabelled and full width rather than sitting
                            opposite an "Investment name" label. */}
                        <td className="name">
                          <button type="button" className="text-link fund-link" onClick={() => setOpenFund(h)}>
                            {h.name}
                          </button>
                        </td>
                        <td data-label="Asset class">{h.asset}</td>
                        <td className="muted" data-label="CUSIP">{h.cusip}</td>
                        <td className="num pos" data-label="Fund return YTD">{h.returnPct.toFixed(2)}%</td>
                        <td className="num" data-label="Invested balance">{money(h.invested)}</td>
                        <td className="num" data-label="Current balance">{money(h.current)}</td>
                        <td className="num pos" data-label="Gain/loss">+{money(h.gain).slice(1)}</td>
                        <td className="num" data-label="Unit balance">{h.units.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {tab === 'investments' && (
          <div className="tab-panel on" role="tabpanel" id="portfolio-panel-investments" aria-labelledby="portfolio-tab-investments">
            <section className="section">
              <h2>Plan investments</h2>
              <p className="sub">Browse and compare the funds available within the retirement plan.</p>
              <div className="table-tools">
                {/* Same search field + plain secondary button as Documents. */}
                <div className="doc-field table-search">
                  <label className="field-label" htmlFor="planQuery-search">
                    Search
                  </label>
                  <input
                    id="planQuery-search"
                    type="text"
                    value={planQuery}
                    onChange={(e) => setPlanQuery(e.target.value)}
                    placeholder="Search investment name or category"
                  />
                </div>
                <button type="button" className="btn btn-secondary table-export" onClick={exportPlanFunds}>
                  Export
                </button>
              </div>
              <div className="table-wrap t-stack-wrap">
                <table className="plan-table t-stack">
                  <thead>
                    <tr>
                      <th scope="col" className="fund-col" rowSpan={2}>
                        Fund name / category
                      </th>
                      <th scope="col"
                        rowSpan={2}
                        className={`sortable${ytdDir === 1 ? ' asc' : ytdDir === -1 ? ' desc' : ''}`}
                        aria-sort={ytdDir === 1 ? 'ascending' : ytdDir === -1 ? 'descending' : 'none'}
                      >
                        <button type="button" onClick={toggleYtd}>
                          Return YTD
                          <SortIcon active={!!ytdDir} dir={ytdDir} />
                        </button>
                      </th>
                      <th scope="col" className="group-h" colSpan={4}>
                        Average annual total return
                      </th>
                      <th scope="col" className="group-h" colSpan={2}>
                        Total expense ratio
                      </th>
                      <th scope="col" rowSpan={2}>
                        Shareholder-
                        <br />
                        type fees
                      </th>
                    </tr>
                    <tr>
                      <th scope="col" className="sub-h">1 yr.</th>
                      <th scope="col" className="sub-h">5 yr.</th>
                      <th scope="col" className="sub-h">10 yr.</th>
                      <th scope="col" className="sub-h">Since inception</th>
                      <th scope="col" className="sub-h">As a %</th>
                      <th scope="col" className="sub-h">Per $1,000</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!planFunds.length && (
                      <tr>
                        <td colSpan={9} className="table-empty">No record(s) found</td>
                      </tr>
                    )}
                    {planFunds.map((f) => (
                      <Fragment key={f.name}>
                        <tr className="fund-row">
                          <td className="fund-cell">
                            <button type="button" className="text-link fund-link fund-title" onClick={() => setOpenFund(f)}>
                              {f.name}
                            </button>
                            <div className="fund-meta">
                              <span className="fund-cat">{f.cat}</span>
                            </div>
                          </td>
                          {[f.ytd, f.y1, f.y5, f.y10, f.si, f.exp, f.perK, f.fees].map((v, i) => (
                            <td key={`${f.name}-v-${i}`} data-label={PLAN_COL_LABELS[i]}>
                              {v}
                            </td>
                          ))}
                        </tr>
                        <tr className="bench-row group-end">
                          <td className="fund-cell">
                            <div className="fund-title">{f.bench}</div>
                          </td>
                          {/* Benchmarks only carry the return columns, so the
                              trailing expense/fee cells are padded out to keep
                              both rows aligned to the same header set. */}
                          {[...f.b, '—', '—', 'N/A'].map((v, i) => (
                            <td key={`${f.name}-b-${i}`} data-label={PLAN_COL_LABELS[i]}>
                              {v}
                            </td>
                          ))}
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      {openFund && (
        <FundDetailDialog
          name={openFund.name}
          onClose={() => setOpenFund(null)}
          fields={[
            { label: 'Asset class / category', value: openFund.asset || openFund.cat },
            { label: 'CUSIP', value: openFund.cusip },
            { label: 'Fund return YTD', value: openFund.returnPct != null ? `${openFund.returnPct.toFixed(2)}%` : openFund.ytd },
            { label: 'Current balance', value: openFund.current != null ? money(openFund.current) : undefined },
            { label: 'Unit balance', value: openFund.units != null ? openFund.units.toFixed(2) : undefined },
            { label: '1 yr. return', value: openFund.y1 },
            { label: '5 yr. return', value: openFund.y5 },
            { label: '10 yr. return', value: openFund.y10 },
            { label: 'Total expense ratio', value: openFund.exp }
          ]}
        />
      )}
    </>
  )
}

function parsePct(value) {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

// `series` also carries a dash pattern and point shape (see SERIES above)
// so each line reads distinctly without relying on color alone.
function line(series, data, order, hidden) {
  return {
    label: series.label,
    data,
    borderColor: series.color,
    backgroundColor: series.color,
    borderDash: series.dash,
    tension: 0.3,
    pointRadius: series.markers ? 4 : 0,
    pointHoverRadius: 5,
    pointHitRadius: 8,
    pointBackgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--core-color-surface-default').trim() || '#FFFFFF',
    pointBorderColor: series.color,
    pointBorderWidth: 2,
    borderWidth: 2.5,
    order,
    hidden
  }
}

// Chart.js reads plain color strings, not CSS variables, so its palette has
// to be rebuilt whenever the theme flips rather than defined once at import
// time — this factory is called from the component with each render's
// resolved --neutral-text-subtle/--neutral-border-light/--neutral-text-subtle-light values.
// Chart.js requires numeric px — keep in sync with --text-xs-size (12px)
// and --font-weight-semibold (600) from the design-system type scale.
const CHART_AXIS_FONT = { size: 12, weight: '600', family: 'Inclusive Sans, sans-serif' }

function buildChartOptions({ axisTitle, gridLine, tick }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    clip: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 8, right: 8 } },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}%` } }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Period of return',
          color: axisTitle,
          font: CHART_AXIS_FONT,
          padding: { top: 8 }
        },
        grid: { display: true, color: gridLine, borderDash: [4, 4], drawTicks: false },
        border: { display: false },
        ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
      },
      y: {
        min: 0,
        grace: '8%',
        title: {
          display: true,
          text: 'Rate of return (%)',
          color: axisTitle,
          font: CHART_AXIS_FONT,
          padding: { bottom: 6 }
        },
        grid: { color: gridLine, borderDash: [4, 4] },
        border: { display: false },
        ticks: { color: tick, stepSize: 5, callback: (v) => v + '%' }
      }
    }
  }
}
