import { useMemo, useState } from 'react'
import Button from '../../ui/components/Button'

const PAGE_SIZE = 10

function PrecinctTablePaginated({ rows, selectedPrecinctId, onSelectPrecinct }) {
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE))
  const selectedPage = useMemo(() => {
    if (!selectedPrecinctId || !rows?.length) return null
    const index = rows.findIndex((row) => String(row.geoid) === String(selectedPrecinctId))
    if (index === -1) return null
    return Math.floor(index / PAGE_SIZE)
  }, [rows, selectedPrecinctId])
  const effectivePage = selectedPage ?? Math.min(page, pageCount - 1)
  const currentRows = useMemo(() => {
    const start = effectivePage * PAGE_SIZE
    return (rows ?? []).slice(start, start + PAGE_SIZE)
  }, [effectivePage, rows])

  function goToPreviousPage() {
    if (selectedPrecinctId) onSelectPrecinct(null)
    setPage((previous) => Math.max(0, previous - 1))
  }

  function goToNextPage() {
    if (selectedPrecinctId) onSelectPrecinct(null)
    setPage((previous) => Math.min(pageCount - 1, previous + 1))
  }

  return (
    <div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 300, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
          <colgroup>
            <col style={{ width: '52%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--ui-border)' }}>
              <th style={{ padding: 5 }}>GEOID</th>
              <th style={{ padding: 5 }}>Dem</th>
              <th style={{ padding: 5 }}>Rep</th>
              <th style={{ padding: 5 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row) => {
              const selected = String(row.geoid) === String(selectedPrecinctId)
              return (
                <tr
                  key={row.rowKey}
                  onClick={() => onSelectPrecinct(row.geoid)}
                  style={{
                    borderBottom: '1px solid var(--ui-border)',
                    cursor: 'pointer',
                    background: selected ? 'var(--ui-accent-soft)' : '#fff',
                  }}
                >
                  <td
                    title={row.geoid}
                    style={{
                      padding: 5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.geoid}
                  </td>
                  <td style={{ padding: 5 }}>{row.votesDem}</td>
                  <td style={{ padding: 5 }}>{row.votesRep}</td>
                  <td style={{ padding: 5 }}>{row.votesTotal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="secondary" disabled={effectivePage === 0} onClick={goToPreviousPage}>
          Prev
        </Button>
        <span className="small-text">
          Page {effectivePage + 1} / {pageCount}
        </span>
        <Button variant="secondary" disabled={effectivePage >= pageCount - 1} onClick={goToNextPage}>
          Next
        </Button>
      </div>
    </div>
  )
}

export default PrecinctTablePaginated
