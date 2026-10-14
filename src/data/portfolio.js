export const PLAN_STATS = {
  'lendguard-401k': {
    label: 'LendGuard Employees Savings and Retirement 401(k) Plan',
    current: '$100,416.00',
    invested: '$90,500.00',
    gain: '+$9,916.00',
    ret: '8.00%'
  },
  'lendguard-profit-sharing': {
    label: 'LendGuard Profit Sharing and Employee Ownership Plan',
    current: '$42,180.00',
    invested: '$38,750.00',
    gain: '+$3,430.00',
    ret: '6.45%'
  }
}

export const HOLDINGS = [
  { name: 'Vanguard Institutional Index Fund Admiral Shares', asset: 'U.S. Equity', cusip: '922908728', returnPct: 14.82, invested: 25000, current: 28705, gain: 3705, units: 74.32 },
  { name: 'Fidelity 500 Index Fund Institutional Class', asset: 'U.S. Equity', cusip: '315911750', returnPct: 14.95, invested: 18000, current: 20691, gain: 2691, units: 52.18 },
  { name: 'Vanguard Total Bond Market Index Fund Admiral Shares', asset: 'Taxable Bond', cusip: '921937835', returnPct: 5.18, invested: 15000, current: 15777, gain: 777, units: 186.42 },
  { name: 'Fidelity U.S. Bond Index Fund Institutional Premium', asset: 'Taxable Bond', cusip: '315911727', returnPct: 5.27, invested: 12500, current: 13159, gain: 659, units: 124.63 },
  { name: 'Vanguard Target Retirement 2050 Trust Select', asset: 'Allocation', cusip: '92202E805', returnPct: 10.42, invested: 20000, current: 22084, gain: 2084, units: 168.57 }
]

export const PLAN_FUNDS = [
  { name: 'Vanguard Institutional Index Fund Admiral Shares', cat: 'Large Cap Blend', risk: 'aggressive', ytd: '8.62%', y1: '14.82%', y5: '13.91%', y10: '11.87%', si: '10.74%', exp: '0.04%', perK: '$0.40', fees: '0.00%', bench: 'Benchmark - S&P 500 Index', b: ['9.10%', '15.10%', '14.18%', '12.40%', '11.20%'] },
  { name: 'Fidelity 500 Index Fund Institutional Class', cat: 'Large Cap Blend', risk: 'aggressive', ytd: '8.71%', y1: '14.95%', y5: '14.02%', y10: '11.96%', si: '10.86%', exp: '0.02%', perK: '$0.20', fees: '0.00%', bench: 'Benchmark - S&P 500 Index', b: ['9.10%', '15.10%', '14.18%', '12.40%', '11.20%'] },
  { name: 'Vanguard Total Bond Market Index Fund Admiral Shares', cat: 'Intermediate Bond', risk: 'conservative', ytd: '3.12%', y1: '5.18%', y5: '0.86%', y10: '2.14%', si: '4.02%', exp: '0.05%', perK: '$0.50', fees: '0.00%', bench: 'Benchmark - Bloomberg U.S. Aggregate Bond', b: ['3.40%', '5.32%', '1.04%', '2.28%', '4.20%'] },
  { name: 'Fidelity U.S. Bond Index Fund Institutional Premium', cat: 'Intermediate Bond', risk: 'conservative', ytd: '3.21%', y1: '5.27%', y5: '0.94%', y10: '2.21%', si: '4.15%', exp: '0.03%', perK: '$0.30', fees: '0.00%', bench: 'Benchmark - Bloomberg U.S. Aggregate Bond', b: ['3.40%', '5.32%', '1.04%', '2.28%', '4.20%'] },
  { name: 'Vanguard Target Retirement 2050 Trust Select', cat: 'Target-Date', risk: 'moderate', ytd: '6.15%', y1: '10.42%', y5: '8.92%', y10: '—', si: '7.86%', exp: '0.08%', perK: '$0.80', fees: '0.00%', bench: 'Benchmark - Target Retirement Composite', b: ['6.40%', '10.71%', '9.21%', '8.50%', '8.10%'] }
]

export const ENDS = {
  '1m': { equity: 2.4, bond: 0.9, target: 1.9 },
  '3m': { equity: 5.1, bond: 1.8, target: 3.6 },
  '6m': { equity: 8.8, bond: 2.9, target: 5.9 },
  ytd: { equity: 8.6, bond: 3.1, target: 6.2 },
  '1y': { equity: 15.2, bond: 5.2, target: 10.4 },
  '3y': { equity: 12.4, bond: 2.4, target: 8.1 },
  '5y': { equity: 14.0, bond: 2.1, target: 8.9 },
  '10y': { equity: 11.9, bond: 2.8, target: 8.4 },
  si: { equity: 10.8, bond: 4.1, target: 7.9 }
}

export function cumSeries(n, endPct, seed) {
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1)
    const ease = Math.pow(t, 0.85)
    const wobble = Math.sin((i + 1 + seed) * 0.85) * 0.35 + Math.cos((i + seed) * 0.4) * 0.2
    const v = endPct * ease + wobble * t * (1 - t) * 2
    out.push(Math.round(Math.max(0, v) * 100) / 100)
  }
  out[0] = 0
  out[n - 1] = endPct
  return out
}

export function labelsFor(period) {
  const now = new Date(2026, 7, 19)
  const fmtMonth = (d) => d.toLocaleDateString('en-US', { month: 'short' })
  const fmtDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fmtYear = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  const configs = {
    '1m': { n: 5, step: (d, i) => { d.setDate(d.getDate() - (4 - i) * 7) }, fmt: fmtDay },
    '3m': { n: 7, step: (d, i) => { d.setDate(d.getDate() - (6 - i) * 14) }, fmt: fmtDay },
    '6m': { n: 7, step: (d, i) => { d.setMonth(d.getMonth() - (6 - i)) }, fmt: fmtMonth },
    ytd: { n: 9, step: (d, i) => { d.setMonth(0 + i) }, fmt: fmtMonth },
    '1y': { n: 13, step: (d, i) => { d.setMonth(d.getMonth() - (12 - i)) }, fmt: fmtMonth },
    '3y': { n: 13, step: (d, i) => { d.setMonth(d.getMonth() - (12 - i) * 3) }, fmt: fmtYear },
    '5y': { n: 11, step: (d, i) => { d.setMonth(d.getMonth() - (10 - i) * 6) }, fmt: fmtYear },
    '10y': { n: 11, step: (d, i) => { d.setFullYear(d.getFullYear() - (10 - i)) }, fmt: fmtYear },
    si: { n: 13, step: (d, i) => { d.setFullYear(d.getFullYear() - (12 - i) * 2) }, fmt: fmtYear }
  }
  const c = configs[period] || configs['1y']
  return Array.from({ length: c.n }, (_, i) => {
    const d = new Date(now)
    c.step(d, i)
    return c.fmt(d)
  })
}

export const money = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// Plan-table value columns in render order, shared by a fund row and its
// benchmark row, and by both copies of the table (Portfolio's "Plan
// investments" tab and the Investments funds modal). The table's own <thead>
// splits these across two rows with colspan groups, which a stacked mobile
// card can't reuse, so each cell carries its column name as a data-label.
export const PLAN_COL_LABELS = [
  'Return YTD',
  '1 yr.',
  '5 yr.',
  '10 yr.',
  'Since inception',
  'As a %',
  'Per $1,000',
  'Shareholder-type fees'
]
