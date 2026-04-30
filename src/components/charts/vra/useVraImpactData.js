import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { fetchStateSummary } from '../../../services/summaryApi'
import thresholdMock from '../../../data/mock/vraImpactThresholdMock.json'
import boxWhiskerMock from '../../../data/mock/vraImpactBoxWhiskerMock.json'
import histogramMock from '../../../data/mock/vraImpactHistogramMock.json'
import {
  buildBoxMockStats,
  buildGroupStats,
  buildThresholdMockStatsByGroup,
  findLatinoGroupKey,
  groupLabel,
  normalizeStateCode,
  toSafeNumber,
} from './vraImpactUtils'

const EFFECTIVE_SHARE_THRESHOLD = Number(thresholdMock?.meta?.effectiveShareThreshold ?? 0.5)
const ENSEMBLE_KEYS = ['raceBlind', 'vraConstrained']
const panelCache = new Map()

async function loadVraImpactState(stateCode) {
  const normalizedStateCode = normalizeStateCode(stateCode)
  if (!normalizedStateCode) return null

  if (panelCache.has(normalizedStateCode)) {
    return panelCache.get(normalizedStateCode)
  }

  const summary = await fetchStateSummary(normalizedStateCode)
  const bootstrapResponse = await axios.get(`/api/states/${normalizedStateCode}/ensembles/boxplot`)
  const availableGroupsRaw = Array.isArray(bootstrapResponse.data?.availableGroups)
    ? bootstrapResponse.data.availableGroups
    : []
  const groupOptions = availableGroupsRaw
    .filter((option) => option?.key)
    .map((option) => ({ key: option.key, label: option.label ?? groupLabel(option.key) }))

  const requests = []
  for (const group of groupOptions) {
    for (const ensembleKey of ENSEMBLE_KEYS) {
      requests.push(
        axios.get(`/api/states/${normalizedStateCode}/ensembles/boxplot`, {
          params: { group: group.key, ensemble: ensembleKey },
        })
          .then((response) => ({ groupKey: group.key, ensembleKey, payload: response.data ?? null })),
      )
    }
  }

  const loaded = await Promise.all(requests)
  const groupData = {}
  for (const group of groupOptions) {
    groupData[group.key] = { label: group.label, variants: {} }
  }

  for (const row of loaded) {
    if (!groupData[row.groupKey]) continue
    groupData[row.groupKey].variants[row.ensembleKey] = row.payload
  }

  const payload = {
    stateCode: normalizedStateCode,
    summary,
    districtCount: Number(summary?.districts ?? 0),
    groupOptions,
    groupData,
  }
  panelCache.set(normalizedStateCode, payload)
  return payload
}

function useVraImpactData(stateCode) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [dataset, setDataset] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!stateCode) {
        setDataset(null)
        setError('')
        return
      }

      setLoading(true)
      setError('')
      try {
        const payload = await loadVraImpactState(stateCode)
        if (cancelled) return
        setDataset(payload)
        const defaultLatinoKey = findLatinoGroupKey(payload?.groupOptions)
        setSelectedGroup((current) => {
          if (payload?.groupOptions?.some((option) => option.key === current)) return current
          return defaultLatinoKey
        })
      } catch (loadError) {
        if (cancelled) return
        setDataset(null)
        const message = axios.isAxiosError(loadError)
          ? loadError.response?.data?.message ?? loadError.message
          : 'Failed to load VRA impact data.'
        setError(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [stateCode])

  const thresholdMockStatsByGroup = useMemo(
    () => buildThresholdMockStatsByGroup(stateCode, thresholdMock),
    [stateCode],
  )
  const thresholdMockOptions = useMemo(() => (
    Object.values(thresholdMockStatsByGroup).map((groupStats) => ({
      value: groupStats.groupKey,
      label: groupStats.groupLabel ?? groupLabel(groupStats.groupKey),
    }))
  ), [thresholdMockStatsByGroup])

  const fallbackGroupOptions = useMemo(() => (
    (dataset?.groupOptions ?? []).map((group) => ({
      value: group.key,
      label: group.label ?? groupLabel(group.key),
    }))
  ), [dataset])

  const effectiveGroupOptions = thresholdMockOptions.length
    ? thresholdMockOptions
    : fallbackGroupOptions

  const histogramGroupKey = String(histogramMock?.groupKey ?? 'latino_pct')
  const defaultGroupFromMock = String(thresholdMock?.defaultGroupKey ?? '')
  const defaultGroupCandidate = (
    effectiveGroupOptions.some((option) => option.value === defaultGroupFromMock)
      ? defaultGroupFromMock
      : (
        findLatinoGroupKey(
          effectiveGroupOptions.map((option) => ({ key: option.value, label: option.label })),
        )
      )
  )
  const effectiveGroup = effectiveGroupOptions.some((group) => group.value === selectedGroup)
    ? selectedGroup
    : defaultGroupCandidate

  const backendStats = useMemo(() => {
    if (!dataset) return []
    const districtCount = Number(dataset.districtCount ?? 0)
    const cvapMap = dataset.summary?.racialEthnicPopulationPct ?? {}

    return Object.entries(dataset.groupData ?? {}).map(([groupKey, groupRecord]) => (
      buildGroupStats(groupKey, groupRecord, districtCount, toSafeNumber(cvapMap?.[groupKey]) / 100, EFFECTIVE_SHARE_THRESHOLD)
    ))
  }, [dataset])

  const mockBoxStats = useMemo(() => buildBoxMockStats(stateCode, boxWhiskerMock), [stateCode])
  const allStats = mockBoxStats.length ? mockBoxStats : backendStats
  const hasAnyRenderableData = Boolean(effectiveGroupOptions.length && allStats.length)

  const selectedStats = thresholdMockStatsByGroup[effectiveGroup]
    ?? allStats.find((row) => row.groupKey === effectiveGroup)
    ?? null
  const latinoStats = allStats.find((row) => row.groupKey === histogramGroupKey)
    ?? allStats.find((row) => row.groupKey === defaultGroupCandidate)
    ?? allStats[0]
    ?? null

  useEffect(() => {
    if (!effectiveGroupOptions.length) return
    setSelectedGroup((current) => {
      if (effectiveGroupOptions.some((option) => option.value === current)) return current
      return defaultGroupCandidate
    })
  }, [effectiveGroupOptions, defaultGroupCandidate])

  return {
    loading,
    error,
    selectedGroup,
    setSelectedGroup,
    effectiveGroup,
    effectiveGroupOptions,
    hasAnyRenderableData,
    selectedStats,
    allStats,
    latinoStats,
  }
}

export { EFFECTIVE_SHARE_THRESHOLD }
export default useVraImpactData
