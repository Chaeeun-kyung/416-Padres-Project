export const FEASIBLE_THRESHOLD_MILLIONS = 0.4

export const RACIAL_GROUPS = [
  { key: 'white_pct', label: 'White' },
  { key: 'black_pct', label: 'Black' },
  { key: 'latino_pct', label: 'Latino' },
  { key: 'native_american_pct', label: 'Native American' },
  { key: 'asian_pct', label: 'Asian' },
]

const GROUP_INDEX = RACIAL_GROUPS.reduce((acc, group, idx) => {
  acc[group.key] = idx
  return acc
}, {})

export function getGroupLabel(groupKey) {
  return RACIAL_GROUPS.find((group) => group.key === groupKey)?.label ?? groupKey
}

export function getFeasibleGroupKeys(summary, threshold = FEASIBLE_THRESHOLD_MILLIONS) {
  if (Array.isArray(summary?.feasibleGroupKeys) && summary.feasibleGroupKeys.length) {
    return new Set(summary.feasibleGroupKeys)
  }

  const result = new Set()
  const populations = summary?.racialEthnicPopulationMillions ?? {}
  RACIAL_GROUPS.forEach((group) => {
    const value = Number(populations[group.key] ?? 0)
    if (value >= threshold) {
      result.add(group.key)
    }
  })
  return result
}

export function buildGroupOptions(groupKeys, summary, labelOverrides = {}, options = {}) {
  const { includeOnlyFeasible = false } = options
  const feasible = getFeasibleGroupKeys(summary)
  const keys = [...new Set(groupKeys)]
    .filter((key) => !includeOnlyFeasible || feasible.has(key))
    .sort((a, b) => (GROUP_INDEX[a] ?? 999) - (GROUP_INDEX[b] ?? 999))
  return keys
    .map((key) => {
      const baseLabel = labelOverrides[key] ?? getGroupLabel(key)
      const feasibleSuffix = feasible.has(key) ? ' (Feasible >0.4M)' : ''
      return {
        value: key,
        label: `${baseLabel}${feasibleSuffix}`,
      }
    })
}
