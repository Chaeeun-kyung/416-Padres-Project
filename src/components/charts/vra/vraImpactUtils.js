const DEFAULT_GROUP_LABEL_OVERRIDES = {
  white_pct: 'White',
  black_pct: 'Black',
  latino_pct: 'Latino',
  asian_pct: 'Asian',
}

function normalizeStateCode(stateCode) {
  return String(stateCode ?? '').trim().toUpperCase()
}

function getScopedMockState(statesMap, stateCode) {
  const safeMap = statesMap ?? {}
  const code = normalizeStateCode(stateCode)
  if (code && safeMap[code]) return safeMap[code]
  if (safeMap.DEFAULT) return safeMap.DEFAULT
  const [firstKey] = Object.keys(safeMap)
  return firstKey ? safeMap[firstKey] : null
}

function groupLabel(key, overrides = DEFAULT_GROUP_LABEL_OVERRIDES) {
  return overrides[key] ?? key
}

function findLatinoGroupKey(options) {
  const safeOptions = Array.isArray(options) ? options : []
  const latino = safeOptions.find((option) => (
    /latino|hisp/i.test(String(option?.key ?? ''))
    || /latino|hispanic/i.test(String(option?.label ?? ''))
  ))
  return latino?.key ?? safeOptions[0]?.key ?? ''
}

function toSafeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeShares(values) {
  return (Array.isArray(values) ? values : []).map((value) => toSafeNumber(value))
}

function buildPlanEffectiveCounts(distributionsByDistrict, districtOrder, threshold) {
  const order = Array.isArray(districtOrder) ? districtOrder : []
  if (!order.length) return []

  const shareRows = order
    .map((districtId) => normalizeShares(distributionsByDistrict?.[districtId]))
    .filter((values) => values.length > 0)
  if (!shareRows.length) return []

  const planCount = Math.min(...shareRows.map((values) => values.length))
  if (!Number.isFinite(planCount) || planCount <= 0) return []

  const counts = []
  for (let planIndex = 0; planIndex < planCount; planIndex += 1) {
    let effectiveCount = 0
    for (const shares of shareRows) {
      if (toSafeNumber(shares[planIndex]) >= threshold) {
        effectiveCount += 1
      }
    }
    counts.push(effectiveCount)
  }
  return counts
}

function countEnactedEffective(enactedByDistrict, threshold) {
  const enactedValues = Object.values(enactedByDistrict ?? {})
  return enactedValues.reduce((total, value) => (
    total + (toSafeNumber(value) >= threshold ? 1 : 0)
  ), 0)
}

function proportionAtLeast(values, threshold) {
  const arr = Array.isArray(values) ? values : []
  if (!arr.length) return 0
  const hits = arr.filter((value) => toSafeNumber(value) >= threshold).length
  return hits / arr.length
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function buildMockHistogramCountsByDistrict(districtCount, mode, histogramConfig, planCount) {
  const n = Math.max(1, Number(districtCount) || 1)
  const profile = histogramConfig?.profiles?.[mode] ?? {}
  const centerRatio = Number(profile?.centerRatio ?? (mode === 'constrained' ? 0.86 : 0.67))
  const center = clampInt(n * centerRatio, 0, n)
  const offsets = Array.isArray(profile?.offsets) ? profile.offsets.map((value) => Number(value)) : [-2, -1, 0, 1, 2]
  const weights = Array.isArray(profile?.weights) ? profile.weights.map((value) => Number(value)) : (
    mode === 'constrained'
      ? [0.03, 0.17, 0.48, 0.25, 0.07]
      : [0.08, 0.23, 0.34, 0.24, 0.11]
  )

  const targets = offsets.map((offset, index) => {
    const raw = weights[index] * planCount
    const floored = Math.floor(raw)
    return {
      districtCount: clampInt(center + offset, 0, n),
      floored,
      frac: raw - floored,
    }
  })

  const counts = new Map()
  for (const row of targets) {
    counts.set(row.districtCount, (counts.get(row.districtCount) ?? 0) + row.floored)
  }

  const baseTotal = Array.from(counts.values()).reduce((sum, value) => sum + value, 0)
  let remainder = planCount - baseTotal
  const priority = [...targets].sort((left, right) => right.frac - left.frac)
  let index = 0
  while (remainder > 0 && priority.length > 0) {
    const key = priority[index % priority.length].districtCount
    counts.set(key, (counts.get(key) ?? 0) + 1)
    remainder -= 1
    index += 1
  }

  return counts
}

function expandCountsToHistogramSamples(countMap) {
  const values = []
  for (const [key, count] of countMap.entries()) {
    const n = Math.max(0, Number(count) || 0)
    for (let i = 0; i < n; i += 1) {
      values.push(Number(key))
    }
  }
  return values
}

function buildGroupStats(groupKey, groupRecord, districtCount, cvapPct, effectiveShareThreshold) {
  const raceBlindPayload = groupRecord?.variants?.raceBlind
  const vraPayload = groupRecord?.variants?.vraConstrained
  const districtOrder = raceBlindPayload?.districtOrder ?? vraPayload?.districtOrder ?? []

  const rbCounts = buildPlanEffectiveCounts(raceBlindPayload?.distributions, districtOrder, effectiveShareThreshold)
  const vraCounts = buildPlanEffectiveCounts(vraPayload?.distributions, districtOrder, effectiveShareThreshold)
  const enactedCount = countEnactedEffective(raceBlindPayload?.enacted ?? vraPayload?.enacted, effectiveShareThreshold)
  const roughProportionalityTarget = Math.ceil(Math.max(0, cvapPct) * Math.max(0, districtCount))
  const jointTarget = Math.max(enactedCount, roughProportionalityTarget)

  return {
    groupKey,
    groupLabel: groupRecord?.label ?? groupLabel(groupKey),
    cvapPct,
    districtCount,
    enactedCount,
    roughProportionalityTarget,
    jointTarget,
    rbCounts,
    vraCounts,
    metrics: {
      enactedThreshold: {
        raceBlind: proportionAtLeast(rbCounts, enactedCount),
        vraConstrained: proportionAtLeast(vraCounts, enactedCount),
      },
      roughProportionality: {
        raceBlind: proportionAtLeast(rbCounts, roughProportionalityTarget),
        vraConstrained: proportionAtLeast(vraCounts, roughProportionalityTarget),
      },
      joint: {
        raceBlind: proportionAtLeast(rbCounts, jointTarget),
        vraConstrained: proportionAtLeast(vraCounts, jointTarget),
      },
    },
  }
}

function buildThresholdMockStatsByGroup(stateCode, thresholdMock) {
  const stateEntry = getScopedMockState(thresholdMock?.states, stateCode)
  const groups = stateEntry?.groups ?? {}
  const out = {}

  for (const [groupKey, groupData] of Object.entries(groups)) {
    const districtCount = toSafeNumber(groupData?.districtCount)
    const cvapPct = toSafeNumber(groupData?.cvapPct)
    const enactedCount = toSafeNumber(groupData?.enactedCount)
    const roughProportionalityTarget = toSafeNumber(groupData?.roughProportionalityTarget)
    const jointTarget = toSafeNumber(groupData?.jointTarget)
    const metrics = groupData?.metrics ?? {}

    out[groupKey] = {
      groupKey,
      groupLabel: groupData?.groupLabel ?? groupLabel(groupKey),
      cvapPct,
      districtCount,
      enactedCount,
      roughProportionalityTarget,
      jointTarget,
      rbCounts: [],
      vraCounts: [],
      metrics: {
        enactedThreshold: {
          raceBlind: toSafeNumber(metrics?.enactedThreshold?.raceBlind),
          vraConstrained: toSafeNumber(metrics?.enactedThreshold?.vraConstrained),
        },
        roughProportionality: {
          raceBlind: toSafeNumber(metrics?.roughProportionality?.raceBlind),
          vraConstrained: toSafeNumber(metrics?.roughProportionality?.vraConstrained),
        },
        joint: {
          raceBlind: toSafeNumber(metrics?.joint?.raceBlind),
          vraConstrained: toSafeNumber(metrics?.joint?.vraConstrained),
        },
      },
    }
  }

  return out
}

function buildBoxMockStats(stateCode, boxWhiskerMock) {
  const stateEntry = getScopedMockState(boxWhiskerMock?.states, stateCode)
  const groups = stateEntry?.groups ?? {}
  const defaultDistrictCount = toSafeNumber(stateEntry?.districtCount)
  const out = []

  for (const [groupKey, groupData] of Object.entries(groups)) {
    const rbCounts = normalizeShares(groupData?.raceBlindCounts).map((value) => Math.round(value))
    const vraCounts = normalizeShares(groupData?.vraConstrainedCounts).map((value) => Math.round(value))
    const districtCount = Math.max(
      1,
      toSafeNumber(groupData?.districtCount) || defaultDistrictCount || 1,
      ...rbCounts,
      ...vraCounts,
    )
    const enactedCount = toSafeNumber(groupData?.enactedCount)
    const cvapPct = toSafeNumber(groupData?.cvapPct)
    const roughProportionalityTarget = Math.ceil(Math.max(0, cvapPct) * districtCount)
    const jointTarget = Math.max(enactedCount, roughProportionalityTarget)

    out.push({
      groupKey,
      groupLabel: groupData?.label ?? groupLabel(groupKey),
      cvapPct,
      districtCount,
      enactedCount,
      roughProportionalityTarget,
      jointTarget,
      rbCounts,
      vraCounts,
      metrics: {
        enactedThreshold: {
          raceBlind: proportionAtLeast(rbCounts, enactedCount),
          vraConstrained: proportionAtLeast(vraCounts, enactedCount),
        },
        roughProportionality: {
          raceBlind: proportionAtLeast(rbCounts, roughProportionalityTarget),
          vraConstrained: proportionAtLeast(vraCounts, roughProportionalityTarget),
        },
        joint: {
          raceBlind: proportionAtLeast(rbCounts, jointTarget),
          vraConstrained: proportionAtLeast(vraCounts, jointTarget),
        },
      },
    })
  }

  return out
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

function formatTemplate(template, value) {
  return String(template ?? '').replace('{value}', String(value))
}

export {
  DEFAULT_GROUP_LABEL_OVERRIDES,
  normalizeStateCode,
  getScopedMockState,
  groupLabel,
  findLatinoGroupKey,
  toSafeNumber,
  normalizeShares,
  buildPlanEffectiveCounts,
  countEnactedEffective,
  proportionAtLeast,
  clampInt,
  buildMockHistogramCountsByDistrict,
  expandCountsToHistogramSamples,
  buildGroupStats,
  buildThresholdMockStatsByGroup,
  buildBoxMockStats,
  formatPercent,
  formatTemplate,
}
