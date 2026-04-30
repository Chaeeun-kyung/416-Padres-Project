import Card from '../../ui/components/Card'
import SegmentedControl from '../../ui/components/SegmentedControl'
import EnsembleSplits from '../charts/EnsembleSplits'
import GinglesScatter from '../charts/GinglesScatter'
import EICurve from '../charts/EICurve'
import EnsembleBoxplot from '../charts/EnsembleBoxplot'
import VraImpactPanel from '../charts/VraImpactPanel'
import MapSummaryCards from './SummaryCards'

const RIGHT_PANEL_VIEW_OPTIONS = [
  { value: 'Map', label: 'State Summary' },
  { value: 'Gingles', label: 'Gingles' },
  { value: 'EI', label: 'EI' },
  { value: 'Ensembles', label: 'Ensemble Analysis' },
]

const ENSEMBLE_VIEW_OPTIONS = [
  { value: 'splits', label: 'Split Bars' },
  { value: 'boxplot', label: 'Box & Whisker' },
  { value: 'vraImpact', label: 'VRA Impact' },
]

function EnsembleSummaryStrip({ summary }) {
  const items = [
    {
      label: 'Race-blind plans',
      value: summary?.ensembleSummary?.raceBlindPlans?.toLocaleString?.() ?? summary?.ensembleSummary?.raceBlindPlans ?? 'N/A',
    },
    {
      label: 'VRA-constrained plans',
      value: summary?.ensembleSummary?.vraConstrainedPlans?.toLocaleString?.() ?? summary?.ensembleSummary?.vraConstrainedPlans ?? 'N/A',
    },
    {
      label: 'Population threshold',
      value: summary?.ensembleSummary?.populationEqualityThresholdLabel ?? 'N/A',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 10,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            border: '1px solid var(--ui-border)',
            borderRadius: 10,
            padding: '8px 10px',
            background: '#f8fafc',
            minWidth: 0,
          }}
        >
          <div className="small-text muted-text" style={{ marginBottom: 3 }}>{item.label}</div>
          <div className="small-text" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function RightPanelPageOne({
  selectedStateCode,
  activeView,
  setActiveView,
  summary,
  loading,
  ensembleView,
  setEnsembleView,
}) {
  return (
    <>
      <Card title="">
        <SegmentedControl
          ariaLabel="Right panel content view selector"
          value={activeView}
          onChange={setActiveView}
          options={RIGHT_PANEL_VIEW_OPTIONS}
        />
      </Card>

      {activeView === 'Map' && (
        <MapSummaryCards
          summary={summary}
          loading={loading}
        />
      )}

      {activeView === 'Gingles' && (
        <Card title="">
          <div style={{ width: '100%', height: 'min(76vh, 760px)' }}>
            <GinglesScatter stateCode={selectedStateCode} />
          </div>
        </Card>
      )}

      {activeView === 'EI' && (
        <Card title="">
          <div style={{ width: '100%', height: 'min(72vh, 700px)' }}>
            <EICurve stateCode={selectedStateCode} />
          </div>
        </Card>
      )}

      {activeView === 'Ensembles' && (
        <Card title="Ensemble Analysis">
          <div style={{ width: '100%', height: 'min(68vh, 620px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <EnsembleSummaryStrip summary={summary} />
            <div style={{ width: 520, maxWidth: '100%', marginBottom: 2 }}>
              <SegmentedControl
                ariaLabel="Ensemble chart selector"
                value={ensembleView}
                onChange={setEnsembleView}
                options={ENSEMBLE_VIEW_OPTIONS}
                columns={3}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {ensembleView === 'boxplot' && <EnsembleBoxplot stateCode={selectedStateCode} />}
              {ensembleView === 'splits' && <EnsembleSplits stateCode={selectedStateCode} />}
              {ensembleView === 'vraImpact' && <VraImpactPanel stateCode={selectedStateCode} />}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

export default RightPanelPageOne
