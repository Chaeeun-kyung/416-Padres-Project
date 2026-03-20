import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

// Visual constants for EI curve styling and fallback behavior.
const SELECTED_GROUP_COLOR = '#0F766E'
const NON_SELECTED_GROUP_COLOR = '#D97706'
const DENSITY_SAMPLE_COUNT = 121
const EMPTY_DENSITY = { demRows: [], repRows: [] }
const EMPTY_OPTION_VALUE = ''
const EI_GROUP_OPTIONS = [
  { value: 'white_pct', label: 'White' },
  { value: 'latino_pct', label: 'Hispanic/Latino' },
]

// Baseline fallback EI distributions used when no state/group-specific preset is defined.
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

// State/group-specific dummy EI presets used to make demo output realistic and separated.
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

// Converts null/undefined to empty string so regex/string checks are safe.
function getSafeString(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

// Prefers a Latino/Hispanic option to align the default chart view with class examples.
function findLatinoOption(options) {
  const safeOptions = Array.isArray(options) ? options : []
  return safeOptions.find((option) => {
    const valueText = getSafeString(option && option.value)
    const labelText = getSafeString(option && option.label)
    const valueMatches = /latino|hisp/i.test(valueText)
    const labelMatches = /latino|hispanic/i.test(labelText)
    return valueMatches || labelMatches
  })
}

// Computes default dropdown value (Latino first when present, else first option).
function getDefaultGroupValue(groupOptions) {
  const latinoOption = findLatinoOption(groupOptions)
  if (latinoOption && latinoOption.value !== undefined && latinoOption.value !== null) return latinoOption.value
  if (groupOptions.length > 0 && groupOptions[0].value !== undefined && groupOptions[0].value !== null) {
    return groupOptions[0].value
  }
  return EMPTY_OPTION_VALUE
}

// Ensures selected value is valid for current option set, else falls back to default.
function getEffectiveGroupValue(selectedGroup, groupOptions, defaultGroupValue) {
  const selectedExists = groupOptions.some((option) => option.value === selectedGroup)
  if (selectedExists) return selectedGroup
  return defaultGroupValue
}

// Creates labels for selected group and comparison "non-selected" group in legends.
function getGroupLabels(groupOptions, effectiveGroup) {
  const selectedOption = groupOptions.find((group) => group.value === effectiveGroup)
  let selectedGroupLabel = effectiveGroup
  if (selectedOption && selectedOption.label) {
    selectedGroupLabel = selectedOption.label
  }

  let nonSelectedGroupLabel = 'Non-selected group'
  if (selectedGroupLabel) {
    nonSelectedGroupLabel = `Non-${selectedGroupLabel}`
  }

  return {
    selectedGroupLabel,
    nonSelectedGroupLabel,
  }
}

// Standard Gaussian PDF used as the base for EI-style density curves.
function gaussianPdf(x, mean, std) {
  const safeStd = Math.max(0.02, Number(std) || 0.08)
  const exponent = -0.5 * ((x - mean) / safeStd) ** 2
  return (1 / (safeStd * Math.sqrt(2 * Math.PI))) * Math.exp(exponent)
}

// Evaluates a weighted Gaussian mixture at x.
function gaussianMixturePdf(x, components) {
  if (!Array.isArray(components) || components.length === 0) return 0
  const totalWeightRaw = components.reduce((sum, component) => {
    const weightValue = component && component.weight
    return sum + (Number(weightValue) || 0)
  }, 0)
  const totalWeight = totalWeightRaw || 1

  return components.reduce((sum, component) => {
    const rawWeight = component && component.weight
    const rawMean = component && component.mean
    const rawStd = component && component.std
    const weight = (Number(rawWeight) || 0) / totalWeight
    const mean = Number(rawMean)
    const std = Number(rawStd)
    return sum + (weight * gaussianPdf(x, mean, std))
  }, 0)
}

// Samples a full density curve as chart rows across [0,1].
function buildDensityRows(curves) {
  return Array.from({ length: DENSITY_SAMPLE_COUNT }, (_, index) => {
    const x = index / (DENSITY_SAMPLE_COUNT - 1)
    return {
      x,
      group: gaussianMixturePdf(x, curves.group),
      nonGroup: gaussianMixturePdf(x, curves.nonGroup),
    }
  })
}

// Returns state/group preset curve parameters, or the default preset.
function getCurvePreset(stateCode, groupKey) {
  const statePreset = STATE_GROUP_CURVES[stateCode]
  if (!statePreset) return DEFAULT_CURVES
  const groupPreset = statePreset[groupKey]
  if (!groupPreset) return DEFAULT_CURVES
  return groupPreset
}

// Formatting helpers for axis and tooltip values.
const formatDensity = (value) => (Number.isFinite(value) ? value.toFixed(2) : '0.00')
const formatSupportShare = (value) => Number(value).toFixed(1)
const formatTooltipSupportShare = (value) => `Support share: ${Number(value).toFixed(2)}`

// Builds chart-ready density rows for Democratic and Republican candidate panels.
function buildDensityByCandidate(stateCode, effectiveGroup) {
  if (!effectiveGroup) return EMPTY_DENSITY
  const preset = getCurvePreset(stateCode, effectiveGroup)
  return {
    demRows: buildDensityRows(preset.dem),
    repRows: buildDensityRows(preset.rep),
  }
}

// Reusable EI panel that draws one candidate's group vs non-group density curves.
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
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tickCount={6}
            height={44}
            tickFormatter={formatSupportShare}
            label={{ value: 'Support share', position: 'insideBottom', dy: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatDensity(Number(value))}
            width={62}
            label={{ value: 'Density', angle: -90, position: 'insideLeft', dx: -2 }}
          />
          <Tooltip
            formatter={(value, name) => [formatDensity(Number(value)), name]}
            labelFormatter={formatTooltipSupportShare}
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

// Main EI chart component with group selector and two candidate support panels.
function EICurve({ stateCode }) {
  // EI dropdown intentionally stays fixed to White and Hispanic/Latino for both states.
  const groupOptions = EI_GROUP_OPTIONS
  const defaultGroupValue = getDefaultGroupValue(groupOptions)
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupValue)

  // Keeps current selection valid if state changes and options are different.
  const effectiveGroup = getEffectiveGroupValue(
    selectedGroup,
    groupOptions,
    defaultGroupValue,
  )
  const { selectedGroupLabel, nonSelectedGroupLabel } = getGroupLabels(groupOptions, effectiveGroup)
  const densityByCandidate = useMemo(
    () => buildDensityByCandidate(stateCode, effectiveGroup),
    [stateCode, effectiveGroup],
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
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
          labelA={selectedGroupLabel}
          labelB={nonSelectedGroupLabel}
        />
        <CurvePanel
          title="Support for Republican Candidate"
          data={densityByCandidate.repRows}
          labelA={selectedGroupLabel}
          labelB={nonSelectedGroupLabel}
        />
      </div>
    </div>
  )
}

export default EICurve
