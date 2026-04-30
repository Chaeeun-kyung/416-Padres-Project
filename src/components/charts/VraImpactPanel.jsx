import { useState } from 'react'
import Info from '../../ui/components/Info'
import SegmentedControl from '../../ui/components/SegmentedControl'
import Select from '../../ui/components/Select'
import useVraImpactData, { EFFECTIVE_SHARE_THRESHOLD } from './vra/useVraImpactData'
import VraThresholdTable from './vra/VraThresholdTable'
import VraBoxplotView from './vra/VraBoxplotView'
import VraHistogramView from './vra/VraHistogramView'

const SUBVIEW_OPTIONS = [
  { value: 'threshold', label: 'Threshold Table' },
  { value: 'box', label: 'Box & Whisker' },
  { value: 'hist', label: 'Histogram' },
]

const PANEL_LAYOUT = {
  sectionGap: 8,
  controlGap: 10,
  filterWidth: 260,
}

const SUBVIEW_COLUMN_COUNT = 3

function VraImpactPanel({ stateCode }) {
  const [subview, setSubview] = useState('threshold')
  const {
    loading,
    error,
    selectedGroup,
    setSelectedGroup,
    effectiveGroup,
    effectiveGroupOptions,
    hasAnyRenderableData,
    selectedStats,
    allStats,
    latinoStats,
  } = useVraImpactData(stateCode)

  if (loading) {
    return <div className="small-text muted-text">Loading VRA impact data...</div>
  }

  if (error && !hasAnyRenderableData) {
    return <div className="small-text muted-text">Failed to load VRA impact data: {error}</div>
  }

  if (!hasAnyRenderableData) {
    return <div className="small-text muted-text">No VRA impact data available.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: PANEL_LAYOUT.sectionGap }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: PANEL_LAYOUT.sectionGap }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: PANEL_LAYOUT.sectionGap }}>
          <div style={{ fontWeight: 700 }}>VRA Impact</div>
          <Info
            label="VRA impact info"
            text={(
              <>
                Minority-effectiveness impact by ensemble type.
                <br />
                Metrics use effectiveness threshold {`${(EFFECTIVE_SHARE_THRESHOLD * 100).toFixed(0)}%`} with the current state dataset.
              </>
            )}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: subview === 'threshold' ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
          alignItems: 'center',
          gap: PANEL_LAYOUT.controlGap,
        }}
      >
        <div style={{ width: '100%' }}>
          <SegmentedControl
            ariaLabel="VRA impact subview selector"
            value={subview}
            onChange={setSubview}
            options={SUBVIEW_OPTIONS}
            columns={SUBVIEW_COLUMN_COUNT}
          />
        </div>

        {subview === 'threshold' && (
          <div style={{ width: PANEL_LAYOUT.filterWidth, maxWidth: '100%', justifySelf: 'end' }}>
            <Select
              ariaLabel="VRA impact feasible race selector"
              value={effectiveGroup || selectedGroup}
              onChange={setSelectedGroup}
              options={effectiveGroupOptions}
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {subview === 'threshold' && <VraThresholdTable stats={selectedStats} />}
        {subview === 'box' && (
          <div style={{ width: '100%', height: '100%' }}>
            <VraBoxplotView allStats={allStats} />
          </div>
        )}
        {subview === 'hist' && (
          <div style={{ width: '100%', height: '100%' }}>
            <VraHistogramView stats={latinoStats} />
          </div>
        )}
      </div>
    </div>
  )
}

export default VraImpactPanel
