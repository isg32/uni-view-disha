import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import DataTable from '../components/DataTable'

const GAS_PROXY = '/api/gas-proxy'

interface SheetMeta {
  id: string
  name: string
  targetSlug: string
  uploadedAt: string
  headers: string[]
  rowCount: number
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()

  const meta = user?.publicMetadata as { role?: string; universitySlug?: string } | undefined
  const universitySlug = meta?.universitySlug ?? ''

  const [sheets, setSheets] = useState<SheetMeta[]>([])
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [loadingSheets, setLoadingSheets] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = (user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Fetch sheet metadata for this university
  useEffect(() => {
    if (!universitySlug) { setLoadingSheets(false); return }
    ;(async () => {
      try {
        const res = await fetch(`${GAS_PROXY}?action=getSheets&targetSlug=${encodeURIComponent(universitySlug)}`)
        const data: SheetMeta[] = await res.json()
        setSheets(data)
        if (data.length > 0) {
          setActiveSheet(data[0].targetSlug)
        }
      } catch (err) {
        setError(`Failed to load sheets: ${String(err)}`)
      } finally {
        setLoadingSheets(false)
      }
    })()
  }, [universitySlug])

  // Fetch row data whenever active sheet changes
  useEffect(() => {
    if (!activeSheet) return
    setLoadingData(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch(`${GAS_PROXY}?action=getSheetData&sheetName=${encodeURIComponent(activeSheet)}`)
        const data: Record<string, unknown>[] = await res.json()
        setRows(data)
        const cols = data.length > 0
          ? Object.keys(data[0]).filter(k => k !== '_rowIndex')
          : []
        setColumns(cols)
      } catch (err) {
        setError(`Failed to load data: ${String(err)}`)
      } finally {
        setLoadingData(false)
      }
    })()
  }, [activeSheet])

  const activeSheetMeta = sheets.find(s => s.targetSlug === activeSheet)

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/dishalogo.png" alt="Disha Logo" />
          <small>{universitySlug || 'Dashboard'}</small>
        </div>

        <nav className="sidebar-nav">
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>
            Data Sheets
          </div>
          {sheets.map(s => (
            <button
              key={s.targetSlug}
              className={`nav-item ${activeSheet === s.targetSlug ? 'active' : ''}`}
              onClick={() => setActiveSheet(s.targetSlug)}
              title={s.name}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            </button>
          ))}
          {!loadingSheets && sheets.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
              No data assigned yet.
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-chip-avatar">{initials}</div>
            <div className="user-chip-info">
              <div className="user-chip-name">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'User'}
              </div>
              <div className="user-chip-role">{universitySlug || 'No University'}</div>
            </div>
            <button
              className="btn-signout"
              title="Sign out"
              onClick={() => signOut(() => navigate('/login'))}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {!universitySlug ? (
          <div className="loading-state" style={{ minHeight: '60vh' }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <h2 style={{ color: 'var(--text-h)' }}>No University Assigned</h2>
            <p style={{ maxWidth: 400, textAlign: 'center' }}>
              Your account hasn't been assigned a university yet. Please contact your administrator.
            </p>
          </div>
        ) : loadingSheets ? (
          <div className="loading-state" style={{ minHeight: '60vh' }}>
            <div className="spinner" /><span>Loading sheets…</span>
          </div>
        ) : error ? (
          <div className="alert alert-error" style={{ maxWidth: 600 }}>{error}</div>
        ) : (
          <>
            <div className="page-header">
              <h1>
                {activeSheetMeta?.name ?? universitySlug}
              </h1>
              <p>
                {universitySlug} &nbsp;·&nbsp;
                {activeSheetMeta
                  ? `${activeSheetMeta.rowCount} rows · Last updated ${new Date(activeSheetMeta.uploadedAt).toLocaleDateString()}`
                  : 'Read-only view'}
              </p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-label">Total Rows</div>
                <div className="stat-value">{rows.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🗂</div>
                <div className="stat-label">Columns</div>
                <div className="stat-value">{columns.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎓</div>
                <div className="stat-label">University</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{universitySlug}</div>
              </div>
            </div>

            {/* Data table */}
            {loadingData ? (
              <div className="loading-state"><div className="spinner" /><span>Loading data…</span></div>
            ) : (
              <div className="card" style={{ padding: 20 }}>
                <DataTable data={rows} columns={columns} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
