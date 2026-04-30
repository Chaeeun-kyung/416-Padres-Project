import { useEffect, useMemo, useState } from 'react'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import RightPanelPageOne from './rightDetails/RightPanelPageOne'
import RepresentationPage from './rightDetails/RepresentationPage'
import useRightDetailsData from './rightDetails/useRightDetailsData'

const RIGHT_PANEL_VIEW_VALUES = new Set(['Map', 'Gingles', 'EI', 'Ensembles'])

function isValidRightPanelView(view) {
  return RIGHT_PANEL_VIEW_VALUES.has(view)
}

function RightDetails({ selectedStateCode, precinctGeojson, loading }) {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)

  const { summary, summaryLoading, representationRows } = useRightDetailsData(selectedStateCode)

  const precinctFeatures = useMemo(() => {
    return precinctGeojson?.features ?? []
  }, [precinctGeojson])

  const canShowRepresentationPage = Boolean(selectedDistrictId)
  const [detailsPage, setDetailsPage] = useState(0)
  const [ensembleView, setEnsembleView] = useState('splits')

  useEffect(() => {
    if (!canShowRepresentationPage) {
      const frameId = requestAnimationFrame(() => {
        setDetailsPage(0)
      })
      return () => cancelAnimationFrame(frameId)
    }

    return undefined
  }, [canShowRepresentationPage])

  useEffect(() => {
    if (canShowRepresentationPage && selectedDistrictId) {
      const frameId = requestAnimationFrame(() => {
        setDetailsPage(1)
      })
      return () => cancelAnimationFrame(frameId)
    }

    return undefined
  }, [canShowRepresentationPage, selectedDistrictId])

  const totalPages = canShowRepresentationPage ? 2 : 1
  const effectivePage = canShowRepresentationPage ? detailsPage : 0
  const effectiveView = isValidRightPanelView(activeTab) ? activeTab : 'Map'

  return (
    <aside className="dashboard-sidebar">
      {canShowRepresentationPage && (
        <Card compact>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Button variant="secondary" onClick={() => setDetailsPage(0)} disabled={effectivePage === 0}>
              Prev
            </Button>
            <span className="small-text">Page {effectivePage + 1} / {totalPages}</span>
            <Button variant="secondary" onClick={() => setDetailsPage(1)} disabled={effectivePage === totalPages - 1}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {effectivePage === 0 && (
        <RightPanelPageOne
          selectedStateCode={selectedStateCode}
          activeView={effectiveView}
          setActiveView={setActiveTab}
          summary={summary}
          loading={loading || summaryLoading}
          ensembleView={ensembleView}
          setEnsembleView={setEnsembleView}
        />
      )}

      {effectivePage === 1 && canShowRepresentationPage && (
        <RepresentationPage
          precinctFeatures={precinctFeatures}
          representationRows={representationRows}
          selectedDistrictId={selectedDistrictId}
          setSelectedDistrictId={setSelectedDistrictId}
          onExitDistrict={() => setDetailsPage(0)}
        />
      )}
    </aside>
  )
}

export default RightDetails
