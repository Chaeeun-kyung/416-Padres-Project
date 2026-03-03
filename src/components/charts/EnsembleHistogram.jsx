import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import ensembleSplits from "../../data/mock/ensembleSplits.json"
import ToggleSwitch from "../../ui/components/ToggleSwitch"

export default function EnsembleHistogram({ stateCode = "CO" }) {
  const [percentView, setPercentView] = useState(false)

  const rows = useMemo(() => {
    const state = ensembleSplits?.[stateCode]
    if (!state) return []

    const rb = Array.isArray(state.raceBlind) ? state.raceBlind : []
    const vra = Array.isArray(state.vraConstrained) ? state.vraConstrained : []

    const totalRB = rb.reduce((s, r) => s + Number(r.freq ?? 0), 0)
    const totalVRA = vra.reduce((s, r) => s + Number(r.freq ?? 0), 0)

    const allKeys = new Set([
      ...rb.map((r) => Number(r.repWins)),
      ...vra.map((r) => Number(r.repWins)),
    ])

    return [...allKeys]
      .filter((k) => Number.isFinite(k))
      .sort((a, b) => a - b)
      .map((repWins) => {
        const rbRow = rb.find((r) => Number(r.repWins) === repWins)
        const vraRow = vra.find((r) => Number(r.repWins) === repWins)
        const rbFreq = Number(rbRow?.freq ?? 0)
        const vraFreq = Number(vraRow?.freq ?? 0)

        return {
          repWins,
          raceBlind: percentView && totalRB ? rbFreq / totalRB : rbFreq,
          vraConstrained: percentView && totalVRA ? vraFreq / totalVRA : vraFreq,
        }
      })
  }, [stateCode, percentView])

  if (!rows.length) {
    return <div className="small-text muted-text">No ensemble split data for {stateCode}.</div>
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        className="small-text muted-text"
        style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
      >
        <span>{percentView ? "Percent view" : "Count view"}</span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="small-text">Count</span>
          <ToggleSwitch checked={percentView} onChange={setPercentView} ariaLabel="Toggle histogram percent view" />
          <span className="small-text">%</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={rows} margin={{ top: 8, right: 14, bottom: 18, left: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="repWins" label={{ value: "Republican seats", position: "insideBottom", offset: -10 }} />
          <YAxis
            tickFormatter={(v) => (percentView ? `${Math.round(v * 100)}%` : `${Math.round(v)}`)}
          />
          <Tooltip
            formatter={(v, name) => {
              if (percentView) return [`${(Number(v) * 100).toFixed(1)}%`, name]
              return [`${Math.round(Number(v)).toLocaleString()}`, name]
            }}
          />
          <Legend />
          <Bar name="Race-blind ensemble" dataKey="raceBlind" />
          <Bar name="VRA-constrained ensemble" dataKey="vraConstrained" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}