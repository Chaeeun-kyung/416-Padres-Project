import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ensembleSplits from '../../data/mock/ensembleSplits.json'
import { STATE_META } from '../../data/stateMeta'
import Info from '../../ui/components/Info'

function EnsembleSplits({ stateCode }) {
  const stateData = ensembleSplits?.[stateCode]
  const districtCount = STATE_META[stateCode]?.districtCount ?? 0

  const data = useMemo(() => {
    if (!stateData || !districtCount) return []

    const raceBlindMap = new Map((stateData.raceBlind ?? []).map((row) => [Number(row.repWins), Number(row.freq)]))
    const vraMap = new Map((stateData.vraConstrained ?? []).map((row) => [Number(row.repWins), Number(row.freq)]))
    const allKeys = [...raceBlindMap.keys(), ...vraMap.keys()]
    if (!allKeys.length) return []

    const minRepWins = Math.min(...allKeys)
    const maxRepWins = Math.max(...allKeys)
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
  }, [districtCount, stateData])

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
