import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../ui/components/Card'
import SegmentedControl from '../../ui/components/SegmentedControl'
import ToggleSwitch from '../../ui/components/ToggleSwitch'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const RACIAL_BAR_COLORS = ['#0f766e', '#14b8a6', '#06b6d4']

const DISPLAY_RACIAL_GROUPS = [
  { key: 'white_pct', label: 'White' },
  { key: 'black_pct', label: 'Black' },
  { key: 'latino_pct', label: 'Latino' },
  { key: 'asian_pct', label: 'Asian' },
]

const POLITICAL_CHART_HEIGHT = 180
const RACIAL_CHART_HEIGHT = 240
const TABLE_FONT_SIZE = '0.8rem'
const TABLE_CELL_PADDING = 6
const SECTION_SPACING = 8
const SUBSECTION_SPACING = 6
const SMALL_SPACING = 4
const INLINE_DOT_SIZE = 8
const CHART_MARGIN_DEFAULT = { top: 8, right: 10, bottom: 10, left: 2 }
const CHART_MARGIN_RACIAL = { top: 8, right: 10, bottom: 18, left: 2 }
const RACIAL_XAXIS_ANGLE = -20
const RACIAL_XAXIS_HEIGHT = 60
const PROCESS_TEXT_LINE_HEIGHT = 1.45

const SUMMARY_SECTION_OPTIONS = [
  { value: 'demographic', label: 'Demographic' },
  { value: 'political', label: 'Political' },
]

function formatWholeNumber(value) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }
  return Math.round(value).toLocaleString()
}

function PopulationSummaryTable({ cvapTotal, districtCount, loading }) {
  const cvapValue = loading ? 'Loading...' : formatWholeNumber(cvapTotal)
  const rows = [
    { label: 'Citizen Voting-Age Population', value: cvapValue },
    { label: 'Districts', value: districtCount?.toLocaleString?.() ?? districtCount ?? 'N/A' },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto', marginBottom: SECTION_SPACING }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: TABLE_FONT_SIZE }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: TABLE_CELL_PADDING }}>Metric</th>
            <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: TABLE_CELL_PADDING }}>{row.label}</td>
              <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatRedistrictingControl(summary, loading) {
  if (summary?.redistrictingControl) {
    return summary.redistrictingControl
  }
  return loading ? 'Loading...' : 'N/A'
}

function CongressionalPartySummarySection({ summary, chartView }) {
  const tableRows = useMemo(() => {
    const demSeats = Number(summary?.congressionalPartySummary?.democrats)
    const repSeats = Number(summary?.congressionalPartySummary?.republicans)
    const rows = []

    if (Number.isFinite(demSeats)) {
      rows.push({ party: 'Democrats', shortParty: 'Dem', seats: demSeats, color: DEM_COLOR })
    }

    if (Number.isFinite(repSeats)) {
      rows.push({ party: 'Republicans', shortParty: 'Rep', seats: repSeats, color: REP_COLOR })
    }

    return rows
  }, [summary])

  const maxSeats = Math.max(1, ...tableRows.map((row) => row.seats))

  return (
    <>
      {!tableRows.length && (
        <div className="small-text muted-text" style={{ marginBottom: SECTION_SPACING }}>
          No congressional party summary data.
        </div>
      )}

      {tableRows.length > 0 && !chartView && (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: SECTION_SPACING }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: TABLE_FONT_SIZE }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: TABLE_CELL_PADDING }}>Party</th>
                <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Seats</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.party} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: TABLE_CELL_PADDING }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: SUBSECTION_SPACING }}>
                      <span style={{ width: INLINE_DOT_SIZE, height: INLINE_DOT_SIZE, borderRadius: '50%', background: row.color }} />
                      {row.party}
                    </span>
                  </td>
                  <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {row.seats.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tableRows.length > 0 && chartView && (
        <div style={{ width: '100%', height: POLITICAL_CHART_HEIGHT, marginBottom: SECTION_SPACING }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tableRows} margin={CHART_MARGIN_DEFAULT}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="shortParty" />
              <YAxis allowDecimals={false} domain={[0, maxSeats]} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(0)} seats`, 'Seats']} />
              <Bar dataKey="seats" fill={DEM_COLOR} isAnimationActive={false}>
                {tableRows.map((entry) => (
                  <Cell key={entry.party} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}

function RacialGroupsSection({ summary, loading, chartView }) {
  const rows = useMemo(() => {
    const computedRows = []

    for (const group of DISPLAY_RACIAL_GROUPS) {
      const pct = Number(summary?.racialEthnicPopulationPct?.[group.key])
      const populationMil = Number(summary?.racialEthnicPopulationMillions?.[group.key])

      if (!Number.isFinite(pct) || !Number.isFinite(populationMil)) {
        continue
      }

      computedRows.push({
        key: group.key,
        group: group.label,
        pct,
        populationMil,
      })
    }

    return computedRows
  }, [summary])

  const chartRows = useMemo(() => {
    return rows.map((row, index) => ({
      ...row,
      fill: RACIAL_BAR_COLORS[index % RACIAL_BAR_COLORS.length],
    }))
  }, [rows])

  return (
    <>
      <div className="small-text muted-text" style={{ marginBottom: SMALL_SPACING }}>
        Statewide CVAP shares by racial/ethnic group.
      </div>

      {loading && rows.length === 0 && (
        <div className="small-text muted-text" style={{ marginBottom: SECTION_SPACING }}>
          Loading statewide racial group summary from the backend...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="small-text muted-text" style={{ marginBottom: SECTION_SPACING }}>
          No statewide racial/ethnic group data.
        </div>
      )}

      {rows.length > 0 && !chartView && (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: SECTION_SPACING }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: TABLE_FONT_SIZE }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: TABLE_CELL_PADDING }}>Group</th>
                <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Share</th>
                <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Population</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: TABLE_CELL_PADDING }}>{row.group}</td>
                  <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.pct.toFixed(1)}%</td>
                  <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.populationMil.toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && chartView && (
        <div style={{ width: '100%', height: RACIAL_CHART_HEIGHT, marginBottom: SECTION_SPACING }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={CHART_MARGIN_RACIAL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="group" interval={0} angle={RACIAL_XAXIS_ANGLE} textAnchor="end" height={RACIAL_XAXIS_HEIGHT} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
              <Tooltip
                formatter={(value, name, item) => [
                  `${Number(value).toFixed(1)}% (${Number(item?.payload?.populationMil ?? 0).toFixed(2)}M)`,
                  'Share',
                ]}
              />
              <Bar dataKey="pct" isAnimationActive={false}>
                {chartRows.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}

function VoterDistributionSection({ summary, loading, chartView }) {
  const { tableRows, totalVotes } = useMemo(() => {
    const demVotes = Number(summary?.voterDistribution?.demVotes)
    const repVotes = Number(summary?.voterDistribution?.repVotes)
    const allVotes = Number(summary?.voterDistribution?.totalVotes)
    const demPct = Number(summary?.voterDistribution?.demPct)
    const repPct = Number(summary?.voterDistribution?.repPct)

    if (!Number.isFinite(demVotes) || !Number.isFinite(repVotes) || !Number.isFinite(allVotes) || allVotes <= 0) {
      return { tableRows: [], totalVotes: 0 }
    }

    return {
      totalVotes: allVotes,
      tableRows: [
        {
          party: 'Democratic',
          shortParty: 'Dem',
          votes: demVotes,
          share: Number.isFinite(demPct) ? demPct : (demVotes / allVotes) * 100,
          color: DEM_COLOR,
        },
        {
          party: 'Republican',
          shortParty: 'Rep',
          votes: repVotes,
          share: Number.isFinite(repPct) ? repPct : (repVotes / allVotes) * 100,
          color: REP_COLOR,
        },
      ],
    }
  }, [summary])

  const chartRows = useMemo(() => {
    return tableRows.map((row) => ({
      party: row.shortParty,
      share: row.share,
      fill: row.color,
      votes: row.votes,
    }))
  }, [tableRows])

  return (
    <>
      {loading && <div className="small-text muted-text" style={{ marginBottom: SECTION_SPACING }}>Loading statewide vote distribution from the backend...</div>}

      {!loading && totalVotes <= 0 && (
        <div className="small-text muted-text" style={{ marginBottom: SECTION_SPACING }}>
          No precinct election totals available.
        </div>
      )}

      {!loading && totalVotes > 0 && !chartView && (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: SECTION_SPACING }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: TABLE_FONT_SIZE }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: TABLE_CELL_PADDING }}>Party</th>
                <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Votes</th>
                <th style={{ padding: TABLE_CELL_PADDING, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.party} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: TABLE_CELL_PADDING }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: SUBSECTION_SPACING }}>
                      <span style={{ width: INLINE_DOT_SIZE, height: INLINE_DOT_SIZE, borderRadius: '50%', background: row.color }} />
                      {row.party}
                    </span>
                  </td>
                  <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(row.votes).toLocaleString()}
                  </td>
                  <td style={{ padding: TABLE_CELL_PADDING, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {row.share.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalVotes > 0 && chartView && (
        <div style={{ width: '100%', height: POLITICAL_CHART_HEIGHT, marginBottom: SECTION_SPACING }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={CHART_MARGIN_DEFAULT}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="party" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
              <Tooltip
                formatter={(value, name, item) => [
                  `${Number(value).toFixed(2)}% (${Math.round(Number(item?.payload?.votes ?? 0)).toLocaleString()} votes)`,
                  'Share',
                ]}
              />
              <Bar dataKey="share" fill={DEM_COLOR} isAnimationActive={false}>
                {chartRows.map((entry) => (
                  <Cell key={entry.party} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}

function MapSummaryCards({ summary, loading }) {
  const [chartView, setChartView] = useState(false)
  const [summarySection, setSummarySection] = useState('demographic')

  if (!summary) {
    return (
      <Card title="Summary">
        <div className="small-text muted-text">No summary data.</div>
      </Card>
    )
  }

  return (
    <>
      <Card
        title="State Summary"
        actions={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: SUBSECTION_SPACING }}>
            <span className="small-text muted-text">Table</span>
            <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle state summary table or chart view" />
            <span className="small-text muted-text">Chart</span>
          </div>
        )}
      >
        <div style={{ marginBottom: SECTION_SPACING }}>
          <SegmentedControl
            ariaLabel="State summary section selector"
            value={summarySection}
            onChange={setSummarySection}
            options={SUMMARY_SECTION_OPTIONS}
          />
        </div>

        {summarySection === 'demographic' && (
          <>
            <div className="small-text muted-text" style={{ marginBottom: SUBSECTION_SPACING }}>Population Overview</div>
            <PopulationSummaryTable
              cvapTotal={summary?.votingAgePopulation}
              districtCount={summary?.districts}
              loading={loading}
            />
            <div className="small-text muted-text" style={{ marginBottom: SUBSECTION_SPACING }}>Racial Groups</div>
            <RacialGroupsSection summary={summary} loading={loading} chartView={chartView} />
          </>
        )}

        {summarySection === 'political' && (
          <>
            <div className="small-text muted-text" style={{ marginBottom: SUBSECTION_SPACING }}>Voter Distribution</div>
            <VoterDistributionSection summary={summary} loading={loading} chartView={chartView} />
            <div className="small-text muted-text" style={{ marginBottom: SUBSECTION_SPACING }}>Congressional Party</div>
            <CongressionalPartySummarySection summary={summary} chartView={chartView} />
          </>
        )}
      </Card>

      <Card title="Redistricting Process">
        <div className="small-text" style={{ lineHeight: PROCESS_TEXT_LINE_HEIGHT }}>
          {formatRedistrictingControl(summary, loading)}
        </div>
      </Card>
    </>
  )
}

export default MapSummaryCards

