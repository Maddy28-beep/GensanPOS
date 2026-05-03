import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/datetime'
import { formatCurrency } from '../lib/receipt'
import { useAuth } from '../state/AuthContext'
import { useConfirm } from '../state/ConfirmContext'
import { useToast } from '../state/ToastContext'
import { Roles } from '../types/auth'
import type { Product, StockInRecord, Supplier } from '../types/entities'

interface DraftStockItem {
  productId: number
  productName: string
  quantity: number
  unitCost: number
}

function getReceivingStatusClass(status: string) {
  if (status === 'Approved') {
    return 'status-badge in'
  }

  if (status === 'Rejected') {
    return 'status-badge out'
  }

  return 'status-badge low'
}

export function StockInPage() {
  const { user } = useAuth()
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const { data, isLoading, error, refetch } = useApiData<StockInRecord[]>('/stock-in', [])
  const { data: suppliers } = useApiData<Supplier[]>('/suppliers', [])
  const { data: products } = useApiData<Product[]>('/products', [])
  const mutation = useApiMutation()
  const [searchParams] = useSearchParams()
  const [form, setForm] = usePersistentState('stock-in-form', {
    supplierId: '0',
    referenceNumber: '',
    containerNumber: '',
    stockNumber: '',
    productReferenceNumber: '',
    receivedDateUtc: new Date().toISOString().slice(0, 10),
    remarks: '',
    productId: '0',
    quantity: '1',
    unitCost: '0',
  })
  const [draftItems, setDraftItems] = usePersistentState<DraftStockItem[]>('stock-in-draft-items', [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ quantity: '1', unitCost: '0' })

  useEffect(() => {
    const productId = searchParams.get('productId')
    if (!productId) {
      return
    }

    setForm((current) => (current.productId === productId ? current : { ...current, productId }))
  }, [searchParams])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === Number(form.productId)) ?? null,
    [form.productId, products],
  )
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === Number(form.supplierId)) ?? null,
    [form.supplierId, suppliers],
  )
  const canCreateReceiving = suppliers.length > 0 && products.length > 0
  const hasSupplier = Number(form.supplierId) > 0
  const hasDraftItems = draftItems.length > 0
  const canAddDeliveredItem = canCreateReceiving && hasSupplier
  const submitBlockedReason = !hasSupplier
    ? 'Choose a supplier first.'
    : !hasDraftItems
      ? 'Add at least one delivered item.'
      : ''

  const totalEstimatedCost = draftItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0,
  )
  const stockInSummary = useMemo(() => {
    const receivedCount = data.length
    const pendingCount = data.filter((record) => record.status === 'Pending').length
    const approvedCount = data.filter((record) => record.status === 'Approved').length
    const totalLines = data.reduce((sum, record) => sum + (record.items?.length ?? 0), 0)
    const totalValue = data.reduce(
      (sum, record) =>
        record.status === 'Approved'
          ? sum +
            (record.items?.reduce((lineSum, item) => lineSum + item.quantity * item.unitCost, 0) ??
              0)
          : sum,
      0,
    )
    return { receivedCount, pendingCount, approvedCount, totalLines, totalValue }
  }, [data])

  return (
    <PageFrame
      title="Stock Receiving"
      description={
        isSuperAdmin
          ? 'Receive delivered stocks into existing product records. Owner receiving updates inventory immediately after confirmation.'
          : 'Encode delivered stocks for owner review. Inventory changes only after owner approval.'
      }
    >
      <div className="stats-grid compact-stats">
        <div className="stat-card">
          <span>Receiving Records</span>
          <strong>{stockInSummary.receivedCount}</strong>
        </div>
        <div className="stat-card">
          <span>Pending Approval</span>
          <strong>{stockInSummary.pendingCount}</strong>
        </div>
        <div className="stat-card">
          <span>Approved Value</span>
          <strong>{formatCurrency(stockInSummary.totalValue)}</strong>
        </div>
        <div className="stat-card">
          <span>Approved Receipts</span>
          <strong>{stockInSummary.approvedCount}</strong>
        </div>
      </div>

      <div className="subtle-panel">
        Receiving is for adding stock to products that already exist. If the delivered item is new,
        create its category and product first, then come back here to receive the quantity.
      </div>

      <div className="receiving-flow print-hide">
        <div className="receiving-flow-step">
          <span>1</span>
          <strong>Prepare Product</strong>
          <p>Product must already have barcode/code, category, unit, cost, and selling price.</p>
        </div>
        <div className="receiving-flow-step">
          <span>2</span>
          <strong>Encode Delivery</strong>
          <p>Select supplier, document numbers, product, quantity, and unit cost.</p>
        </div>
        <div className="receiving-flow-step">
          <span>3</span>
          <strong>{isSuperAdmin ? 'Receive Stock' : 'Owner Approval'}</strong>
          <p>
            {isSuperAdmin
              ? 'Owner receiving adds stock immediately after confirmation.'
              : 'Cashier receiving waits for owner approval before stock changes.'}
          </p>
        </div>
      </div>

      {(suppliers.length === 0 || products.length === 0) ? (
        <div className="panel stack-form">
          <h4>Setup Needed Before Receiving</h4>
          {suppliers.length === 0 ? (
            <div className="subtle-panel">
              No suppliers found. Add the supplier first so the receiving report can show where
              the stock came from.
            </div>
          ) : null}
          {products.length === 0 ? (
            <div className="subtle-panel">
              No products found. Add the product first with barcode/product code, category, unit,
              cost price, and selling price. Receiving will then add stock quantity to that product.
            </div>
          ) : null}
          <div className="action-row">
            {suppliers.length === 0 ? (
              <Link className="ghost-button" to="/suppliers">
                Add Supplier
              </Link>
            ) : null}
            {products.length === 0 && isSuperAdmin ? (
              <Link className="primary-button" to="/products">
                Add Product
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {true ? (
        <div className="panel stack-form receiving-card">
          <div className="split-line">
            <div>
              <h4>Create Receiving Report</h4>
              <span className="muted">
                {isSuperAdmin
                  ? 'Owner mode: this can update inventory right away.'
                  : 'Cashier mode: this creates a pending request.'}
              </span>
            </div>
            <span className="badge">{isSuperAdmin ? 'Owner Direct Receive' : 'Needs Owner Approval'}</span>
          </div>
          {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

          {!canCreateReceiving ? (
            <div className="error-panel">
              Add at least one supplier and one product before creating a receiving report.
            </div>
          ) : null}

          <div className="form-section-heading">
            <span>1</span>
            <strong>Supplier and document details</strong>
          </div>
          <div className="mini-grid">
            <label className="field">
              <span>Supplier</span>
              <select
                value={form.supplierId}
                disabled={suppliers.length === 0}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supplierId: event.target.value }))
                }
              >
                <option value="0">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Receiving Report No.</span>
              <input
                value={form.referenceNumber}
                placeholder="RR number or delivery receipt number"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    referenceNumber: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="mini-grid">
            <label className="field">
              <span>Container Number</span>
              <input
                value={form.containerNumber}
                placeholder="Optional"
                onChange={(event) =>
                  setForm((current) => ({ ...current, containerNumber: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Stock Number</span>
              <input
                value={form.stockNumber}
                placeholder="Optional"
                onChange={(event) =>
                  setForm((current) => ({ ...current, stockNumber: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="mini-grid">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={form.receivedDateUtc}
                onChange={(event) =>
                  setForm((current) => ({ ...current, receivedDateUtc: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Product Reference Number</span>
              <input
                value={form.productReferenceNumber}
                placeholder="Supplier product reference"
                onChange={(event) =>
                  setForm((current) => ({ ...current, productReferenceNumber: event.target.value }))
                }
              />
            </label>
          </div>

          <label className="field">
            <span>Remarks</span>
            <input
              value={form.remarks}
              placeholder="Optional receiving notes"
              onChange={(event) =>
                setForm((current) => ({ ...current, remarks: event.target.value }))
              }
            />
          </label>

          <div className="panel nested-panel receiving-section">
            <div className="split-line">
              <div className="form-section-heading inline-heading">
                <span>2</span>
                <strong>Add delivered items</strong>
              </div>
              {isSuperAdmin ? (
                <Link
                  className="primary-button receiving-missing-product-button"
                  to="/products?create=1&from=stock-in"
                >
                  + Add Missing Product
                </Link>
              ) : (
                <span className="owner-only-note">New products are owner-only</span>
              )}
            </div>
            {!isSuperAdmin ? (
              <div className="subtle-panel">
                If the delivered item is new, ask the owner to create the product first. After the
                owner creates it, come back here and select it from the product list.
              </div>
            ) : null}
            {!hasSupplier ? (
              <div className="receiving-lock-panel">
                <strong>Choose supplier first</strong>
                <span>
                  A receiving report needs a supplier before items can be added. This keeps the
                  stock source clear for the owner and audit history.
                </span>
              </div>
            ) : null}
            <div className="mini-grid">
              <label className="field">
                <span>Product</span>
                <select
                  value={form.productId}
                  disabled={!canAddDeliveredItem}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, productId: event.target.value }))
                  }
                >
                  <option value="0">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} / {product.categoryName || 'No category'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  disabled={!canAddDeliveredItem}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="mini-grid">
              <label className="field">
                <span>Unit Cost</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitCost}
                  disabled={!canAddDeliveredItem}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, unitCost: event.target.value }))
                  }
                />
              </label>
              <div className="subtle-panel panel-note">
                {selectedProduct
                  ? `Product Code: ${selectedProduct.sku} / Category: ${selectedProduct.categoryName || 'No category'} / Stock on hand ${selectedProduct.quantityOnHand}`
                  : 'Choose a product to add it to the stock-in batch.'}
              </div>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!canAddDeliveredItem}
              onClick={() => {
                if (!hasSupplier) {
                  mutation.setError('Choose a supplier before adding delivered items.')
                  return
                }

                if (!selectedProduct) {
                  mutation.setError('Select a valid product first.')
                  return
                }

                const productId = selectedProduct.id
                const quantity = Number(form.quantity)
                const unitCost = Number(form.unitCost)

                if (quantity <= 0) {
                  mutation.setError('Quantity must be greater than zero.')
                  return
                }

                if (draftItems.some((item) => item.productId === productId)) {
                  mutation.setError(
                    `${selectedProduct.name} is already in this batch. Use Edit to change the quantity, or remove it first.`,
                  )
                  return
                }

                setDraftItems((current) => [
                  ...current,
                  {
                    productId,
                    productName: selectedProduct.name,
                    quantity,
                    unitCost,
                  },
                ])

                mutation.clearMessages()
                showToast({
                  tone: 'success',
                  title: 'Line item added',
                  message: `${selectedProduct.name} was added to the stock-in batch.`,
                })
                setForm((current) => ({
                  ...current,
                  productId: '0',
                  quantity: '1',
                  unitCost: '0',
                }))
              }}
            >
              {hasSupplier ? 'Add Delivered Item' : 'Choose Supplier First'}
            </button>
          </div>

          <div className="panel nested-panel receiving-section">
            <div className="split-line">
              <div className="form-section-heading inline-heading">
                <span>3</span>
                <strong>Review delivery batch</strong>
              </div>
              <span className="badge">
                {draftItems.length} line(s) / {formatCurrency(totalEstimatedCost)}
              </span>
            </div>

            {draftItems.length === 0 ? (
              <div className="empty-panel">No delivered items added yet.</div>
            ) : (
              <>
                <div className="subtle-panel">
                  Review the quantities below before receiving. If these are old test numbers,
                  click Reset Batch and add the items again.
                </div>
                <div className="list-stack">
                  {draftItems.map((item) => (
                    <div className="list-row" key={item.productId}>
                      {editingId === item.productId ? (
                        <div className="list-row-edit">
                          <strong>{item.productName}</strong>
                          <div className="mini-grid">
                            <label className="field">
                              <span>Quantity</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={editForm.quantity}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    quantity: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Unit Cost</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editForm.unitCost}
                                onChange={(event) =>
                                  setEditForm((current) => ({
                                    ...current,
                                    unitCost: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="action-row">
                            <button
                              className="primary-button"
                              type="button"
                              onClick={() => {
                                const quantity = Number(editForm.quantity)
                                if (quantity <= 0) {
                                  mutation.setError('Quantity must be greater than zero.')
                                  return
                                }

                                setDraftItems((current) =>
                                  current.map((entry) =>
                                    entry.productId === item.productId
                                      ? {
                                          ...entry,
                                          quantity,
                                          unitCost: Number(editForm.unitCost),
                                        }
                                      : entry,
                                  ),
                                )
                                setEditingId(null)
                                showToast({
                                  tone: 'success',
                                  title: 'Batch line updated',
                                  message: `${item.productName} values were updated.`,
                                })
                              }}
                            >
                              Save Line
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="table-title-cell">
                            <strong>{item.productName}</strong>
                            <span>Qty {item.quantity} @ {formatCurrency(item.unitCost)}</span>
                          </div>
                          <div className="table-title-cell align-right">
                            <strong>{formatCurrency(item.quantity * item.unitCost)}</strong>
                            <span>Line total</span>
                          </div>
                          <div className="action-row">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setEditingId(item.productId)
                                setEditForm({
                                  quantity: String(item.quantity),
                                  unitCost: String(item.unitCost),
                                })
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                const accepted = await confirm({
                                  title: 'Remove line item?',
                                  message: `Remove ${item.productName} from this receiving batch?`,
                                  confirmLabel: 'Remove',
                                  tone: 'danger',
                                })

                                if (!accepted) {
                                  return
                                }

                                setDraftItems((current) =>
                                  current.filter((entry) => entry.productId !== item.productId),
                                )
                                showToast({
                                  tone: 'info',
                                  title: 'Line removed',
                                  message: `${item.productName} was removed from the batch.`,
                                })
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="receiving-submit-panel">
            <div>
              <strong>
                {submitBlockedReason ||
                  (isSuperAdmin ? 'Ready to receive stock?' : 'Ready to submit request?')}
              </strong>
              <span>
                {submitBlockedReason
                  ? 'Complete the missing step above before continuing.'
                  : selectedSupplier
                  ? `Supplier: ${selectedSupplier.name}`
                  : ''}
              </span>
            </div>
            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                disabled={
                  mutation.isSubmitting ||
                  Boolean(submitBlockedReason)
                }
                onClick={async () => {
                  const accepted = await confirm({
                    title: isSuperAdmin
                      ? 'Receive stock and update inventory?'
                      : 'Submit receiving request?',
                    message: isSuperAdmin
                      ? `This will save ${draftItems.length} delivered item line(s) and immediately add the quantities to inventory.`
                      : `This will send ${draftItems.length} delivered item line(s) for owner approval. Inventory will not change yet.`,
                    confirmLabel: isSuperAdmin ? 'Receive Stock' : 'Submit Request',
                  })

                  if (!accepted) {
                    return
                  }

                  const saved = await mutation.run(
                    () =>
                      api.post('/stock-in', {
                        supplierId: Number(form.supplierId),
                        referenceNumber: form.referenceNumber,
                        containerNumber: form.containerNumber,
                        stockNumber: form.stockNumber,
                        productReferenceNumber: form.productReferenceNumber,
                        receivedDateUtc: new Date(`${form.receivedDateUtc}T00:00:00`).toISOString(),
                        remarks: form.remarks,
                        items: draftItems.map((item) => ({
                          productId: item.productId,
                          quantity: item.quantity,
                          unitCost: item.unitCost,
                        })),
                      }),
                  )

                  if (saved) {
                    if (isSuperAdmin) {
                      const approved = await mutation.run(() =>
                        api.post(`/stock-in/${saved.data.id}/approve`, {
                          notes: 'Received directly by owner.',
                        }),
                      )

                      if (!approved) {
                        return
                      }
                    }

                    setForm({
                      supplierId: '0',
                      referenceNumber: '',
                      containerNumber: '',
                      stockNumber: '',
                      productReferenceNumber: '',
                      receivedDateUtc: new Date().toISOString().slice(0, 10),
                      remarks: '',
                      productId: searchParams.get('productId') ?? '0',
                      quantity: '1',
                      unitCost: '0',
                    })
                    setDraftItems([])
                    await refetch()
                    showToast({
                      tone: 'success',
                      title: isSuperAdmin ? 'Stock received' : 'Receiving request sent',
                      message: isSuperAdmin
                        ? 'Delivered quantities were added to inventory.'
                        : 'The owner must approve before inventory is updated.',
                    })
                  }
                }}
              >
                {submitBlockedReason ||
                  (isSuperAdmin ? 'Receive and Add Stock' : 'Submit for Owner Approval')}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={draftItems.length === 0}
                onClick={async () => {
                  const accepted = await confirm({
                    title: 'Clear current batch?',
                    message: 'All unsaved stock-in lines will be removed.',
                    confirmLabel: 'Clear Batch',
                    tone: 'danger',
                  })

                  if (!accepted) {
                    return
                  }

                  setDraftItems([])
                  showToast({
                    tone: 'info',
                    title: 'Batch cleared',
                    message: 'The unsaved receiving batch was cleared.',
                  })
                }}
              >
                Reset Batch
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No stock-in records found."
        hasData={data.length > 0}
      />

      <div className="split-line top-gap">
        <h4>Receiving History</h4>
        <span className="badge">{data.length} record(s)</span>
      </div>

      <div className="timeline">
        {data.map((record) => (
          <article className="panel" key={record.id}>
            <div className="split-line">
              <div className="table-title-cell">
                <strong>{record.referenceNumber || `RR-${record.id}`}</strong>
                <span>
                  {record.supplierName} / encoded by {record.receivedByName}
                </span>
              </div>
              <div className="action-row">
                <span className={getReceivingStatusClass(record.status)}>{record.status}</span>
                <span className="badge">{formatDateTime(record.receivedDateUtc)}</span>
              </div>
            </div>

            <div className="stats-grid compact-stats">
              <div className="stat-card">
                <span>Container No.</span>
                <strong>{record.containerNumber || 'Not set'}</strong>
              </div>
              <div className="stat-card">
                <span>Stock No.</span>
                <strong>{record.stockNumber || 'Not set'}</strong>
              </div>
              <div className="stat-card">
                <span>Product Ref.</span>
                <strong>{record.productReferenceNumber || 'Not set'}</strong>
              </div>
              <div className="stat-card">
                <span>Items</span>
                <strong>{record.items?.length ?? 0}</strong>
              </div>
            </div>

            <div className="subtle-panel">
              <strong>Receiving notes</strong>
              <p>{record.remarks || 'No notes provided.'}</p>
            </div>

            {record.items?.length ? (
              <div className="list-stack">
                {record.items.map((item) => (
                  <div key={`${record.id}-${item.productId}`} className="list-row">
                    <div className="table-title-cell">
                      <strong>{item.productName}</strong>
                      <span>Delivered quantity: {item.quantity}</span>
                    </div>
                    <div className="table-title-cell align-right">
                      <strong>{formatCurrency(item.unitCost)}</strong>
                      <span>Total cost {formatCurrency(item.quantity * item.unitCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {record.reviewNotes ? (
              <div className="subtle-panel">
                <strong>Owner review</strong>
                <p>{record.reviewNotes}</p>
                {record.reviewedByName ? (
                  <span>
                    Reviewed by {record.reviewedByName}
                    {record.reviewedAtUtc ? ` on ${formatDateTime(record.reviewedAtUtc)}` : ''}
                  </span>
                ) : null}
              </div>
            ) : null}

            {isSuperAdmin && record.status === 'Pending' ? (
              <div className="action-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutation.isSubmitting}
                  onClick={async () => {
                    const accepted = await confirm({
                      title: 'Approve receiving report?',
                      message:
                        'Approving this report will add all delivered quantities to inventory.',
                      confirmLabel: 'Approve',
                    })

                    if (!accepted) {
                      return
                    }

                    const approved = await mutation.run(() =>
                      api.post(`/stock-in/${record.id}/approve`, {
                        notes: 'Approved by owner.',
                      }),
                    )

                    if (approved) {
                      await refetch()
                      showToast({
                        tone: 'success',
                        title: 'Receiving approved',
                        message: 'Delivered quantities were added to inventory.',
                      })
                    }
                  }}
                >
                  Approve and Add Stock
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={mutation.isSubmitting}
                  onClick={async () => {
                    const accepted = await confirm({
                      title: 'Reject receiving report?',
                      message: 'Rejecting this report will keep inventory unchanged.',
                      confirmLabel: 'Reject',
                      tone: 'danger',
                    })

                    if (!accepted) {
                      return
                    }

                    const rejected = await mutation.run(() =>
                      api.post(`/stock-in/${record.id}/reject`, {
                        notes: 'Rejected by owner.',
                      }),
                    )

                    if (rejected) {
                      await refetch()
                      showToast({
                        tone: 'info',
                        title: 'Receiving rejected',
                        message: 'Inventory was not changed.',
                      })
                    }
                  }}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </PageFrame>
  )
}
