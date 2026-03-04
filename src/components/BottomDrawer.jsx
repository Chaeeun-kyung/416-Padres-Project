import { useCallback, useEffect, useMemo, useState } from 'react'
import DistrictBoxplot from './charts/DistrictBoxplot'
import EICurve from './charts/EICurve'
import EnsembleSplits from './charts/EnsembleSplits'
import GinglesScatter from './charts/GinglesScatter'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import Divider from '../ui/components/Divider'
import SegmentedControl from '../ui/components/SegmentedControl'

const ENSEMBLE_VIEW_OPTIONS = [
  { value: 'splits', label: 'Split Bars' },
  { value: 'boxplot', label: 'Box & Whisker' },
]
const CHART_TABS = new Set(['Gingles', 'EI', 'Ensembles'])
const MIN_OPEN_HEIGHT = 360

function TabPanelContent({ tab, selectedStateCode, precinctFeatures, mapError, ensembleView, onEnsembleViewChange }) {
  if (mapError) {
    return <div className="small-text muted-text">{mapError}</div>
  }

  if (tab === 'Gingles') {
    return <GinglesScatter stateCode={selectedStateCode} features={precinctFeatures} />
  }

  if (tab === 'EI') {
    return <EICurve stateCode={selectedStateCode} features={precinctFeatures} />
  }

  if (tab === 'Ensembles') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
        <div style={{ width: 280 }}>
          <SegmentedControl
            ariaLabel="Ensemble chart selector"
            options={ENSEMBLE_VIEW_OPTIONS}
            value={ensembleView}
            onChange={onEnsembleViewChange}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Card compact className="drawer-ensemble-card">
            {ensembleView === 'boxplot'
              ? <DistrictBoxplot stateCode={selectedStateCode} />
              : <EnsembleSplits stateCode={selectedStateCode} />}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="small-text muted-text">
      Switch to Gingles, EI, or Ensembles tabs for chart-specific analysis.
    </div>
  )
}

function BottomDrawer({ selectedStateCode, precinctFeatures, mapError }) {
  const activeTab = useAppStore((state) => state.activeTab)
  const bottomDrawerOpen = useAppStore((state) => state.bottomDrawerOpen)
  const toggleBottomDrawer = useAppStore((state) => state.toggleBottomDrawer)
  const setBottomDrawerOpen = useAppStore((state) => state.setBottomDrawerOpen)
  const [ensembleView, setEnsembleView] = useState('splits')
  const [drawerHeight, setDrawerHeight] = useState(MIN_OPEN_HEIGHT)
  const [isResizing, setIsResizing] = useState(false)
  const isChartTab = CHART_TABS.has(activeTab)

  const minOpenHeight = MIN_OPEN_HEIGHT
  const maxOpenHeight = useMemo(() => {
    if (typeof window === 'undefined') return minOpenHeight
    return Math.max(minOpenHeight, Math.floor(window.innerHeight - 120))
  }, [minOpenHeight])
  const effectiveDrawerHeight = Math.max(minOpenHeight, Math.min(drawerHeight, maxOpenHeight))

  useEffect(() => {
    if (isChartTab) {
      setBottomDrawerOpen(true)
    }
  }, [activeTab, isChartTab, setBottomDrawerOpen])

  const beginResize = useCallback(
    (event) => {
      if (!bottomDrawerOpen) return

      event.preventDefault()
      const startY = event.touches?.[0]?.clientY ?? event.clientY
      const startHeight = effectiveDrawerHeight
      setIsResizing(true)

      const onMove = (moveEvent) => {
        const clientY = moveEvent.touches?.[0]?.clientY ?? moveEvent.clientY
        const delta = startY - clientY
        const nextHeight = Math.max(minOpenHeight, Math.min(startHeight + delta, maxOpenHeight))
        setDrawerHeight(nextHeight)
      }

      const onEnd = () => {
        setIsResizing(false)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onEnd)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onEnd)
      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
    },
    [bottomDrawerOpen, effectiveDrawerHeight, maxOpenHeight, minOpenHeight],
  )

  if (!isChartTab) {
    return null
  }

  return (
    <section
      className="drawer"
      style={{
        minHeight: bottomDrawerOpen ? minOpenHeight : 52,
        maxHeight: bottomDrawerOpen ? maxOpenHeight : 52,
        height: bottomDrawerOpen ? effectiveDrawerHeight : 52,
        display: 'flex',
      }}
    >
      <Card noPadding className="drawer">
        {bottomDrawerOpen && (
          <div
            className={`drawer__resize-handle${isResizing ? ' drawer__resize-handle--active' : ''}`}
            onMouseDown={beginResize}
            onTouchStart={beginResize}
            role="separator"
            aria-label="Resize charts drawer"
            aria-orientation="horizontal"
          />
        )}
        <div className="drawer__header">
          <div className="ui-card__title">Charts Drawer</div>
          <Button variant="ghost" onClick={toggleBottomDrawer}>
            {bottomDrawerOpen ? 'Collapse' : 'Expand'}
          </Button>
        </div>

        {bottomDrawerOpen && (
          <>
            <Divider />
            <div className="drawer__content">
              <div className="drawer__panel">
                <TabPanelContent
                  tab={activeTab}
                  selectedStateCode={selectedStateCode}
                  precinctFeatures={precinctFeatures}
                  mapError={mapError}
                  ensembleView={ensembleView}
                  onEnsembleViewChange={setEnsembleView}
                />
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  )
}

export default BottomDrawer
