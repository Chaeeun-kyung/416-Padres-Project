import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Info from '../../ui/components/Info'

// Converts split rows into a Map for O(1) frequency lookup by Republican wins.
function toSplitMap(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  return new Map(safeRows.map((row) => [Number(row.repWins), Number(row.freq)]))
}

// Builds aligned chart rows so race-blind and VRA-constrained bars share the same x-axis.
// Missing frequencies are treated as 0, and empty bins for both series are dropped.
function buildSplitRows(stateData, districtCount) {
  if (!stateData || !districtCount) return []

  const raceBlindMap = toSplitMap(stateData.raceBlind)
  const vraMap = toSplitMap(stateData.vraConstrained)
  const allRepWinKeys = [...raceBlindMap.keys(), ...vraMap.keys()]
  if (!allRepWinKeys.length) return []

  const minRepWins = Math.min(...allRepWinKeys)
  const maxRepWins = Math.max(...allRepWinKeys)
  const rows = []

  for (let repWins = minRepWins; repWins <= maxRepWins; repWins += 1) {
    const raceBlind = raceBlindMap.get(repWins) ?? 0
    const vraConstrained = vraMap.get(repWins) ?? 0
    if (raceBlind === 0 && vraConstrained === 0) continue

    const demWins = districtCount - repWins
    rows.push({
      split: `${repWins}R / ${demWins}D`,
      raceBlind,
      vraConstrained,
    })
  }

  return rows
}

// Main ensemble split chart component (GUI-16 style split comparison display).
function EnsembleSplits({ stateCode }) {
  const [stateData, setStateData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const districtCount = Number(stateData?.districtCount ?? 0)

  useEffect(() => {
    let cancelled = false

    async function loadStateData() {
      if (!stateCode) {
        setStateData(null)
        setError('')
        return
      }

      setLoading(true)
      setError('')
      try {
        const response = await axios.get(`/api/states/${stateCode}/ensembles/splits`)
        if (!cancelled) {
          setStateData(response.data)
        }
      } catch (loadError) {
        if (!cancelled) {
          setStateData(null)
          const message = axios.isAxiosError(loadError)
            ? loadError.response?.data?.message ?? loadError.message
            : 'Failed to load ensemble split data.'
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
  }, [stateCode])

  // Memoize derived chart data so it only recomputes when inputs actually change.
  const data = useMemo(() => buildSplitRows(stateData, districtCount), [districtCount, stateData])

  if (loading) {
    return <div className="small-text muted-text">Loading ensemble split data...</div>
  }

  if (error) {
    return <div className="small-text muted-text">Failed to load ensemble split data: {error}</div>
  }

  if (!data.length) {
    return <div className="small-text muted-text">No ensemble split data available.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Ensemble Split Comparison</div>
        <Info
          label="Ensemble split info"
          text={(
            <>
            This chart shows the distribution of party seat outcomes across simulated district plans.
            <br />
            Each bar represents the frequency of a specific outcome (R/D), allowing comparison between race-blind and VRA-constrained ensembles.
            </>
          )}
        />
      </div>
      <ResponsiveContainer width="100%" height="91%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 36 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="split"
            angle={-15}
            textAnchor="end"
            interval={0}
            height={64}
            label={{ value: 'Seat split (R / D)', position: 'insideBottom', dy: -8 }}
          />
          <YAxis
            allowDecimals={false}
            label={{ value: 'Plan frequency', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="raceBlind" fill="#c29a32" name="Race-blind" />
          <Bar dataKey="vraConstrained" fill="#16a34a" name="VRA-constrained" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default EnsembleSplits
