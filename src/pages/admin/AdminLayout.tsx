import { useState } from 'react'
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import UploadCSV from './UploadCSV'
import ManageUsers from './ManageUsers'

type Tab = 'upload' | 'users'

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [activeTab, setActiveTab] = useState<Tab>('upload')

  const goto = (tab: Tab) => {
    setActiveTab(tab)
    navigate(`/admin/${tab}`)
  }

  const initials = (user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'A')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/dishalogo.png" alt="Disha Logo" />
          <small>Admin Panel</small>
        </div>

        <nav className="sidebar-nav">
          <button
            id="nav-upload"
            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => goto('upload')}
          >
            <IconUpload /> Upload CSV
          </button>
          <button
            id="nav-users"
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => goto('users')}
          >
            <IconUsers /> Manage Users
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-chip-avatar">{initials}</div>
            <div className="user-chip-info">
              <div className="user-chip-name">
                {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Admin'}
              </div>
              <div className="user-chip-role">Admin</div>
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
        <Routes>
          <Route path="/" element={<Navigate to="upload" replace />} />
          <Route path="upload" element={<UploadCSV />} />
          <Route path="users" element={<ManageUsers />} />
        </Routes>
      </main>
    </div>
  )
}
