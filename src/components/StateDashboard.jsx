import { useRef, useState } from 'react'
import BottomDrawer from './BottomDrawer'
import LeftControls from './LeftControls'
import MapPanel from './MapPanel'
import RightDetails from './RightDetails'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'

const LEFT_PANEL_WIDTH = 280
const RIGHT_PANEL_MIN_WIDTH = 370
const MAP_PANEL_MIN_WIDTH = 320

function StateDashboard() {
  const selectedStateCode = useAppStore((state) => state.selectedStateCode)
  const resetDashboardPage = useAppStore((state) => state.resetDashboardPage)
  const resetApp = useAppStore((state) => state.resetApp)
  const [precinctGeojson, setPrecinctGeojson] = useState(null)
  const [loadingMapData, setLoadingMapData] = useState(false)
  const [mapError, setMapError] = useState('')
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_MIN_WIDTH)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const gridRef = useRef(null)

  function handleSidebarResizeStart(event) {
    if (!gridRef.current) return

    event.preventDefault()
    const startX = event.clientX
    const startWidth = rightPanelWidth
    const gridRect = gridRef.current.getBoundingClientRect()
    const gridStyle = window.getComputedStyle(gridRef.current)
    const gridGap = Number.parseFloat(gridStyle.columnGap || gridStyle.gap || '0') || 0
    const maxWidth = Math.max(
      RIGHT_PANEL_MIN_WIDTH,
      gridRect.width - LEFT_PANEL_WIDTH - MAP_PANEL_MIN_WIDTH - (gridGap * 3) - 10,
    )

    setIsResizingSidebar(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function handlePointerMove(moveEvent) {
      const delta = startX - moveEvent.clientX
      const nextWidth = startWidth + delta
      setRightPanelWidth(Math.max(RIGHT_PANEL_MIN_WIDTH, Math.min(maxWidth, nextWidth)))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      setIsResizingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div className="dashboard-shell">
      <Card className="dashboard-topbar" compact>
        <div className="dashboard-topbar__row">
          <div>
            <h1 className="dashboard-title">CSE 416 Project Dashboard</h1>
          </div>
          <div className="dashboard-topbar__meta">
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

      <div
        className="dashboard-grid"
        ref={gridRef}
        style={{ '--right-sidebar-width': `${rightPanelWidth}px` }}
      >
        <LeftControls precinctGeojson={precinctGeojson} />
        <MapPanel
          selectedStateCode={selectedStateCode}
          onPrecinctGeojsonLoaded={setPrecinctGeojson}
          setLoadingMapData={setLoadingMapData}
          setMapError={setMapError}
          loadingMapData={loadingMapData}
        />
        <div
          className={`dashboard-resize-handle${isResizingSidebar ? ' dashboard-resize-handle--active' : ''}`}
          role="separator"
          aria-label="Resize right sidebar"
          aria-orientation="vertical"
          onPointerDown={handleSidebarResizeStart}
        />
        <div className="dashboard-right-pane">
          <RightDetails selectedStateCode={selectedStateCode} precinctGeojson={precinctGeojson} loading={loadingMapData} />
        </div>
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

