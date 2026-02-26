import binConfig from '../data/mock/binConfig.json'

const DEFAULT_DEMOGRAPHIC_COLORS = ['#fff9de', '#fff2bc', '#ffe996', '#ffe16f', '#f9cb48', '#e5ad2f', '#c7861b']
const DEFAULT_GENERAL_COLORS = ['#f7efe0', '#edd9b8', '#e3c38f', '#d7ac66', '#c99545', '#af7830', '#8f5f23']
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

function buildEqualBins(minValue, maxValue, count = 7) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [{ min: 0, max: 1, label: '0% to 100%' }]
  }

  const minPct = minValue === 0 ? 0 : Math.floor(minValue * 100)
  const maxPct = Math.ceil(maxValue * 100)
  const normalizedMaxPct = maxPct <= minPct ? minPct + 1 : maxPct
  const rangePct = normalizedMaxPct - minPct
  const stepPct = Math.max(1, Math.ceil(rangePct / count))

  const bins = []
  let startPct = minPct
  while (startPct < normalizedMaxPct && bins.length < count) {
    const isLastBin = bins.length === count - 1
    const endPct = isLastBin ? normalizedMaxPct : Math.min(normalizedMaxPct, startPct + stepPct)
    bins.push({
      min: startPct / 100,
      max: endPct / 100,
      label: `${startPct}% to ${endPct}%`,
    })
    startPct = endPct
  }

  if (!bins.length) {
    return [{ min: minPct / 100, max: normalizedMaxPct / 100, label: `${minPct}% to ${normalizedMaxPct}%` }]
  }

  return bins
}

export function resolveBinsForMetric(stateCode, metricKey, features, explicitValues = null) {
  const configured = binConfig?.[stateCode]?.[metricKey]
  if (configured?.bins?.length) {
    return {
      bins: configured.bins,
      colors: configured.colors?.length
        ? configured.colors
        : (isDemographicMetric(metricKey) ? DEFAULT_DEMOGRAPHIC_COLORS : DEFAULT_GENERAL_COLORS),
      metricLabel: configured.metricLabel ?? metricKey,
      source: 'mock-config',
    }
  }

  const values = (explicitValues?.length
    ? explicitValues
    : (features ?? []).map((feature) => Number(feature?.properties?.[metricKey]))
  ).filter((value) => Number.isFinite(value))

  const minValue = values.length ? Math.min(...values) : 0
  const maxValue = values.length ? Math.max(...values) : 1

  return {
    bins: buildEqualBins(minValue, maxValue, 7),
    colors: isDemographicMetric(metricKey) ? DEFAULT_DEMOGRAPHIC_COLORS : DEFAULT_GENERAL_COLORS,
    metricLabel: METRIC_LABELS[metricKey] ?? metricKey,
    source: 'dynamic-fallback',
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
