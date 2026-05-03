import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import { getRoleLabel } from '../lib/roles'
import { Roles, type RoleName } from '../types/auth'
import type { UserRecord } from '../types/entities'

export function UsersPage() {
  const { data, isLoading, error, refetch } = useApiData<UserRecord[]>('/users', [])
  const mutation = useApiMutation()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | RoleName>('All')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [createForm, setCreateForm] = usePersistentState<{
    fullName: string
    username: string
    email: string
    password: string
    roleName: RoleName
  }>('users-create-form', {
    fullName: '',
    username: '',
    email: '',
    password: '',
    roleName: Roles.Admin,
  })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{
    fullName: string
    email: string
    roleName: RoleName
    isActive: boolean
  }>({
    fullName: '',
    email: '',
    roleName: Roles.Admin,
    isActive: true,
  })

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return data.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)

      const matchesRole = roleFilter === 'All' || user.roleName === roleFilter
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && user.isActive) ||
        (statusFilter === 'Inactive' && !user.isActive)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [data, roleFilter, search, statusFilter])
  const userSummary = useMemo(() => {
    const activeCount = filteredUsers.filter((user) => user.isActive).length
    const ownerCount = filteredUsers.filter((user) => user.roleName === Roles.SuperAdmin).length
    const cashierCount = filteredUsers.filter((user) => user.roleName === Roles.Admin).length
    return { activeCount, ownerCount, cashierCount }
  }, [filteredUsers])

  return (
    <PageFrame
      title="User Management"
      description="Owner-only user administration surface with create, update, and role/status filtering."
      aside={<div className="badge">Owner only</div>}
    >
      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}
      {mutation.success ? <div className="subtle-panel">{mutation.success}</div> : null}

      <div className="stats-grid compact-stats">
        <div className="stat-card">
          <span>Visible Users</span>
          <strong>{filteredUsers.length}</strong>
        </div>
        <div className="stat-card">
          <span>Active</span>
          <strong>{userSummary.activeCount}</strong>
        </div>
        <div className="stat-card">
          <span>Cashiers</span>
          <strong>{userSummary.cashierCount}</strong>
        </div>
        <div className="stat-card">
          <span>Owners</span>
          <strong>{userSummary.ownerCount}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="inventory-toolbar inventory-toolbar-primary">
          <label className="field search-field">
            <span>Search Users</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, username, email, or role"
            />
          </label>
          <div className="inventory-toolbar-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setSearch('')
                setRoleFilter('All')
                setStatusFilter('All')
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="inventory-toolbar">
          <label className="field">
            <span>Role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'All' | RoleName)}
            >
              <option value="All">All roles</option>
              <option value={Roles.Admin}>Cashier</option>
              <option value={Roles.SuperAdmin}>Owner</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'All' | 'Active' | 'Inactive')
              }
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <div className="subtle-panel panel-note">{filteredUsers.length} visible users</div>
          <div className="summary-block compact-summary">
            <strong>Access Reminder</strong>
            <span>Only active users can sign in and access role-protected pages.</span>
          </div>
        </div>
      </div>

      <div className="two-column">
        <section className="panel stack-form">
          <h4>Create User</h4>
          <label className="field">
            <span>Full Name</span>
            <input
              value={createForm.fullName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, fullName: event.target.value }))
              }
            />
          </label>
          <div className="mini-grid">
            <label className="field">
              <span>Username</span>
              <input
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="mini-grid">
            <label className="field">
              <span>Email</span>
              <input
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select
                value={createForm.roleName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    roleName: event.target.value as RoleName,
                  }))
                }
              >
                <option value={Roles.Admin}>Cashier</option>
                <option value={Roles.SuperAdmin}>Owner</option>
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={mutation.isSubmitting}
            onClick={async () => {
              const created = await mutation.run(
                () => api.post('/users', createForm),
                'User created.',
              )
              if (created) {
                setCreateForm({
                  fullName: '',
                  username: '',
                  email: '',
                  password: '',
                  roleName: Roles.Admin,
                })
                await refetch()
              }
            }}
          >
            Create User
          </button>
        </section>

        {editId ? (
          <section className="panel stack-form">
            <div className="split-line">
              <h4>Update User</h4>
              <button className="ghost-button" type="button" onClick={() => setEditId(null)}>
                Close
              </button>
            </div>
            <label className="field">
              <span>Full Name</span>
              <input
                value={editForm.fullName}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </label>
            <div className="mini-grid">
              <label className="field">
                <span>Email</span>
                <input
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Role</span>
                <select
                  value={editForm.roleName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      roleName: event.target.value as RoleName,
                    }))
                  }
                >
                  <option value={Roles.Admin}>Cashier</option>
                  <option value={Roles.SuperAdmin}>Owner</option>
                </select>
              </label>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              <span>Active user</span>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={mutation.isSubmitting}
              onClick={async () => {
                const saved = await mutation.run(
                  () => api.put(`/users/${editId}`, editForm),
                  'User updated.',
                )
                if (saved) {
                  setEditId(null)
                  await refetch()
                }
              }}
            >
              Save Changes
            </button>
          </section>
        ) : (
          <section className="panel subtle-panel">
            Select a user from the table below to edit role or status.
          </section>
        )}
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No users found."
        hasData={filteredUsers.length > 0}
      />

      {filteredUsers.length > 0 ? (
        <div className="panel table-panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="table-title-cell">
                      <strong>{user.fullName}</strong>
                      <span>{user.username}</span>
                    </div>
                  </td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={user.roleName === Roles.SuperAdmin ? 'status-badge low' : 'status-badge in'}>
                      {getRoleLabel(user.roleName)}
                    </span>
                  </td>
                  <td>
                    <span className={user.isActive ? 'status-badge in' : 'status-badge out'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setEditId(user.id)
                        setEditForm({
                          fullName: user.fullName,
                          email: user.email,
                          roleName:
                            user.roleName === Roles.SuperAdmin ? Roles.SuperAdmin : Roles.Admin,
                          isActive: user.isActive,
                        })
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  )
}
