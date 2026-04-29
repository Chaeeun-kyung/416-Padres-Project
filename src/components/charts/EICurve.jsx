import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'
import ToggleSwitch from '../../ui/components/ToggleSwitch'

const SELECTED_GROUP_COLOR = '#0F766E'
const NON_SELECTED_GROUP_COLOR = '#D97706'
const EMPTY_OPTION_VALUE = ''
const FALLBACK_GROUP_OPTIONS = [
  { value: 'white_pct', label: 'White' },
  { value: 'latino_pct', label: 'Hispanic/Latino' },
]
const POLARIZATION_THRESHOLD_FRACTION = 0.1
const POLARIZATION_LINE_COLOR = '#1d4ed8'
const POLARIZATION_FILL_COLOR = '#60a5fa'
const eiAnalysisCache = new Map()

function normalizeStateCodeForCache(stateCode) {
  if (!stateCode) return ''
  return String(stateCode).trim().toUpperCase()
}

function buildEiCacheKey(stateCode, groupKey) {
  return `${normalizeStateCodeForCache(stateCode)}::${getSafeString(groupKey).trim().toLowerCase()}`
}

async function fetchEiAnalysisByGroup(stateCode, groupKey) {
  const key = buildEiCacheKey(stateCode, groupKey)
  if (!key || key.startsWith('::')) {
    throw new Error('State code is required')
  }

  const cached = eiAnalysisCache.get(key)
  if (cached?.data) {
    return cached.data
  }
  if (cached?.promise) {
    return cached.promise
  }

  const pending = axios
    .get(`/api/states/${normalizeStateCodeForCache(stateCode)}/analysis/ei`, {
      params: groupKey ? { group: groupKey } : undefined,
    })
    .then((response) => {
      const data = response.data ?? null
      eiAnalysisCache.set(key, { data })
      return data
    })
    .catch((error) => {
      eiAnalysisCache.delete(key)
      throw error
    })

  eiAnalysisCache.set(key, { promise: pending })
  return pending
}

function trapezoidArea(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) {
    return 0
  }

  let area = 0
  for (let index = 1; index < xs.length; index += 1) {
    const width = xs[index] - xs[index - 1]
    if (!Number.isFinite(width) || width <= 0) continue
    area += 0.5 * width * (ys[index] + ys[index - 1])
  }
  return area
}

function integrationWeights(xs) {
  const n = Array.isArray(xs) ? xs.length : 0
  if (n < 2) return []

  const weights = new Array(n).fill(0)
  for (let index = 0; index < n; index += 1) {
    if (index === 0) {
      weights[index] = (xs[1] - xs[0]) / 2
      continue
    }
    if (index === n - 1) {
      weights[index] = (xs[n - 1] - xs[n - 2]) / 2
      continue
    }
    weights[index] = (xs[index + 1] - xs[index - 1]) / 2
  }
  return weights
}

function normalizeDensityRows(rows, densityKey) {
  const points = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      x: Number(row?.x),
      density: Number(row?.[densityKey]),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.density) && row.x >= 0 && row.x <= 1 && row.density >= 0)
    .sort((left, right) => left.x - right.x)

  if (points.length < 2) return null

  const xs = []
  const ys = []
  for (const point of points) {
    const lastIndex = xs.length - 1
    if (lastIndex >= 0 && Math.abs(point.x - xs[lastIndex]) < 1e-9) {
      ys[lastIndex] = point.density
      continue
    }
    xs.push(point.x)
    ys.push(point.density)
  }

  if (xs.length < 2) return null

  const area = trapezoidArea(xs, ys)
  if (!Number.isFinite(area) || area <= 0) return null

  const normalized = ys.map((value) => value / area)
  return { xs, ys: normalized, weights: integrationWeights(xs) }
}

function buildPolarizationDifferenceDensity(candidateRows, thresholdFraction) {
  const groupSeries = normalizeDensityRows(candidateRows, 'group')
  const nonGroupSeries = normalizeDensityRows(candidateRows, 'nonGroup')
  if (!groupSeries || !nonGroupSeries) {
    return { rows: [], probabilityAboveThreshold: null }
  }

  const binCount = 401
  const step = 2 / (binCount - 1)
  const bins = new Array(binCount).fill(0)

  for (let i = 0; i < groupSeries.xs.length; i += 1) {
    const xA = groupSeries.xs[i]
    const fA = groupSeries.ys[i]
    const wA = groupSeries.weights[i] ?? 0
    if (!Number.isFinite(xA) || !Number.isFinite(fA) || !Number.isFinite(wA) || wA <= 0) continue

    for (let j = 0; j < nonGroupSeries.xs.length; j += 1) {
      const xB = nonGroupSeries.xs[j]
      const fB = nonGroupSeries.ys[j]
      const wB = nonGroupSeries.weights[j] ?? 0
      if (!Number.isFinite(xB) || !Number.isFinite(fB) || !Number.isFinite(wB) || wB <= 0) continue

      const diff = xA - xB
      const mass = fA * fB * wA * wB
      const binIndex = Math.round((diff + 1) / step)
      if (binIndex >= 0 && binIndex < binCount) {
        bins[binIndex] += mass
      }
    }
  }

  const rows = bins.map((mass, index) => {
    const diff = -1 + (index * step)
    const density = mass / step
    return {
      diff,
      diffPct: diff * 100,
      density: Number.isFinite(density) ? density : 0,
    }
  })

  const threshold = Number.isFinite(thresholdFraction) ? thresholdFraction : 0
  const probabilityAboveThreshold = bins.reduce((acc, mass, index) => {
    const diff = -1 + (index * step)
    if (diff > threshold) {
      return acc + mass
    }
    return acc
  }, 0)

  return {
    rows,
    probabilityAboveThreshold: Math.max(0, Math.min(1, probabilityAboveThreshold)),
  }
}

function getSafeString(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function findLatinoOption(options) {
  const safeOptions = Array.isArray(options) ? options : []
  return safeOptions.find((option) => {
    const valueText = getSafeString(option?.value)
    const labelText = getSafeString(option?.label)
    const valueMatches = /latino|hisp/i.test(valueText)
    const labelMatches = /latino|hispanic/i.test(labelText)
    return valueMatches || labelMatches
  })
}

function getDefaultGroupValue(groupOptions) {
  const latinoOption = findLatinoOption(groupOptions)
  if (latinoOption?.value !== undefined && latinoOption?.value !== null) return latinoOption.value
  if (groupOptions.length > 0 && groupOptions[0].value !== undefined && groupOptions[0].value !== null) {
    return groupOptions[0].value
  }
  return EMPTY_OPTION_VALUE
}

function getEffectiveGroupValue(selectedGroup, groupOptions, defaultGroupValue) {
  const selectedExists = groupOptions.some((option) => option.value === selectedGroup)
  if (selectedExists) return selectedGroup
  return defaultGroupValue
}

const formatDensity = (value) => (Number.isFinite(value) ? value.toFixed(2) : '0.00')
const formatSupportSharePct = (value) => `${Number(value).toFixed(1)}%`
const formatTooltipSupportSharePct = (value) => `Support share: ${Number(value).toFixed(2)}%`

function CurvePanel({ title, data, labelA, labelB }) {
  return (
    <div
      style={{
        minHeight: 0,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '8px 8px 2px',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data} margin={{ top: 8, right: 14, left: 10, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis
            dataKey="xPct"
            type="number"
            domain={[0, 100]}
            tickCount={6}
            height={44}
            tickFormatter={formatSupportSharePct}
            label={{ value: 'Support share (%)', position: 'insideBottom', dy: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatDensity(Number(value))}
            width={62}
            label={{ value: 'Density', angle: -90, position: 'insideLeft', dx: -2 }}
          />
          <Tooltip
            formatter={(value, name) => [formatDensity(Number(value)), name]}
            labelFormatter={formatTooltipSupportSharePct}
          />
          <Legend wrapperStyle={{ bottom: 15 }} />
          <Area
            type="monotone"
            dataKey="group"
            name={labelA}
            stroke={SELECTED_GROUP_COLOR}
            fill={SELECTED_GROUP_COLOR}
            fillOpacity={0.32}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="nonGroup"
            name={labelB}
            stroke={NON_SELECTED_GROUP_COLOR}
            fill={NON_SELECTED_GROUP_COLOR}
            fillOpacity={0.32}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PolarizationKDEPanel({
  data,
  groupLabel,
  groupKey,
  candidateLabel,
  probabilityAboveThreshold,
}) {
  const thresholdPct = POLARIZATION_THRESHOLD_FRACTION * 100
  const axisGroupKey = getSafeString(groupKey).replace(/_pct$/i, '')
  const probabilityText = Number.isFinite(probabilityAboveThreshold)
    ? `${(probabilityAboveThreshold * 100).toFixed(1)}%`
    : 'N/A'

  return (
    <div
      style={{
        minHeight: 0,
        height: '100%',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '8px 8px 2px',
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        gap: 4,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        Polarization KDE for {candidateLabel}
      </div>
      <div className="small-text muted-text" style={{ marginBottom: 4 }}>
        ({groupLabel} - Non-{groupLabel}) candidate support
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 14, left: 10, bottom: 26 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis
            dataKey="diffPct"
            type="number"
            domain={[-100, 100]}
            tickCount={9}
            tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
            label={{ value: `(e_${axisGroupKey} - non-e_${axisGroupKey}) support (%)`, position: 'insideBottom', dy: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatDensity(Number(value))}
            width={62}
            label={{ value: 'Density', angle: -90, position: 'insideLeft', dx: -2 }}
          />
          <Tooltip
            formatter={(value) => [formatDensity(Number(value)), 'Density']}
            labelFormatter={(value) => `Difference: ${Number(value).toFixed(2)}%`}
          />
          <ReferenceLine
            x={thresholdPct}
            stroke="#475569"
            strokeDasharray="4 4"
            label={{ value: `>${thresholdPct.toFixed(0)}%`, fill: '#334155', position: 'insideTopRight' }}
          />
          <Area
            type="monotone"
            dataKey="density"
            name="Difference KDE"
            stroke={POLARIZATION_LINE_COLOR}
            fill={POLARIZATION_FILL_COLOR}
            fillOpacity={0.35}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ fontWeight: 600, marginTop: 4 }}>
        Prob (difference &gt; {thresholdPct.toFixed(0)}%) = {probabilityText}
      </div>
    </div>
  )
}

function EICurve({ stateCode }) {
  const [selectedGroup, setSelectedGroup] = useState('latino_pct')
  const [showPolarizationOnly, setShowPolarizationOnly] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polarizationCandidate, setPolarizationCandidate] = useState('dem')

  useEffect(() => {
    let cancelled = false

    async function loadAnalysis() {
      if (!stateCode) {
        setAnalysis(null)
        setError('')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await fetchEiAnalysisByGroup(stateCode, selectedGroup)
        if (!cancelled) {
          setAnalysis(response ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null)
          const message = axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : 'Failed to load EI analysis.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadAnalysis()

    return () => {
      cancelled = true
    }
  }, [selectedGroup, stateCode])

  const groupOptions = useMemo(() => {
    const options = Array.isArray(analysis?.availableGroups)
      ? analysis.availableGroups
          .filter((group) => group?.key && group?.label)
          .map((group) => ({ value: group.key, label: group.label }))
      : []
    return options.length > 0 ? options : FALLBACK_GROUP_OPTIONS
  }, [analysis])

  const defaultGroupValue = getDefaultGroupValue(groupOptions)
  const effectiveGroup = analysis?.groupKey ?? getEffectiveGroupValue(selectedGroup, groupOptions, defaultGroupValue)
  const selectedGroupLabel = analysis?.groupLabel
    ?? groupOptions.find((group) => group.value === effectiveGroup)?.label
    ?? effectiveGroup
  const nonSelectedGroupLabel = analysis?.nonGroupLabel
    ?? (selectedGroupLabel ? `Non-${selectedGroupLabel}` : 'Non-selected group')
  const demRows = Array.isArray(analysis?.demRows) ? analysis.demRows : []
  const repRows = Array.isArray(analysis?.repRows) ? analysis.repRows : []
  const demRowsPercent = useMemo(
    () => demRows.map((row) => ({ ...row, xPct: Number(row?.x ?? 0) * 100 })),
    [demRows],
  )
  const repRowsPercent = useMemo(
    () => repRows.map((row) => ({ ...row, xPct: Number(row?.x ?? 0) * 100 })),
    [repRows],
  )
  const demCandidateLabel = getSafeString(analysis?.demCandidateLabel) || 'Kamala Harris'
  const repCandidateLabel = getSafeString(analysis?.repCandidateLabel) || 'Donald Trump'
  const candidateOptions = [
    { value: 'dem', label: demCandidateLabel },
    { value: 'rep', label: repCandidateLabel },
  ]
  const comparisonGroupLabel = selectedGroupLabel
  const comparisonGroupKey = effectiveGroup
  const comparisonCandidateLabel = polarizationCandidate === 'rep' ? repCandidateLabel : demCandidateLabel
  const candidateRows = polarizationCandidate === 'rep' ? repRows : demRows
  const polarizationDensity = useMemo(() => (
    buildPolarizationDifferenceDensity(candidateRows, POLARIZATION_THRESHOLD_FRACTION)
  ), [candidateRows])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="small-text muted-text">KDE chart</span>
            <ToggleSwitch
              checked={showPolarizationOnly}
              onChange={setShowPolarizationOnly}
              ariaLabel="Toggle KDE-only chart view"
            />
          </div>
          <Info
            label="EI chart info"
            text={(
              <>
                This chart estimates candidate support among different racial groups using ecological inference.
                <br />
                The x-axis shows the estimated share of a group voting for a candidate, and the y-axis shows the probability of that estimate.
                <br />
                The curves indicate likely voting preferences across groups.
              </>
            )}
          />
        </div>
        <div style={{ width: 230 }}>
          <Select
            ariaLabel="EI demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
        </div>
      </div>

      {loading && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          Loading EI analysis from the backend...
        </div>
      )}

      {!loading && error && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          Failed to load EI data: {error}
        </div>
      )}

      {!loading && !error && (demRows.length === 0 || repRows.length === 0) && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          No EI curves available for {stateCode}.
        </div>
      )}

      {!loading && !error && demRows.length > 0 && repRows.length > 0 && (
        <>
          {!showPolarizationOnly && (
            <div
              style={{
                width: '100%',
                height: '90%',
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: 12,
              }}
            >
              <CurvePanel
                title={`Support for ${demCandidateLabel}`}
                data={demRowsPercent}
                labelA={selectedGroupLabel}
                labelB={nonSelectedGroupLabel}
              />
              <CurvePanel
                title={`Support for ${repCandidateLabel}`}
                data={repRowsPercent}
                labelA={selectedGroupLabel}
                labelB={nonSelectedGroupLabel}
              />
            </div>
          )}

          {showPolarizationOnly && (
            <div
              style={{
                width: '100%',
                height: '90%',
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                gap: 8,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="small-text muted-text" style={{ alignSelf: 'center' }}>
                  Compare: {comparisonGroupLabel} vs Non-{comparisonGroupLabel}
                </div>
                <Select
                  ariaLabel="Polarization comparison candidate"
                  value={polarizationCandidate}
                  onChange={setPolarizationCandidate}
                  options={candidateOptions}
                />
              </div>

              <div style={{ minHeight: 0 }}>
                {polarizationDensity.rows.length === 0 && (
                  <div className="small-text muted-text" style={{ marginBottom: 8 }}>
                    No polarization KDE comparison data available.
                  </div>
                )}

                {polarizationDensity.rows.length > 0 && (
                  <div style={{ height: '100%', minHeight: 320 }}>
                    <PolarizationKDEPanel
                      data={polarizationDensity.rows}
                      groupLabel={comparisonGroupLabel}
                      groupKey={comparisonGroupKey}
                      candidateLabel={comparisonCandidateLabel}
                      probabilityAboveThreshold={polarizationDensity.probabilityAboveThreshold}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default EICurve
