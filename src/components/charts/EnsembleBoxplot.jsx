import { useMemo, useState } from "react"
import districtBoxplot from "../../data/mock/districtBoxplot.json"
import Info from "../../ui/components/Info"
import Select from "../../ui/components/Select"

function quantile(sorted, q) {
  const n = sorted.length
  if (!n) return null
  const pos = (n - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const a = sorted[base]
  const b = sorted[Math.min(n - 1, base + 1)]
  return a + rest * (b - a)
}

function fiveNumber(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  return {
    min: sorted[0],
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  }
}

export default function EnsembleBoxplot({ stateCode = "CO" }) {
  const state = districtBoxplot?.[stateCode]
  const distributions = useMemo(() => state?.distributions ?? {}, [state])
  const districts = useMemo(() => Object.keys(distributions).sort(), [distributions])

  const [district, setDistrict] = useState(districts[0] ?? "")

  const stats = useMemo(() => {
    const vals = distributions?.[district] ?? []
    return fiveNumber(vals)
  }, [district, distributions])

  const enacted = Number(state?.enacted?.[district])

  if (!state) return <div className="small-text muted-text">No boxplot data for {stateCode}.</div>
  if (!districts.length) return <div className="small-text muted-text">No districts found.</div>
  if (!stats) return <div className="small-text muted-text">No distribution values for {district}.</div>

  // SVG layout
  const W = 520
  const H = 240
  const padL = 48
  const padR = 18
  const padT = 18
  const padB = 38

  const x0 = padL
  const x1 = W - padR
  const y0 = padT
  const y1 = H - padB

  const scaleX = (v) => x0 + v * (x1 - x0) // values already 0..1
  const midY = (y0 + y1) / 2

  const boxY = midY - 18
  const boxH = 36

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 0 }}>District distribution (GUI-17)</div>
          <Info
            label="Ensemble boxplot info"
            text="Box/whisker from ensemble distribution. Dashed vertical line shows the enacted plan."
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            ariaLabel="District selector"
            value={district}
            onChange={setDistrict}
            options={districts.map((d) => ({ value: d, label: d }))}
          />
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* axis */}
        <line x1={x0} x2={x1} y1={y1} y2={y1} stroke="#9ca3af" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={scaleX(t)} x2={scaleX(t)} y1={y1} y2={y1 + 6} stroke="#9ca3af" />
            <text x={scaleX(t)} y={y1 + 22} textAnchor="middle" fontSize="12" fill="#374151">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {/* whisker */}
        <line x1={scaleX(stats.min)} x2={scaleX(stats.max)} y1={midY} y2={midY} stroke="#111827" />
        <line x1={scaleX(stats.min)} x2={scaleX(stats.min)} y1={midY - 10} y2={midY + 10} stroke="#111827" />
        <line x1={scaleX(stats.max)} x2={scaleX(stats.max)} y1={midY - 10} y2={midY + 10} stroke="#111827" />

        {/* box */}
        <rect
          x={scaleX(stats.q1)}
          y={boxY}
          width={Math.max(1, scaleX(stats.q3) - scaleX(stats.q1))}
          height={boxH}
          fill="white"
          stroke="#111827"
        />

        {/* median */}
        <line x1={scaleX(stats.median)} x2={scaleX(stats.median)} y1={boxY} y2={boxY + boxH} stroke="#111827" strokeWidth="2" />

        {/* enacted */}
        {Number.isFinite(enacted) && (
          <g>
            <line x1={scaleX(enacted)} x2={scaleX(enacted)} y1={y0} y2={y1} stroke="#111827" strokeDasharray="6 4" />
            <text x={scaleX(enacted)} y={y0 + 12} textAnchor="middle" fontSize="12" fill="#111827">
              enacted
            </text>
          </g>
        )}

        {/* labels */}
        <text x={x0} y={14} fontSize="12" fill="#111827">
          {district}
        </text>
      </svg>

      <div className="small-text muted-text" style={{ marginTop: 6 }}>
        min {(stats.min * 100).toFixed(1)}% · Q1 {(stats.q1 * 100).toFixed(1)}% · median {(stats.median * 100).toFixed(1)}% · Q3 {(stats.q3 * 100).toFixed(1)}% · max {(stats.max * 100).toFixed(1)}%
      </div>
    </div>
  )
}
