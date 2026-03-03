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
// Bin count = round(sqrt(unique integer % values)), then clamp to [4, 7].
const MIN_BIN_COUNT = 4
const MAX_BIN_COUNT = 7
const DEMOGRAPHIC_NICE_STEPS = [5, 10, 20, 25, 50]

function isDemographicMetric(metricKey) {
  return metricKey !== 'pct_dem_lead' && String(metricKey).endsWith('_pct')
}

function chooseBinCount(minPct, maxPct, values) {
  const rangePct = Math.max(1, maxPct - minPct)
  const uniqueIntegerPctCount = new Set(values.map((value) => Math.round(value * 100))).size
  const dataDrivenCount = Math.round(Math.sqrt(uniqueIntegerPctCount || 1))
  const clampedCount = Math.max(MIN_BIN_COUNT, Math.min(MAX_BIN_COUNT, dataDrivenCount))
  return Math.max(1, Math.min(clampedCount, rangePct))
}

function chooseNiceStep(rangePct, targetBinCount, candidateSteps) {
  const safeRange = Math.max(1, rangePct)
  const safeTarget = Math.max(1, targetBinCount)
  const rawStep = safeRange / safeTarget

  let best = null
  for (let i = 0; i < candidateSteps.length; i += 1) {
    const step = candidateSteps[i]
    const binCount = Math.ceil(safeRange / step)
    if (binCount < MIN_BIN_COUNT || binCount > MAX_BIN_COUNT) {
      continue
    }

    const score = Math.abs(binCount - safeTarget) * 10 + Math.abs(step - rawStep)
    if (!best || score < best.score) {
      best = { step, score }
    }
  }

  if (best) {
    return best.step
  }

  for (let i = 0; i < candidateSteps.length; i += 1) {
    const step = candidateSteps[i]
    if (Math.ceil(safeRange / step) <= MAX_BIN_COUNT) {
      return step
    }
  }
  return candidateSteps[candidateSteps.length - 1]
}

function formatPctLabel(value) {
  const percent = value * 100
  const roundedToTenth = Math.round(percent * 10) / 10
  if (Number.isInteger(roundedToTenth)) {
    return `${roundedToTenth.toFixed(0)}%`
  }
  return `${roundedToTenth.toFixed(1)}%`
}

function buildEqualBins(values, metricKey) {
  const numericValues = (values ?? []).filter((value) => Number.isFinite(value))
  if (!numericValues.length) {
    return [{ min: 0, max: 1, label: '0% to 100%' }]
  }

  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const demographic = isDemographicMetric(metricKey)

  let minPct = demographic ? 0 : (minValue === 0 ? 0 : Math.floor(minValue * 100))
  let maxPct = Math.ceil(maxValue * 100)
  if (maxPct <= minPct) {
    maxPct = minPct + 1
  }

  const count = chooseBinCount(minPct, maxPct, numericValues)
  const rangePct = maxPct - minPct
  const stepPct = demographic
    ? chooseNiceStep(rangePct, count, DEMOGRAPHIC_NICE_STEPS)
    : Math.max(1, Math.ceil(rangePct / count))
  const normalizedMaxPct = demographic ? Math.ceil(maxPct / stepPct) * stepPct : maxPct
  const maxBins = demographic ? Number.POSITIVE_INFINITY : count

  const binsWithCounts = []
  let startPct = minPct
  while (startPct < normalizedMaxPct && binsWithCounts.length < maxBins) {
    const isLastBin = binsWithCounts.length === maxBins - 1 || startPct + stepPct >= normalizedMaxPct
    const endPct = isLastBin ? normalizedMaxPct : Math.min(normalizedMaxPct, startPct + stepPct)
    binsWithCounts.push({
      min: startPct / 100,
      max: endPct / 100,
      label: `${formatPctLabel(startPct / 100)} to ${formatPctLabel(endPct / 100)}`,
      count: 0,
    })
    startPct = endPct
  }

  if (!binsWithCounts.length) {
    return [{
      min: minPct / 100,
      max: normalizedMaxPct / 100,
      label: `${formatPctLabel(minPct / 100)} to ${formatPctLabel(normalizedMaxPct / 100)}`,
    }]
  }

  numericValues.forEach((value) => {
    for (let i = 0; i < binsWithCounts.length; i += 1) {
      const bin = binsWithCounts[i]
      const isLast = i === binsWithCounts.length - 1
      if (value >= bin.min && (isLast ? value <= bin.max : value < bin.max)) {
        bin.count += 1
        break
      }
    }
  })

  const nonEmptyBins = binsWithCounts
    .filter((bin) => bin.count > 0)
    .map(({ min, max, label }) => ({ min, max, label }))

  return nonEmptyBins.length
    ? nonEmptyBins
    : [{ min: binsWithCounts[0].min, max: binsWithCounts[0].max, label: binsWithCounts[0].label }]
}

function selectColorsForBins(baseColors, count) {
  if (!count) return []
  if (count === 1) {
    return [baseColors[Math.floor(baseColors.length / 2)] ?? '#334155']
  }

  return Array.from({ length: count }, (_, index) => {
    const colorIndex = Math.round((index * (baseColors.length - 1)) / (count - 1))
    return baseColors[colorIndex] ?? baseColors[baseColors.length - 1] ?? '#334155'
  })
}

export function resolveBinsForMetric(metricKey, features, explicitValues = null) {
  const values = (explicitValues?.length
    ? explicitValues
    : (features ?? []).map((feature) => Number(feature?.properties?.[metricKey]))
  ).filter((value) => Number.isFinite(value))

  const baseColors = isDemographicMetric(metricKey)
    ? DEFAULT_DEMOGRAPHIC_COLORS
    : metricKey === 'pct_dem_lead'
      ? [...DEFAULT_GENERAL_COLORS].reverse()
      : DEFAULT_GENERAL_COLORS
  const bins = buildEqualBins(values, metricKey)

  return {
    bins,
    colors: selectColorsForBins(baseColors, bins.length),
    metricLabel: METRIC_LABELS[metricKey] ?? metricKey,
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
