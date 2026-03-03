import { useState } from 'react'
import { useEffect } from 'react'
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
  const isChartTab = CHART_TABS.has(activeTab)

  const expandedHeight = activeTab === 'Ensembles' ? 620 : 520

  useEffect(() => {
    if (isChartTab) {
      setBottomDrawerOpen(true)
    }
  }, [activeTab, isChartTab, setBottomDrawerOpen])

  if (!isChartTab) {
    return null
  }

  return (
    <section
      className="drawer"
      style={{
        minHeight: bottomDrawerOpen ? 360 : 52,
        maxHeight: bottomDrawerOpen ? expandedHeight : 52,
        display: 'flex',
      }}
    >
      <Card noPadding className="drawer">
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
