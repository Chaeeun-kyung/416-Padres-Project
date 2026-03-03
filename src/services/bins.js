import binConfig from '../data/mock/binConfig.json'

const DEFAULT_DEMOGRAPHIC_COLORS = ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39']
const DEFAULT_GENERAL_COLORS = ['#2166ac', '#4393c3', '#92c5de', '#f7f7f7', '#f4a582', '#d6604d', '#b2182b']
const METRIC_LABELS = {
  pct_dem_lead: 'Dem Lead % (2024)',
  white_pct: 'White Population %',
  black_pct: 'Black Population %',
  latino_pct: 'Latino Population %',
  native_american_pct: 'Native American Population %',
  asian_pct: 'Asian Population %',
}

function isDemographicMetric(metricKey) {
  return metricKey !== 'pct_dem_lead' && String(metricKey).endsWith('_pct')
}

function formatPctLabel(value) {
  const percent = value * 100
  const roundedToTenth = Math.round(percent * 10) / 10
  if (Number.isInteger(roundedToTenth)) {
    return `${roundedToTenth.toFixed(0)}%`
  }
  return `${roundedToTenth.toFixed(1)}%`
}

function buildEqualBins(minValue, maxValue, count = 7) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [{ min: 0, max: 1, label: '0% to 100%' }]
  }

  const normalizedMin = Number(minValue)
  const normalizedMax = maxValue <= minValue ? minValue + 0.01 : Number(maxValue)
  const width = (normalizedMax - normalizedMin) / count

  const bins = []
  for (let i = 0; i < count; i += 1) {
    const start = normalizedMin + (width * i)
    const isLastBin = i === count - 1
    const end = isLastBin ? normalizedMax : normalizedMin + (width * (i + 1))
    bins.push({
      min: start,
      max: end,
      label: `${formatPctLabel(start)} to ${formatPctLabel(end)}`,
    })
  }

  if (!bins.length) {
    return [{ min: normalizedMin, max: normalizedMax, label: `${formatPctLabel(normalizedMin)} to ${formatPctLabel(normalizedMax)}` }]
  }

  return bins
}

export function resolveBinsForMetric(stateCode, metricKey, features, explicitValues = null) {
  const configured = binConfig?.[stateCode]?.[metricKey]

  const values = (explicitValues?.length
    ? explicitValues
    : (features ?? []).map((feature) => Number(feature?.properties?.[metricKey]))
  ).filter((value) => Number.isFinite(value))

  const minValue = values.length ? Math.min(...values) : 0
  const maxValue = values.length ? Math.max(...values) : 1
  const colors = isDemographicMetric(metricKey) ? DEFAULT_DEMOGRAPHIC_COLORS : DEFAULT_GENERAL_COLORS

  return {
    bins: buildEqualBins(minValue, maxValue, 7),
    colors,
    metricLabel: configured?.metricLabel ?? METRIC_LABELS[metricKey] ?? metricKey,
    source: 'equal-width',
  }
}

export function getColorForValue(value, bins, colors) {
  if (!Number.isFinite(value)) {
    return '#cbd5e1'
  }

  for (let i = 0; i < bins.length; i += 1) {
    const bin = bins[i]
    const isLast = i === bins.length - 1
    if (value >= bin.min && (isLast ? value <= bin.max : value < bin.max)) {
      return colors[i] ?? colors[colors.length - 1] ?? '#334155'
    }
  }

  return value < bins[0].min ? colors[0] : colors[colors.length - 1]
}
