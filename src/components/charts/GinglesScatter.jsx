import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const FALLBACK_GROUP_OPTIONS = [
  { value: 'latino_pct', label: 'Latino' },
  { value: 'white_pct', label: 'White' },
]
const ginglesAnalysisCache = new Map()

function GinglesScatter({ stateCode }) {
  const [selectedGroup, setSelectedGroup] = useState('latino_pct')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAnalysis() {
      if (!stateCode) {
        setAnalysis(null)
        setError('')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const cacheKey = `${stateCode}:${selectedGroup || ''}`
        if (ginglesAnalysisCache.has(cacheKey)) {
          if (!cancelled) {
            setAnalysis(ginglesAnalysisCache.get(cacheKey))
            setLoading(false)
          }
          return
        }

        const response = await axios.get(`/api/states/${stateCode}/analysis/gingles`, {
          params: selectedGroup ? { group: selectedGroup } : undefined,
        })

        if (!cancelled) {
          const nextAnalysis = response.data ?? null
          ginglesAnalysisCache.set(cacheKey, nextAnalysis)
          setAnalysis(nextAnalysis)
        }
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null)
          const message = axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : 'Failed to load Gingles analysis.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadAnalysis()

    return () => {
      cancelled = true
    }
  }, [selectedGroup, stateCode])

  const groupOptions = useMemo(() => {
    const options = Array.isArray(analysis?.availableGroups)
      ? analysis.availableGroups
          .filter((group) => group?.key && group?.label)
          .map((group) => ({ value: group.key, label: group.label }))
      : []
    return options.length > 0 ? options : FALLBACK_GROUP_OPTIONS
  }, [analysis])

  const effectiveGroup = analysis?.groupKey ?? selectedGroup
  const activeGroupLabel = analysis?.groupLabel
    ?? groupOptions.find((option) => option.value === effectiveGroup)?.label
    ?? 'Selected Group'

  const chartRows = useMemo(() => (Array.isArray(analysis?.points) ? analysis.points : []), [analysis])
  const trendRows = useMemo(() => (Array.isArray(analysis?.trendRows) ? analysis.trendRows : []), [analysis])

  // Build dense point arrays once so Plotly/WebGL receives compact numeric series.
  const plotSeries = useMemo(() => {
    const x = []
    const demY = []
    const repY = []
    const pid = []

    for (const row of chartRows) {
      const xVal = Number(row?.x)
      const demVal = Number(row?.demSharePct)
      const repVal = Number(row?.repSharePct)
      if (!Number.isFinite(xVal) || !Number.isFinite(demVal) || !Number.isFinite(repVal)) {
        continue
      }
      x.push(xVal)
      demY.push(demVal)
      repY.push(repVal)
      pid.push(row?.pid ?? 'N/A')
    }

    return { x, demY, repY, pid }
  }, [chartRows])

  const trendSeries = useMemo(() => {
    const x = []
    const demY = []
    const repY = []
    for (const row of trendRows) {
      const xVal = Number(row?.x)
      const demVal = Number(row?.demTrendPct)
      const repVal = Number(row?.repTrendPct)
      if (!Number.isFinite(xVal) || !Number.isFinite(demVal) || !Number.isFinite(repVal)) {
        continue
      }
      x.push(xVal)
      demY.push(demVal)
      repY.push(repVal)
    }
    return { x, demY, repY }
  }, [trendRows])

  const plottedPrecincts = plotSeries.x.length

  if (loading) {
    return <div className="small-text muted-text">Loading Gingles analysis from the backend...</div>
  }

  if (error) {
    return <div className="small-text muted-text">Failed to load Gingles data: {error}</div>
  }

  if (!plottedPrecincts) {
    return <div className="small-text muted-text">No Gingles points available for {stateCode}.</div>
  }

  const demTrace = {
    type: 'scattergl',
    mode: 'markers',
    name: 'Democratic vote share',
    x: plotSeries.x,
    y: plotSeries.demY,
    customdata: plotSeries.pid,
    marker: {
      color: DEM_COLOR,
      size: 5,
      opacity: 0.34,
    },
    hovertemplate:
      `PID: %{customdata}<br>${activeGroupLabel}: %{x:.1f}%<br>Democratic vote share: %{y:.1f}%<extra></extra>`,
  }

  const repTrace = {
    type: 'scattergl',
    mode: 'markers',
    name: 'Republican vote share',
    x: plotSeries.x,
    y: plotSeries.repY,
    customdata: plotSeries.pid,
    marker: {
      color: REP_COLOR,
      size: 5,
      opacity: 0.32,
    },
    hovertemplate:
      `PID: %{customdata}<br>${activeGroupLabel}: %{x:.1f}%<br>Republican vote share: %{y:.1f}%<extra></extra>`,
  }

  const demTrendTrace = {
    type: 'scatter',
    mode: 'lines',
    name: 'Democratic trend',
    x: trendSeries.x,
    y: trendSeries.demY,
    line: { color: DEM_COLOR, width: 2.2 },
    hovertemplate:
      `${activeGroupLabel}: %{x:.1f}%<br>Democratic trend: %{y:.1f}%<extra></extra>`,
  }

  const repTrendTrace = {
    type: 'scatter',
    mode: 'lines',
    name: 'Republican trend',
    x: trendSeries.x,
    y: trendSeries.repY,
    line: { color: REP_COLOR, width: 2.2 },
    hovertemplate:
      `${activeGroupLabel}: %{x:.1f}%<br>Republican trend: %{y:.1f}%<extra></extra>`,
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Gingles Analysis</div>
          <Info
            label="Gingles chart info"
            text={(
              <>
                Each precinct is plotted as a blue Democratic point and a red Republican point.
                <br />
                X-axis is selected racial/ethnic CVAP share; y-axis is party vote share.
                <br />
                Rendering uses WebGL so all precinct points can be displayed with lower UI lag.
              </>
            )}
          />
          <div className="small-text muted-text">
            {`Showing ${plottedPrecincts.toLocaleString()} precincts`}
          </div>
        </div>
        <div style={{ width: 190 }}>
          <Select
            ariaLabel="Gingles group selector"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
        </div>
      </div>

      <Plot
        data={[demTrace, repTrace, demTrendTrace, repTrendTrace]}
        layout={{
          autosize: true,
          margin: { l: 58, r: 12, t: 8, b: 52 },
          showlegend: true,
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.11,
            traceorder: 'normal',
            entrywidthmode: 'fraction',
            entrywidth: 0.5,
          },
          hovermode: 'closest',
          xaxis: {
            range: [0, 100],
            title: { text: `${activeGroupLabel} (CVAP %)` },
            ticksuffix: '%',
            automargin: true,
          },
          yaxis: {
            range: [0, 100],
            title: { text: 'Vote share (%)' },
            ticksuffix: '%',
            automargin: true,
          },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
          uirevision: `${stateCode}:${effectiveGroup}`,
        }}
        config={{
          displayModeBar: false,
          displaylogo: false,
          responsive: true,
        }}
        useResizeHandler
        style={{ width: '100%', height: '88%' }}
      />
    </div>
  )
}

export default GinglesScatter
