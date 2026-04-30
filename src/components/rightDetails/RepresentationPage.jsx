import { useMemo } from 'react'
import Button from '../../ui/components/Button'
import Card from '../../ui/components/Card'
import RepresentationTable from '../tables/RepresentationTable'

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

function RepresentationPage({
  precinctFeatures,
  representationRows,
  selectedDistrictId,
  setSelectedDistrictId,
  onExitDistrict,
}) {
  const selectedDistrictDatasetDetails = useMemo(
    () => buildSelectedDistrictDatasetDetails(precinctFeatures, selectedDistrictId),
    [precinctFeatures, selectedDistrictId],
  )

  return (
    <>
      <Card title="Congressional Representation">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedDistrictId(null)
              onExitDistrict?.()
            }}
          >
            Exit District Details
          </Button>
        </div>
        <RepresentationTable
          rows={representationRows}
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
  )
}

export default RepresentationPage
