import { useEffect, useMemo, useRef, useState } from 'react'

function normalizePid(value) {
  return String(value ?? '').trim()
}

function formatWholeNumber(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 'N/A'
  }
  return Math.round(numeric).toLocaleString()
}

function formatPct(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 'N/A'
  }
  return `${numeric.toFixed(1)}%`
}

function getGroupColumnLabel(selectedGroupLabel) {
  const label = String(selectedGroupLabel ?? '').trim()
  return label ? `${label} CVAP %` : 'Selected Group CVAP %'
}

function getWinnerLabel(value) {
  const winner = String(value ?? '').trim().toUpperCase()
  if (winner === 'DEMOCRATIC') {
    return 'Democratic'
  }
  if (winner === 'REPUBLICAN') {
    return 'Republican'
  }
  if (winner === 'TIE') {
    return 'Tie'
  }
  return 'N/A'
}

function getSelectedGroupPercent(row, selectedGroupKey) {
  const key = String(selectedGroupKey ?? '').trim().toLowerCase()
  const map = row?.groupPercentages
  if (map && typeof map === 'object') {
    const value = Number(map[key])
    if (Number.isFinite(value)) {
      return value
    }
  }
  return Number(row?.x)
}

function GinglesPointsTable({
  rows,
  selectedPid,
  onSelectPid,
  selectedGroupKey,
  selectedGroupLabel,
}) {
  const [query, setQuery] = useState('')
  const scrollContainerRef = useRef(null)
  const rowRefMap = useRef(new Map())

  const normalizedQuery = query.trim().toLowerCase()

  const sortedRows = useMemo(() => {
    const source = Array.isArray(rows) ? rows : []
    return [...source].sort((left, right) => {
      const leftPid = String(left?.pid ?? '')
      const rightPid = String(right?.pid ?? '')
      return leftPid.localeCompare(rightPid, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return sortedRows
    }
    return sortedRows.filter((row) => normalizePid(row?.pid).toLowerCase().includes(normalizedQuery))
  }, [normalizedQuery, sortedRows])

  const totalRows = filteredRows.length
  const groupPopulationColumnLabel = getGroupColumnLabel(selectedGroupLabel)

  useEffect(() => {
    if (!selectedPid) {
      return
    }
    const container = scrollContainerRef.current
    const rowElement = rowRefMap.current.get(selectedPid)
    if (!container || !rowElement) {
      return
    }

    const rowTop = rowElement.offsetTop
    const rowCenter = rowTop - (container.clientHeight / 2) + (rowElement.clientHeight / 2)
    container.scrollTop = Math.max(0, rowCenter)
  }, [selectedPid, normalizedQuery])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        border: '1px solid var(--ui-border)',
        borderRadius: 10,
        overflow: 'hidden',
        background: 'white',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--ui-border)',
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: '0.85rem' }}>Precinct Table</strong>
          <span className="small-text muted-text">{`${totalRows.toLocaleString()} rows`}</span>
          {selectedPid && <span className="small-text muted-text">{`Selected: ${selectedPid}`}</span>}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search PID"
          aria-label="Search precinct by PID"
          style={{
            width: 180,
            border: '1px solid var(--ui-border)',
            borderRadius: 8,
            padding: '5px 8px',
            fontSize: '0.78rem',
            background: 'white',
          }}
        />
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', minWidth: 760, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <colgroup>
          <col style={{ width: '24%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--ui-border)' }}>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6 }}>Precinct (PID)</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6 }}>Winner</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>Total CVAP</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>{groupPopulationColumnLabel}</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>Dem Votes</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>Rep Votes</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>Dem Share</th>
              <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, padding: 6, textAlign: 'right' }}>Rep Share</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const pid = normalizePid(row?.pid)
              const displayPid = pid || 'N/A'
              const selected = pid && pid === selectedPid
              return (
                <tr
                  key={displayPid}
                  ref={(element) => {
                    if (element && pid) {
                      rowRefMap.current.set(pid, element)
                    } else if (pid) {
                      rowRefMap.current.delete(pid)
                    }
                  }}
                  data-pid={pid}
                  onClick={() => {
                    if (!pid) {
                      return
                    }
                    onSelectPid?.(selected ? null : pid)
                  }}
                  style={{
                    borderBottom: '1px solid var(--ui-border)',
                    cursor: 'pointer',
                    background: selected ? 'var(--ui-accent-soft)' : 'white',
                  }}
                >
                  <td
                    style={{
                      padding: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={displayPid}
                  >
                    {displayPid}
                  </td>
                  <td style={{ padding: 6 }}>{getWinnerLabel(row?.winningParty)}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWholeNumber(row?.totalPopulation)}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatPct(getSelectedGroupPercent(row, selectedGroupKey))}
                  </td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWholeNumber(row?.democraticVotes)}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatWholeNumber(row?.republicanVotes)}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPct(row?.demSharePct)}</td>
                  <td style={{ padding: 6, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPct(row?.repSharePct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--ui-border)', background: '#f8fafc' }}>
        <span className="small-text muted-text">{`Showing ${totalRows.toLocaleString()} filtered rows`}</span>
      </div>
    </div>
  )
}

export default GinglesPointsTable
