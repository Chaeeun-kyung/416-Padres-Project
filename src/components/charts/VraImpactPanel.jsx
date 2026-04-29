import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'
import Info from '../../ui/components/Info'
import SegmentedControl from '../../ui/components/SegmentedControl'
import Select from '../../ui/components/Select'
import { fetchStateSummary } from '../../services/summaryApi'

const EFFECTIVE_SHARE_THRESHOLD = 0.5
const HISTOGRAM_EFFECTIVE_SHARE_THRESHOLD = 0.6
const MOCK_ENSEMBLE_PLAN_COUNT = 5000
const ENSEMBLE_KEYS = ['raceBlind', 'vraConstrained']
const SUBVIEW_OPTIONS = [
  { value: 'threshold', label: 'Threshold Table' },
  { value: 'box', label: 'Box & Whisker' },
  { value: 'hist', label: 'Histogram' },
]
const ENSEMBLE_LABELS = {
  raceBlind: 'Race-Blind',
  vraConstrained: 'VRA-Constrained',
}
const GROUP_LABEL_OVERRIDES = {
  white_pct: 'White',
  black_pct: 'Black',
  latino_pct: 'Latino',
  asian_pct: 'Asian',
}
const panelCache = new Map()

function formatPercent(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
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

function groupLabel(key) {
  return GROUP_LABEL_OVERRIDES[key] ?? key
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function buildMockHistogramCountsByDistrict(districtCount, mode) {
  const n = Math.max(1, Number(districtCount) || 1)
  const center = mode === 'constrained'
    ? clampInt(n * 0.86, 0, n)
    : clampInt(n * 0.67, 0, n)
  const offsets = [-2, -1, 0, 1, 2]
  const weights = mode === 'constrained'
    ? [0.03, 0.17, 0.48, 0.25, 0.07]
    : [0.08, 0.23, 0.34, 0.24, 0.11]

  const targets = offsets.map((offset, index) => {
    const raw = weights[index] * MOCK_ENSEMBLE_PLAN_COUNT
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
  let remainder = MOCK_ENSEMBLE_PLAN_COUNT - baseTotal
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

async function loadVraImpactState(stateCode) {
  const normalizedStateCode = String(stateCode ?? '').trim().toUpperCase()
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

function buildGroupStats(groupKey, groupRecord, districtCount, cvapPct) {
  const raceBlindPayload = groupRecord?.variants?.raceBlind
  const vraPayload = groupRecord?.variants?.vraConstrained
  const districtOrder = raceBlindPayload?.districtOrder ?? vraPayload?.districtOrder ?? []

  const rbCounts = buildPlanEffectiveCounts(raceBlindPayload?.distributions, districtOrder, EFFECTIVE_SHARE_THRESHOLD)
  const vraCounts = buildPlanEffectiveCounts(vraPayload?.distributions, districtOrder, EFFECTIVE_SHARE_THRESHOLD)
  const enactedCount = countEnactedEffective(raceBlindPayload?.enacted ?? vraPayload?.enacted, EFFECTIVE_SHARE_THRESHOLD)
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

function ThresholdTable({ stats }) {
  if (!stats) return <div className="small-text muted-text">No threshold stats available.</div>

  const rows = [
    {
      key: 'enacted',
      metric: `Satisfies enacted effectiveness (>= ${stats.enactedCount} effective districts)`,
      raceBlind: stats.metrics.enactedThreshold.raceBlind,
      vra: stats.metrics.enactedThreshold.vraConstrained,
    },
    {
      key: 'rough',
      metric: `Satisfies rough proportionality (>= ${stats.roughProportionalityTarget} effective districts)`,
      raceBlind: stats.metrics.roughProportionality.raceBlind,
      vra: stats.metrics.roughProportionality.vraConstrained,
    },
    {
      key: 'joint',
      metric: `Satisfies both conditions jointly (>= ${stats.jointTarget})`,
      raceBlind: stats.metrics.joint.raceBlind,
      vra: stats.metrics.joint.vraConstrained,
    },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
        VRA Impact Threshold
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>VRA Impact Threshold</th>
            <th style={{ padding: 8, textAlign: 'right' }}>Race-Blind</th>
            <th style={{ padding: 8, textAlign: 'right' }}>VRA-Constrained</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: 8 }}>{row.metric}</td>
              <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {formatPercent(row.raceBlind)}
              </td>
              <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {formatPercent(row.vra)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MinorityEffectivenessBoxPlot({ allStats }) {
  const preferredGroupOrder = ['latino_pct', 'white_pct']
  const orderedStats = [...(allStats ?? [])].sort((left, right) => {
    const leftRank = preferredGroupOrder.indexOf(left.groupKey)
    const rightRank = preferredGroupOrder.indexOf(right.groupKey)
    const safeLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank
    const safeRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank
    if (safeLeftRank !== safeRightRank) return safeLeftRank - safeRightRank
    return String(left.groupLabel).localeCompare(String(right.groupLabel))
  })

  const traces = []
  for (const stats of orderedStats) {
    const rbX = stats.rbCounts.map(() => stats.groupLabel)
    const vraX = stats.vraCounts.map(() => stats.groupLabel)
    traces.push({
      type: 'box',
      x: rbX,
      y: stats.rbCounts,
      name: 'Race-Blind Ensemble',
      legendgroup: ENSEMBLE_LABELS.raceBlind,
      marker: { color: '#3cbf7a' },
      boxpoints: false,
      showlegend: traces.every((trace) => trace.name !== 'Race-Blind Ensemble'),
    })
    traces.push({
      type: 'box',
      x: vraX,
      y: stats.vraCounts,
      name: 'VRA-Constrained Ensemble',
      legendgroup: ENSEMBLE_LABELS.vraConstrained,
      marker: { color: '#7c4dbe' },
      boxpoints: false,
      showlegend: traces.every((trace) => trace.name !== 'VRA-Constrained Ensemble'),
    })
  }

  const enactedTrace = {
    type: 'scatter',
    mode: 'markers',
    x: orderedStats.map((stats) => stats.groupLabel),
    y: orderedStats.map((stats) => stats.enactedCount),
    name: 'Enacted Plan',
    marker: {
      color: '#dc2626',
      size: 9,
      symbol: 'circle',
      line: { color: '#991b1b', width: 0.6 },
    },
  }

  if (!traces.length) {
    return <div className="small-text muted-text">No minority effectiveness boxplot data available.</div>
  }

  const maxDistricts = Math.max(1, ...orderedStats.map((row) => row.districtCount))
  return (
    <Plot
      data={[...traces, enactedTrace]}
      layout={{
        autosize: true,
        boxmode: 'group',
        margin: { l: 58, r: 10, t: 52, b: 58 },
        title: {
          text: 'Minority Effectiveness Distribution by Ensemble Type',
          x: 0.5,
          xanchor: 'center',
          y: 0.98,
          yanchor: 'top',
          font: { size: 18 },
        },
        showlegend: true,
        xaxis: {
          title: { text: 'Racial / Ethnic Group' },
          automargin: true,
        },
        yaxis: {
          title: { text: 'Number of effective districts' },
          rangemode: 'tozero',
          range: [0, maxDistricts + 0.5],
          dtick: 1,
          automargin: true,
        },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

function MinorityEffectivenessHistogram({ stats }) {
  if (!stats) return <div className="small-text muted-text">No histogram data available.</div>

  const maxDistricts = Math.max(1, stats.districtCount)
  const start = -0.5
  const end = maxDistricts + 0.5
  const nonVraCounts = buildMockHistogramCountsByDistrict(maxDistricts, 'nonVra')
  const constrainedCounts = buildMockHistogramCountsByDistrict(maxDistricts, 'constrained')
  const nonVraSamples = expandCountsToHistogramSamples(nonVraCounts)
  const constrainedSamples = expandCountsToHistogramSamples(constrainedCounts)
  const peakCount = Math.max(
    1,
    ...Array.from(nonVraCounts.values()),
    ...Array.from(constrainedCounts.values()),
  )

  return (
    <Plot
      data={[
        {
          type: 'histogram',
          x: constrainedSamples,
          name: 'Constrained: statewide score',
          marker: { color: '#4f67b3' },
          opacity: 0.7,
          xbins: { start, end, size: 1 },
        },
        {
          type: 'histogram',
          x: nonVraSamples,
          name: 'Non-VRA',
          marker: { color: '#59a966' },
          opacity: 0.7,
          xbins: { start, end, size: 1 },
        },
      ]}
      layout={{
        autosize: true,
        barmode: 'overlay',
        margin: { l: 58, r: 10, t: 54, b: 58 },
        title: {
          text: `${stats.groupLabel} effectiveness`,
          x: 0.5,
          xanchor: 'center',
          y: 0.98,
          yanchor: 'top',
          font: { size: 18 },
        },
        showlegend: true,
        xaxis: {
          title: { text: `Number of districts with ${stats.groupLabel} effectiveness > ${(HISTOGRAM_EFFECTIVE_SHARE_THRESHOLD * 100).toFixed(0)}%` },
          dtick: 1,
          range: [start, end],
          automargin: true,
        },
        yaxis: {
          title: { text: 'Number of plans in ensemble' },
          range: [0, peakCount * 1.15],
          rangemode: 'tozero',
          automargin: true,
        },
        annotations: [
          {
            x: clampInt(maxDistricts * 0.58, 0, maxDistricts),
            y: peakCount * 0.62,
            xref: 'x',
            yref: 'y',
            text: 'non-VRA',
            showarrow: false,
            font: { size: 22, color: 'rgba(30, 41, 59, 0.82)' },
          },
          {
            x: clampInt(maxDistricts * 0.9, 0, maxDistricts),
            y: peakCount * 0.75,
            xref: 'x',
            yref: 'y',
            text: 's<sup>state</sup>',
            showarrow: false,
            font: { size: 22, color: 'rgba(30, 41, 59, 0.82)' },
          },
        ],
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

function VraImpactPanel({ stateCode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subview, setSubview] = useState('threshold')
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

  const groupOptions = useMemo(() => (
    (dataset?.groupOptions ?? []).map((group) => ({
      value: group.key,
      label: group.label ?? groupLabel(group.key),
    }))
  ), [dataset])

  const defaultLatinoValue = findLatinoGroupKey(dataset?.groupOptions)
  const effectiveGroup = groupOptions.some((group) => group.value === selectedGroup)
    ? selectedGroup
    : defaultLatinoValue

  const allStats = useMemo(() => {
    if (!dataset) return []
    const districtCount = Number(dataset.districtCount ?? 0)
    const cvapMap = dataset.summary?.racialEthnicPopulationPct ?? {}

    return Object.entries(dataset.groupData ?? {}).map(([groupKey, groupRecord]) => (
      buildGroupStats(groupKey, groupRecord, districtCount, toSafeNumber(cvapMap?.[groupKey]) / 100)
    ))
  }, [dataset])

  const selectedStats = allStats.find((row) => row.groupKey === effectiveGroup) ?? null
  const latinoStats = allStats.find((row) => row.groupKey === defaultLatinoValue) ?? allStats[0] ?? null

  if (loading) {
    return <div className="small-text muted-text">Loading VRA impact data...</div>
  }

  if (error) {
    return <div className="small-text muted-text">Failed to load VRA impact data: {error}</div>
  }

  if (!dataset || !groupOptions.length) {
    return <div className="small-text muted-text">No VRA impact data available.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>VRA Impact</div>
          <Info
            label="VRA impact info"
            text={(
              <>
                Frontend preview of minority-effectiveness impact by ensemble type.
                <br />
                Metrics use effectiveness threshold {`${(EFFECTIVE_SHARE_THRESHOLD * 100).toFixed(0)}%`} and feasible-group filtering from backend group options.
              </>
            )}
          />
        </div>
        {subview === 'threshold' && (
          <div style={{ width: 220 }}>
            <Select
              ariaLabel="VRA impact feasible race selector"
              value={effectiveGroup}
              onChange={setSelectedGroup}
              options={groupOptions}
            />
          </div>
        )}
      </div>

      <div style={{ width: 520, maxWidth: '100%' }}>
        <SegmentedControl
          ariaLabel="VRA impact subview selector"
          value={subview}
          onChange={setSubview}
          options={SUBVIEW_OPTIONS}
          columns={3}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {subview === 'threshold' && <ThresholdTable stats={selectedStats} />}
        {subview === 'box' && (
          <div style={{ width: '100%', height: '100%' }}>
            <MinorityEffectivenessBoxPlot allStats={allStats} />
          </div>
        )}
        {subview === 'hist' && (
          <div style={{ width: '100%', height: '100%' }}>
            <MinorityEffectivenessHistogram stats={latinoStats} />
          </div>
        )}
      </div>
    </div>
  )
}

export default VraImpactPanel
