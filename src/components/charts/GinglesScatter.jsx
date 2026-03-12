import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const DATA_URL = '/data/gingles_points.json'
const MAX_RENDERED_PRECINCTS = 900
const SAMPLE_BIN_COUNT = 28

const GROUP_OPTIONS = [
  { value: 'latino_pct', label: 'Latino' },
  { value: 'white_pct', label: 'White' },
]
const GROUP_DISPLAY_LABEL = {
  latino_pct: 'Latino',
  white_pct: 'White',
}

let cachedRows = null
let loadingPromise = null

// Converts mixed percent formats into a normalized decimal in [0, 1].
// Accepts values already in decimal form (0.42) or whole-percent form (42).
function normalizePct(value) {
  if (!Number.isFinite(value)) return null
  if (value >= 0 && value <= 1) return value
  if (value >= 0 && value <= 100) return value / 100
  return null
}

// Validates and normalizes one raw JSON row from the Gingles dataset.
// Produces a consistent shape used by all chart calculations.
function parsePoint(row) {
  const demShare = normalizePct(Number(row?.dem_share))
  const repShare = normalizePct(Number(row?.rep_share))
  const latinoPct = normalizePct(Number(row?.latino_pct))
  const whitePct = normalizePct(Number(row?.white_pct))
  if (demShare === null || repShare === null || latinoPct === null || whitePct === null) return null

  const pidRaw = row?.pid ?? row?.GEOID
  const pid = String(pidRaw ?? '').trim()
  if (!pid) return null

  let state = null
  if (typeof row?.state === 'string') {
    const trimmed = row.state.trim().toUpperCase()
    if (trimmed.length === 2) {
      state = trimmed
    }
  }

  return {
    pid,
    state,
    dem_share: demShare,
    rep_share: repShare,
    latino_pct: latinoPct,
    white_pct: whitePct,
  }
}

// Loads, validates, and caches Gingles rows once for the app session.
// This avoids repeated network requests when users switch tabs/states.
async function loadRows() {
  if (cachedRows) return cachedRows
  if (!loadingPromise) {
    loadingPromise = fetch(DATA_URL, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${DATA_URL} (${response.status})`)
        }
        return response.json()
      })
      .then((payload) => {
        if (!Array.isArray(payload)) {
          throw new Error('Invalid gingles_points.json format (expected array).')
        }
        const normalized = payload.map(parsePoint).filter(Boolean)
        cachedRows = normalized
        return normalized
      })
      .finally(() => {
        loadingPromise = null
      })
  }
  return loadingPromise
}

// Formats decimal percentages into friendly label text.
function formatPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : 'N/A'
}

// Restricts numeric values to [0, 1] so rendered trend lines remain valid.
function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

// Solves a linear system with Gaussian elimination.
// Used internally by polynomial fitting to compute trend coefficients.
function solveLinearSystem(matrix, vector) {
  const n = vector.length
  const aug = matrix.map((row, rowIndex) => [...row, vector[rowIndex]])

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot
    let maxAbs = Math.abs(aug[pivot][pivot] ?? 0)
    for (let row = pivot + 1; row < n; row += 1) {
      const absValue = Math.abs(aug[row][pivot] ?? 0)
      if (absValue > maxAbs) {
        maxAbs = absValue
        maxRow = row
      }
    }
    if (maxAbs <= 1e-12) return null
    if (maxRow !== pivot) {
      const temp = aug[pivot]
      aug[pivot] = aug[maxRow]
      aug[maxRow] = temp
    }

    const pivotValue = aug[pivot][pivot]
    for (let col = pivot; col <= n; col += 1) {
      aug[pivot][col] /= pivotValue
    }

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue
      const factor = aug[row][pivot]
      for (let col = pivot; col <= n; col += 1) {
        aug[row][col] -= factor * aug[pivot][col]
      }
    }
  }

  return aug.map((row) => row[n])
}

// Fits a polynomial (default cubic) to scatter data using least squares.
// Returns coefficients c0..cn so y = c0 + c1*x + c2*x^2 + ...
function fitPolynomial(points, valueKey, degree = 3) {
  const cleanPoints = points.filter((point) => (
    Number.isFinite(point?.x) && Number.isFinite(point?.[valueKey])
  ))
  if (cleanPoints.length < degree + 1) return null

  const size = degree + 1
  const matrix = Array.from({ length: size }, () => Array(size).fill(0))
  const vector = Array(size).fill(0)

  cleanPoints.forEach((point) => {
    const x = point.x
    const y = point[valueKey]
    const powers = Array(size * 2).fill(1)
    for (let i = 1; i < powers.length; i += 1) {
      powers[i] = powers[i - 1] * x
    }

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        matrix[row][col] += powers[row + col]
      }
      vector[row] += y * powers[row]
    }
  })

  return solveLinearSystem(matrix, vector)
}

// Evaluates a polynomial at a single x value.
function evaluatePolynomial(coeffs, x) {
  if (!Array.isArray(coeffs) || !coeffs.length) return null
  let result = 0
  let power = 1
  for (let i = 0; i < coeffs.length; i += 1) {
    result += coeffs[i] * power
    power *= x
  }
  return result
}

// Picks roughly even samples from an ordered list to preserve coverage.
// Used to keep scatter rendering fast while still showing full x-range shape.
function pickEvenly(items, count) {
  if (count <= 0 || !items.length) return []
  if (count >= items.length) return [...items]

  const picked = []
  const stride = items.length / count
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(items.length - 1, Math.floor(cursor))
    picked.push(items[index])
    cursor += stride
  }
  return picked
}

// Downsamples very large precinct sets while preserving distribution across x bins.
// This keeps chart interactions smooth and avoids plotting thousands of points.
function sampleRowsForRender(rows, groupKey, maxRows = MAX_RENDERED_PRECINCTS, binCount = SAMPLE_BIN_COUNT) {
  if (!Array.isArray(rows) || rows.length <= maxRows) return rows ?? []

  const bins = Array.from({ length: binCount }, () => [])
  rows.forEach((row) => {
    const x = Number(row?.[groupKey])
    if (!Number.isFinite(x)) return
    const binIndex = Math.max(0, Math.min(binCount - 1, Math.floor(x * binCount)))
    bins[binIndex].push(row)
  })

  const nonEmptyBins = bins.filter((bin) => bin.length > 0)
  if (!nonEmptyBins.length) return rows.slice(0, maxRows)

  const sampled = []
  const baseQuota = Math.max(1, Math.floor(maxRows / nonEmptyBins.length))
  let remaining = maxRows
  const leftovers = []

  nonEmptyBins.forEach((bin) => {
    const take = Math.min(bin.length, baseQuota)
    const chosen = pickEvenly(bin, take)
    sampled.push(...chosen)
    remaining -= chosen.length
    if (bin.length > take) {
      const rest = bin.filter((item) => !chosen.includes(item))
      leftovers.push(...rest)
    }
  })

  if (remaining > 0 && leftovers.length) {
    sampled.push(...pickEvenly(leftovers, Math.min(remaining, leftovers.length)))
  }

  return sampled.slice(0, maxRows)
}

// Ensures selected group exists in options; otherwise falls back safely.
function getValidGroupOrFallback(groupValue) {
  const isValid = GROUP_OPTIONS.some((option) => option.value === groupValue)
  if (isValid) return groupValue
  return GROUP_OPTIONS[0].value
}

// Normalizes state code inputs for reliable comparison/filtering.
function normalizeStateCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

// Builds smooth trend rows (Dem and Rep) from full state data.
// Trend points are generated on a fixed [0, 100] x-grid for line rendering.
function buildTrendRows(stateRows, groupKey, degree = 3, pointCount = 90) {
  const points = stateRows
    .map((row) => ({
      x: Number(row?.[groupKey]),
      dem: Number(row?.dem_share),
      rep: Number(row?.rep_share),
    }))
    .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.dem) && Number.isFinite(row.rep))

  if (points.length < degree + 1) return []

  const demCoeffs = fitPolynomial(points, 'dem', degree)
  const repCoeffs = fitPolynomial(points, 'rep', degree)
  if (!demCoeffs || !repCoeffs) return []

  return Array.from({ length: pointCount }, (_, index) => {
    const x = index / (pointCount - 1)
    const demTrend = evaluatePolynomial(demCoeffs, x)
    const repTrend = evaluatePolynomial(repCoeffs, x)
    return {
      x: x * 100,
      demTrendPct: clamp01(Number(demTrend)) * 100,
      repTrendPct: clamp01(Number(repTrend)) * 100,
    }
  })
}

// Custom tooltip renderer that supports both scatter points and trend line points.
function TooltipCard({ active, payload, groupLabel }) {
  if (active === false || !payload?.length) return null
  const rowCandidate = payload.find((item) => item?.payload)?.payload ?? payload[0]?.payload
  const row = rowCandidate?.payload ?? rowCandidate
  if (!row) return null

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #dfe3ea',
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: '0 4px 14px rgba(17, 24, 39, 0.08)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.pid ? `PID: ${row.pid}` : 'Trend point'}</div>
      <div className="small-text muted-text">{groupLabel}: {formatPct(Number(row.x))}</div>
      {Number.isFinite(Number(row.demSharePct)) && (
        <div className="small-text" style={{ color: DEM_COLOR }}>Democratic vote share: {formatPct(row.demSharePct)}</div>
      )}
      {Number.isFinite(Number(row.repSharePct)) && (
        <div className="small-text" style={{ color: REP_COLOR }}>Republican vote share: {formatPct(row.repSharePct)}</div>
      )}
      {Number.isFinite(Number(row.demTrendPct)) && (
        <div className="small-text" style={{ color: DEM_COLOR }}>Democratic trend: {formatPct(row.demTrendPct)}</div>
      )}
      {Number.isFinite(Number(row.repTrendPct)) && (
        <div className="small-text" style={{ color: REP_COLOR }}>Republican trend: {formatPct(row.repTrendPct)}</div>
      )}
    </div>
  )
}

// Transparent hover target to make sparse points easier to inspect with tooltip.
function HitCircle(props) {
  const { cx, cy } = props ?? {}
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
  return <circle cx={cx} cy={cy} r={8} fill="rgba(0,0,0,0)" />
}

// Main Gingles chart component.
// Flow:
// 1) Load/cached data
// 2) Filter by selected state
// 3) Sample for render speed
// 4) Build scatter and trend rows
// 5) Render chart with group selector + tooltip
function GinglesScatter({ stateCode }) {
  const [selectedGroup, setSelectedGroup] = useState('latino_pct')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const effectiveGroup = getValidGroupOrFallback(selectedGroup)

  const activeGroupLabel = GROUP_DISPLAY_LABEL[effectiveGroup] ?? 'Selected Group'

  useEffect(() => {
    let cancelled = false

    loadRows()
      .then((loadedRows) => {
        if (!cancelled) setRows(loadedRows)
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([])
          setError(err instanceof Error ? err.message : 'Failed to load Gingles data.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const stateRows = useMemo(() => {
    if (!rows.length) return []
    const normalizedState = normalizeStateCode(stateCode)
    if (!normalizedState) return rows

    const hasStateTag = rows.some((row) => typeof row.state === 'string' && row.state.length === 2)
    if (!hasStateTag) return rows

    return rows.filter((row) => row.state === normalizedState)
  }, [rows, stateCode])

  const renderRows = useMemo(
    () => sampleRowsForRender(stateRows, effectiveGroup),
    [effectiveGroup, stateRows],
  )

  const chartRows = useMemo(() => renderRows.map((row) => ({
    pid: row.pid,
    x: row[effectiveGroup] * 100,
    demSharePct: row.dem_share * 100,
    repSharePct: row.rep_share * 100,
  })), [effectiveGroup, renderRows])

  const trendRows = useMemo(
    () => buildTrendRows(stateRows, effectiveGroup),
    [effectiveGroup, stateRows],
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Gingles Analysis</div>
          <Info
            label="Gingles chart info"
            text={(
              <>
                Each point represents a precinct.
                <br />
                The x-axis shows the percentage of a selected racial group in the precinct, and the y-axis shows the vote share for each party.
                <br />
                This chart helps identify patterns of racially polarized voting.
              </>
            )}
          />
        </div>
        <div style={{ width: 190 }}>
          <Select ariaLabel="Gingles group selector" value={effectiveGroup} onChange={setSelectedGroup} options={GROUP_OPTIONS} />
        </div>
      </div>

      {loading && (
        <div className="small-text muted-text">Loading Gingles points...</div>
      )}

      {!loading && error && (
        <div className="small-text muted-text">Failed to load Gingles data: {error}</div>
      )}

      {!loading && !error && chartRows.length === 0 && (
        <div className="small-text muted-text">No Gingles points available for {stateCode}.</div>
      )}

      {!loading && !error && chartRows.length > 0 && (
        <ResponsiveContainer width="100%" height="88%">
          <ComposedChart margin={{ top: 8, right: 20, bottom: 20, left: 8 }} data={chartRows}>
            <CartesianGrid stroke="#e7e9ee" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={activeGroupLabel}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              label={{ value: `${activeGroupLabel} (CVAP %)`, position: 'insideBottom', dy: 10 }}
            />
            <YAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              label={{ value: 'Vote share (%)', angle: -90, position: 'insideLeft' }}
            />
            <ZAxis zAxisId={0} type="number" range={[20, 20]} />
            <Tooltip
              shared={false}
              content={<TooltipCard groupLabel={activeGroupLabel} />}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 20 }}
            />
            <Legend wrapperStyle={{ bottom: 1 }} />
            <Scatter
              name="Democratic vote share"
              data={chartRows}
              dataKey="demSharePct"
              fill={DEM_COLOR}
              fillOpacity={0.28}
              stroke="none"
              isAnimationActive={false}
            />
            <Scatter
              legendType="none"
              data={chartRows}
              dataKey="demSharePct"
              fill="rgba(0,0,0,0)"
              stroke="none"
              shape={HitCircle}
              isAnimationActive={false}
            />
            <Scatter
              name="Republican vote share"
              data={chartRows}
              dataKey="repSharePct"
              fill={REP_COLOR}
              fillOpacity={0.26}
              stroke="none"
              isAnimationActive={false}
            />
            <Scatter
              legendType="none"
              data={chartRows}
              dataKey="repSharePct"
              fill="rgba(0,0,0,0)"
              stroke="none"
              shape={HitCircle}
              isAnimationActive={false}
            />
            <Line
              name="Democratic trend"
              data={trendRows}
              type="monotone"
              dataKey="demTrendPct"
              stroke={DEM_COLOR}
              strokeWidth={2.2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              name="Republican trend"
              data={trendRows}
              type="monotone"
              dataKey="repTrendPct"
              stroke={REP_COLOR}
              strokeWidth={2.2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default GinglesScatter
