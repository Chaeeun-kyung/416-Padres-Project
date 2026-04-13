// District detail table used on the right-side "Congressional Representation" page.
// Each row is selectable and keeps map + table selection synchronized by district ID.
function RepresentationTable({ rows, selectedDistrictId, onSelectDistrict }) {
  return (
    <div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 420, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          {/* Fixed column sizes keep the table readable in a narrow sidebar. */}
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--ui-border)' }}>
              <th style={{ padding: 6 }}>District</th>
              <th style={{ padding: 6 }}>Incumbent</th>
              <th style={{ padding: 6 }}>Party</th>
              <th style={{ padding: 6 }}>Race/Ethnicity</th>
              <th style={{ padding: 6 }}>Vote Margin</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => {
              const selected = selectedDistrictId === row.districtId
              return (
                <tr
                  key={row.districtId}
                  // Toggle behavior:
                  // clicking the selected row clears it; otherwise selects new district.
                  onClick={() => onSelectDistrict(selected ? null : row.districtId)}
                  style={{
                    borderBottom: '1px solid var(--ui-border)',
                    cursor: 'pointer',
                    background: selected ? 'var(--ui-accent-soft)' : '#fff',
                  }}
                >
                  <td style={{ padding: 6 }}>{row.districtId}</td>
                  <td
                    title={row.incumbent}
                    style={{
                      padding: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.incumbent}
                  </td>
                  <td style={{ padding: 6 }}>{row.party}</td>
                  <td
                    title={row.repRaceEthnicity}
                    style={{
                      padding: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.repRaceEthnicity ?? 'N/A'}
                  </td>
                  <td style={{ padding: 6 }}>
                    {`${row.voteMarginPct > 0 ? '+' : ''}${Number(row.voteMarginPct ?? 0).toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RepresentationTable
