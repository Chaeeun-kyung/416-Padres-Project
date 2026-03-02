import metricConfig from '../data/mock/metricConfig.json'
import stateSummary from '../data/mock/stateSummary.json'
import { buildGroupOptions } from '../data/racialGroupConfig'
import { STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import SegmentedControl from '../ui/components/SegmentedControl'
import Select from '../ui/components/Select'
import ToggleSwitch from '../ui/components/ToggleSwitch'

const TABS = ['Map', 'Gingles', 'EI', 'Ensembles']
const STATE_OPTIONS = [
  { value: 'CO', label: 'CO' },
  { value: 'AZ', label: 'AZ' },
]

function LeftControls() {
  const selectedStateCode = useAppStore((state) => state.selectedStateCode)
  const setSelectedStateCode = useAppStore((state) => state.setSelectedStateCode)
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const showDistrictBoundaries = useAppStore((state) => state.showDistrictBoundaries)
  const showPrecinctBoundaries = useAppStore((state) => state.showPrecinctBoundaries)
  const showDemLeadOverlay = useAppStore((state) => state.showDemLeadOverlay)
  const toggleDistrictBoundaries = useAppStore((state) => state.toggleDistrictBoundaries)
  const togglePrecinctBoundaries = useAppStore((state) => state.togglePrecinctBoundaries)
  const toggleDemLeadOverlay = useAppStore((state) => state.toggleDemLeadOverlay)
  const activeMetric = useAppStore((state) => state.activeMetric)
  const setActiveMetric = useAppStore((state) => state.setActiveMetric)
  const summary = stateSummary?.[selectedStateCode]

  const demographicMetrics = metricConfig.filter((metric) => metric.key !== 'pct_dem_lead')
  const feasibleDemographicOptions = buildGroupOptions(
    demographicMetrics.map((metric) => metric.key),
    summary,
    Object.fromEntries(demographicMetrics.map((metric) => [metric.key, metric.label])),
    { includeOnlyFeasible: true },
  )
  const metricOptions = [
    { value: '', label: 'None' },
    ...feasibleDemographicOptions,
  ]
  const effectiveMetric = metricOptions.some((option) => option.value === activeMetric)
    ? activeMetric
    : ''

  return (
    <aside className="dashboard-sidebar">
      <Card title="State" subtitle="- Select a state">
        <SegmentedControl
          ariaLabel="State selector"
          options={STATE_OPTIONS}
          value={selectedStateCode}
          onChange={setSelectedStateCode}
        />
        <div className="small-text" style={{ marginTop: 'var(--ui-space-sm)', fontWeight: 700, color: 'var(--ui-text)' }}>
          {STATE_META[selectedStateCode]?.name ?? 'No state selected'}
        </div>
      </Card>

      <Card title="Map/Charts" subtitle="- Choose one of these options">
        <div className="plan-tabs">
          {TABS.map((tab) => (
            <Button key={tab} variant={activeTab === tab ? 'primary' : 'ghost'} block onClick={() => setActiveTab(tab)}>
              {tab === 'Ensembles' ? 'Ensemble Analysis' : tab}
            </Button>
          ))}
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
