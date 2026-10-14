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

// Self-Directed Brokerage (SDB) investments. Same shape as PLAN_FUNDS so the
// fund picker, detail dialog and allocation panels render them unchanged;
// the extra fields carry the brokerage account each one settles into and
// whether that account has been activated yet.
export const SDB_FUNDS = [
  { name: 'Franklin Managed Income Fund - SDB', cat: 'Self-Directed Brokerage', fundType: 'Large Cap', sdb: true, cusip: '354026106', accounts: ['ENROLL04456', 'ENROLL34354'], activated: true, ytd: '5.84%', y1: '9.12%', y5: '6.48%', y10: '5.91%', si: '6.20%', exp: '0.62%', perK: '$6.20', fees: '0.00%', bench: 'Benchmark - Morningstar Moderate Allocation', b: ['5.20%', '8.75%', '6.10%', '5.70%', '6.00%'] },
  { name: 'Columbia Mid Cap Index Fund (NTIAX) - SDB', cat: 'Self-Directed Brokerage', fundType: 'Mid Cap', sdb: true, cusip: '19765P489', accounts: ['ENROLL3456'], activated: true, ytd: '6.71%', y1: '11.40%', y5: '9.86%', y10: '8.92%', si: '9.10%', exp: '0.20%', perK: '$2.00', fees: '0.00%', bench: 'Benchmark - S&P MidCap 400 Index', b: ['6.90%', '11.62%', '10.01%', '9.05%', '9.20%'] },
  { name: 'Fidelity Mid Cap Index Fund (FSMDX) - SDB', cat: 'Self-Directed Brokerage', fundType: 'Mid Cap', sdb: true, cusip: '316146489', accounts: [], activated: false, ytd: '6.92%', y1: '11.88%', y5: '10.12%', y10: '9.40%', si: '9.55%', exp: '0.03%', perK: '$0.30', fees: '0.00%', bench: 'Benchmark - Russell Midcap Index', b: ['7.00%', '12.00%', '10.20%', '9.50%', '9.60%'] },
  { name: 'BNY Mellon Mid Cap Index Shares (PESPX) - SDB', cat: 'Self-Directed Brokerage', fundType: 'Mid Cap', sdb: true, cusip: '05589H107', accounts: [], activated: false, ytd: '6.55%', y1: '11.21%', y5: '9.74%', y10: '8.88%', si: '9.02%', exp: '0.29%', perK: '$2.90', fees: '0.00%', bench: 'Benchmark - S&P MidCap 400 Index', b: ['6.90%', '11.62%', '10.01%', '9.05%', '9.20%'] }
]

// Brokerage accounts on file, shown on Plan details > SDB details.
// "Track Traditional and Roth SDB separately" = Yes adds the Roth row.
export const SDB_ACCOUNTS = [
  { number: '1276235612', type: 'Traditional', updatedOn: '11/21/2025', through: 'SDB account return file' },
  { number: '9856453452', type: 'Roth', updatedOn: '12/12/2025', through: 'jordan.hale@email.com' },
  { number: '1232343122', type: 'Traditional', updatedOn: '01/12/2026', through: 'SDB account return file' },
  { number: '1233167557', type: 'Roth', updatedOn: '02/15/2026', through: 'SDB API upload' }
]

// Election change log for Plan details > History.
export const PLAN_HISTORY = [
  { date: '02/15/2026', change: 'Investment election', detail: 'Pre-Tax and Roth set to own election', by: 'Participant' },
  { date: '01/12/2026', change: 'Self-Directed Brokerage', detail: 'Opted in, Traditional and Roth tracked separately', by: 'Participant' },
  { date: '01/01/2026', change: 'Auto increase', detail: 'Pre-Tax +1% each year until 10%', by: 'Plan rule' },
  { date: '12/12/2025', change: 'Deferral rate', detail: 'Pre-Tax 6%, Roth 2%', by: 'Participant' },
  { date: '11/21/2025', change: 'Enrollment', detail: 'Auto enrolled into the plan', by: 'Plan rule' }
]
