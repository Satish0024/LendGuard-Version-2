import { ASSET_CLASS_ORDER, resolveChartPalette, resolveColorForAsset } from './chartPalette.js'

export function parseMoney(value) {
  if (value == null || value === '—' || value === '') return 0
  const n = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatPct(n) {
  return `${n.toFixed(2)}%`
}

export function planCode(meta) {
  return String(meta || '').match(/ID\s+(\d+)/i)?.[1] || '—'
}

export function planBalance(plan) {
  return parseMoney(plan.stats?.balance || plan.details?.balance)
}

export function planVested(plan) {
  return parseMoney(plan.stats?.vested || plan.details?.vested)
}

export function isSummaryPlan(plan) {
  if (plan.badge === 'Not Eligible' || plan.badgeClass === 'muted' || plan.cardClass === 'ineligible') {
    return false
  }
  return planBalance(plan) > 0
}

export function hasAccountSummary(participant) {
  return (participant?.plans || []).some(isSummaryPlan)
}

// Some funds hold more than one asset type (e.g. a target-date or balanced
// fund blends stock and bond), so each asset class maps to an array of the
// categories it's made up of rather than a single label.
const ASSET_CATEGORY = {
  'U.S. Equity': ['Stock'],
  'Sector Equity': ['Stock'],
  'Allocation': ['Stock', 'Bond'],
  'International Equity': ['Stock'],
  'Alternative': ['Other'],
  'Commodities': ['Other'],
  'Taxable Bond': ['Bond'],
  'Municipal Bond': ['Bond'],
  'Money Market': ['Other'],
  'Miscellaneous': ['Other'],
  'Nontraditional Equity': ['Stock'],
  Balanced: ['Stock', 'Bond']
}

export function assetCategory(asset) {
  return ASSET_CATEGORY[asset] || ['Other']
}

function toRows(items, total) {
  if (!items?.length || total <= 0) return []
  const colors = resolveChartPalette()
  return items
    .filter((item) => item.amount > 0)
    .map((item, i) => ({
      id: `${item.name}-${i}`,
      name: item.name,
      asset: item.asset || '',
      amount: item.amount,
      vested: item.vested ?? 0,
      price: item.price ?? null,
      units: item.units ?? null,
      color: item.asset ? resolveColorForAsset(item.asset, i) : colors[i % colors.length],
      pct: total ? (item.amount / total) * 100 : 0
    }))
}

// Groups investment rows by their asset class (e.g. "U.S. Equity") into one
// row per class, each carrying its member investments so the summary table
// can expand a class row to show the underlying holdings — same accordion
// pattern as the Investments tab, just grouped a level up.
function toAssetClassRows(investments, total) {
  const rows = toRows(investments, total)
  if (!rows.length) return []
  const byClass = new Map()
  rows.forEach((row) => {
    const key = row.asset || 'Other'
    if (!byClass.has(key)) byClass.set(key, [])
    byClass.get(key).push(row)
  })
  return Array.from(byClass.entries())
    .sort((a, b) => {
      const ai = ASSET_CLASS_ORDER.indexOf(a[0])
      const bi = ASSET_CLASS_ORDER.indexOf(b[0])
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    })
    .map(([asset, members], i) => {
    const amount = members.reduce((sum, m) => sum + m.amount, 0)
    return {
      id: `class-${asset}-${i}`,
      name: asset,
      asset,
      amount,
      color: resolveColorForAsset(asset, i),
      pct: total ? (amount / total) * 100 : 0,
      members
    }
  })
}

function roundCents(n) {
  return Math.round(n * 100) / 100
}

function roundUnits(n) {
  return Math.round(n * 1000) / 1000
}

// Each source is invested across the same funds as the plan allocation, so
// expanding a source lists those holdings (NAV, units, dollars) the same
// way an asset-class row does — scaled to that source's share of the plan.
function toSourceRows(sources, investments, total) {
  const sourceRows = toRows(sources, total)
  const holdings = toRows(investments, total)
  return sourceRows.map((source) => {
    const share = total > 0 ? source.amount / total : 0
    const members = holdings
      .map((holding) => ({
        ...holding,
        id: `${source.id}--${holding.id}`,
        amount: roundCents(holding.amount * share),
        units: holding.units != null ? roundUnits(holding.units * share) : null
      }))
      .filter((holding) => holding.amount > 0)

    if (members.length) {
      const drift = roundCents(source.amount - members.reduce((sum, m) => sum + m.amount, 0))
      members[members.length - 1].amount = roundCents(members[members.length - 1].amount + drift)
    }

    return { ...source, members }
  })
}

export function summaryForPlan(plan) {
  const balance = planBalance(plan)
  const vested = planVested(plan)
  return {
    balance,
    vested,
    sources: toSourceRows(plan.sources, plan.investments, balance),
    investments: toRows(plan.investments, balance),
    assetClasses: toAssetClassRows(plan.investments, balance)
  }
}
