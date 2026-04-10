import { useEffect, useRef, useState } from 'react'
import LeftControls from './LeftControls'
import MapPanel from './MapPanel'
import RightDetails from './RightDetails'
import { STATE_META } from '../data/stateMeta'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'

const LEFT_PANEL_WIDTH = 280
const RIGHT_PANEL_MIN_WIDTH = 370
const MAP_PANEL_MIN_WIDTH = 320
const RIGHT_PANEL_SUMMARY_WIDTH = RIGHT_PANEL_MIN_WIDTH
const ANALYSIS_RIGHT_PANEL_RATIO = 0.5
const GINGLES_RIGHT_PANEL_RATIO = 0.68
const ANALYSIS_TABS = new Set(['Gingles', 'EI', 'Ensembles'])

const STATE_PRECLEARANCE_LABEL = {
  AZ: 'Preclearance State',
  CO: 'Non-preclearance State',
}

// Main dashboard layout manager.
// Responsibilities:
// 1) Coordinate left controls, center map, and right analysis/details panel
// 2) Load/hold currently selected state's precinct GeoJSON at dashboard scope
// 3) Resize right panel (auto sizing for analysis tabs + manual drag handle)
// 4) Provide top-level page actions (reset page, back to splash map)
function StateDashboard() {
  const selectedStateCode = useAppStore((state) => state.selectedStateCode)
  const activeTab = useAppStore((state) => state.activeTab)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const resetDashboardPage = useAppStore((state) => state.resetDashboardPage)
  const resetApp = useAppStore((state) => state.resetApp)
  const [precinctGeojson, setPrecinctGeojson] = useState(null)
  const [loadingMapData, setLoadingMapData] = useState(false)
  const [, setMapError] = useState('')
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_MIN_WIDTH)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const gridRef = useRef(null)
  const previousPanelModeRef = useRef(
    activeTab === 'Gingles'
      ? 'gingles'
      : ((ANALYSIS_TABS.has(activeTab) || selectedDistrictId) ? 'analysis' : 'summary'),
  )
  const selectedStateName = STATE_META[selectedStateCode]?.name ?? 'State Dashboard'
  const preclearanceLabel = STATE_PRECLEARANCE_LABEL[selectedStateCode] ?? ''

  // Computes safe width limits for right panel based on current grid size.
  // We keep left and map panes usable while allowing chart tabs to expand.
  function getRightPanelWidthBounds() {
    if (!gridRef.current) {
      return { minWidth: RIGHT_PANEL_MIN_WIDTH, maxWidth: RIGHT_PANEL_MIN_WIDTH, paneAvailableWidth: RIGHT_PANEL_MIN_WIDTH }
    }

    const gridRect = gridRef.current.getBoundingClientRect()
    const gridStyle = window.getComputedStyle(gridRef.current)
    const gridGap = Number.parseFloat(gridStyle.columnGap || gridStyle.gap || '0') || 0
    const paneAvailableWidth = gridRect.width - LEFT_PANEL_WIDTH - (gridGap * 3) - 10
    const maxWidth = Math.max(
      RIGHT_PANEL_MIN_WIDTH,
      gridRect.width - LEFT_PANEL_WIDTH - MAP_PANEL_MIN_WIDTH - (gridGap * 3) - 10,
    )
    return { minWidth: RIGHT_PANEL_MIN_WIDTH, maxWidth, paneAvailableWidth }
  }

  useEffect(() => {
    const panelMode = activeTab === 'Gingles'
      ? 'gingles'
      : ((ANALYSIS_TABS.has(activeTab) || selectedDistrictId) ? 'analysis' : 'summary')
    const previousPanelMode = previousPanelModeRef.current
    if (panelMode === previousPanelMode) return

    previousPanelModeRef.current = panelMode
    const frameId = requestAnimationFrame(() => {
      const { minWidth, maxWidth, paneAvailableWidth } = getRightPanelWidthBounds()
      if (panelMode === 'gingles') {
        const targetWidth = paneAvailableWidth * GINGLES_RIGHT_PANEL_RATIO
        setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, targetWidth)))
        return
      }
      if (panelMode === 'analysis') {
        const targetWidth = paneAvailableWidth * ANALYSIS_RIGHT_PANEL_RATIO
        setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, targetWidth)))
        return
      }
      setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, RIGHT_PANEL_SUMMARY_WIDTH)))
    })
    return () => cancelAnimationFrame(frameId)
  }, [activeTab, selectedDistrictId])

  // Manual resize handler for the right panel drag bar.
  // Pointer movement adjusts width in real time, clamped to computed bounds.
  function handleSidebarResizeStart(event) {
    if (!gridRef.current) return

    event.preventDefault()
    const startX = event.clientX
    const startWidth = rightPanelWidth
    const { minWidth, maxWidth } = getRightPanelWidthBounds()

    setIsResizingSidebar(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function handlePointerMove(moveEvent) {
      const delta = startX - moveEvent.clientX
      const nextWidth = startWidth + delta
      setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)))
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
          <div className="dashboard-topbar__state-block">
            <h1 className="dashboard-title">{selectedStateName}</h1>
            {preclearanceLabel && (
              <div className="small-text muted-text">{preclearanceLabel}</div>
            )}
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
      </Card>

      <div
        className="dashboard-grid"
        ref={gridRef}
        style={{ '--right-sidebar-width': `${rightPanelWidth}px` }}
      >
        <LeftControls />
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
    </div>
  )
}

export default StateDashboard
