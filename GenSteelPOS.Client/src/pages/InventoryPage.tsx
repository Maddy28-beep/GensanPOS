import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { StatCard } from '../components/StatCard'
import { useApiMutation } from '../hooks/useApiMutation'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import { useAuth } from '../state/AuthContext'
import { useConfirm } from '../state/ConfirmContext'
import { useToast } from '../state/ToastContext'
import { Roles } from '../types/auth'
import type { InventoryAdjustmentRequest, InventoryItem, InventoryListResponse } from '../types/entities'

const pageSizeOptions = [10, 25, 50]
const sortOptions = [
  { label: 'Product Name', value: 'productName' },
  { label: 'Product Code', value: 'code' },
  { label: 'Quantity', value: 'quantity' },
  { label: 'Category', value: 'category' },
]

type StockAdjustmentMode = 'increase' | 'decrease' | 'set' | 'reset'

const emptyInventoryResponse: InventoryListResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  summary: {
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  },
  availableCategories: [],
  availableLocations: [],
}

function getStatusLabel(item: InventoryItem) {
  return item.stockStatus === 'OutOfStock'
    ? 'Out of Stock'
    : item.stockStatus === 'LowStock'
      ? 'Low Stock'
      : 'In Stock'
}

function getStatusClass(item: InventoryItem) {
  return item.stockStatus === 'OutOfStock'
    ? 'status-badge out'
    : item.stockStatus === 'LowStock'
      ? 'status-badge low'
      : 'status-badge in'
}

function getRequestStatusClass(status: InventoryAdjustmentRequest['status']) {
  return status === 'Pending' ? 'status-badge low' : status === 'Approved' ? 'status-badge in' : 'status-badge out'
}

function getRequestTypeLabel(requestType: string) {
  return requestType === 'SetActualCount' ? 'Set Actual Count' : requestType
}

export function InventoryPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const isAdmin = user?.roleName === Roles.Admin
  const mutation = useApiMutation()
  const [searchParams] = useSearchParams()
  const [inventory, setInventory] = useState<InventoryListResponse>(emptyInventoryResponse)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 25,
    search: '',
    category: '',
    status: '',
    location: '',
    sortBy: 'productName',
    sortOrder: 'asc',
  })
  const [adjustmentForm, setAdjustmentForm] = usePersistentState('inventory-adjustment-form', {
    productId: '0',
    adjustmentMode: 'increase' as StockAdjustmentMode,
    quantity: '0',
    reason: '',
  })
  const [inventoryRequests, setInventoryRequests] = useState<InventoryAdjustmentRequest[]>([])

  const loadInventory = async (override?: Partial<typeof filters>) => {
    const next = { ...filters, ...override }
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(next.page))
      params.set('pageSize', String(next.pageSize))
      params.set('sortBy', next.sortBy)
      params.set('sortOrder', next.sortOrder)

      if (next.search.trim()) {
        params.set('search', next.search.trim())
      }

      if (next.category) {
        params.set('category', next.category)
      }

      if (next.status) {
        params.set('status', next.status)
      }

      if (next.location) {
        params.set('location', next.location)
      }

      const response = await api.get<InventoryListResponse>(`/inventory?${params.toString()}`)
      setInventory(response.data)
    } catch {
      setError('Unable to load data from the API.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadInventoryRequests = async () => {
    try {
      const response = await api.get<InventoryAdjustmentRequest[]>('/inventory-adjustment-requests')
      setInventoryRequests(response.data)
    } catch {
      setInventoryRequests([])
    }
  }

  const reviewInventoryRequest = async (
    request: InventoryAdjustmentRequest,
    action: 'approve' | 'reject',
  ) => {
    const accepted = await confirm({
      title: action === 'approve' ? 'Approve stock request?' : 'Reject stock request?',
      message:
        action === 'approve'
          ? `${request.productName} stock will change from ${request.previousQuantity} to ${request.requestedQuantity}.`
          : `${request.productName} stock will stay at ${request.previousQuantity}.`,
      confirmLabel: action === 'approve' ? 'Approve' : 'Reject',
      tone: action === 'reject' ? 'danger' : 'default',
    })

    if (!accepted) {
      return
    }

    const saved = await mutation.run(() =>
      api.post(`/inventory-adjustment-requests/${request.id}/${action}`, {
        notes: action === 'approve' ? 'Approved by owner.' : 'Rejected by owner.',
      }),
    )

    if (saved) {
      await loadInventory()
      await loadInventoryRequests()
      showToast({
        tone: action === 'approve' ? 'success' : 'info',
        title: action === 'approve' ? 'Stock request approved' : 'Stock request rejected',
        message:
          action === 'approve'
            ? `${request.productName} inventory was updated.`
            : `${request.productName} inventory was not changed.`,
      })
    }
  }

  useEffect(() => {
    void loadInventory()
    void loadInventoryRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.pageSize, filters.search, filters.category, filters.status, filters.location, filters.sortBy, filters.sortOrder])

  useEffect(() => {
    const productId = searchParams.get('productId')
    if (!productId) {
      return
    }

    setAdjustmentForm((current) =>
      current.productId === productId ? current : { ...current, productId },
    )
  }, [searchParams])

  const selectedItem = useMemo(
    () => inventory.items.find((item) => item.productId === Number(adjustmentForm.productId)) ?? null,
    [adjustmentForm.productId, inventory.items],
  )
  const parsedAdjustmentQuantity = Number(adjustmentForm.quantity)
  const adjustmentQuantity = Number.isFinite(parsedAdjustmentQuantity) ? parsedAdjustmentQuantity : 0
  const isValidAdjustmentQuantity =
    adjustmentForm.adjustmentMode === 'reset'
      ? true
      : adjustmentForm.adjustmentMode === 'set'
      ? adjustmentQuantity >= 0
      : adjustmentQuantity > 0
  const previewQuantityChange = selectedItem
    ? adjustmentForm.adjustmentMode === 'reset'
      ? -selectedItem.quantityOnHand
      : adjustmentForm.adjustmentMode === 'set'
      ? adjustmentQuantity - selectedItem.quantityOnHand
      : adjustmentForm.adjustmentMode === 'decrease'
        ? -Math.abs(adjustmentQuantity)
        : Math.abs(adjustmentQuantity)
    : 0

  return (
    <PageFrame
      title="Inventory"
      description="Compare system stock against physical count, then request or apply audited inventory corrections."
      aside={
        <div className="action-row">
          {isSuperAdmin ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => navigate('/products')}
            >
              Add Product
            </button>
          ) : null}
        </div>
      }
    >
      <div className="stats-grid">
        <StatCard label="Total Products" value={String(inventory.summary.totalProducts)} />
        <StatCard label="In Stock" value={String(inventory.summary.inStockCount)} />
        <StatCard
          label="Low Stock"
          value={String(inventory.summary.lowStockCount)}
          tone={inventory.summary.lowStockCount > 0 ? 'alert' : 'default'}
        />
        <StatCard
          label="Out of Stock"
          value={String(inventory.summary.outOfStockCount)}
          tone={inventory.summary.outOfStockCount > 0 ? 'alert' : 'default'}
        />
      </div>

      {isSuperAdmin || isAdmin ? (
        <div className="panel stack-form">
          <div className="split-line">
            <h4>{isSuperAdmin ? 'Inventory Adjustment' : 'Request Inventory Adjustment'}</h4>
            <span className="badge">{isSuperAdmin ? 'Owner Direct Update' : 'Owner Approval Required'}</span>
          </div>
          <div className="subtle-panel">
            Use this only when the system stock does not match the actual physical count.
            Every adjustment requires a reason and is recorded in stock history.
          </div>
          {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}
          {mutation.success ? <div className="subtle-panel">{mutation.success}</div> : null}
          <div className="mini-grid">
            <label className="field">
              <span>Product</span>
              <select
                value={adjustmentForm.productId}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
              >
                <option value="0">Select product</option>
                {inventory.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.productName}
                  </option>
                ))}
              </select>
            </label>
            <div className="stock-adjustment-control">
              <span className="field-label">Adjustment Type</span>
              <div className="action-row">
                <button
                  className={
                    adjustmentForm.adjustmentMode === 'increase' ? 'primary-button' : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'increase',
                    }))
                  }
                >
                  Add Stock
                </button>
                <button
                  className={
                    adjustmentForm.adjustmentMode === 'decrease' ? 'danger-button' : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'decrease',
                    }))
                  }
                >
                  Remove Stock
                </button>
                <button
                  className={
                    adjustmentForm.adjustmentMode === 'set' ? 'primary-button' : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'set',
                      quantity: selectedItem ? String(selectedItem.quantityOnHand) : current.quantity,
                    }))
                  }
                >
                  Set Actual Count
                </button>
                <button
                  className={
                    adjustmentForm.adjustmentMode === 'reset' ? 'danger-button' : 'ghost-button'
                  }
                  type="button"
                  onClick={() =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      adjustmentMode: 'reset',
                      quantity: '0',
                    }))
                  }
                >
                  Reset to Zero
                </button>
              </div>
            </div>
            <label className="field">
              <span>
                {adjustmentForm.adjustmentMode === 'set'
                  ? 'Actual Physical Count'
                  : adjustmentForm.adjustmentMode === 'reset'
                    ? 'Actual Physical Count'
                    : 'Quantity Change'}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustmentForm.quantity}
                disabled={adjustmentForm.adjustmentMode === 'reset'}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>{isAdmin ? 'Reason for Owner' : 'Reason for Audit History'}</span>
            <input
              value={adjustmentForm.reason}
              onChange={(event) =>
                setAdjustmentForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Example: physical count correction, missing stock, damaged stock, or full reset"
            />
          </label>
          {selectedItem ? (
            <div className="summary-block">
              <strong>{selectedItem.productName}</strong>
              <span>Current Inventory: {selectedItem.quantityOnHand}</span>
              <span>
                Actual Inventory:{' '}
                {adjustmentForm.adjustmentMode === 'reset'
                  ? 0
                  : adjustmentForm.adjustmentMode === 'set'
                  ? Math.max(0, adjustmentQuantity || 0)
                  : selectedItem.quantityOnHand + previewQuantityChange}
              </span>
              <span>Quantity change: {previewQuantityChange}</span>
            </div>
          ) : null}
          <button
            className="primary-button"
            type="button"
            disabled={
              mutation.isSubmitting ||
              Number(adjustmentForm.productId) <= 0 ||
              !isValidAdjustmentQuantity ||
              previewQuantityChange === 0 ||
              !adjustmentForm.reason.trim() ||
              Boolean(selectedItem && selectedItem.quantityOnHand + previewQuantityChange < 0)
            }
            onClick={async () => {
              const quantityChange = previewQuantityChange
              const productName = selectedItem?.productName ?? 'Selected product'
              if (isAdmin) {
                const saved = await mutation.run(
                  () =>
                    api.post('/inventory-adjustment-requests', {
                      productId: Number(adjustmentForm.productId),
                      requestType:
                        adjustmentForm.adjustmentMode === 'set' || adjustmentForm.adjustmentMode === 'reset'
                          ? 'SetActualCount'
                          : adjustmentForm.adjustmentMode === 'decrease'
                            ? 'Decrease'
                            : 'Increase',
                      quantityChange,
                      reason: adjustmentForm.reason,
                    }),
                  'Inventory request sent to owner.',
                )
                if (saved) {
                  setAdjustmentForm({
                    productId: '0',
                    adjustmentMode: 'increase',
                    quantity: '0',
                    reason: '',
                  })
                  await loadInventoryRequests()
                  showToast({
                    tone: 'success',
                    title: 'Request sent',
                    message: `${productName} adjustment is pending owner approval.`,
                  })
                }
                return
              }

              const saved = await mutation.run(
                () =>
                  api.post('/inventory/adjust', {
                    productId: Number(adjustmentForm.productId),
                    quantityChange,
                    remarks: adjustmentForm.reason,
                  }),
                'Stock quantity updated.',
              )
              if (saved) {
                setAdjustmentForm({
                  productId: '0',
                  adjustmentMode: 'increase',
                  quantity: '0',
                  reason: '',
                })
                await loadInventory()
                showToast({
                  tone: 'success',
                  title: 'Stock updated',
                  message: `${productName} stock was adjusted successfully.`,
                })
              }
            }}
          >
            {isAdmin ? 'Send Request' : 'Apply Adjustment'}
          </button>
        </div>
      ) : null}

      {inventoryRequests.length > 0 ? (
        <div className="panel stack-form">
          <div className="split-line">
            <h4>{isSuperAdmin ? 'Inventory Approval Requests' : 'My Inventory Requests'}</h4>
            <span className="badge">
              {inventoryRequests.filter((request) => request.status === 'Pending').length} pending
            </span>
          </div>
          {isAdmin ? (
            <div className="subtle-panel">
              Pending requests are waiting for owner approval. Stock will not change until the owner approves them.
            </div>
          ) : null}
          <div className="inventory-request-list">
            {inventoryRequests.slice(0, 5).map((request) => (
              <article className="inventory-request-card" key={request.id}>
                <div className="inventory-request-head">
                  <div>
                    <h4>{request.productName}</h4>
                    <span>
                      {getRequestTypeLabel(request.requestType)} request / change {request.quantityChange}
                    </span>
                  </div>
                  <span className={getRequestStatusClass(request.status)}>{request.status}</span>
                </div>
                <div className="inventory-request-metrics">
                  <div>
                    <span>Current</span>
                    <strong>{request.previousQuantity}</strong>
                  </div>
                  <div>
                    <span>Requested</span>
                    <strong>{request.requestedQuantity}</strong>
                  </div>
                  <div>
                    <span>Requested By</span>
                    <strong>{request.requestedByName}</strong>
                  </div>
                </div>
                <div className="inventory-request-note">
                  <span>Reason</span>
                  <p>{request.reason}</p>
                </div>
                {isSuperAdmin && request.status === 'Pending' ? (
                  <div className="action-row">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={mutation.isSubmitting}
                      onClick={() => void reviewInventoryRequest(request, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={mutation.isSubmitting}
                      onClick={() => void reviewInventoryRequest(request, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <button className="ghost-button" type="button" onClick={() => navigate('/sale-action-requests')}>
            Open Action Requests
          </button>
        </div>
      ) : null}

      <div className="panel stack-form">
        <div className="split-line">
            <h4>Current Stock</h4>
            <span className="badge">{inventory.totalCount} matching records</span>
        </div>

        <div className="inventory-toolbar inventory-toolbar-primary">
          <label className="field search-field">
            <span>Search Inventory</span>
            <input
              placeholder="Search product name or code"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))
              }
            />
          </label>
          <div className="inventory-toolbar-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                setFilters({
                  page: 1,
                  pageSize: 25,
                  search: '',
                  category: '',
                  status: '',
                  location: '',
                  sortBy: 'productName',
                  sortOrder: 'asc',
                })
              }
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="inventory-toolbar">

          <label className="field">
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value, page: 1 }))
              }
            >
              <option value="">All categories</option>
              {inventory.availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))
              }
            >
              <option value="">All statuses</option>
              <option value="InStock">In Stock</option>
              <option value="LowStock">Low Stock</option>
              <option value="OutOfStock">Out of Stock</option>
            </select>
          </label>

          <label className="field">
            <span>Sort By</span>
            <select
              value={filters.sortBy}
              onChange={(event) =>
                setFilters((current) => ({ ...current, sortBy: event.target.value, page: 1 }))
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Order</span>
            <select
              value={filters.sortOrder}
              onChange={(event) =>
                setFilters((current) => ({ ...current, sortOrder: event.target.value, page: 1 }))
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>

          <label className="field">
            <span>Rows</span>
            <select
              value={filters.pageSize}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  pageSize: Number(event.target.value),
                  page: 1,
                }))
              }
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataState
          isLoading={isLoading}
          error={error}
          emptyMessage="No inventory records found."
          hasData={inventory.items.length > 0}
        />

        {inventory.items.length > 0 ? (
          <>
            <div className="table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <div className="table-title-cell">
                          <strong>{item.productName}</strong>
                          <span>Product Code: {item.sku}</span>
                        </div>
                      </td>
                      <td>{item.categoryName}</td>
                      <td>
                        <div className="table-title-cell">
                          <strong>{item.quantityOnHand}</strong>
                          <span>{item.isActiveProduct ? 'Active product' : 'Inactive product'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={getStatusClass(item)}>{getStatusLabel(item)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span className="muted">
                Showing {(inventory.page - 1) * inventory.pageSize + 1} to{' '}
                {Math.min(inventory.page * inventory.pageSize, inventory.totalCount)} of{' '}
                {inventory.totalCount}
              </span>
              <div className="action-row">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={inventory.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page - 1 }))
                  }
                >
                  Previous
                </button>
                <span className="badge">
                  Page {inventory.page} of {inventory.totalPages}
                </span>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={inventory.page >= inventory.totalPages}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page + 1 }))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PageFrame>
  )
}
