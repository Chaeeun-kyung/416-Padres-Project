import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FEASIBLE_THRESHOLD_MILLIONS, RACIAL_GROUPS } from '../../data/racialGroupConfig'
import Select from '../../ui/components/Select'

const GROUP_A_COLOR = '#0F766E'
const GROUP_B_COLOR = '#D97706'
const KDE_BANDWIDTH = 0.022
const DENSITY_POINT_COUNT = 101

const GROUP_TO_CVAP_FIELD = {
  white_pct: 'CVAP_WHT24',
  black_pct: 'CVAP_BLA24',
  latino_pct: 'CVAP_HSP24',
  asian_pct: 'CVAP_ASI24',
}

const GROUP_TO_PCT_FIELD = {
  white_pct: 'PCT_CVAP_WHT',
  black_pct: 'PCT_CVAP_BLA',
  latino_pct: 'PCT_CVAP_HSP',
  asian_pct: 'PCT_CVAP_ASI',
}

function clamp01(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

function gaussianKernel(u) {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
}

function buildWeightedDensitySeries(samples, weights, pointCount = DENSITY_POINT_COUNT, bandwidth = KDE_BANDWIDTH) {
  if (!samples.length || !weights.length || samples.length !== weights.length) {
    return []
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (!(totalWeight > 0)) {
    return []
  }

  const rows = []
  for (let index = 0; index < pointCount; index += 1) {
    const x = index / (pointCount - 1)
    let weightedKernelSum = 0

    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      const u = (x - samples[sampleIndex]) / bandwidth
      weightedKernelSum += weights[sampleIndex] * gaussianKernel(u)
    }

    rows.push({
      x,
      y: weightedKernelSum / (totalWeight * bandwidth),
    })
  }

  return rows
}

function formatDensity(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function EICurve({ stateCode, features = [] }) {
  const availableGroups = useMemo(() => {
    const totals = new Map()

    ;(features ?? []).forEach((feature) => {
      const props = feature?.properties ?? {}
      const totalCvap = Number(props.CVAP_TOT24)
      if (!Number.isFinite(totalCvap) || totalCvap <= 0) return

      RACIAL_GROUPS.forEach((group) => {
        const cvapField = GROUP_TO_CVAP_FIELD[group.key]
        const pctField = GROUP_TO_PCT_FIELD[group.key]

        let groupCvap = Number(props[cvapField])
        if (!Number.isFinite(groupCvap) || groupCvap < 0) {
          const pct = clamp01(Number(props[pctField]))
          groupCvap = pct !== null ? pct * totalCvap : NaN
        }

        if (!Number.isFinite(groupCvap) || groupCvap <= 0) return
        totals.set(group.key, (totals.get(group.key) ?? 0) + groupCvap)
      })
    })

    return RACIAL_GROUPS
      .filter((group) => Number(totals.get(group.key) ?? 0) > 0)
      .map((group) => {
        const millions = (totals.get(group.key) ?? 0) / 1000000
        return {
          value: group.key,
          label: `${group.label}${millions >= FEASIBLE_THRESHOLD_MILLIONS ? ' (Feasible >0.4M)' : ''}`,
          baseLabel: group.label,
          cvapMillions: millions,
        }
      })
  }, [features])

  const [selectedGroup, setSelectedGroup] = useState('')
  const [focusedCandidate, setFocusedCandidate] = useState(null)
  const effectiveGroup = availableGroups.some((group) => group.value === selectedGroup)
    ? selectedGroup
    : (availableGroups[0]?.value ?? '')

  const activeGroupMeta = availableGroups.find((group) => group.value === effectiveGroup)
  const activeGroupLabel = activeGroupMeta?.baseLabel ?? effectiveGroup
  const nonGroupLabel = activeGroupLabel ? `Non-${activeGroupLabel}` : 'Non-selected group'

  const densityByCandidate = useMemo(() => {
    if (!effectiveGroup) {
      return { demRows: [], repRows: [] }
    }

    const cvapField = GROUP_TO_CVAP_FIELD[effectiveGroup]
    const pctField = GROUP_TO_PCT_FIELD[effectiveGroup]
    const demGroupSamples = []
    const demGroupWeights = []
    const demNonGroupSamples = []
    const demNonGroupWeights = []
    const repGroupSamples = []
    const repGroupWeights = []
    const repNonGroupSamples = []
    const repNonGroupWeights = []

    ;(features ?? []).forEach((feature) => {
      const props = feature?.properties ?? {}
      const votesDem = Number(props.votes_dem)
      const votesRep = Number(props.votes_rep)
      const votesTotal = Number(props.votes_total)
      const totalCvap = Number(props.CVAP_TOT24)

      if (!Number.isFinite(votesDem) || !Number.isFinite(votesRep) || !Number.isFinite(votesTotal) || votesTotal <= 0) return
      if (!Number.isFinite(totalCvap) || totalCvap <= 0) return

      let groupCvap = Number(props[cvapField])
      if (!Number.isFinite(groupCvap) || groupCvap < 0) {
        const pct = clamp01(Number(props[pctField]))
        if (pct === null) return
        groupCvap = pct * totalCvap
      }

      const cappedGroupCvap = Math.max(0, Math.min(totalCvap, groupCvap))
      const nonGroupCvap = Math.max(0, totalCvap - cappedGroupCvap)
      if (cappedGroupCvap <= 0 && nonGroupCvap <= 0) return

      const demSupport = clamp01(votesDem / votesTotal)
      const repSupport = clamp01(votesRep / votesTotal)
      if (demSupport === null || repSupport === null) return

      if (cappedGroupCvap > 0) {
        demGroupSamples.push(demSupport)
        demGroupWeights.push(cappedGroupCvap)
        repGroupSamples.push(repSupport)
        repGroupWeights.push(cappedGroupCvap)
      }

      if (nonGroupCvap > 0) {
        demNonGroupSamples.push(demSupport)
        demNonGroupWeights.push(nonGroupCvap)
        repNonGroupSamples.push(repSupport)
        repNonGroupWeights.push(nonGroupCvap)
      }
    })

    const demGroupSeries = buildWeightedDensitySeries(demGroupSamples, demGroupWeights)
    const demNonGroupSeries = buildWeightedDensitySeries(demNonGroupSamples, demNonGroupWeights)
    const repGroupSeries = buildWeightedDensitySeries(repGroupSamples, repGroupWeights)
    const repNonGroupSeries = buildWeightedDensitySeries(repNonGroupSamples, repNonGroupWeights)

    const demRows = demGroupSeries.map((row, index) => ({
      x: row.x,
      group: row.y,
      nonGroup: demNonGroupSeries[index]?.y ?? null,
    }))

    const repRows = repGroupSeries.map((row, index) => ({
      x: row.x,
      group: row.y,
      nonGroup: repNonGroupSeries[index]?.y ?? null,
    }))

    return { demRows, repRows }
  }, [effectiveGroup, features])

  if (!availableGroups.length) {
    return <div className="small-text muted-text">No eligible statewide CVAP group data found for EI display.</div>
  }

  const hasDensity = densityByCandidate.demRows.length > 0 && densityByCandidate.repRows.length > 0

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
          <div className="small-text muted-text">
            Uses statewide precinct-level 2024 Presidential results with CVAP-weighted densities. Select one group to compare with its non-group complement.
          </div>
        </div>
        <div style={{ width: 280 }}>
          <Select
            ariaLabel="EI demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={availableGroups}
          />
        </div>
      </div>

      {!hasDensity && (
        <div className="small-text muted-text" style={{ marginTop: 8 }}>
          Not enough statewide precinct data to compute EI density curves for the selected group.
        </div>
      )}

      {hasDensity && (
        <div
          style={{
            width: '100%',
            height: '90%',
            display: 'grid',
            gridTemplateRows: focusedCandidate ? '1fr' : '1fr 1fr',
            gap: 12,
          }}
        >
        {(focusedCandidate === null || focusedCandidate === 'dem') && (
        <CardChart
          title="Support for Democratic Candidate (2024)"
          data={densityByCandidate.demRows}
          labelA={activeGroupLabel}
          labelB={nonGroupLabel}
          isFocused={focusedCandidate === 'dem'}
          onToggleFocus={() => setFocusedCandidate((current) => (current === 'dem' ? null : 'dem'))}
        />
        )}
        {(focusedCandidate === null || focusedCandidate === 'rep') && (
        <CardChart
          title="Support for Republican Candidate (2024)"
          data={densityByCandidate.repRows}
          labelA={activeGroupLabel}
          labelB={nonGroupLabel}
          isFocused={focusedCandidate === 'rep'}
          onToggleFocus={() => setFocusedCandidate((current) => (current === 'rep' ? null : 'rep'))}
        />
        )}
      </div>
      )}
    </div>
  )
}

function CardChart({ title, data, labelA, labelB, isFocused, onToggleFocus }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleFocus}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggleFocus?.()
        }
      }}
      style={{
        minHeight: 0,
        background: '#f8fafc',
        border: isFocused ? '2px solid #334155' : '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '8px 8px 2px',
        cursor: 'pointer',
      }}
      aria-label={`${title}. Click to ${isFocused ? 'shrink' : 'expand'}`}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span>
        <span className="small-text muted-text">{isFocused ? 'Click to restore split view' : 'Click to expand'}</span>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <AreaChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tickCount={6}
            tickFormatter={(value) => Number(value).toFixed(1)}
          />
          <YAxis tickFormatter={(value) => formatDensity(Number(value))} width={56} />
          <Tooltip
            formatter={(value, name) => [formatDensity(Number(value)), name]}
            labelFormatter={(value) => `Support share: ${Number(value).toFixed(2)}`}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="group"
            name={labelA}
            stroke={GROUP_A_COLOR}
            fill={GROUP_A_COLOR}
            fillOpacity={0.32}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="nonGroup"
            name={labelB}
            stroke={GROUP_B_COLOR}
            fill={GROUP_B_COLOR}
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

export default EICurve
