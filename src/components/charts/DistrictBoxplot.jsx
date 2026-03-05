import { useState } from 'react'
import Plot from 'react-plotly.js'
import districtBoxplot from '../../data/mock/districtBoxplot.json'
import { buildGroupOptions, RACIAL_GROUPS } from '../../data/racialGroupConfig'
import stateSummary from '../../data/mock/stateSummary.json'
import Info from '../../ui/components/Info'
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

function findLatinoOption(options) {
  return (options ?? []).find((option) => (
    /latino|hisp/i.test(String(option?.value ?? ''))
    || /latino|hispanic/i.test(String(option?.label ?? ''))
  ))
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
  const defaultGroupValue = findLatinoOption(groupOptions)?.value ?? groupOptions[0]?.value ?? 'black_pct'
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupValue)
  const [selectedEnsemble, setSelectedEnsemble] = useState(ENSEMBLE_OPTIONS[0].value)
  const effectiveGroup = groupOptions.some((option) => option.value === selectedGroup)
    ? selectedGroup
    : defaultGroupValue

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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 0 }}>District Boxplot</div>
          <Info
            label="Boxplot info"
            text={(
            <>
            This chart shows how minority population is typically distributed across districts in the ensemble.
            <br />
            Each box shows the typical range for a district rank, and the dots indicate the enacted plan's district values for comparison.
            </>
            )}
          />
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
          margin: { l: 58, r: 10, t: 10, b: 52 },
          showlegend: true,
          xaxis: {
            title: { text: 'District (sorted by enacted minority share)' },
            automargin: true,
          },
          yaxis: {
            range: [0, 1],
            tickformat: '.0%',
            title: { text: 'Minority share (%)' },
            automargin: true,
          },
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
