import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { navigationItems } from '../config/navigation'
import { api } from '../lib/api'
import { getRoleLabel } from '../lib/roles'
import { clearPersistentDrafts } from '../hooks/usePersistentState'
import { useAuth } from '../state/AuthContext'
import { useConfirm } from '../state/ConfirmContext'
import type { InventoryAdjustmentRequest, SaleActionRequest, StockInRecord } from '../types/entities'

const navigationGroups = ['Run', 'Stock', 'Orders', 'Reports', 'Management'] as const
const ownerMainPaths = new Set([
  '/dashboard',
  '/pos',
  '/products',
  '/inventory',
  '/sales',
  '/returns',
  '/sale-action-requests',
  '/reports',
])

export function AppShell() {
  const { user, logout } = useAuth()
  const { confirm } = useConfirm()
  const [pendingActionCount, setPendingActionCount] = useState(0)

  const visibleItems = navigationItems.filter((item) =>
    user ? item.roles.includes(user.roleName) : false,
  )
  const isOwner = user?.roleName === 'SuperAdmin'
  const ownerMainItems = visibleItems.filter((item) => ownerMainPaths.has(item.path))
  const ownerAdvancedItems = visibleItems.filter((item) => !ownerMainPaths.has(item.path))

  useEffect(() => {
    if (!user) {
      setPendingActionCount(0)
      return
    }

    let isMounted = true
    const loadPendingActions = async () => {
      try {
        const [saleActions, inventoryActions, stockReceivingActions] = await Promise.all([
          api.get<SaleActionRequest[]>('/sale-action-requests'),
          api.get<InventoryAdjustmentRequest[]>('/inventory-adjustment-requests'),
          api.get<StockInRecord[]>('/stock-in'),
        ])
        if (!isMounted) {
          return
        }

        setPendingActionCount(
          saleActions.data.filter((request) => request.status === 'Pending').length +
            inventoryActions.data.filter((request) => request.status === 'Pending').length +
            stockReceivingActions.data.filter((request) => request.status === 'Pending').length,
        )
      } catch {
        if (isMounted) {
          setPendingActionCount(0)
        }
      }
    }

    void loadPendingActions()
    const interval = window.setInterval(loadPendingActions, 30000)
    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [user])

  const renderNavItem = (item: (typeof visibleItems)[number]) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => (isActive ? 'nav-card active' : 'nav-card')}
    >
      <div className="nav-card-top">
        <strong>{item.label}</strong>
        {item.path === '/sale-action-requests' && pendingActionCount > 0 ? (
          <span className="nav-count nav-count-warning">{pendingActionCount}</span>
        ) : null}
      </div>
    </NavLink>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <h1>Gen Steel</h1>
        </div>

        <nav className="nav-grid">
          {isOwner ? (
            <>
              <div className="nav-section">
                <span className="nav-section-title">Owner View</span>
                <div className="nav-section-links">{ownerMainItems.map(renderNavItem)}</div>
              </div>
              <details className="nav-section nav-more">
                <summary className="nav-section-title nav-summary">Advanced Tools</summary>
                <div className="nav-section-links">{ownerAdvancedItems.map(renderNavItem)}</div>
              </details>
            </>
          ) : (
            navigationGroups.map((group) => {
              const groupItems = visibleItems.filter((item) => item.group === group)

              if (groupItems.length === 0) {
                return null
              }

              return (
                <div className="nav-section" key={group}>
                  <span className="nav-section-title">{group}</span>
                  <div className="nav-section-links">{groupItems.map(renderNavItem)}</div>
                </div>
              )
            })
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="access-pill">{getRoleLabel(user?.roleName)}</div>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-heading">
            <h2>{user?.fullName}</h2>
            <div className="workspace-meta">
              <span className="access-pill">{getRoleLabel(user?.roleName)}</span>
              <span className="muted">{user?.email}</span>
            </div>
          </div>

          <button
            className="ghost-button"
            type="button"
            onClick={async () => {
              const accepted = await confirm({
                title: 'Log out?',
                message: 'Do you want to log out of your account?',
                confirmLabel: 'Log Out',
                cancelLabel: 'Stay',
                tone: 'danger',
              })

              if (accepted) {
                clearPersistentDrafts()
                logout()
              }
            }}
          >
            Log out
          </button>
        </header>

        <div className="workspace-body">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
