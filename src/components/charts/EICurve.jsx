import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildGroupOptions, FEASIBLE_THRESHOLD_MILLIONS } from '../../data/racialGroupConfig'
import stateSummary from '../../data/mock/stateSummary.json'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const GROUP_A_COLOR = '#0F766E'
const GROUP_B_COLOR = '#D97706'
const DENSITY_POINT_COUNT = 121

const DEFAULT_CURVES = {
  dem: {
    group: [{ mean: 0.74, std: 0.08, weight: 1 }],
    nonGroup: [{ mean: 0.44, std: 0.09, weight: 1 }],
  },
  rep: {
    group: [{ mean: 0.26, std: 0.08, weight: 1 }],
    nonGroup: [{ mean: 0.56, std: 0.09, weight: 1 }],
  },
}

const STATE_GROUP_CURVES = {
  CO: {
      latino_pct: {
        dem: {
          group: [{ mean: 0.79, std: 0.08, weight: 0.78 }, { mean: 0.66, std: 0.05, weight: 0.22 }],
          nonGroup: [{ mean: 0.31, std: 0.03, weight: 0.52 }, { mean: 0.45, std: 0.09, weight: 0.48 }],
        },
        rep: {
          group: [{ mean: 0.21, std: 0.08, weight: 0.78 }, { mean: 0.34, std: 0.05, weight: 0.22 }],
          nonGroup: [{ mean: 0.69, std: 0.03, weight: 0.52 }, { mean: 0.55, std: 0.09, weight: 0.48 }],
        },
      },
    },
  AZ: {
    latino_pct: {
      dem: {
        group: [{ mean: 0.75, std: 0.08, weight: 0.72 }, { mean: 0.62, std: 0.06, weight: 0.28 }],
        nonGroup: [{ mean: 0.34, std: 0.04, weight: 0.48 }, { mean: 0.48, std: 0.1, weight: 0.52 }],
      },
      rep: {
        group: [{ mean: 0.25, std: 0.08, weight: 0.72 }, { mean: 0.38, std: 0.06, weight: 0.28 }],
        nonGroup: [{ mean: 0.66, std: 0.04, weight: 0.48 }, { mean: 0.52, std: 0.1, weight: 0.52 }],
      },
    },
    black_pct: {
      dem: {
        group: [{ mean: 0.84, std: 0.055, weight: 0.82 }, { mean: 0.72, std: 0.06, weight: 0.18 }],
        nonGroup: [{ mean: 0.29, std: 0.03, weight: 0.5 }, { mean: 0.44, std: 0.09, weight: 0.5 }],
      },
      rep: {
        group: [{ mean: 0.16, std: 0.055, weight: 0.82 }, { mean: 0.28, std: 0.06, weight: 0.18 }],
        nonGroup: [{ mean: 0.71, std: 0.03, weight: 0.5 }, { mean: 0.56, std: 0.09, weight: 0.5 }],
      },
    },
  },
}

function gaussianPdf(x, mean, std) {
  const safeStd = Math.max(0.02, Number(std) || 0.08)
  const exponent = -0.5 * ((x - mean) / safeStd) ** 2
  return (1 / (safeStd * Math.sqrt(2 * Math.PI))) * Math.exp(exponent)
}

function gaussianMixturePdf(x, components) {
  if (!Array.isArray(components) || components.length === 0) return 0
  const totalWeight = components.reduce((sum, component) => sum + (Number(component?.weight) || 0), 0) || 1
  return components.reduce((sum, component) => {
    const weight = (Number(component?.weight) || 0) / totalWeight
    const mean = Number(component?.mean)
    const std = Number(component?.std)
    return sum + (weight * gaussianPdf(x, mean, std))
  }, 0)
}

function buildDensityRows(curves) {
  const rows = []
  for (let index = 0; index < DENSITY_POINT_COUNT; index += 1) {
    const x = index / (DENSITY_POINT_COUNT - 1)
    rows.push({
      x,
      group: gaussianMixturePdf(x, curves.group),
      nonGroup: gaussianMixturePdf(x, curves.nonGroup),
    })
  }
  return rows
}

function getCurvePreset(stateCode, groupKey) {
  const statePreset = STATE_GROUP_CURVES[stateCode] ?? {}
  return statePreset[groupKey] ?? DEFAULT_CURVES
}

function formatDensity(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

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

function EICurve({ stateCode }) {
  const summary = stateSummary?.[stateCode]

  const groupOptions = useMemo(() => {
    const stateSummaryGroups = Object.keys(summary?.racialEthnicPopulationMillions ?? {})
    const statePresetGroups = Object.keys(STATE_GROUP_CURVES[stateCode] ?? {})
    const stateGroups = [...new Set([...stateSummaryGroups, ...statePresetGroups])]
    const feasibleOnly = buildGroupOptions(
      stateGroups,
      summary,
      {},
      { includeOnlyFeasible: true },
    )
    if (feasibleOnly.length) return feasibleOnly
    return buildGroupOptions(stateGroups, summary, {}, {})
  }, [stateCode, summary])

  const [selectedGroup, setSelectedGroup] = useState(groupOptions[0]?.value ?? '')
  const effectiveGroup = groupOptions.some((option) => option.value === selectedGroup)
    ? selectedGroup
    : (groupOptions[0]?.value ?? '')

  const activeGroupLabel = groupOptions.find((group) => group.value === effectiveGroup)?.label ?? effectiveGroup
  const nonGroupLabel = activeGroupLabel ? `Non-${activeGroupLabel}` : 'Non-selected group'

  const densityByCandidate = useMemo(() => {
    if (!effectiveGroup) return { demRows: [], repRows: [] }
    const preset = getCurvePreset(stateCode, effectiveGroup)
    return {
      demRows: buildDensityRows(preset.dem),
      repRows: buildDensityRows(preset.rep),
    }
  }, [effectiveGroup, stateCode])

  if (!groupOptions.length) {
    return <div className="small-text muted-text">No feasible statewide minority group data found for EI display.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
          <Info
            label="EI chart info"
            text={`Dummy EI curves: x-axis is candidate support share (0 to 1), y-axis is probability density. Select one feasible minority group (>${FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)}M CVAP) to compare against its non-group complement.`}
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
          title="Support for Democratic Candidate"
          data={densityByCandidate.demRows}
          labelA={activeGroupLabel}
          labelB={nonGroupLabel}
        />
        <CurvePanel
          title="Support for Republican Candidate"
          data={densityByCandidate.repRows}
          labelA={activeGroupLabel}
          labelB={nonGroupLabel}
        />
      </div>
    </div>
  )
}

export default EICurve
