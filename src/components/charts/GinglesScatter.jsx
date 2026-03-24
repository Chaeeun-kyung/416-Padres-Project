import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const FALLBACK_GROUP_OPTIONS = [
  { value: 'latino_pct', label: 'Latino' },
  { value: 'white_pct', label: 'White' },
]
const ginglesAnalysisCache = new Map()

function formatPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : 'N/A'
}

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

function HitCircle(props) {
  const { cx, cy } = props ?? {}
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
  return <circle cx={cx} cy={cy} r={8} fill="rgba(0,0,0,0)" />
}

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

  const trendRows = Array.isArray(analysis?.trendRows) ? analysis.trendRows : []

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
          <Select
            ariaLabel="Gingles group selector"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
        </div>
      </div>

      {loading && (
        <div className="small-text muted-text">Loading Gingles analysis from the backend...</div>
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
