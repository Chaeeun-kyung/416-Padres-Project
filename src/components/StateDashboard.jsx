import { useMemo, useState } from 'react'
import BottomDrawer from './BottomDrawer'
import LeftControls from './LeftControls'
import MapPanel from './MapPanel'
import RightDetails from './RightDetails'
import { STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'
import Badge from '../ui/components/Badge'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'

function StateDashboard() {
  const selectedStateCode = useAppStore((state) => state.selectedStateCode)
  const resetDashboardPage = useAppStore((state) => state.resetDashboardPage)
  const resetApp = useAppStore((state) => state.resetApp)
  const [precinctGeojson, setPrecinctGeojson] = useState(null)
  const [loadingMapData, setLoadingMapData] = useState(false)
  const [mapError, setMapError] = useState('')

  const stateName = useMemo(() => STATE_META[selectedStateCode]?.name ?? selectedStateCode, [selectedStateCode])

  return (
    <div className="dashboard-shell">
      <Card className="dashboard-topbar" compact>
        <div className="dashboard-topbar__row">
          <div>
            <h1 className="dashboard-title">CSE 416 Redistricting Dashboard</h1>
            <div className="small-text muted-text">{stateName}</div>
          </div>
          <div className="dashboard-topbar__meta">
            <Badge>Based on 2024 Presidential (Precinct-Level)</Badge>
            <Button variant="secondary" onClick={resetDashboardPage}>
              Reset Page
            </Button>
            <Button variant="secondary" onClick={resetApp}>
              Back to Map
            </Button>
          </div>
        </div>
        <div className="dashboard-method-note">
          We use CVAP (2020-2024 ACS 5-year) as the population denominator for racial/ethnic percentages, and 2024 presidential election results as the source of
          precinct vote totals for party vote share, consistently throughout the application.
        </div>
      </Card>

      <div className="dashboard-grid">
        <LeftControls />
        <MapPanel
          selectedStateCode={selectedStateCode}
          onPrecinctGeojsonLoaded={setPrecinctGeojson}
          setLoadingMapData={setLoadingMapData}
          setMapError={setMapError}
        />
        <RightDetails selectedStateCode={selectedStateCode} precinctGeojson={precinctGeojson} loading={loadingMapData} />
      </div>

      <BottomDrawer
        selectedStateCode={selectedStateCode}
        precinctFeatures={precinctGeojson?.features ?? []}
        mapError={mapError}
      />
    </div>
  )
}

export default StateDashboard

