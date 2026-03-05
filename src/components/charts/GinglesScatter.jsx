import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { buildGroupOptions, FEASIBLE_THRESHOLD_MILLIONS } from '../../data/racialGroupConfig'
import stateSummary from '../../data/mock/stateSummary.json'
import metricConfig from '../../data/mock/metricConfig.json'
import eiCurves from '../../data/mock/eiCurves.json'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const DEFAULT_GROUPS = metricConfig.filter((metric) => metric.key !== 'pct_dem_lead')
const GROUP_FIELD_CANDIDATES = {
  white_pct: ['PCT_CVAP_WHT', 'pct_cvap_wht'],
  black_pct: ['PCT_CVAP_BLA', 'pct_cvap_bla'],
  latino_pct: ['PCT_CVAP_HSP', 'pct_cvap_hsp'],
  native_american_pct: ['PCT_CVAP_AMI', 'pct_cvap_ami'],
  asian_pct: ['PCT_CVAP_ASI', 'pct_cvap_asi'],
}
const GROUP_TO_CVAP_FIELD = {
  white_pct: 'CVAP_WHT24',
  black_pct: 'CVAP_BLA24',
  latino_pct: 'CVAP_HSP24',
  native_american_pct: 'CVAP_AMI24',
  asian_pct: 'CVAP_ASI24',
}

function normalizePct(value) {
  if (!Number.isFinite(value)) return null
  if (value >= 0 && value <= 1) return value
  if (value >= 0 && value <= 100) return value / 100
  return null
}

function resolveGroupPct(properties, groupKey, rowIndex) {
  const candidates = GROUP_FIELD_CANDIDATES[groupKey] ?? [groupKey]
  for (let i = 0; i < candidates.length; i += 1) {
    const normalized = normalizePct(Number(properties[candidates[i]]))
    if (normalized !== null) {
      return normalized
    }
  }

  const cvapField = GROUP_TO_CVAP_FIELD[groupKey]
  const groupCvap = Number(properties?.[cvapField])
  const totalCvap = Number(properties?.CVAP_TOT24)
  if (Number.isFinite(groupCvap) && Number.isFinite(totalCvap) && totalCvap > 0) {
    return normalizePct(groupCvap / totalCvap)
  }

  return null
}

function buildTrend(points, binCount = 12) {
  const bins = Array.from({ length: binCount }, () => ({
    count: 0,
    demSum: 0,
    repSum: 0,
  }))

  points.forEach((point) => {
    const index = Math.max(0, Math.min(binCount - 1, Math.floor(point.x * binCount)))
    const target = bins[index]
    target.count += 1
    target.demSum += point.demShare
    target.repSum += point.repShare
  })

  return bins.map((bin, index) => ({
    x: (index + 0.5) / binCount,
    demTrend: bin.count ? bin.demSum / bin.count : null,
    repTrend: bin.count ? bin.repSum / bin.count : null,
  }))
}

function TooltipCard({ active, payload, groupLabel }) {
  if (!active || !payload?.length) return null
  const row = payload.find((item) => item?.payload)?.payload
  if (!row) return null

  const hasPrecinct = typeof row.geoid === 'string'
  const demEntry = payload.find((item) => item?.dataKey === 'demShare' || item?.dataKey === 'demTrend')
  const repEntry = payload.find((item) => item?.dataKey === 'repShare' || item?.dataKey === 'repTrend')
  const demValue = Number(demEntry?.value)
  const repValue = Number(repEntry?.value)
  const xValue = Number(row.x)

  const pctText = (value) => (Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'N/A')
  const title = hasPrecinct ? row.geoid : `Trend bin (${pctText(xValue)})`

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #dfe3ea',
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: '0 4px 14px rgba(17, 24, 39, 0.08)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div className="small-text muted-text">{groupLabel}: {pctText(xValue)}</div>
      <div className="small-text" style={{ color: DEM_COLOR }}>Democratic vote share: {pctText(demValue)}</div>
      <div className="small-text" style={{ color: REP_COLOR }}>Republican vote share: {pctText(repValue)}</div>
    </div>
  )
}

function GinglesScatter({ stateCode, features }) {
  const summary = stateSummary?.[stateCode]
  const groupOptions = useMemo(
    () => {
      const stateGroups = eiCurves?.[stateCode]?.groups ?? {}
      const stateKeys = Object.keys(stateGroups)
      if (stateKeys.length) {
        const feasibleOnly = buildGroupOptions(
          stateKeys,
          summary,
          Object.fromEntries(stateKeys.map((key) => [key, stateGroups[key]?.label ?? key])),
          { includeOnlyFeasible: true },
        )
        if (feasibleOnly.length) return feasibleOnly
        return buildGroupOptions(
          stateKeys,
          summary,
          Object.fromEntries(stateKeys.map((key) => [key, stateGroups[key]?.label ?? key])),
          {},
        )
      }
      if (DEFAULT_GROUPS.length) {
        const feasibleOnly = buildGroupOptions(
          DEFAULT_GROUPS.map((group) => group.key),
          summary,
          Object.fromEntries(DEFAULT_GROUPS.map((group) => [group.key, group.label])),
          { includeOnlyFeasible: true },
        )
        if (feasibleOnly.length) return feasibleOnly
        return buildGroupOptions(
          DEFAULT_GROUPS.map((group) => group.key),
          summary,
          Object.fromEntries(DEFAULT_GROUPS.map((group) => [group.key, group.label])),
          {},
        )
      }
      return [{ value: 'minority_mock', label: 'Minority % (Mock)' }]
    },
    [stateCode, summary],
  )
  const [selectedGroup, setSelectedGroup] = useState(groupOptions[0]?.value ?? 'minority_mock')
  const effectiveGroup = groupOptions.some((option) => option.value === selectedGroup)
    ? selectedGroup
    : (groupOptions[0]?.value ?? 'minority_mock')

  const activeGroupLabel = groupOptions.find((group) => group.value === effectiveGroup)?.label ?? 'Selected Group %'

  const precinctPoints = useMemo(() => {
    const mapped = (features ?? []).map((feature, index) => {
      const props = feature.properties ?? {}
      const totalVotes = Number(props.votes_total ?? 0)
      const demShare = totalVotes > 0 ? Number(props.votes_dem ?? 0) / totalVotes : 0
      const repShare = totalVotes > 0 ? Number(props.votes_rep ?? 0) / totalVotes : 0
      const x = resolveGroupPct(props, effectiveGroup, index)

      if (x === null) return null

      return {
        geoid: props.GEOID ?? `row-${index}`,
        x,
        demShare,
        repShare,
      }
    })
      .filter(Boolean)

    return mapped
  }, [effectiveGroup, features])

  const trendData = useMemo(() => buildTrend(precinctPoints), [precinctPoints])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Gingles Analysis</div>
          <Info
            label="Gingles chart info"
            text={`X: racial/ethnic group %, Y: party vote share (Democratic blue / Republican red). Feasible: over ${FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)}M CVAP.`}
          />
        </div>
        <div style={{ width: 190 }}>
          <Select ariaLabel="Gingles group selector" value={effectiveGroup} onChange={setSelectedGroup} options={groupOptions} />
        </div>
      </div>
      {precinctPoints.length === 0 ? (
        <div className="small-text muted-text">
          No precinct rows have both vote totals and demographic percentage data for this group.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height="90%">
        <ComposedChart margin={{ top: 8, right: 20, bottom: 20, left: 8 }}>
          <CartesianGrid stroke="#e7e9ee" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={activeGroupLabel}
            domain={[0, 1]}
            tickFormatter={(value) => `${Math.round(value * 100)}%`}
          />
          <YAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={(value) => `${Math.round(value * 100)}%`}
          />
          <Tooltip content={<TooltipCard groupLabel={activeGroupLabel} />} />
          <Legend />
          <Scatter
            name="Democratic vote share"
            data={precinctPoints}
            dataKey="demShare"
            fill={DEM_COLOR}
            fillOpacity={0.24}
            stroke="none"
          />
          <Scatter
            name="Republican vote share"
            data={precinctPoints}
            dataKey="repShare"
            fill={REP_COLOR}
            fillOpacity={0.22}
            stroke="none"
          />
          <Line
            name="Democratic trend"
            data={trendData}
            type="monotone"
            dataKey="demTrend"
            stroke={DEM_COLOR}
            strokeWidth={2.3}
            dot={false}
            connectNulls
          />
          <Line
            name="Republican trend"
            data={trendData}
            type="monotone"
            dataKey="repTrend"
            stroke={REP_COLOR}
            strokeWidth={2.3}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}

export default GinglesScatter
