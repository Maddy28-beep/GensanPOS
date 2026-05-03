import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { StatCard } from '../components/StatCard'
import { useApiData } from '../hooks/useApiData'
import { formatCurrency } from '../lib/receipt'
import { useAuth } from '../state/AuthContext'
import { Roles } from '../types/auth'
import type {
  DashboardData,
  InventoryAdjustmentRequest,
  InventoryListResponse,
  InventoryValueReportRow,
  Sale,
  SaleActionRequest,
} from '../types/entities'

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const LOW_STOCK_THRESHOLD = 15

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const today = new Date()
  const defaultFrom = new Date(today)
  defaultFrom.setDate(today.getDate() - 6)

  const [dateRange, setDateRange] = useState({
    from: formatDateInput(defaultFrom),
    to: formatDateInput(today),
  })

  const dashboard = useApiData<DashboardData>('/reports/dashboard', {
    totalSalesToday: 0,
    totalReturnsToday: 0,
    netSalesToday: 0,
    totalTransactionsToday: 0,
    lowStockCount: 0,
    activeProductsCount: 0,
    totalInventoryValue: 0,
    totalSalesThisMonth: 0,
    totalReturnsThisMonth: 0,
    netSalesThisMonth: 0,
  })
  const inventory = useApiData<InventoryListResponse>(
    '/inventory?page=1&pageSize=50&sortBy=quantity&sortOrder=asc',
    {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      summary: {
        totalProducts: 0,
        inStockCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
      availableCategories: [],
      availableLocations: [],
    },
  )
  const sales = useApiData<Sale[]>('/sales', [])
  const actionRequests = useApiData<SaleActionRequest[]>('/sale-action-requests', [])
  const inventoryRequests = useApiData<InventoryAdjustmentRequest[]>('/inventory-adjustment-requests', [])
  const inventoryValue = useApiData<InventoryValueReportRow[]>(
    isSuperAdmin ? '/reports/inventory/value' : '',
    [],
  )

  const pendingActionRequests = useMemo(
    () =>
      actionRequests.data.filter((request) => request.status === 'Pending').length +
      inventoryRequests.data.filter((request) => request.status === 'Pending').length,
    [actionRequests.data, inventoryRequests.data],
  )
  const todayGrossSales = dashboard.data.totalSalesToday
  const todayNetSales = dashboard.data.netSalesToday
  const lowStockAlertCount =
    inventory.data.summary.lowStockCount + inventory.data.summary.outOfStockCount
  const liveInventoryValue = inventoryValue.data.reduce(
    (sum, item) => sum + item.inventoryValue,
    0,
  )

  const lowStockItems = useMemo(
    () =>
      inventory.data.items
        .filter((item) => item.quantityOnHand <= LOW_STOCK_THRESHOLD)
        .sort((left, right) => left.quantityOnHand - right.quantityOnHand)
        .slice(0, 6),
    [inventory.data.items],
  )

  const chartData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      return []
    }

    const start = new Date(`${dateRange.from}T00:00:00`)
    const end = new Date(`${dateRange.to}T23:59:59.999`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return []
    }

    const labels: string[] = []
    const totals = new Map<string, number>()

    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const key = formatDateInput(current)
      labels.push(key)
      totals.set(key, 0)
    }

    for (const sale of sales.data) {
      if (sale.status !== 'Completed') {
        continue
      }

      const created = new Date(sale.createdAtUtc)
      if (created < start || created > end) {
        continue
      }

      const key = formatDateInput(created)
      totals.set(key, (totals.get(key) ?? 0) + sale.totalAmount)
    }

    return labels.map((label) => ({
      label,
      total: totals.get(label) ?? 0,
    }))
  }, [dateRange.from, dateRange.to, sales.data])

  const chartMax = Math.max(...chartData.map((item) => item.total), 1)
  const completedSalesInRange = sales.data.filter((sale) => {
    if (sale.status !== 'Completed' || !dateRange.from || !dateRange.to) {
      return false
    }

    const created = new Date(sale.createdAtUtc)
    return (
      created >= new Date(`${dateRange.from}T00:00:00`) &&
      created <= new Date(`${dateRange.to}T23:59:59.999`)
    )
  })
  const grossSalesInRange = completedSalesInRange.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const discountInRange = completedSalesInRange.reduce(
    (sum, sale) => sum + sale.discountAmount,
    0,
  )
  const taxInRange = completedSalesInRange.reduce((sum, sale) => sum + sale.taxAmount, 0)
  const returnsInRange = completedSalesInRange.reduce(
    (sum, sale) => sum + sale.totalReturnedAmount,
    0,
  )
  const netSalesInRange = grossSalesInRange - returnsInRange
  const dashboardDescription = isSuperAdmin
    ? 'Owner dashboard with historical sales insights, inventory value, and low-stock actions.'
    : 'Staff dashboard with today-only operational metrics and low-stock visibility.'
  const dashboardHasBlockingError = Boolean(dashboard.error && sales.error && inventory.error)

  return (
    <PageFrame
      title="Dashboard"
      description={dashboardDescription}
    >
      <div className="stats-grid dashboard-kpi-grid">
        {isSuperAdmin ? (
          <>
            <StatCard
              label="Sales Today"
              value={formatCurrency(todayGrossSales)}
            />
            <StatCard
              label="Sales This Month"
              value={formatCurrency(dashboard.data.totalSalesThisMonth)}
            />
            <StatCard
              label="Inventory Value"
              value={formatCurrency(liveInventoryValue || dashboard.data.totalInventoryValue)}
            />
            <StatCard
              label="Low Stock"
              value={String(lowStockAlertCount || dashboard.data.lowStockCount)}
              tone={lowStockAlertCount > 0 || dashboard.data.lowStockCount > 0 ? 'alert' : 'default'}
            />
            <StatCard
              label="Pending Approvals"
              value={String(pendingActionRequests)}
              tone={pendingActionRequests > 0 ? 'alert' : 'default'}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Sales Today"
              value={formatCurrency(todayGrossSales)}
            />
            <StatCard label="Transactions" value={String(dashboard.data.totalTransactionsToday)} />
            <StatCard
              label="Low Stock"
              value={String(lowStockAlertCount)}
              tone={lowStockAlertCount > 0 ? 'alert' : 'default'}
            />
            <StatCard
              label="Net Sales Today"
              value={formatCurrency(todayNetSales)}
            />
          </>
        )}
      </div>

      <DataState
        isLoading={
          dashboard.isLoading || inventory.isLoading || sales.isLoading || actionRequests.isLoading
        }
        error={dashboardHasBlockingError ? 'Unable to load dashboard records.' : null}
        emptyMessage="Dashboard metrics will appear once the API returns live report data."
        hasData
      />

      <div className="two-column dashboard-main-grid">
        {isSuperAdmin ? (
          <section className="panel stack-form">
            <div className="split-line">
              <h4>Sales Trend</h4>
              <span className="badge">{completedSalesInRange.length} completed sales</span>
            </div>

            <div className="trend-toolbar">
              {pendingActionRequests > 0 ? (
                <>
                  <div className="trend-request-pill alert">
                    <strong>{pendingActionRequests}</strong>
                    <span>pending owner actions</span>
                  </div>
                  <button
                    className="ghost-button inline-button"
                    type="button"
                    onClick={() => navigate('/sale-action-requests')}
                  >
                    Review Queue
                  </button>
                </>
              ) : (
                <>
                  <div className="trend-request-pill">
                    <strong>0</strong>
                    <span>pending owner actions</span>
                  </div>
                  <span className="muted">Queue clear</span>
                </>
              )}
            </div>

            <div className="trend-filter-bar">
              <label className="field">
                <span>From</span>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(event) =>
                    setDateRange((current) => ({ ...current, from: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(event) =>
                    setDateRange((current) => ({ ...current, to: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="trend-ledger">
              <div>
                <span>Gross</span>
                <strong>{formatCurrency(grossSalesInRange)}</strong>
              </div>
              <div>
                <span>Returns</span>
                <strong>{formatCurrency(returnsInRange)}</strong>
              </div>
              <div>
                <span>Net</span>
                <strong>{formatCurrency(netSalesInRange)}</strong>
              </div>
              <div>
                <span>Discount</span>
                <strong>{formatCurrency(discountInRange)}</strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>{formatCurrency(taxInRange)}</strong>
              </div>
              <div>
                <span>Days</span>
                <strong>{chartData.length}</strong>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="subtle-panel">
                Choose a valid date range to render daily sales totals.
              </div>
            ) : (
              <div className="sales-trend-list">
                {chartData.map((item) => (
                  <div key={item.label} className="sales-trend-row">
                    <div className="sales-trend-meta">
                      <span>{new Date(`${item.label}T00:00:00`).toLocaleDateString()}</span>
                      <strong>{formatCurrency(item.total)}</strong>
                    </div>
                    <div className="chart-track">
                      <div
                        className={`chart-fill ${item.total === 0 ? 'cool' : 'warm'}`}
                        style={{ width: `${(item.total / chartMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="panel stack-form">
            <div className="split-line">
              <h4>Today Focus</h4>
              <span className="badge">Staff View</span>
            </div>
            <div className="subtle-panel">
              Staff should focus on current-day operations only: processing sales, checking stock
              availability, and watching urgent low-stock items.
            </div>
            <div className="focus-list">
              <div className="focus-item">
                <strong>Process sales quickly</strong>
                <span>Use POS for walk-in transactions and keep the queue moving.</span>
              </div>
              <div className="focus-item">
                <strong>Watch stock availability</strong>
                <span>Check the low-stock watchlist before promising quantities to customers.</span>
              </div>
              <div className="focus-item">
                <strong>Escalate owner actions</strong>
                <span>Submit cancel, refund, or void requests instead of changing transactions directly.</span>
              </div>
              <div className="focus-item">
                <strong>Review your own sales</strong>
                <span>Use the Sales page for today's receipts and your current-day transactions only.</span>
              </div>
            </div>
          </section>
        )}

        <section className="panel stack-form">
          <div className="split-line">
            <h4>Low Stock Watchlist</h4>
            <span className="badge">{lowStockItems.length} urgent items</span>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="subtle-panel">No products are currently out of stock or at 15 pcs and below.</div>
          ) : (
            <div className="list-stack">
              {lowStockItems.map((item) => {
                const ratio =
                  item.quantityOnHand / LOW_STOCK_THRESHOLD

                return (
                  <div className="low-stock-card compact-low-stock-card" key={item.productId}>
                    <div className="split-line">
                      <div className="low-stock-heading">
                        <strong>{item.productName}</strong>
                        <span>
                          {item.sku} / {item.location || 'Main rack'}
                        </span>
                      </div>
                      <span className="badge alert-badge">
                        {item.quantityOnHand <= 0
                          ? 'Out of stock'
                          : `${item.quantityOnHand} / ${LOW_STOCK_THRESHOLD}`}
                      </span>
                    </div>
                    <div className="chart-track compact-chart-track">
                      <div
                        className={`chart-fill ${ratio <= 0.5 ? 'alert' : 'warning'}`}
                        style={{ width: `${Math.max(8, Math.min(100, ratio * 100))}%` }}
                      />
                    </div>
                    {isSuperAdmin ? (
                      <div className="action-row compact-action-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => navigate(`/inventory?productId=${item.productId}`)}
                        >
                          Adjust Stock
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => navigate(`/stock-in?productId=${item.productId}`)}
                        >
                          Stock In
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  )
}
