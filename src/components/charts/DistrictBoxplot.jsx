import { useState } from 'react'
import Plot from 'react-plotly.js'
import districtBoxplot from '../../data/mock/districtBoxplot.json'
import { buildGroupOptions, FEASIBLE_THRESHOLD_MILLIONS, RACIAL_GROUPS } from '../../data/racialGroupConfig'
import stateSummary from '../../data/mock/stateSummary.json'
import Select from '../../ui/components/Select'

const ENSEMBLE_OPTIONS = [
  { value: 'raceBlind', label: 'Race-blind Ensemble' },
  { value: 'vraConstrained', label: 'VRA-constrained Ensemble' },
]

const GROUP_OFFSETS = {
  white_pct: 0.012,
  black_pct: 0,
  latino_pct: 0.03,
  native_american_pct: 0.022,
  asian_pct: -0.018,
}

const ENSEMBLE_OFFSETS = {
  raceBlind: 0,
  vraConstrained: 0.012,
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function DistrictBoxplot({ stateCode }) {
  const stateData = districtBoxplot?.[stateCode]
  const summary = stateSummary?.[stateCode]
  const baseDistributions = stateData?.distributions ?? {}
  const baseEnacted = stateData?.enacted ?? {}
  const districtIds = Object.keys(baseDistributions)
  const groupOptions = (() => {
    const feasibleOnly = buildGroupOptions(
      RACIAL_GROUPS.map((group) => group.key),
      summary,
      {},
      { includeOnlyFeasible: true, includeOnlyMinorities: true },
    )
    if (feasibleOnly.length) return feasibleOnly
    return buildGroupOptions(RACIAL_GROUPS.map((group) => group.key), summary, {}, { includeOnlyMinorities: true })
  })()
  const [selectedGroup, setSelectedGroup] = useState(groupOptions[0]?.value ?? 'black_pct')
  const [selectedEnsemble, setSelectedEnsemble] = useState(ENSEMBLE_OPTIONS[0].value)
  const effectiveGroup = groupOptions.some((option) => option.value === selectedGroup)
    ? selectedGroup
    : (groupOptions[0]?.value ?? 'black_pct')

  if (!districtIds.length) {
    return <div className="small-text muted-text">No district distribution data available.</div>
  }

  const groupOffset = GROUP_OFFSETS[effectiveGroup] ?? 0
  const ensembleOffset = ENSEMBLE_OFFSETS[selectedEnsemble] ?? 0

  const adjustedEnacted = {}
  districtIds.forEach((districtId, index) => {
    const baseValue = Number(baseEnacted[districtId] ?? 0)
    adjustedEnacted[districtId] = clamp01(baseValue + groupOffset + ensembleOffset + index * 0.0015)
  })

  const orderedDistrictIds = [...districtIds].sort((a, b) => adjustedEnacted[a] - adjustedEnacted[b])
  const adjustedDistributions = {}
  orderedDistrictIds.forEach((districtId, districtIndex) => {
    adjustedDistributions[districtId] = (baseDistributions[districtId] ?? []).map((value, rowIndex) =>
      clamp01(Number(value) + groupOffset + ensembleOffset + districtIndex * 0.001 + rowIndex * 0.0004),
    )
  })

  const boxTraces = orderedDistrictIds.map((districtId) => ({
    type: 'box',
    name: districtId,
    y: adjustedDistributions[districtId],
    boxpoints: false,
    marker: { color: '#94a3b8' },
    line: { color: '#475569' },
  }))

  const enactedTrace = {
    type: 'scatter',
    mode: 'markers',
    x: orderedDistrictIds,
    y: orderedDistrictIds.map((districtId) => adjustedEnacted[districtId]),
    name: 'Enacted Plan',
    marker: {
      color: '#dc2626',
      size: 8,
      symbol: 'circle',
    },
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>District Boxplot</div>
          <div className="small-text muted-text">
            Districts are sorted by enacted minority share for the selected group. Feasible: over {FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)}M CVAP.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, minWidth: 330 }}>
          <Select
            ariaLabel="Boxplot demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
          <Select
            ariaLabel="Boxplot ensemble type"
            value={selectedEnsemble}
            onChange={setSelectedEnsemble}
            options={ENSEMBLE_OPTIONS}
          />
        </div>
      </div>
      <Plot
        data={[...boxTraces, enactedTrace]}
        layout={{
          autosize: true,
          margin: { l: 40, r: 10, t: 10, b: 34 },
          showlegend: true,
          yaxis: { range: [0, 1], tickformat: '.0%' },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '90%' }}
      />
    </div>
  )
}

export default DistrictBoxplot
