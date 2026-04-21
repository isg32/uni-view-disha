import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

interface Props {
  data: Record<string, unknown>[]
  columns: string[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

type SortDir = 'asc' | 'desc' | null

function downloadCSV(data: Record<string, unknown>[], columns: string[]) {
  const header = columns.join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `disha-export-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadXLSX(data: Record<string, unknown>[], columns: string[]) {
  // Build rows with only the visible columns in order
  const sheetData = data.map(row =>
    Object.fromEntries(columns.map(col => [col, row[col] ?? '']))
  )
  const ws = XLSX.utils.json_to_sheet(sheetData, { header: columns })

  // Auto-width columns
  const colWidths = columns.map(col => ({
    wch: Math.max(
      col.length,
      ...sheetData.map(r => String(r[col] ?? '').length)
    ) + 2,
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `disha-export-${Date.now()}.xlsx`)
}

export default function DataTable({ data, columns }: Props) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [colFilters, setColFilters] = useState<Record<string, string>>({})

  // ── filter ───────────────────────────────────
  const filtered = useMemo(() => {
    let rows = data

    // global search
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(row =>
        columns.some(col => String(row[col] ?? '').toLowerCase().includes(q))
      )
    }

    // column filters
    Object.entries(colFilters).forEach(([col, val]) => {
      if (val) {
        rows = rows.filter(row =>
          String(row[col] ?? '').toLowerCase().includes(val.toLowerCase())
        )
      }
    })

    return rows
  }, [data, search, columns, colFilters])

  // ── sort ─────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol] ?? '')
      const bv = String(b[sortCol] ?? '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  // ── paginate ──────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortCol(null)
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const setFilter = (col: string, val: string) => {
    setColFilters(f => ({ ...f, [col]: val }))
    setPage(1)
  }

  const sortIcon = (col: string) => {
    if (sortCol !== col) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }

  const pageNumbers = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="table-search"
            type="text"
            placeholder="Search all columns…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <button
          id="btn-export-csv"
          className="btn btn-sm"
          style={{
            background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.4)',
            color: '#10b981',
            fontWeight: 700,
          }}
          onClick={() => downloadCSV(sorted, columns)}
          title="Export visible rows as CSV"
        >
          ⬇ CSV
        </button>
        <button
          id="btn-export-xlsx"
          className="btn btn-sm"
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.45)',
            color: 'var(--accent-2)',
            fontWeight: 700,
          }}
          onClick={() => downloadXLSX(sorted, columns)}
          title="Export visible rows as Excel XLSX"
        >
          ⬇ Excel
        </button>
      </div>

      {/* Column filter row */}
      {columns.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {columns.slice(0, 6).map(col => (
            <input
              key={col}
              className="form-input"
              style={{ flex: '1', minWidth: 120, maxWidth: 180, padding: '6px 10px', fontSize: 12 }}
              placeholder={`Filter ${col}…`}
              value={colFilters[col] ?? ''}
              onChange={e => setFilter(col, e.target.value)}
            />
          ))}
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  className="sortable"
                  onClick={() => handleSort(col)}
                  title={`Sort by ${col}`}
                >
                  {col}
                  <span className="sort-icon">{sortIcon(col)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="table-empty">
                    {data.length === 0 ? 'No data available.' : 'No rows match your search.'}
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col} title={String(row[col] ?? '')}>
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="table-pagination">
          <span>
            {sorted.length === 0
              ? 'No results'
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length} rows`}
          </span>

          <div className="rows-select">
            <span>Rows:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px' }}
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="pagination-btns">
            <button disabled={currentPage === 1} onClick={() => setPage(1)}>«</button>
            <button disabled={currentPage === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {pageNumbers().map((p, i) =>
              p === '...'
                ? <button key={`ellipsis-${i}`} disabled>…</button>
                : <button
                    key={p}
                    className={currentPage === p ? 'active' : ''}
                    onClick={() => setPage(p)}
                  >{p}</button>
            )}
            <button disabled={currentPage === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      </div>
    </div>
  )
}
