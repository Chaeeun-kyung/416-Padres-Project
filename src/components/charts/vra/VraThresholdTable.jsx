// GUI-20: Display VRA impact threshold table
import thresholdMock from '../../../data/fallback/vraImpactThresholdMock.json'
import { formatPercent, formatTemplate } from './vraImpactUtils'

const THRESHOLD_TABLE_STYLE = {
  titleFontSize: '1.05rem',
  tableFontSize: '0.84rem',
  rowGap: 8,
  cellPadding: 8,
}

function VraThresholdTable({ stats }) {
  if (!stats) return <div className="small-text muted-text">No threshold stats available.</div>

  const columns = thresholdMock?.columns ?? {}
  const rowTemplates = thresholdMock?.rowTemplates ?? {}
  const rows = [
    {
      key: 'enacted',
      metric: formatTemplate(
        rowTemplates?.enacted ?? 'Satisfies enacted effectiveness (>= {value} effective districts)',
        stats.enactedCount,
      ),
      raceBlind: stats.metrics.enactedThreshold.raceBlind,
      vra: stats.metrics.enactedThreshold.vraConstrained,
    },
    {
      key: 'rough',
      metric: formatTemplate(
        rowTemplates?.rough ?? 'Satisfies rough proportionality (>= {value} effective districts)',
        stats.roughProportionalityTarget,
      ),
      raceBlind: stats.metrics.roughProportionality.raceBlind,
      vra: stats.metrics.roughProportionality.vraConstrained,
    },
    {
      key: 'joint',
      metric: formatTemplate(
        rowTemplates?.joint ?? 'Satisfies both conditions jointly (>= {value})',
        stats.jointTarget,
      ),
      raceBlind: stats.metrics.joint.raceBlind,
      vra: stats.metrics.joint.vraConstrained,
    },
  ]

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ fontSize: THRESHOLD_TABLE_STYLE.titleFontSize, fontWeight: 700, marginBottom: THRESHOLD_TABLE_STYLE.rowGap }}>
        {thresholdMock?.title ?? 'VRA Impact Threshold'}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: THRESHOLD_TABLE_STYLE.tableFontSize }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ui-border)', textAlign: 'left' }}>
            <th style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding }}>{columns?.metric ?? 'VRA Impact Threshold'}</th>
            <th style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding, textAlign: 'right' }}>{columns?.raceBlind ?? 'Race-Blind'}</th>
            <th style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding, textAlign: 'right' }}>{columns?.vraConstrained ?? 'VRA-Constrained'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <td style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding }}>{row.metric}</td>
              <td style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {formatPercent(row.raceBlind)}
              </td>
              <td style={{ padding: THRESHOLD_TABLE_STYLE.cellPadding, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                {formatPercent(row.vra)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default VraThresholdTable
