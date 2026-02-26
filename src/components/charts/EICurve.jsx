import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import eiCurves from '../../data/mock/eiCurves.json'
import { buildGroupOptions, FEASIBLE_THRESHOLD_MILLIONS } from '../../data/racialGroupConfig'
import stateSummary from '../../data/mock/stateSummary.json'
import Select from '../../ui/components/Select'

function EICurve({ stateCode }) {
  const groupMap = eiCurves?.[stateCode]?.groups ?? {}
  const groupKeys = Object.keys(groupMap)
  const summary = stateSummary?.[stateCode]
  const [selectedGroup, setSelectedGroup] = useState(groupKeys[0] ?? '')
  const groupOptions = (() => {
    const feasibleOnly = buildGroupOptions(
      groupKeys,
      summary,
      Object.fromEntries(groupKeys.map((key) => [key, groupMap[key]?.label ?? key])),
      { includeOnlyFeasible: true },
    )
    if (feasibleOnly.length) return feasibleOnly
    return buildGroupOptions(
      groupKeys,
      summary,
      Object.fromEntries(groupKeys.map((key) => [key, groupMap[key]?.label ?? key])),
    )
  })()
  const effectiveGroup = groupOptions.some((option) => option.value === selectedGroup)
    ? selectedGroup
    : (groupOptions[0]?.value ?? '')

  const activeGroup = groupMap[effectiveGroup] ?? groupMap[groupKeys[0]]
  const points = (activeGroup?.points ?? []).map((point) => ({
    ...point,
    demCandidate: Number(point.y),
    repCandidate: 1 - Number(point.y),
  }))

  if (!groupKeys.length) {
    return <div className="small-text muted-text">No EI data configured for this state.</div>
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ecological Inference</div>
          <div className="small-text muted-text">
            Select one racial/language group and view candidate probability curves. Feasible: over {FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)}M CVAP.
          </div>
        </div>
        <div style={{ width: 220 }}>
          <Select
            ariaLabel="EI demographic group"
            value={effectiveGroup}
            onChange={setSelectedGroup}
            options={groupOptions}
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={points} margin={{ top: 10, right: 18, left: 10, bottom: 14 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tickFormatter={(value) => `${value}%`} label={{ value: '% of selected group voting for candidate', position: 'insideBottom', offset: -6 }} />
          <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
          <Tooltip formatter={(value) => `${Math.round(Number(value) * 100)}%`} labelFormatter={(value) => `Group share: ${value}%`} />
          <Legend />
          <Line type="monotone" dataKey="demCandidate" name="Democratic Candidate" stroke="#2563eb" strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey="repCandidate" name="Republican Candidate" stroke="#dc2626" strokeWidth={2.4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default EICurve
