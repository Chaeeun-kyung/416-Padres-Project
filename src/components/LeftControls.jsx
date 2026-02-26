import metricConfig from '../data/mock/metricConfig.json'
import stateSummary from '../data/mock/stateSummary.json'
import { buildGroupOptions } from '../data/racialGroupConfig'
import { STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import Divider from '../ui/components/Divider'
import SegmentedControl from '../ui/components/SegmentedControl'
import Select from '../ui/components/Select'
import ToggleSwitch from '../ui/components/ToggleSwitch'

const TABS = ['Map', 'Demographics', 'Gingles', 'EI', 'Ensembles']
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
  const showChoropleth = useAppStore((state) => state.showChoropleth)
  const toggleDistrictBoundaries = useAppStore((state) => state.toggleDistrictBoundaries)
  const toggleChoropleth = useAppStore((state) => state.toggleChoropleth)
  const activeMetric = useAppStore((state) => state.activeMetric)
  const setActiveMetric = useAppStore((state) => state.setActiveMetric)
  const resetDashboardPage = useAppStore((state) => state.resetDashboardPage)
  const resetApp = useAppStore((state) => state.resetApp)
  const summary = stateSummary?.[selectedStateCode]

  const pctLeadMetric = metricConfig.find((metric) => metric.key === 'pct_dem_lead')
  const demographicMetrics = metricConfig.filter((metric) => metric.key !== 'pct_dem_lead')
  const feasibleDemographicOptions = buildGroupOptions(
    demographicMetrics.map((metric) => metric.key),
    summary,
    Object.fromEntries(demographicMetrics.map((metric) => [metric.key, metric.label])),
    { includeOnlyFeasible: true },
  )
  const metricOptions = [
    { value: pctLeadMetric?.key ?? 'pct_dem_lead', label: pctLeadMetric?.label ?? 'Dem Lead % (2024)' },
    ...feasibleDemographicOptions,
  ]
  const effectiveMetric = metricOptions.some((option) => option.value === activeMetric)
    ? activeMetric
    : (pctLeadMetric?.key ?? 'pct_dem_lead')

  return (
    <aside className="dashboard-sidebar">
      <Card title="State" subtitle="1) Select a state">
        <SegmentedControl
          ariaLabel="State selector"
          options={STATE_OPTIONS}
          value={selectedStateCode}
          onChange={setSelectedStateCode}
        />
        <div className="small-text muted-text" style={{ marginTop: 'var(--ui-space-sm)' }}>
          {STATE_META[selectedStateCode]?.name ?? 'No state selected'}
        </div>
      </Card>

      <Card title="Plan" subtitle="2) Choose a tab">
        <div className="plan-tabs">
          {TABS.map((tab) => (
            <Button key={tab} variant={activeTab === tab ? 'primary' : 'ghost'} block onClick={() => setActiveTab(tab)}>
              {tab}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="Layers">
        <div className="control-row">
          <span className="small-text">District boundaries</span>
          <ToggleSwitch checked={showDistrictBoundaries} onChange={toggleDistrictBoundaries} ariaLabel="District boundaries" />
        </div>
        <div className="control-row">
          <span className="small-text">Precinct choropleth</span>
          <ToggleSwitch checked={showChoropleth} onChange={toggleChoropleth} ariaLabel="Precinct choropleth" />
        </div>
      </Card>

      <Card title="Race/Ethnicity">
        <Select
          ariaLabel="Metric selector"
          value={effectiveMetric}
          onChange={setActiveMetric}
          options={metricOptions}
        />
      </Card>

      <Card title="Legend">
        <div className="small-text muted-text">
          3) Click districts or precincts for details.
          <br />
          Choropleth bins are loaded from config with dynamic fallback.
        </div>
      </Card>

      <Card title="Actions">
        <Button variant="secondary" block onClick={resetDashboardPage}>
          Reset Page
        </Button>
        <Button variant="secondary" block onClick={resetApp}>
          Back to Map
        </Button>
        <Divider />
        {/* <Button variant="ghost" block disabled>
          Export Screenshot
        </Button> */}
        <Button variant="primary" block onClick={() => setActiveTab('Ensembles')}>
          Go to Analysis
        </Button>
      </Card>
    </aside>
  )
}

export default LeftControls
