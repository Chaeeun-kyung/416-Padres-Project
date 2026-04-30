// GUI-21: Display minority effectiveness box & whisker data
import Plot from 'react-plotly.js'
import boxWhiskerMock from '../../../data/mock/vraImpactBoxWhiskerMock.json'

const ENSEMBLE_LABELS = {
  raceBlind: 'Race-Blind',
  vraConstrained: 'VRA-Constrained',
}

function VraBoxplotView({ allStats }) {
  const preferredGroupOrder = Array.isArray(boxWhiskerMock?.preferredGroupOrder)
    ? boxWhiskerMock.preferredGroupOrder
    : ['latino_pct', 'white_pct']
  const raceBlindLabel = boxWhiskerMock?.legendLabels?.raceBlind ?? 'Race-Blind Ensemble'
  const vraConstrainedLabel = boxWhiskerMock?.legendLabels?.vraConstrained ?? 'VRA-Constrained Ensemble'
  const enactedLabel = boxWhiskerMock?.legendLabels?.enacted ?? 'Enacted Plan'
  const raceBlindColor = boxWhiskerMock?.colors?.raceBlind ?? '#3cbf7a'
  const vraConstrainedColor = boxWhiskerMock?.colors?.vraConstrained ?? '#7c4dbe'
  const enactedColor = boxWhiskerMock?.colors?.enacted ?? '#dc2626'
  const enactedBorderColor = boxWhiskerMock?.colors?.enactedBorder ?? '#991b1b'
  const orderedStats = [...(allStats ?? [])].sort((left, right) => {
    const leftRank = preferredGroupOrder.indexOf(left.groupKey)
    const rightRank = preferredGroupOrder.indexOf(right.groupKey)
    const safeLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank
    const safeRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank
    if (safeLeftRank !== safeRightRank) return safeLeftRank - safeRightRank
    return String(left.groupLabel).localeCompare(String(right.groupLabel))
  })

  const traces = []
  for (const stats of orderedStats) {
    const rbX = stats.rbCounts.map(() => stats.groupLabel)
    const vraX = stats.vraCounts.map(() => stats.groupLabel)
    traces.push({
      type: 'box',
      x: rbX,
      y: stats.rbCounts,
      name: raceBlindLabel,
      legendgroup: ENSEMBLE_LABELS.raceBlind,
      marker: { color: raceBlindColor },
      boxpoints: false,
      showlegend: traces.every((trace) => trace.name !== raceBlindLabel),
    })
    traces.push({
      type: 'box',
      x: vraX,
      y: stats.vraCounts,
      name: vraConstrainedLabel,
      legendgroup: ENSEMBLE_LABELS.vraConstrained,
      marker: { color: vraConstrainedColor },
      boxpoints: false,
      showlegend: traces.every((trace) => trace.name !== vraConstrainedLabel),
    })
  }

  const enactedTrace = {
    type: 'scatter',
    mode: 'markers',
    x: orderedStats.map((stats) => stats.groupLabel),
    y: orderedStats.map((stats) => stats.enactedCount),
    name: enactedLabel,
    marker: {
      color: enactedColor,
      size: 9,
      symbol: 'circle',
      line: { color: enactedBorderColor, width: 0.6 },
    },
  }

  if (!traces.length) {
    return <div className="small-text muted-text">No minority effectiveness boxplot data available.</div>
  }

  const maxDistricts = Math.max(1, ...orderedStats.map((row) => row.districtCount))
  return (
    <Plot
      data={[...traces, enactedTrace]}
      layout={{
        autosize: true,
        boxmode: 'group',
        margin: { l: 58, r: 10, t: 52, b: 58 },
        title: {
          text: boxWhiskerMock?.title ?? 'Minority Effectiveness Distribution by Ensemble Type',
          x: 0.5,
          xanchor: 'center',
          y: 0.98,
          yanchor: 'top',
          font: { size: 18 },
        },
        showlegend: true,
        xaxis: {
          title: { text: 'Racial / Ethnic Group' },
          automargin: true,
        },
        yaxis: {
          title: { text: 'Number of effective districts' },
          rangemode: 'tozero',
          range: [0, maxDistricts + 0.5],
          dtick: 1,
          automargin: true,
        },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export default VraBoxplotView
