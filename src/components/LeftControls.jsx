import { useEffect, useMemo } from 'react'
import metricConfig from '../data/mock/metricConfig.json'
import { buildGroupOptions } from '../data/racialGroupConfig'
import useAppStore from '../store/useAppStore'
import Card from '../ui/components/Card'
import Select from '../ui/components/Select'
import ToggleSwitch from '../ui/components/ToggleSwitch'

const STATE_OPTIONS = [
  { value: 'CO', label: 'Colorado (CO)' },
  { value: 'AZ', label: 'Arizona (AZ)' },
]
const PRECINCT_DATA_OPTIONS = [
  { value: 'enacted', label: 'Enacted + CVAP' },
  { value: 'cvap', label: 'Original CVAP only' },
]
const CVAP_TOTAL_FIELD = 'CVAP_TOT24'
const CVAP_GROUP_FIELDS = {
  white_pct: 'CVAP_WHT24',
  black_pct: 'CVAP_BLA24',
  latino_pct: 'CVAP_HSP24',
  asian_pct: 'CVAP_ASI24',
}
const DEMOGRAPHIC_METRICS = metricConfig.filter((metric) => metric.key !== 'pct_dem_lead')
const DEMOGRAPHIC_METRIC_LABELS = Object.fromEntries(
  DEMOGRAPHIC_METRICS.map((metric) => [metric.key, metric.label]),
)

function buildCvapSummaryForFeasible(features) {
  if (!Array.isArray(features) || !features.length) return null

  let totalCvap = 0
  let hasTotalCvap = false
  const groupTotals = Object.fromEntries(Object.keys(CVAP_GROUP_FIELDS).map((groupKey) => [groupKey, 0]))

  ;(features ?? []).forEach((feature) => {
    const props = feature?.properties ?? {}
    const total = Number(props[CVAP_TOTAL_FIELD])
    if (Number.isFinite(total)) {
      totalCvap += total
      hasTotalCvap = true
    }

    Object.entries(CVAP_GROUP_FIELDS).forEach(([groupKey, fieldName]) => {
      const value = Number(props[fieldName])
      if (Number.isFinite(value)) {
        groupTotals[groupKey] += value
      }
    })
  })

  if (!hasTotalCvap || totalCvap <= 0) return null

  const racialEthnicPopulationMillions = {}
  Object.keys(CVAP_GROUP_FIELDS).forEach((groupKey) => {
    racialEthnicPopulationMillions[groupKey] = groupTotals[groupKey] / 1000000
  })

  return { racialEthnicPopulationMillions }
}

function LeftControls({ precinctGeojson }) {
  const selectedStateCode = useAppStore((state) => state.selectedStateCode)
  const setSelectedStateCode = useAppStore((state) => state.setSelectedStateCode)
  const showDistrictBoundaries = useAppStore((state) => state.showDistrictBoundaries)
  const showPrecinctBoundaries = useAppStore((state) => state.showPrecinctBoundaries)
  const showDemLeadOverlay = useAppStore((state) => state.showDemLeadOverlay)
  const precinctDataVariant = useAppStore((state) => state.precinctDataVariant)
  const toggleDistrictBoundaries = useAppStore((state) => state.toggleDistrictBoundaries)
  const togglePrecinctBoundaries = useAppStore((state) => state.togglePrecinctBoundaries)
  const toggleDemLeadOverlay = useAppStore((state) => state.toggleDemLeadOverlay)
  const activeMetric = useAppStore((state) => state.activeMetric)
  const setActiveMetric = useAppStore((state) => state.setActiveMetric)
  const setPrecinctDataVariant = useAppStore((state) => state.setPrecinctDataVariant)
  const cvapSummaryForFeasible = useMemo(
    () => buildCvapSummaryForFeasible(precinctGeojson?.features ?? []),
    [precinctGeojson?.features],
  )

  const feasibleDemographicOptions = useMemo(
    () => buildGroupOptions(
      DEMOGRAPHIC_METRICS.map((metric) => metric.key),
      cvapSummaryForFeasible,
      DEMOGRAPHIC_METRIC_LABELS,
      {
        includeOnlyFeasible: Boolean(cvapSummaryForFeasible),
        includeOnlyMinorities: true,
      },
    ),
    [cvapSummaryForFeasible],
  )
  const metricOptions = useMemo(
    () => [{ value: '', label: 'None' }, ...feasibleDemographicOptions],
    [feasibleDemographicOptions],
  )
  const firstAvailableMetric = metricOptions.find((option) => option.value)?.value ?? ''
  const effectiveMetric = metricOptions.some((option) => option.value === activeMetric)
    ? activeMetric
    : ''

  useEffect(() => {
    if (activeMetric && !metricOptions.some((option) => option.value === activeMetric)) {
      setActiveMetric(firstAvailableMetric)
    }
  }, [activeMetric, firstAvailableMetric, metricOptions, setActiveMetric])

  return (
    <aside className="dashboard-sidebar">
      <Card title="State" subtitle="- Select a state">
        <Select
          ariaLabel="State selector"
          value={selectedStateCode ?? ''}
          onChange={setSelectedStateCode}
          options={STATE_OPTIONS}
        />
      </Card>

      <Card title="Precinct Dataset" subtitle="- Switch between original and enacted-plan data">
        <Select
          ariaLabel="Precinct dataset selector"
          value={precinctDataVariant}
          onChange={setPrecinctDataVariant}
          options={PRECINCT_DATA_OPTIONS}
        />
        <div className="small-text muted-text" style={{ marginTop: 8, lineHeight: 1.45 }}>
          {precinctDataVariant === 'cvap'
            ? 'Original CVAP only includes precinct voting and demographic data.'
            : 'Enacted + CVAP also includes enacted congressional district assignment fields.'}
        </div>
      </Card>

      <Card title="Boundaries">
        <div className="control-row">
          <span className="small-text">District boundaries</span>
          <ToggleSwitch checked={showDistrictBoundaries} onChange={toggleDistrictBoundaries} ariaLabel="District boundaries" />
        </div>
        <div className="control-row">
          <span className="small-text">Precinct boundaries</span>
          <ToggleSwitch checked={showPrecinctBoundaries} onChange={togglePrecinctBoundaries} ariaLabel="Precinct boundaries" />
        </div>
        <div className="control-row">
          <span className="small-text">Dem Lead % (2024 Presidential)</span>
          <ToggleSwitch checked={showDemLeadOverlay} onChange={toggleDemLeadOverlay} ariaLabel="Dem lead overlay" />
        </div>
      </Card>

      <Card title="Demographic Heatmap" subtitle="- Choose a racial/ethnic group">
        <Select
          ariaLabel="Metric selector"
          value={effectiveMetric}
          onChange={setActiveMetric}
          options={metricOptions}
        />
      </Card>

      <Card title="Congressional Representation">
        <div className="small-text muted-text">
          - Click a district to view details in the table on the right.
        </div>
      </Card>
    </aside>
  )
}

export default LeftControls
