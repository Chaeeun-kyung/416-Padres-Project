import representationRows from '../data/mock/representationRows.json'
import { FEASIBLE_THRESHOLD_MILLIONS, getFeasibleGroupKeys, RACIAL_GROUPS } from '../data/racialGroupConfig'
import stateSummary from '../data/mock/stateSummary.json'
import { getFeatureByGeoId, getPrecinctRows } from '../services/dataLoader'
import useAppStore from '../store/useAppStore'
import Badge from '../ui/components/Badge'
import Card from '../ui/components/Card'
import RepresentationTable from './tables/RepresentationTable'
import PrecinctTablePaginated from './tables/PrecinctTablePaginated'

function StatLine({ label, value }) {
  return (
    <div className="details-stat">
      <span className="details-stat__label">{label}</span>
      <span className="details-stat__value">{value}</span>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="small-text" style={{ fontWeight: 700, marginTop: 'var(--ui-space-md)', marginBottom: 4 }}>
      {children}
    </div>
  )
}

function RightDetails({ selectedStateCode, precinctGeojson, loading }) {
  const activeTab = useAppStore((state) => state.activeTab)
  const selectedPrecinctId = useAppStore((state) => state.selectedPrecinctId)
  const selectedDistrictId = useAppStore((state) => state.selectedDistrictId)
  const setSelectedDistrictId = useAppStore((state) => state.setSelectedDistrictId)
  const setSelectedPrecinctId = useAppStore((state) => state.setSelectedPrecinctId)

  const rows = getPrecinctRows(precinctGeojson?.features ?? [])
  const selectedFeature = getFeatureByGeoId(precinctGeojson?.features ?? [], selectedPrecinctId)
  const summary = stateSummary[selectedStateCode]
  const repRows = representationRows[selectedStateCode] ?? []
  const feasibleGroups = getFeasibleGroupKeys(summary)

  return (
    <aside className="dashboard-sidebar">
      <Card title="State Summary" actions={<Badge>Academic Demo</Badge>}>
        {!summary ? (
          <div className="small-text muted-text">No summary data.</div>
        ) : (
          <>
            <StatLine label="Population (Total)" value={summary.population} />
            <StatLine label="Voting-Age Population" value={summary.votingAgePopulation ?? 'N/A'} />
            <StatLine label="Precincts" value={summary.precincts} />
            <StatLine label="Districts" value={summary.districts} />
            <SectionTitle>2024 Voter Distribution</SectionTitle>
            <StatLine
              label="Democratic Share"
              value={`${Number(summary.stateVoterDistribution?.demPct ?? 0).toFixed(1)}%`}
            />
            <StatLine
              label="Republican Share"
              value={`${Number(summary.stateVoterDistribution?.repPct ?? 0).toFixed(1)}%`}
            />

            <SectionTitle>Significant Racial/Ethnic Groups</SectionTitle>
            <div className="small-text muted-text" style={{ marginBottom: 4 }}>
              Included groups are feasible groups only: over {FEASIBLE_THRESHOLD_MILLIONS.toFixed(1)} million CVAP.
            </div>
            {RACIAL_GROUPS.filter((group) => feasibleGroups.has(group.key)).map((group) => {
              const pct = Number(summary.racialEthnicPopulationPct?.[group.key])
              const populationMil = Number(summary.racialEthnicPopulationMillions?.[group.key])
              if (!Number.isFinite(pct) || !Number.isFinite(populationMil)) return null
              return (
                <StatLine
                  key={group.key}
                  label={`${group.label} (Feasible >0.4M)`}
                  value={`${pct.toFixed(1)}% (${populationMil.toFixed(2)}M)`}
                />
              )
            })}

            <SectionTitle>Redistricting Process</SectionTitle>
            <div className="small-text muted-text">{summary.redistrictingControl ?? 'N/A'}</div>

            <SectionTitle>Congressional Party Summary</SectionTitle>
            <StatLine label="Democrats" value={summary.congressionalPartySummary?.democrats ?? 'N/A'} />
            <StatLine label="Republicans" value={summary.congressionalPartySummary?.republicans ?? 'N/A'} />

            <SectionTitle>Ensemble Summary</SectionTitle>
            {(summary.ensembles ?? []).map((ensemble) => (
              <div key={ensemble.name} className="small-text muted-text" style={{ marginBottom: 4 }}>
                {ensemble.name}: {ensemble.planCount?.toLocaleString?.() ?? ensemble.planCount} plans, {ensemble.populationEqualityThreshold}
              </div>
            ))}

            <div className="small-text muted-text" style={{ marginTop: 'var(--ui-space-sm)' }}>
              {summary.note}
            </div>
          </>
        )}
      </Card>

      <Card title="Selection">
        {loading ? (
          <div className="small-text muted-text">Loading precinct data...</div>
        ) : selectedFeature ? (
          <>
            <StatLine label="Selected GEOID" value={selectedFeature.properties?.GEOID ?? 'N/A'} />
            <StatLine label="Dem Votes" value={selectedFeature.properties?.votes_dem ?? 0} />
            <StatLine label="Rep Votes" value={selectedFeature.properties?.votes_rep ?? 0} />
            <StatLine label="Total Votes" value={selectedFeature.properties?.votes_total ?? 0} />
          </>
        ) : (
          <div className="small-text muted-text">Click a precinct on the map to inspect details.</div>
        )}
      </Card>

      {(activeTab === 'Map' || activeTab === 'Demographics') && (
        <Card title="Congressional Representation">
          <RepresentationTable
            rows={repRows}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
          />
        </Card>
      )}

      {(activeTab === 'Map' || activeTab === 'Demographics') && (
        <Card title="Precinct Results">
          <PrecinctTablePaginated
            rows={rows}
            selectedPrecinctId={selectedPrecinctId}
            onSelectPrecinct={setSelectedPrecinctId}
          />
        </Card>
      )}
    </aside>
  )
}

export default RightDetails
