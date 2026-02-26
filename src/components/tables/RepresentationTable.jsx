import { useMemo, useState } from 'react'
import Button from '../../ui/components/Button'

const PAGE_SIZE = 10

function RepresentationTable({ rows, selectedDistrictId, onSelectDistrict }) {
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE))
  const effectivePage = Math.min(page, pageCount - 1)
  const pagedRows = useMemo(() => {
    const start = effectivePage * PAGE_SIZE
    return (rows ?? []).slice(start, start + PAGE_SIZE)
  }, [effectivePage, rows])

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
            {pagedRows.map((row) => {
              const selected = selectedDistrictId === row.districtId
              return (
                <tr
                  key={row.districtId}
                  onClick={() => onSelectDistrict(row.districtId)}
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
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage((previous) => Math.max(0, previous - 1))}>
          Prev
        </Button>
        <span className="small-text">
          Page {effectivePage + 1} / {pageCount}
        </span>
        <Button
          variant="secondary"
          disabled={effectivePage >= pageCount - 1}
          onClick={() => setPage((previous) => Math.min(pageCount - 1, previous + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export default RepresentationTable
