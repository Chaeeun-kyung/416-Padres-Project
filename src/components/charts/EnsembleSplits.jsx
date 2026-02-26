import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ensembleSplits from '../../data/mock/ensembleSplits.json'
import { STATE_META } from '../../data/stateMeta'

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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Ensemble Split Comparison</div>
      <div className="small-text muted-text" style={{ marginBottom: 6 }}>
        Frequency of election splits (#Republican / #Democratic seats), with matched split range
      </div>
      <ResponsiveContainer width="100%" height="91%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 18 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="split" angle={-15} textAnchor="end" interval={0} height={46} />
          <YAxis allowDecimals={false} />
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
