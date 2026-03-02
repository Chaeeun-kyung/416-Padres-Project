import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import representationRows from '../data/mock/representationRows.json'
import { FEASIBLE_THRESHOLD_MILLIONS, getFeasibleGroupKeys, RACIAL_GROUPS } from '../data/racialGroupConfig'
import stateSummary from '../data/mock/stateSummary.json'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import ToggleSwitch from '../ui/components/ToggleSwitch'
import RepresentationTable from './tables/RepresentationTable'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const RACIAL_BAR_COLORS = ['#0f766e', '#14b8a6', '#06b6d4']

function StatLine({ label, value }) {
  return (
    <div className="details-stat">
      <span className="details-stat__label">{label}</span>
      <span className="details-stat__value">{value}</span>
    </div>
  )
}

function PopulationSummaryTable({ summary }) {
  const rows = [
    { label: 'Citizen Voting-Age Population', value: summary?.votingAgePopulation ?? 'N/A' },
    { label: 'Districts', value: summary?.districts?.toLocaleString?.() ?? summary?.districts ?? 'N/A' },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto', marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Metric</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: 6 }}>{row.label}</td>
              <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RedistrictingProcessTable({ summary }) {
  return (
    <div className="small-text" style={{ marginBottom: 4, lineHeight: 1.45 }}>
      <span>{summary?.redistrictingControl ?? 'N/A'}</span>
    </div>
  )
}

function CongressionalPartySummarySection({ summary }) {
  const [chartView, setChartView] = useState(false)

  const tableRows = useMemo(() => {
    const demSeats = Number(summary?.congressionalPartySummary?.democrats)
    const repSeats = Number(summary?.congressionalPartySummary?.republicans)
    const rows = []

    if (Number.isFinite(demSeats)) rows.push({ party: 'Democrats', shortParty: 'Dem', seats: demSeats, color: DEM_COLOR })
    if (Number.isFinite(repSeats)) rows.push({ party: 'Republicans', shortParty: 'Rep', seats: repSeats, color: REP_COLOR })
    return rows
  }, [summary])

  const maxSeats = Math.max(1, ...tableRows.map((row) => row.seats))

  return (
    <>
      <div className="small-text muted-text" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{chartView ? 'Chart view' : 'Table view'}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="small-text">Table</span>
          <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle congressional party summary view" />
          <span className="small-text">Chart</span>
        </div>
      </div>

      {!tableRows.length && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          No congressional party summary data.
        </div>
      )}

      {tableRows.length > 0 && (chartView ? (
        <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tableRows} margin={{ top: 8, right: 10, bottom: 10, left: 2 }}>
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
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: 6 }}>Party</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Seats</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.party} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                      {row.party}
                    </span>
                  </td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {row.seats.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

function RacialGroupsSection({ summary, feasibleGroups }) {
  const [chartView, setChartView] = useState(false)

  const rows = useMemo(() => {
    return RACIAL_GROUPS
      .filter((group) => feasibleGroups.has(group.key))
      .map((group) => {
        const pct = Number(summary?.racialEthnicPopulationPct?.[group.key])
        const populationMil = Number(summary?.racialEthnicPopulationMillions?.[group.key])
        if (!Number.isFinite(pct) || !Number.isFinite(populationMil)) return null
        return {
          key: group.key,
          group: group.label,
          pct,
          populationMil,
        }
      })
      .filter(Boolean)
  }, [feasibleGroups, summary])

  const chartRows = useMemo(
    () => rows.map((row, index) => ({ ...row, fill: RACIAL_BAR_COLORS[index % RACIAL_BAR_COLORS.length] })),
    [rows],
  )

  return (
    <>
      <div className="small-text muted-text" style={{ marginBottom: 4 }}>
        Feasible groups only: over {FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)} million CVAP.
      </div>
      <div className="small-text muted-text" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{chartView ? 'Chart view' : 'Table view'}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="small-text">Table</span>
          <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle racial groups view" />
          <span className="small-text">Chart</span>
        </div>
      </div>

      {!rows.length && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          No feasible racial/ethnic group data.
        </div>
      )}

      {rows.length > 0 && (chartView ? (
        <div style={{ width: '100%', height: 240, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 10, bottom: 18, left: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="group" interval={0} angle={-20} textAnchor="end" height={60} />
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
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: 6 }}>Group</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Share</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Population</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: 6 }}>{row.group}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.pct.toFixed(1)}%</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.populationMil.toFixed(2)}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

function EnsembleSummaryTable() {
  const rows = [
    { label: 'Race-blind plans', value: '5,000' },
    { label: 'VRA-constrained plans', value: '5,000' },
    { label: 'Population Equality Threshold', value: '+/-1%' },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Metric</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: 6 }}>{row.label}</td>
              <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VoterDistributionSection({ features, loading }) {
  const [chartView, setChartView] = useState(false)

  const { tableRows, totalVotes } = useMemo(() => {
    let demVotes = 0
    let repVotes = 0
    let allVotes = 0

    ;(features ?? []).forEach((feature) => {
      const props = feature?.properties ?? {}
      const dem = Number(props.votes_dem ?? 0)
      const rep = Number(props.votes_rep ?? 0)
      const total = Number(props.votes_total ?? 0)
      demVotes += Number.isFinite(dem) ? dem : 0
      repVotes += Number.isFinite(rep) ? rep : 0
      allVotes += Number.isFinite(total) ? total : 0
    })

    if (allVotes <= 0) {
      return { tableRows: [], totalVotes: 0 }
    }

    const rows = [
      { party: 'Democratic', shortParty: 'Dem', votes: demVotes, share: (demVotes / allVotes) * 100, color: DEM_COLOR },
      { party: 'Republican', shortParty: 'Rep', votes: repVotes, share: (repVotes / allVotes) * 100, color: REP_COLOR },
    ]

    return { tableRows: rows, totalVotes: allVotes }
  }, [features])

  const chartRows = useMemo(
    () => tableRows.map((row) => ({ party: row.shortParty, share: row.share, fill: row.color, votes: row.votes })),
    [tableRows],
  )

  return (
    <>
      <div className="small-text muted-text" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{chartView ? 'Chart view' : 'Table view'}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="small-text">Table</span>
          <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle voter distribution view" />
          <span className="small-text">Chart</span>
        </div>
      </div>

      {loading && <div className="small-text muted-text" style={{ marginBottom: 8 }}>Loading statewide vote distribution from precinct GeoJSON...</div>}
      {/* {!loading && totalVotes > 0 && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          Source: aggregated 2024 precinct GeoJSON totals ({Math.round(totalVotes).toLocaleString()} votes).
        </div>
      )} */}
      {!loading && totalVotes <= 0 && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          No precinct election totals available.
        </div>
      )}

      {!loading && totalVotes > 0 && (chartView ? (
        <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 10, bottom: 10, left: 2 }}>
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
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
                <th style={{ padding: 6 }}>Party</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Votes</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.party} style={{ borderBottom: '1px solid var(--ui-border)' }}>
                  <td style={{ padding: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                      {row.party}
                    </span>
                  </td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(row.votes).toLocaleString()}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {row.share.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

function RightDetails({ selectedStateCode, precinctGeojson, loading }) {
  const activeTab = useAppStore((state) => state.activeTab)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)
  const summary = stateSummary[selectedStateCode]
  const repRows = representationRows[selectedStateCode] ?? []
  const feasibleGroups = getFeasibleGroupKeys(summary)
  const canShowRepresentationPage =
    (activeTab === 'Map' || activeTab === 'Demographics') && Boolean(selectedDistrictId)
  const [detailsPage, setDetailsPage] = useState(0)

  useEffect(() => {
    if (!canShowRepresentationPage) {
      setDetailsPage(0)
    }
  }, [canShowRepresentationPage])

  useEffect(() => {
    if (canShowRepresentationPage && selectedDistrictId) {
      setDetailsPage(1)
    }
  }, [canShowRepresentationPage, selectedDistrictId])

  const totalPages = canShowRepresentationPage ? 2 : 1
  const effectivePage = canShowRepresentationPage ? detailsPage : 0

  return (
    <aside className="dashboard-sidebar">
      {canShowRepresentationPage && (
        <Card compact>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Button
              variant="secondary"
              onClick={() => setDetailsPage(0)}
              disabled={effectivePage === 0}
            >
              Prev
            </Button>
            <span className="small-text">Page {effectivePage + 1} / {totalPages}</span>
            <Button
              variant="secondary"
              onClick={() => setDetailsPage(1)}
              disabled={effectivePage === totalPages - 1}
            >
              Next
            </Button>
          </div>
        </Card>
      )}

      {effectivePage === 0 && (
        !summary ? (
          <Card title="Summary">
            <div className="small-text muted-text">No summary data.</div>
          </Card>
        ) : (
          <>
            <Card title="Population Overview">
              <PopulationSummaryTable summary={summary} />
            </Card>

            <Card title="Voter Distribution">
              <VoterDistributionSection features={precinctGeojson?.features ?? []} loading={loading} />
            </Card>

            <Card title="Racial Groups">
              <RacialGroupsSection summary={summary} feasibleGroups={feasibleGroups} />
            </Card>

            <Card title="Redistricting Process">
              <RedistrictingProcessTable summary={summary} />
            </Card>

            <Card title="Congressional Party">
              <CongressionalPartySummarySection summary={summary} />
            </Card>

            <Card title="Ensemble Summary">
              <EnsembleSummaryTable />
            </Card>
          </>
        )
      )}

      {effectivePage === 1 && canShowRepresentationPage && (
        <Card title="Congressional Representation">
          <RepresentationTable
            rows={repRows}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
          />
        </Card>
      )}
    </aside>
  )
}

export default RightDetails
