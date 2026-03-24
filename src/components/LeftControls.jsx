import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import useAppStore from '../store/useAppStore'
import Card from '../ui/components/Card'
import Select from '../ui/components/Select'
import ToggleSwitch from '../ui/components/ToggleSwitch'
import metricConfig from '../data/mock/metricConfig.json'

const STATE_OPTIONS = [
  { value: 'CO', label: 'Colorado (CO)' },
  { value: 'AZ', label: 'Arizona (AZ)' },
]
const PRECINCT_DATA_OPTIONS = [
  { value: 'enacted', label: 'Enacted + CVAP' },
  { value: 'cvap', label: 'Original CVAP only' },
]
const FEASIBLE_GROUP_MIN_MILLIONS = 0.4
const FEASIBLE_GROUP_KEYS = ['white_pct', 'latino_pct']
const HEATMAP_BASE_OPTIONS = metricConfig.filter((metric) => metric.key !== 'pct_dem_lead')

// Guards against stale selections after state/data changes.
// If selected metric is no longer available, fall back to None.
function getEffectiveMetric(metricOptions, activeMetric) {
  const activeMetricExists = metricOptions.some((option) => option.value === activeMetric)
  if (activeMetricExists) return activeMetric
  return ''
}

// Left sidebar control panel.
// Responsibilities:
// 1) State selection
// 2) Layer visibility toggles
// 3) Demographic heatmap group selection
// 4) Context guidance for district table interaction
function LeftControls() {
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
  const [feasibleGroupKeys, setFeasibleGroupKeys] = useState(FEASIBLE_GROUP_KEYS)
  const metricOptions = useMemo(() => ([
    { value: '', label: 'None' },
    ...HEATMAP_BASE_OPTIONS
      .filter((metric) => feasibleGroupKeys.includes(metric.key))
      .map((metric) => ({ value: metric.key, label: metric.label })),
  ]), [feasibleGroupKeys])
  const firstAvailableMetric = metricOptions.find((option) => option.value)?.value ?? ''
  const effectiveMetric = getEffectiveMetric(metricOptions, activeMetric)

  useEffect(() => {
    let cancelled = false

    async function loadFeasibleGroups() {
      if (!selectedStateCode) {
        setFeasibleGroupKeys(FEASIBLE_GROUP_KEYS)
        return
      }

      try {
        const response = await axios.get(`/api/states/${selectedStateCode}/summary`)
        const millions = response.data?.racialEthnicPopulationMillions ?? {}
        const nextKeys = FEASIBLE_GROUP_KEYS.filter((key) => Number(millions[key]) > FEASIBLE_GROUP_MIN_MILLIONS)
        if (!cancelled) {
          setFeasibleGroupKeys(nextKeys.length > 0 ? nextKeys : FEASIBLE_GROUP_KEYS)
        }
      } catch {
        if (!cancelled) {
          setFeasibleGroupKeys(FEASIBLE_GROUP_KEYS)
        }
      }
    }

    loadFeasibleGroups()

    return () => {
      cancelled = true
    }
  }, [selectedStateCode])

  // If selected metric disappears after a state/data change, auto-correct it.
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
