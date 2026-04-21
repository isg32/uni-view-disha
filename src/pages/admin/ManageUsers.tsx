import { useEffect, useState } from 'react'

interface ClerkUser {
  id: string
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  imageUrl: string
  publicMetadata: {
    role?: string
    universitySlug?: string
  }
}

interface CreateForm {
  username: string
  password: string
  firstName: string
  lastName: string
  role: string
  universitySlug: string
}

const EMPTY_FORM: CreateForm = {
  username: '', password: '', firstName: '', lastName: '', role: '', universitySlug: '',
}

export default function ManageUsers() {
  const [users, setUsers] = useState<ClerkUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, { type: 'success' | 'error'; msg: string }>>({})
  const [search, setSearch] = useState('')

  // Create user modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete confirm state
  const [confirmDelete, setConfirmDelete] = useState<ClerkUser | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/list-users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setUsers(await res.json())
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
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, publicMetadata: { ...u.publicMetadata, ...patch } } : u
      ))
      setFeedback(f => ({ ...f, [userId]: { type: 'success', msg: '✅ Saved' } }))
    } catch (err) {
      setFeedback(f => ({ ...f, [userId]: { type: 'error', msg: `${String(err)}` } }))
    } finally {
      setSaving(null)
      setTimeout(() => setFeedback(f => { const c = { ...f }; delete c[userId]; return c }), 3000)
    }
  }

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) {
      setCreateError('Username and password are required.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: createForm.username,
          password: createForm.password,
          firstName: createForm.firstName || undefined,
          lastName: createForm.lastName || undefined,
          role: createForm.role || undefined,
          universitySlug: createForm.universitySlug || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed')
      setUsers(prev => [json.user, ...prev])
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (user: ClerkUser) => {
    setDeleting(user.id)
    setConfirmDelete(null)
    try {
      const res = await fetch('/api/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed')
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (err) {
      setError(`Delete failed: ${String(err)}`)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = users.filter(u =>
    !search.trim() ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()) ||
    (u.publicMetadata.universitySlug ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>Manage Users</h1>
        <p>Create, assign roles, and remove Clerk users.</p>
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
            placeholder="Search by name, email or slug…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button id="btn-refresh-users" className="btn btn-ghost btn-sm" onClick={fetchUsers}>↻ Refresh</button>
        <button
          id="btn-create-user"
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setShowCreate(true); setCreateError(null); setCreateForm(EMPTY_FORM) }}
        >
          + Add User
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Users table */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading users…</span></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ borderRadius: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>University Slug</th>
                  <th style={{ minWidth: 150 }}>Actions</th>
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
                    deleting={deleting === user.id}
                    feedback={feedback[user.id]}
                    onSave={patch => updateMeta(user.id, patch)}
                    onDelete={() => setConfirmDelete(user)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create User Modal ──────────────────────────────────── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div className="card" style={{ width: 440, maxWidth: '95vw', padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Add New User</h2>
              <button
                className="btn-signout"
                onClick={() => setShowCreate(false)}
                style={{ fontSize: 20, color: 'var(--text-muted)' }}
              >✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" placeholder="Rahul" value={createForm.firstName}
                  onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" placeholder="Sharma" value={createForm.lastName}
                  onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Username <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" placeholder="rahul_sharma" value={createForm.username}
                onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} />
              <span className="form-hint">Used to sign in. Lowercase, no spaces.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Password <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" type="password" placeholder="Min. 8 characters" value={createForm.password}
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="">— none —</option>
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">University Slug</label>
                <input className="form-input" placeholder="iimahmedabad" value={createForm.universitySlug}
                  onChange={e => setCreateForm(f => ({ ...f, universitySlug: e.target.value }))} />
              </div>
            </div>

            {createError && <div className="alert alert-error">{createError}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                id="btn-confirm-create"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={creating}
                onClick={handleCreate}
              >
                {creating ? '⏳ Creating…' : '+ Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div className="card" style={{ width: 380, maxWidth: '95vw', padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Delete User?</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              This will permanently delete{' '}
              <strong style={{ color: 'var(--text-h)' }}>
                {[confirmDelete.firstName, confirmDelete.lastName].filter(Boolean).join(' ') || confirmDelete.email}
              </strong>{' '}
              from Clerk. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                id="btn-confirm-delete"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => handleDelete(confirmDelete)}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

function UserRow({
  user, saving, deleting, feedback, onSave, onDelete,
}: {
  user: ClerkUser
  saving: boolean
  deleting: boolean
  feedback?: { type: 'success' | 'error'; msg: string }
  onSave: (patch: { role?: string; universitySlug?: string }) => void
  onDelete: () => void
}) {
  const [role, setRole] = useState(user.publicMetadata.role ?? '')
  const [slugInput, setSlugInput] = useState(user.publicMetadata.universitySlug ?? '')
  const [dirty, setDirty] = useState(false)

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  // Username is the primary identifier; fall back to email prefix if no username
  const primaryId = user.username || user.email.split('@')[0]
  const subtitle = fullName || user.email || ''
  const initials = primaryId.split(/[\s._-]+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <tr style={{ opacity: deleting ? 0.4 : 1, transition: 'opacity 0.2s' }}>
      {/* User info */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-chip-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials}</div>
          <div>
            <div className="user-email">{primaryId}</div>
            {subtitle && <div className="user-id">{subtitle}</div>}
          </div>
        </div>
      </td>

      {/* Role */}
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

      {/* Slug */}
      <td>
        <input
          className="form-input"
          style={{ minWidth: 160, padding: '5px 8px', fontSize: 13 }}
          type="text"
          placeholder="e.g. iimahmedabad"
          value={slugInput}
          onChange={e => { setSlugInput(e.target.value); setDirty(true) }}
        />
      </td>

      {/* Actions */}
      <td>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            id={`btn-save-${user.id}`}
            className="btn btn-primary btn-sm"
            disabled={saving || !dirty}
            onClick={() => { onSave({ role: role || undefined, universitySlug: slugInput.trim().toLowerCase() || undefined }); setDirty(false) }}
          >
            {saving ? '⏳' : '✓ Save'}
          </button>
          <button
            id={`btn-delete-${user.id}`}
            className="btn btn-danger btn-sm"
            disabled={deleting}
            onClick={onDelete}
            title="Delete user"
          >
            {deleting ? '⏳' : '🗑'}
          </button>
          {feedback && (
            <span style={{ fontSize: 11, color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
              {feedback.msg}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
