// GUI-17: Display box & whisker data
import { useEffect, useState } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const ensembleBoxplotCache = new Map()
function findLatinoOption(options) {
  return (options ?? []).find((option) => (
    /latino|hisp/i.test(String(option?.value ?? ''))
    || /latino|hispanic/i.test(String(option?.label ?? ''))
  ))
}
function EnsembleBoxplot({ stateCode }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const defaultGroupValue = 'latino_pct'
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupValue)
  const [selectedEnsemble, setSelectedEnsemble] = useState('raceBlind')

  useEffect(() => {
    let cancelled = false

    async function loadStateData() {
      if (!stateCode) {
        setAnalysis(null)
        setError('')
        return
      }

      setLoading(true)
      setError('')
      try {
        const cacheKey = `${stateCode}:${selectedGroup}:${selectedEnsemble}`
        if (ensembleBoxplotCache.has(cacheKey)) {
          if (!cancelled) {
            setAnalysis(ensembleBoxplotCache.get(cacheKey))
            setLoading(false)
          }
          return
        }

        const response = await axios.get(`/api/states/${stateCode}/ensembles/boxplot`, {
          params: {
            group: selectedGroup,
            ensemble: selectedEnsemble,
          },
        })
        if (!cancelled) {
          const nextAnalysis = response.data ?? null
          ensembleBoxplotCache.set(cacheKey, nextAnalysis)
          setAnalysis(nextAnalysis)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAnalysis(null)
          const message = axios.isAxiosError(loadError)
            ? loadError.response?.data?.message ?? loadError.message
            : 'Failed to load boxplot data.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadStateData()

    return () => {
      cancelled = true
    }
  }, [selectedEnsemble, selectedGroup, stateCode])

  const groupOptions = Array.isArray(analysis?.availableGroups)
    ? analysis.availableGroups
        .filter((option) => option?.key && option?.label)
        .map((option) => ({ value: option.key, label: option.label }))
    : []
  const ensembleOptions = Array.isArray(analysis?.availableEnsembles)
    ? analysis.availableEnsembles
        .filter((option) => option?.key && option?.label)
        .map((option) => ({ value: option.key, label: option.label }))
    : []

  const fallbackGroupValue = findLatinoOption(groupOptions)?.value ?? groupOptions[0]?.value ?? defaultGroupValue
  const effectiveGroup = analysis?.groupKey
    ?? (groupOptions.some((option) => option.value === selectedGroup) ? selectedGroup : fallbackGroupValue)
  const effectiveEnsemble = analysis?.ensembleKey
    ?? (ensembleOptions.some((option) => option.value === selectedEnsemble) ? selectedEnsemble : ensembleOptions[0]?.value ?? 'raceBlind')

  const baseDistributions = analysis?.distributions ?? {}
  const baseEnacted = analysis?.enacted ?? {}
  const orderedDistrictIds = Array.isArray(analysis?.districtOrder) ? analysis.districtOrder : Object.keys(baseDistributions)

  if (loading) {
    return <div className="small-text muted-text">Loading district boxplot data...</div>
  }

  if (error) {
    return <div className="small-text muted-text">Failed to load district boxplot data: {error}</div>
  }

  if (!orderedDistrictIds.length) {
    return <div className="small-text muted-text">No district distribution data available.</div>
  }

  const boxTraces = orderedDistrictIds.map((districtId) => ({
    type: 'box',
    name: districtId,
    y: baseDistributions[districtId] ?? [],
    boxpoints: false,
    marker: { color: '#94a3b8' },
    line: { color: '#475569' },
  }))
  const enactedTrace = {
    type: 'scatter',
    mode: 'markers',
    x: orderedDistrictIds,
    y: orderedDistrictIds.map((districtId) => baseEnacted[districtId]),
    name: 'Enacted Plan',
    marker: {
      color: '#dc2626',
      size: 8,
      symbol: 'circle',
    },
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 0 }}>District Boxplot</div>
          <Info
            label="Boxplot info"
            text={(
            <>
            This chart shows how minority population is typically distributed across districts in the ensemble.
            <br />
            Each box shows the typical range for a district rank, and the dots indicate the enacted plan's district values for comparison.
            </>
            )}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, minWidth: 330 }}>
          <Select
            ariaLabel="Boxplot demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
          <Select
            ariaLabel="Boxplot ensemble type"
            value={effectiveEnsemble}
            onChange={setSelectedEnsemble}
            options={ensembleOptions}
          />
        </div>
      </div>
      <Plot
        data={[...boxTraces, enactedTrace]}
        layout={{
          autosize: true,
          margin: { l: 58, r: 10, t: 10, b: 52 },
          showlegend: true,
          xaxis: {
            title: { text: 'District (sorted by enacted minority share)' },
            automargin: true,
          },
          yaxis: {
            range: [0, 1],
            tickformat: '.0%',
            title: { text: 'Minority share (%)' },
            automargin: true,
          },
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '90%' }}
      />
    </div>
  )
}

export default EnsembleBoxplot
