import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Info from '../../ui/components/Info'
import Select from '../../ui/components/Select'

const SELECTED_GROUP_COLOR = '#0F766E'
const NON_SELECTED_GROUP_COLOR = '#D97706'
const EMPTY_OPTION_VALUE = ''
const FALLBACK_GROUP_OPTIONS = [
  { value: 'white_pct', label: 'White' },
  { value: 'latino_pct', label: 'Hispanic/Latino' },
]

function getSafeString(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function findLatinoOption(options) {
  const safeOptions = Array.isArray(options) ? options : []
  return safeOptions.find((option) => {
    const valueText = getSafeString(option?.value)
    const labelText = getSafeString(option?.label)
    const valueMatches = /latino|hisp/i.test(valueText)
    const labelMatches = /latino|hispanic/i.test(labelText)
    return valueMatches || labelMatches
  })
}

function getDefaultGroupValue(groupOptions) {
  const latinoOption = findLatinoOption(groupOptions)
  if (latinoOption?.value !== undefined && latinoOption?.value !== null) return latinoOption.value
  if (groupOptions.length > 0 && groupOptions[0].value !== undefined && groupOptions[0].value !== null) {
    return groupOptions[0].value
  }
  return EMPTY_OPTION_VALUE
}

function getEffectiveGroupValue(selectedGroup, groupOptions, defaultGroupValue) {
  const selectedExists = groupOptions.some((option) => option.value === selectedGroup)
  if (selectedExists) return selectedGroup
  return defaultGroupValue
}

const formatDensity = (value) => (Number.isFinite(value) ? value.toFixed(2) : '0.00')
const formatSupportShare = (value) => Number(value).toFixed(1)
const formatTooltipSupportShare = (value) => `Support share: ${Number(value).toFixed(2)}`

function CurvePanel({ title, data, labelA, labelB }) {
  return (
    <div
      style={{
        minHeight: 0,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '8px 8px 2px',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data} margin={{ top: 8, right: 14, left: 10, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tickCount={6}
            height={44}
            tickFormatter={formatSupportShare}
            label={{ value: 'Support share', position: 'insideBottom', dy: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatDensity(Number(value))}
            width={62}
            label={{ value: 'Density', angle: -90, position: 'insideLeft', dx: -2 }}
          />
          <Tooltip
            formatter={(value, name) => [formatDensity(Number(value)), name]}
            labelFormatter={formatTooltipSupportShare}
          />
          <Legend wrapperStyle={{ bottom: 15 }} />
          <Area
            type="monotone"
            dataKey="group"
            name={labelA}
            stroke={SELECTED_GROUP_COLOR}
            fill={SELECTED_GROUP_COLOR}
            fillOpacity={0.32}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="nonGroup"
            name={labelB}
            stroke={NON_SELECTED_GROUP_COLOR}
            fill={NON_SELECTED_GROUP_COLOR}
            fillOpacity={0.32}
            strokeWidth={1.8}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function EICurve({ stateCode }) {
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
        const response = await axios.get(`/api/states/${stateCode}/analysis/ei`, {
          params: selectedGroup ? { group: selectedGroup } : undefined,
        })

        if (!cancelled) {
          setAnalysis(response.data ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          setAnalysis(null)
          const message = axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : 'Failed to load EI analysis.'
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

  const defaultGroupValue = getDefaultGroupValue(groupOptions)
  const effectiveGroup = analysis?.groupKey ?? getEffectiveGroupValue(selectedGroup, groupOptions, defaultGroupValue)
  const selectedGroupLabel = analysis?.groupLabel
    ?? groupOptions.find((group) => group.value === effectiveGroup)?.label
    ?? effectiveGroup
  const nonSelectedGroupLabel = analysis?.nonGroupLabel
    ?? (selectedGroupLabel ? `Non-${selectedGroupLabel}` : 'Non-selected group')
  const demRows = Array.isArray(analysis?.demRows) ? analysis.demRows : []
  const repRows = Array.isArray(analysis?.repRows) ? analysis.repRows : []
  const demCandidateLabel = getSafeString(analysis?.demCandidateLabel) || 'Kamala Harris'
  const repCandidateLabel = getSafeString(analysis?.repCandidateLabel) || 'Donald Trump'

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
          <Info
            label="EI chart info"
            text={(
              <>
                This chart estimates candidate support among different racial groups using ecological inference.
                <br />
                The x-axis shows the estimated share of a group voting for a candidate, and the y-axis shows the probability of that estimate.
                <br />
                The curves indicate likely voting preferences across groups.
              </>
            )}
          />
        </div>
        <div style={{ width: 230 }}>
          <Select
            ariaLabel="EI demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
        </div>
      </div>

      {loading && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          Loading EI analysis from the backend...
        </div>
      )}

      {!loading && error && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          Failed to load EI data: {error}
        </div>
      )}

      {!loading && !error && (demRows.length === 0 || repRows.length === 0) && (
        <div className="small-text muted-text" style={{ marginBottom: 12 }}>
          No EI curves available for {stateCode}.
        </div>
      )}

      {!loading && !error && demRows.length > 0 && repRows.length > 0 && (
        <div
          style={{
            width: '100%',
            height: '90%',
            display: 'grid',
            gridTemplateRows: '1fr 1fr',
            gap: 12,
          }}
        >
          <CurvePanel
            title={`Support for ${demCandidateLabel}`}
            data={demRows}
            labelA={selectedGroupLabel}
            labelB={nonSelectedGroupLabel}
          />
          <CurvePanel
            title={`Support for ${repCandidateLabel}`}
            data={repRows}
            labelA={selectedGroupLabel}
            labelB={nonSelectedGroupLabel}
          />
        </div>
      )}
    </div>
  )
}

export default EICurve
