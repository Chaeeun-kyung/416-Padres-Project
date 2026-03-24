import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useAppStore from '../store/useAppStore'
import Button from '../ui/components/Button'
import Card from '../ui/components/Card'
import SegmentedControl from '../ui/components/SegmentedControl'
import ToggleSwitch from '../ui/components/ToggleSwitch'
import RepresentationTable from './tables/RepresentationTable'
import EnsembleSplits from './charts/EnsembleSplits'
import GinglesScatter from './charts/GinglesScatter'
import EICurve from './charts/EICurve'
import EnsembleBoxplot from './charts/EnsembleBoxplot'

const DEM_COLOR = '#2563eb'
const REP_COLOR = '#dc2626'
const RACIAL_BAR_COLORS = ['#0f766e', '#14b8a6', '#06b6d4']

const DISPLAY_RACIAL_GROUPS = [
  { key: 'white_pct', label: 'White' },
  { key: 'black_pct', label: 'Black' },
  { key: 'latino_pct', label: 'Latino' },
  { key: 'asian_pct', label: 'Asian' },
]

const RIGHT_PANEL_VIEW_OPTIONS = [
  { value: 'Map', label: 'State Summary' },
  { value: 'Gingles', label: 'Gingles' },
  { value: 'EI', label: 'EI' },
  { value: 'Ensembles', label: 'Ensemble Analysis' },
]

const ENSEMBLE_VIEW_OPTIONS = [
  { value: 'splits', label: 'Split Bars' },
  { value: 'boxplot', label: 'Box & Whisker' },
]

// Number formatting helper for summary tables.
function formatWholeNumber(value) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }
  return Math.round(value).toLocaleString()
}

function normalizeDistrictNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) return null
  const digits = String(rawValue).match(/\d+/)?.[0]
  return digits ? digits.padStart(2, '0') : null
}

function buildSelectedDistrictDatasetDetails(features, selectedDistrictId) {
  if (!Array.isArray(features) || !selectedDistrictId) return null

  const selectedDistrictNumber = normalizeDistrictNumber(selectedDistrictId)
  if (!selectedDistrictNumber) return null

  const matchingFeature = features.find((feature) => {
    const props = feature?.properties ?? {}
    return normalizeDistrictNumber(props.district_number ?? props.district_id) === selectedDistrictNumber
  })

  if (!matchingFeature) return null

  const props = matchingFeature.properties ?? {}
  if (!props.district_name && !props.plan_type && !props.plan_source_file) return null

  return {
    districtName: props.district_name ?? 'N/A',
    districtNumber: normalizeDistrictNumber(props.district_number ?? props.district_id) ?? 'N/A',
    planType: props.plan_type ?? 'N/A',
    planSourceFile: props.plan_source_file ?? 'N/A',
  }
}

function PopulationSummaryTable({ cvapTotal, districtCount, loading }) {
  const cvapValue = loading ? 'Loading...' : formatWholeNumber(cvapTotal)
  const rows = [
    { label: 'Citizen Voting-Age Population', value: cvapValue },
    { label: 'Districts', value: districtCount?.toLocaleString?.() ?? districtCount ?? 'N/A' },
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

// Single-line display for current redistricting control/process owner.
function RedistrictingProcessTable({ summary }) {
  return (
    <div className="small-text" style={{ marginBottom: 4, lineHeight: 1.45 }}>
      <span>{summary?.redistrictingControl ?? 'N/A'}</span>
    </div>
  )
}

// Two-view section (table/chart) for party seat allocation.
function CongressionalPartySummarySection({ summary }) {
  const [chartView, setChartView] = useState(false)

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

      {tableRows.length > 0 && !chartView && (
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
      )}

      {tableRows.length > 0 && chartView && (
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
      )}
    </>
  )
}

// Two-view section (table/chart) for statewide CVAP racial composition.
function RacialGroupsSection({ summary, loading }) {
  const [chartView, setChartView] = useState(false)

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
      <div className="small-text muted-text" style={{ marginBottom: 4 }}>
        Statewide CVAP shares by racial/ethnic group.
      </div>
      <div className="small-text muted-text" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{chartView ? 'Chart view' : 'Table view'}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="small-text">Table</span>
          <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle racial groups view" />
          <span className="small-text">Chart</span>
        </div>
      </div>

      {loading && rows.length === 0 && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          Loading statewide racial group summary from the backend...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          No statewide racial/ethnic group data.
        </div>
      )}

      {rows.length > 0 && !chartView && (
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
      )}

      {rows.length > 0 && chartView && (
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
      )}
    </>
  )
}

// Summary table for ensemble counts and population-equality metadata.
function EnsembleSummaryTable({ summary }) {
  const rows = [
    { label: 'Race-blind plans', value: summary?.ensembleSummary?.raceBlindPlans?.toLocaleString?.() ?? summary?.ensembleSummary?.raceBlindPlans ?? 'N/A' },
    { label: 'VRA-constrained plans', value: summary?.ensembleSummary?.vraConstrainedPlans?.toLocaleString?.() ?? summary?.ensembleSummary?.vraConstrainedPlans ?? 'N/A' },
    { label: 'Population Equality Threshold', value: summary?.ensembleSummary?.populationEqualityThresholdLabel ?? 'N/A' },
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

function DistrictDatasetDetailsTable({ details }) {
  const rows = [
    { label: 'District Name', value: details?.districtName ?? 'N/A' },
    { label: 'District Number', value: details?.districtNumber ?? 'N/A' },
    { label: 'Plan Type', value: details?.planType ?? 'N/A' },
    { label: 'Source File', value: details?.planSourceFile ?? 'N/A' },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: 6 }}>Field</th>
            <th style={{ padding: 6, textAlign: 'right' }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: 6 }}>{row.label}</td>
              <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function VoterDistributionSection({ summary, loading }) {
  const [chartView, setChartView] = useState(false)

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
      <div className="small-text muted-text" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{chartView ? 'Chart view' : 'Table view'}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="small-text">Table</span>
          <ToggleSwitch checked={chartView} onChange={setChartView} ariaLabel="Toggle voter distribution view" />
          <span className="small-text">Chart</span>
        </div>
      </div>

      {loading && <div className="small-text muted-text" style={{ marginBottom: 8 }}>Loading statewide vote distribution from the backend...</div>}

      {!loading && totalVotes <= 0 && (
        <div className="small-text muted-text" style={{ marginBottom: 8 }}>
          No precinct election totals available.
        </div>
      )}

      {!loading && totalVotes > 0 && !chartView && (
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
      )}

      {!loading && totalVotes > 0 && chartView && (
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
      )}
    </>
  )
}

function isValidRightPanelView(view) {
  return RIGHT_PANEL_VIEW_OPTIONS.some((option) => option.value === view)
}

function MapSummaryCards({ summary, loading }) {
  if (!summary) {
    return (
      <Card title="Summary">
        <div className="small-text muted-text">No summary data.</div>
      </Card>
    )
  }

  return (
    <>
      <Card title="Population Overview">
        <PopulationSummaryTable
          cvapTotal={summary?.votingAgePopulation}
          districtCount={summary?.districts}
          loading={loading}
        />
      </Card>

      <Card title="Voter Distribution">
        <VoterDistributionSection summary={summary} loading={loading} />
      </Card>

      <Card title="Racial Groups">
        <RacialGroupsSection summary={summary} loading={loading} />
      </Card>

      <Card title="Redistricting Process">
        <RedistrictingProcessTable summary={summary} />
      </Card>

      <Card title="Congressional Party">
        <CongressionalPartySummarySection summary={summary} />
      </Card>

      <Card title="Ensemble Summary">
        <EnsembleSummaryTable summary={summary} />
      </Card>
    </>
  )
}

// Right panel page 1 router:
// - "Map" summary cards
// - chart-focused views for Gingles/EI/Ensembles
function RightPanelPageOne({
  selectedStateCode,
  activeView,
  setActiveView,
  summary,
  loading,
  ensembleView,
  setEnsembleView,
}) {
  return (
    <>
      <Card title="">
        <SegmentedControl
          ariaLabel="Right panel content view selector"
          value={activeView}
          onChange={setActiveView}
          options={RIGHT_PANEL_VIEW_OPTIONS}
        />
      </Card>

      {activeView === 'Map' && (
        <MapSummaryCards
          summary={summary}
          loading={loading}
        />
      )}

      {activeView === 'Gingles' && (
        <Card title="">
          <div style={{ width: '100%', height: 'min(72vh, 700px)' }}>
            <GinglesScatter stateCode={selectedStateCode} />
          </div>
        </Card>
      )}

      {activeView === 'EI' && (
        <Card title="">
          <div style={{ width: '100%', height: 'min(72vh, 700px)' }}>
            <EICurve stateCode={selectedStateCode} />
          </div>
        </Card>
      )}

      {activeView === 'Ensembles' && (
        <Card title="Ensemble Analysis">
          <div style={{ width: '100%', height: 'min(72vh, 700px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 360, maxWidth: '100%' }}>
              <SegmentedControl
                ariaLabel="Ensemble chart selector"
                value={ensembleView}
                onChange={setEnsembleView}
                options={ENSEMBLE_VIEW_OPTIONS}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {ensembleView === 'boxplot' ? <EnsembleBoxplot stateCode={selectedStateCode} /> : <EnsembleSplits stateCode={selectedStateCode} />}
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

// Right sidebar controller with two-page behavior:
// Page 1: state summary + chart views
// Page 2: congressional representation table for selected district context
function RightDetails({ selectedStateCode, precinctGeojson, loading }) {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [representationRows, setRepresentationRows] = useState([])
  const precinctFeatures = useMemo(() => {
    return precinctGeojson?.features ?? []
  }, [precinctGeojson])
  const selectedDistrictDatasetDetails = useMemo(
    () => buildSelectedDistrictDatasetDetails(precinctFeatures, selectedDistrictId),
    [precinctFeatures, selectedDistrictId],
  )
  const canShowRepresentationPage = Boolean(selectedDistrictId)
  const [detailsPage, setDetailsPage] = useState(0)
  const [ensembleView, setEnsembleView] = useState('splits')
  const repRows = representationRows

  // Always stay on page 1 if no district is selected.
  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!selectedStateCode) {
        setSummary(null)
        return
      }

      setSummaryLoading(true)
      try {
        // Ask Spring for the selected state's summary and render the response directly.
        const response = await axios.get(`/api/states/${selectedStateCode}/summary`)
        const nextSummary = response.data
        if (!cancelled) {
          setSummary(nextSummary)
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null)
        }

        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Failed to load state summary', error)
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      cancelled = true
    }
  }, [selectedStateCode])

  useEffect(() => {
    let cancelled = false

    async function loadRepresentation() {
      if (!selectedStateCode) {
        setRepresentationRows([])
        return
      }

      try {
        const response = await axios.get(`/api/states/${selectedStateCode}/representation`)
        const nextRows = Array.isArray(response.data?.rows) ? response.data.rows : []
        if (!cancelled) {
          setRepresentationRows(nextRows)
        }
      } catch (error) {
        if (!cancelled) {
          setRepresentationRows([])
        }

        if (!axios.isAxiosError(error) || error.response?.status !== 404) {
          console.error('Failed to load representation rows', error)
        }
      }
    }

    loadRepresentation()

    return () => {
      cancelled = true
    }
  }, [selectedStateCode])

  useEffect(() => {
    if (!canShowRepresentationPage) {
      const frameId = requestAnimationFrame(() => {
        setDetailsPage(0)
      })
      return () => cancelAnimationFrame(frameId)
    }

    return undefined
  }, [canShowRepresentationPage])

  // When a district gets selected, switch to district details page.
  useEffect(() => {
    if (canShowRepresentationPage && selectedDistrictId) {
      const frameId = requestAnimationFrame(() => {
        setDetailsPage(1)
      })
      return () => cancelAnimationFrame(frameId)
    }

    return undefined
  }, [canShowRepresentationPage, selectedDistrictId])

  const totalPages = canShowRepresentationPage ? 2 : 1
  const effectivePage = canShowRepresentationPage ? detailsPage : 0
  const effectiveView = isValidRightPanelView(activeTab) ? activeTab : 'Map'

  return (
    <aside className="dashboard-sidebar">
      {canShowRepresentationPage && (
        <Card compact>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Button variant="secondary" onClick={() => setDetailsPage(0)} disabled={effectivePage === 0}>
              Prev
            </Button>
            <span className="small-text">Page {effectivePage + 1} / {totalPages}</span>
            <Button variant="secondary" onClick={() => setDetailsPage(1)} disabled={effectivePage === totalPages - 1}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {effectivePage === 0 && (
        <RightPanelPageOne
          selectedStateCode={selectedStateCode}
          activeView={effectiveView}
          setActiveView={setActiveTab}
          summary={summary}
          loading={loading || summaryLoading}
          ensembleView={ensembleView}
          setEnsembleView={setEnsembleView}
        />
      )}

      {effectivePage === 1 && canShowRepresentationPage && (
        <>
          <Card title="Congressional Representation">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedDistrictId(null)
                  setDetailsPage(0)
                }}
              >
                Exit District Details
              </Button>
            </div>
            <RepresentationTable
              rows={repRows}
              selectedDistrictId={selectedDistrictId}
              onSelectDistrict={setSelectedDistrictId}
            />
          </Card>

          {selectedDistrictDatasetDetails && (
            <Card title="Enacted Plan Metadata">
              <DistrictDatasetDetailsTable details={selectedDistrictDatasetDetails} />
            </Card>
          )}
        </>
      )}
    </aside>
  )
}

export default RightDetails
