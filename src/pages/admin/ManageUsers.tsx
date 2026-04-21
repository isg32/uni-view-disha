import { useEffect, useState } from 'react'

interface ClerkUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  imageUrl: string
  publicMetadata: {
    role?: string
    universitySlug?: string
  }
}

const SLUGS_PLACEHOLDER = ['iimahmedabad', 'iimbangalore', 'xlri', 'spjimr', 'fms']

export default function ManageUsers() {
  const [users, setUsers] = useState<ClerkUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null) // userId being saved
  const [feedback, setFeedback] = useState<Record<string, { type: 'success' | 'error'; msg: string }>>({})
  const [search, setSearch] = useState('')

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/list-users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(`Failed to load users: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const updateMeta = async (userId: string, patch: { role?: string; universitySlug?: string }) => {
    setSaving(userId)
    setFeedback(f => ({ ...f, [userId]: { type: 'success', msg: 'Saving…' } }))
    try {
      const res = await fetch('/api/set-user-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...patch }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed')

      // Optimistically update local state
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, publicMetadata: { ...u.publicMetadata, ...patch } }
          : u
      ))
      setFeedback(f => ({ ...f, [userId]: { type: 'success', msg: '✅ Saved' } }))
    } catch (err) {
      setFeedback(f => ({ ...f, [userId]: { type: 'error', msg: `Error: ${String(err)}` } }))
    } finally {
      setSaving(null)
      setTimeout(() => setFeedback(f => { const c = { ...f }; delete c[userId]; return c }), 3000)
    }
  }

  const filtered = users.filter(u =>
    !search.trim() ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.publicMetadata.universitySlug ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>Manage Users</h1>
        <p>Assign roles and university access to Clerk users.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎓</div>
          <div className="stat-label">Assigned</div>
          <div className="stat-value">{users.filter(u => u.publicMetadata.universitySlug).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛡</div>
          <div className="stat-label">Admins</div>
          <div className="stat-value">{users.filter(u => u.publicMetadata.role === 'admin').length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div className="search-box" style={{ maxWidth: 320 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            id="user-search"
            type="text"
            placeholder="Search by email or slug…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button id="btn-refresh-users" className="btn btn-ghost btn-sm" onClick={fetchUsers}>
          ↻ Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading users…</span></div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ borderRadius: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>University Slug</th>
                  <th style={{ minWidth: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4}><div className="table-empty">No users found.</div></td></tr>
                ) : filtered.map(user => (
                  <UserRow
                    key={user.id}
                    user={user}
                    saving={saving === user.id}
                    feedback={feedback[user.id]}
                    onSave={(patch) => updateMeta(user.id, patch)}
                    slugSuggestions={SLUGS_PLACEHOLDER}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

function UserRow({
  user, saving, feedback, onSave, slugSuggestions,
}: {
  user: ClerkUser
  saving: boolean
  feedback?: { type: 'success' | 'error'; msg: string }
  onSave: (patch: { role?: string; universitySlug?: string }) => void
  slugSuggestions: string[]
}) {
  const [role, setRole] = useState(user.publicMetadata.role ?? '')
  const [slugInput, setSlugInput] = useState(user.publicMetadata.universitySlug ?? '')
  const [dirty, setDirty] = useState(false)

  // Build a human-readable display name: prefer full name, fall back to email prefix
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  const emailPrefix = user.email.split('@')[0]
  const displayName = fullName || emailPrefix

  // Initials from display name
  const initials = displayName
    .split(/[\s._-]+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handleSave = () => {
    onSave({ role: role || undefined, universitySlug: slugInput.trim().toLowerCase() || undefined })
    setDirty(false)
  }

  return (
    <tr>
      {/* User info */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-chip-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
            {initials}
          </div>
          <div>
            <div className="user-email">{displayName}</div>
            <div className="user-id">{user.email}</div>
          </div>
        </div>
      </td>

      {/* Role selector */}
      <td>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 110, padding: '5px 8px', fontSize: 13 }}
          value={role}
          onChange={e => { setRole(e.target.value); setDirty(true) }}
        >
          <option value="">— none —</option>
          <option value="admin">admin</option>
          <option value="user">user</option>
        </select>
      </td>

      {/* Slug input */}
      <td>
        <input
          className="form-input"
          style={{ minWidth: 180, padding: '5px 8px', fontSize: 13 }}
          type="text"
          placeholder="e.g. iimahmedabad"
          list={`slugs-${user.id}`}
          value={slugInput}
          onChange={e => { setSlugInput(e.target.value); setDirty(true) }}
        />
        <datalist id={`slugs-${user.id}`}>
          {slugSuggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      </td>

      {/* Save + feedback */}
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            id={`btn-save-${user.id}`}
            className="btn btn-primary btn-sm"
            disabled={saving || !dirty}
            onClick={handleSave}
          >
            {saving ? '⏳' : '✓ Save'}
          </button>
          {feedback && (
            <span style={{
              fontSize: 11,
              color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
              whiteSpace: 'nowrap',
            }}>
              {feedback.msg}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
