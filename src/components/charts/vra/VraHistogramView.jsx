// GUI-22: Display minority effectiveness ensemble histogram
import Plot from 'react-plotly.js'
import histogramMock from '../../../data/fallback/vraImpactHistogramMock.json'
import {
  buildMockHistogramCountsByDistrict,
  expandCountsToHistogramSamples,
} from './vraImpactUtils'

const HISTOGRAM_EFFECTIVE_SHARE_THRESHOLD = 0.5
const MOCK_ENSEMBLE_PLAN_COUNT = Number(histogramMock?.meta?.planCountPerEnsemble ?? 5000)

function VraHistogramView({ stats }) {
  if (!stats) return <div className="small-text muted-text">No histogram data available.</div>

  const maxDistricts = Math.max(1, stats.districtCount)
  const start = -0.5
  const end = maxDistricts + 0.5

  const hasRealData = Array.isArray(stats.rbCounts) && stats.rbCounts.length > 0
  const nonVraSamples = hasRealData
    ? stats.rbCounts
    : expandCountsToHistogramSamples(buildMockHistogramCountsByDistrict(maxDistricts, 'nonVra', histogramMock, MOCK_ENSEMBLE_PLAN_COUNT))
  const constrainedSamples = hasRealData
    ? stats.vraCounts
    : expandCountsToHistogramSamples(buildMockHistogramCountsByDistrict(maxDistricts, 'constrained', histogramMock, MOCK_ENSEMBLE_PLAN_COUNT))
  const binCounts = (samples) => {
    const counts = {}
    for (const v of samples) { counts[v] = (counts[v] ?? 0) + 1 }
    return Object.values(counts)
  }
  const peakCount = Math.max(1, ...binCounts(nonVraSamples), ...binCounts(constrainedSamples))

  return (
    <Plot
      data={[
        {
          type: 'histogram',
          x: constrainedSamples,
          name: histogramMock?.legendLabels?.constrained ?? 'Constrained: statewide score',
          marker: { color: histogramMock?.colors?.constrained ?? '#4f67b3' },
          opacity: 0.7,
          xbins: { start, end, size: 1 },
        },
        {
          type: 'histogram',
          x: nonVraSamples,
          name: histogramMock?.legendLabels?.nonVra ?? 'Non-VRA',
          marker: { color: histogramMock?.colors?.nonVra ?? '#59a966' },
          opacity: 0.7,
          xbins: { start, end, size: 1 },
        },
      ]}
      layout={{
        autosize: true,
        barmode: 'overlay',
        margin: { l: 58, r: 10, t: 54, b: 58 },
        title: {
          text: String(histogramMock?.titleTemplate ?? '{groupLabel} effectiveness').replace('{groupLabel}', stats.groupLabel),
          x: 0.5,
          xanchor: 'center',
          y: 0.98,
          yanchor: 'top',
          font: { size: 18 },
        },
        showlegend: true,
        xaxis: {
          title: { text: `Number of districts ≥ ${(HISTOGRAM_EFFECTIVE_SHARE_THRESHOLD * 100).toFixed(0)}% ${stats.groupLabel}` },
          dtick: 1,
          range: [start, end],
          automargin: true,
        },
        yaxis: {
          title: { text: 'Number of plans in ensemble' },
          range: [0, peakCount * 1.15],
          rangemode: 'tozero',
          automargin: true,
        },
        annotations: [],
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export default VraHistogramView
