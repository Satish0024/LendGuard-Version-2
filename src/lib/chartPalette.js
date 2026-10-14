// Shared 11-color chart scale. Index is the contract: the same asset class
// always draws with the same --chart-N on the donut (Account summary) and
// the line chart (Portfolio), so a slice and a series stay visually paired.
export const CHART_TOKEN_COUNT = 11

export const ASSET_CLASS_ORDER = [
  'U.S. Equity',
  'Sector Equity',
  'Allocation',
  'International Equity',
  'Alternative',
  'Commodities',
  'Taxable Bond',
  'Municipal Bond',
  'Money Market',
  'Miscellaneous',
  'Nontraditional Equity'
]

// Only used if the CSS tokens are unreadable (e.g. before styles load);
// mirrors the light-mode --chart-N values (CORE brand/semantic/accent tokens).
const FALLBACKS = [
  '#1F4F8D',
  '#116840',
  '#95590A',
  '#8F212A',
  '#5C6B7A',
  '#8E3B5C',
  '#1E8C82',
  '#CB819E',
  '#2C5F8A',
  '#155F59',
  '#CD8A22'
]

export function chartTokenAt(index) {
  return `--chart-${(index % CHART_TOKEN_COUNT) + 1}`
}

export function chartTokenForAsset(name, fallbackIndex = 0) {
  const i = ASSET_CLASS_ORDER.indexOf(name)
  return chartTokenAt(i >= 0 ? i : fallbackIndex)
}

export function resolveChartPalette() {
  const css = getComputedStyle(document.documentElement)
  return Array.from({ length: CHART_TOKEN_COUNT }, (_, i) => {
    const token = chartTokenAt(i)
    return css.getPropertyValue(token).trim() || FALLBACKS[i]
  })
}

export function resolveChartColor(tokenOrIndex, fallbackIndex = 0) {
  const css = getComputedStyle(document.documentElement)
  const token = typeof tokenOrIndex === 'number' ? chartTokenAt(tokenOrIndex) : tokenOrIndex
  return css.getPropertyValue(token).trim() || FALLBACKS[fallbackIndex % CHART_TOKEN_COUNT]
}

export function resolveColorForAsset(name, fallbackIndex = 0) {
  const colors = resolveChartPalette()
  const i = ASSET_CLASS_ORDER.indexOf(name)
  return colors[i >= 0 ? i : fallbackIndex % colors.length]
}
