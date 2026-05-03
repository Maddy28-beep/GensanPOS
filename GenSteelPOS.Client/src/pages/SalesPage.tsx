import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { api } from '../lib/api'
import { formatDateTime, parseApiDate } from '../lib/datetime'
import { formatCurrency, openPrintWindow } from '../lib/receipt'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'
import { Roles } from '../types/auth'
import type { Sale } from '../types/entities'

type SaleAction = 'cancel' | 'refund' | 'void'
type RequestedReturnLine = {
  lineId: string
  saleItemId: number
  productName: string
  maxQuantity: number
  quantity: string
  remarks: string
}

const presetReasons = [
  'Customer changed mind',
  'Wrong item encoded',
  'Duplicate transaction',
  'Pricing mistake',
]

function getSaleStatusClass(status: Sale['status']) {
  switch (status) {
    case 'Completed':
      return 'status-badge in'
    case 'PartiallyRefunded':
      return 'status-badge low'
    case 'Refunded':
    case 'Cancelled':
    case 'Voided':
      return 'status-badge out'
    default:
      return 'status-badge'
  }
}

function createReturnLine(
  saleItemId: number,
  productName: string,
  maxQuantity: number,
): RequestedReturnLine {
  return {
    lineId: `${saleItemId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    saleItemId,
    productName,
    maxQuantity,
    quantity: '',
    remarks: '',
  }
}

function formatSoldItems(sale: Sale) {
  const visibleItems = sale.items.slice(0, 2)
  const text = visibleItems
    .map((item) => `${item.productName} x ${item.quantity}`)
    .join(', ')

  return sale.items.length > 2 ? `${text}, +${sale.items.length - 2} more` : text || 'No items'
}

export function SalesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const { data, isLoading, error, refetch } = useApiData<Sale[]>('/sales', [])
  const mutation = useApiMutation()
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [openOwnerMenuSaleId, setOpenOwnerMenuSaleId] = useState<number | null>(null)
  const [requestModal, setRequestModal] = useState<{
    sale: Sale
    requestType: 'Cancel' | 'Refund' | 'Void'
    selectedReason: string
    notes: string
    returnItems: RequestedReturnLine[]
  } | null>(null)
  const [actionModal, setActionModal] = useState<{
    sale: Sale
    action: SaleAction
    selectedReason: string
    notes: string
  } | null>(null)

  const pageDescription = isSuperAdmin
    ? 'Full transaction history with owner-only return-backed refunds, cancellations, and void actions plus receipt reprint from the sales ledger.'
    : 'Today-only sales history for the signed-in cashier, with receipt reprint for current-day transactions.'
  const sortedSales = useMemo(
    () =>
      [...data].sort(
        (left, right) =>
          parseApiDate(right.createdAtUtc).getTime() - parseApiDate(left.createdAtUtc).getTime(),
      ),
    [data],
  )
  const salesSummary = useMemo(() => {
    const visibleTransactions = sortedSales.length
    const grossSales = sortedSales.reduce((sum, sale) => sum + sale.totalAmount, 0)
    const returnsAmount = sortedSales.reduce((sum, sale) => sum + sale.totalReturnedAmount, 0)
    const netSales = grossSales - returnsAmount
    return { visibleTransactions, grossSales, returnsAmount, netSales }
  }, [sortedSales])

  const buildReturnLines = (sale: Sale): RequestedReturnLine[] =>
    sale.items
      .filter((item) => item.remainingReturnableQuantity > 0)
      .map((item) => createReturnLine(item.saleItemId, item.productName, item.remainingReturnableQuantity))

  const selectedReturnItems = requestModal?.requestType === 'Refund'
    ? requestModal.returnItems
        .map((item) => ({
          ...item,
          parsedQuantity: Number(item.quantity),
        }))
        .filter((item) => Number.isFinite(item.parsedQuantity) && item.parsedQuantity > 0)
    : []
  const returnTotalsBySaleItem = selectedReturnItems.reduce<Record<number, number>>((totals, item) => {
    totals[item.saleItemId] = (totals[item.saleItemId] ?? 0) + item.parsedQuantity
    return totals
  }, {})
  const selectedReturnQuantity = selectedReturnItems.reduce(
    (sum, item) => sum + item.parsedQuantity,
    0,
  )

  return (
    <PageFrame
      title="Sales"
      description={pageDescription}
    >
      {!isSuperAdmin ? (
        <div className="subtle-panel compact-help-panel">
          Staff can only see their own transactions for today. Full sales history remains visible to the owner.
        </div>
      ) : (
        <div className="subtle-panel compact-help-panel">
          Newest transactions are shown first. Cancel and void restore all sold stock and close the sale. Returns create a GRS against the original invoice and only good-condition items can be returned.
        </div>
      )}

      <div className="stats-grid compact-stats sales-kpi-grid">
        <div className="stat-card">
          <span>{isSuperAdmin ? 'Visible Transactions' : 'Today Transactions'}</span>
          <strong>{salesSummary.visibleTransactions}</strong>
        </div>
        <div className="stat-card">
          <span>Gross Sales</span>
          <strong>{formatCurrency(salesSummary.grossSales)}</strong>
        </div>
        <div className="stat-card">
          <span>Returns</span>
          <strong>{formatCurrency(salesSummary.returnsAmount)}</strong>
        </div>
        <div className="stat-card">
          <span>Net Sales</span>
          <strong>{formatCurrency(salesSummary.netSales)}</strong>
        </div>
      </div>

      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No sales records found."
        hasData={sortedSales.length > 0}
      />

      {sortedSales.length > 0 ? (
        <div className="panel table-panel compact-sales-table">
          <table>
            <thead>
              <tr>
                <th>Sale No.</th>
                <th>Items Sold</th>
                <th>Cashier</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <div className="table-title-cell">
                      <strong>{sale.saleNumber}</strong>
                      <span>{sale.customerName || 'Walk-in Customer'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{formatSoldItems(sale)}</strong>
                      <span>{sale.items.length} item line(s)</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{sale.cashierName}</strong>
                      <span>{sale.items.length} item(s)</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{formatCurrency(sale.totalAmount)}</strong>
                      <span>Returned {formatCurrency(sale.totalReturnedAmount)}</span>
                    </div>
                  </td>
                  <td>
                    <span className={getSaleStatusClass(sale.status)}>{sale.status}</span>
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{formatDateTime(sale.createdAtUtc)}</strong>
                      <span>{sale.payments.length} payment line(s)</span>
                    </div>
                  </td>
                  <td>
                    <div className="sales-action-cell table-action-stack">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                      >
                        View Receipt
                      </button>
                      {isSuperAdmin ? (
                        <div className="owner-menu">
                          <button
                            className="owner-menu-trigger"
                            type="button"
                            disabled={sale.status !== 'Completed' || mutation.isSubmitting}
                            onClick={() =>
                              setOpenOwnerMenuSaleId((current) =>
                                current === sale.id ? null : sale.id,
                              )
                            }
                          >
                            {openOwnerMenuSaleId === sale.id ? 'Close Owner Actions' : 'Owner Actions'}
                          </button>
                          {openOwnerMenuSaleId === sale.id ? (
                            <div className="owner-menu-list">
                              <button
                                className="owner-menu-item danger"
                                type="button"
                                onClick={() => {
                                  setOpenOwnerMenuSaleId(null)
                                  setActionModal({
                                    sale,
                                    action: 'cancel',
                                    selectedReason: '',
                                    notes: '',
                                  })
                                }}
                              >
                                Cancel Sale / Restore Stock
                              </button>
                              <button
                                className="owner-menu-item"
                                type="button"
                                onClick={() => {
                                  setOpenOwnerMenuSaleId(null)
                                  setActionModal({
                                    sale,
                                    action: 'refund',
                                    selectedReason: '',
                                    notes: '',
                                  })
                                }}
                              >
                                Full Return / Refund
                              </button>
                              <button
                                className="owner-menu-item danger"
                                type="button"
                                onClick={() => {
                                  setOpenOwnerMenuSaleId(null)
                                  setActionModal({
                                    sale,
                                    action: 'void',
                                    selectedReason: '',
                                    notes: '',
                                  })
                                }}
                              >
                                Void Sale / Restore Stock
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : sale.status === 'Completed' ? (
                        <button
                          className="owner-menu-trigger"
                          type="button"
                          onClick={() =>
                            setRequestModal({
                              sale,
                              requestType: 'Cancel',
                              selectedReason: '',
                              notes: '',
                              returnItems: buildReturnLines(sale),
                            })
                          }
                        >
                          Request Owner Action
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {requestModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Cashier Request</p>
            <h3>Request Owner Action</h3>
            <p className="page-copy">
              Submit a cancel, return/refund, or void request for sale {requestModal.sale.saleNumber}.
              Returns are only for good-condition items and will reference the original invoice.
            </p>
            <label className="field">
              <span>Request Type</span>
              <select
                value={requestModal.requestType}
                onChange={(event) =>
                  setRequestModal((current) =>
                    current
                      ? {
                          ...current,
                          requestType: event.target.value as 'Cancel' | 'Refund' | 'Void',
                          returnItems:
                            event.target.value === 'Refund'
                              ? current.returnItems.length > 0
                                ? current.returnItems
                                : buildReturnLines(current.sale)
                              : current.returnItems,
                        }
                      : current,
                  )
                }
              >
                <option value="Cancel">Cancel</option>
                <option value="Refund">Return Items / GRS</option>
                <option value="Void">Void</option>
              </select>
            </label>
            {requestModal.requestType === 'Refund' ? (
              <div className="return-request-box">
                <div className="subtle-panel">
                  Select the item quantities being returned. Only good-condition items are accepted; damaged items should not be submitted as returns.
                </div>
                <div className="return-request-summary">
                  <div className="summary-card">
                    <span>Original Sale</span>
                    <strong>{requestModal.sale.saleNumber}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Selected Return Qty</span>
                    <strong>{selectedReturnQuantity}</strong>
                  </div>
                </div>
                {requestModal.returnItems.length > 0 ? (
                  <div className="return-request-list">
                    {requestModal.returnItems.map((item) => {
                      const siblingLines = requestModal.returnItems.filter(
                        (line) => line.saleItemId === item.saleItemId,
                      )
                      const canRemoveLine = siblingLines.length > 1
                      const remainingForLine =
                        item.maxQuantity -
                        siblingLines
                          .filter((line) => line.lineId !== item.lineId)
                          .reduce((sum, line) => {
                            const quantity = Number(line.quantity)
                            return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0)
                          }, 0)

                      return (
                      <div className="return-request-line" key={item.lineId}>
                        <div className="return-request-product">
                          <strong>{item.productName}</strong>
                          <span>Available to return: {Math.max(0, remainingForLine)}</span>
                        </div>
                        <label className="field compact-field">
                          <span>Qty</span>
                          <input
                            min="0"
                            max={Math.max(0, remainingForLine)}
                            step="0.01"
                            type="number"
                            value={item.quantity}
                            onChange={(event) =>
                              setRequestModal((current) =>
                                current
                                  ? {
                                      ...current,
                                      returnItems: current.returnItems.map((line) =>
                                        line.lineId === item.lineId
                                          ? { ...line, quantity: event.target.value }
                                          : line,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            placeholder="0"
                          />
                        </label>
                        <div className="summary-card compact-field">
                          <span>Condition</span>
                          <strong>Good only</strong>
                        </div>
                        <label className="field compact-field return-remarks-field">
                          <span>Item Note</span>
                          <input
                            value={item.remarks}
                            onChange={(event) =>
                              setRequestModal((current) =>
                                current
                                  ? {
                                      ...current,
                                      returnItems: current.returnItems.map((line) =>
                                        line.lineId === item.lineId
                                          ? { ...line, remarks: event.target.value }
                                          : line,
                                      ),
                                    }
                                  : current,
                              )
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <div className="return-line-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() =>
                              setRequestModal((current) =>
                                current
                                  ? {
                                      ...current,
                                      returnItems: [
                                        ...current.returnItems,
                                        createReturnLine(
                                          item.saleItemId,
                                          item.productName,
                                          item.maxQuantity,
                                        ),
                                      ],
                                    }
                                  : current,
                              )
                            }
                          >
                            Add Another Line
                          </button>
                          {canRemoveLine ? (
                            <button
                              className="ghost-button danger-text-button"
                              type="button"
                              onClick={() =>
                                setRequestModal((current) =>
                                  current
                                    ? {
                                        ...current,
                                        returnItems: current.returnItems.filter(
                                          (line) => line.lineId !== item.lineId,
                                        ),
                                      }
                                    : current,
                                )
                              }
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="subtle-panel">No remaining items can be returned for this sale.</div>
                )}
              </div>
            ) : null}
            <label className="field">
              <span>Quick Reason</span>
              <div className="reason-chip-row">
                {presetReasons.map((reason) => (
                  <button
                    key={reason}
                    className={
                      requestModal.selectedReason === reason ? 'reason-chip active' : 'reason-chip'
                    }
                    type="button"
                    onClick={() =>
                      setRequestModal((current) =>
                        current ? { ...current, selectedReason: reason } : current,
                      )
                    }
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={requestModal.notes}
                onChange={(event) =>
                  setRequestModal((current) =>
                    current ? { ...current, notes: event.target.value } : current,
                  )
                }
                placeholder="Add more details for the owner."
              />
            </label>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => setRequestModal(null)}>
                Close
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={
                  mutation.isSubmitting ||
                  (!requestModal.selectedReason.trim() && !requestModal.notes.trim())
                  || (requestModal.requestType === 'Refund' && selectedReturnItems.length === 0)
                }
                onClick={async () => {
                  const reason = [requestModal.selectedReason.trim(), requestModal.notes.trim()]
                    .filter(Boolean)
                    .join(' - ')
                  const invalidReturnItem = selectedReturnItems.find(
                    (item) => returnTotalsBySaleItem[item.saleItemId] > item.maxQuantity,
                  )

                  if (invalidReturnItem) {
                    mutation.setError(
                      `${invalidReturnItem.productName} can only return up to ${invalidReturnItem.maxQuantity}.`,
                    )
                    return
                  }

                  const saved = await mutation.run(() =>
                    api.post('/sale-action-requests', {
                      saleId: requestModal.sale.id,
                      requestType: requestModal.requestType,
                      reason,
                      requestedReturnItems: selectedReturnItems.map((item) => ({
                        saleItemId: item.saleItemId,
                        quantity: item.parsedQuantity,
                        condition: 1,
                        remarks: item.remarks.trim(),
                      })),
                    }),
                  )

                  if (saved) {
                    setRequestModal(null)
                    showToast({
                      tone: 'success',
                      title: 'Request sent',
                      message: `Owner request created for ${requestModal.sale.saleNumber}.`,
                    })
                  }
                }}
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Owner Action</p>
            <h3>
              {actionModal.action === 'cancel'
                ? 'Cancel Sale'
                : actionModal.action === 'refund'
                  ? 'Full Return / Refund Sale'
                  : 'Void Sale'}
            </h3>
            <p className="page-copy">
              {actionModal.sale.saleNumber}{' '}
              {actionModal.action === 'refund'
                ? 'will create a GRS for all remaining good-condition items and reference the original invoice.'
                : `will be marked as ${actionModal.action === 'void' ? 'voided' : 'cancelled'} and all sold stock will be restored. Voided transactions remain visible in audit logs.`}
            </p>
            <label className="field">
              <span>Quick Reason</span>
              <div className="reason-chip-row">
                {presetReasons.map((reason) => (
                  <button
                    key={reason}
                    className={
                      actionModal.selectedReason === reason ? 'reason-chip active' : 'reason-chip'
                    }
                    type="button"
                    onClick={() =>
                      setActionModal((current) =>
                        current ? { ...current, selectedReason: reason } : current,
                      )
                    }
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={actionModal.notes}
                onChange={(event) =>
                  setActionModal((current) =>
                    current ? { ...current, notes: event.target.value } : current,
                  )
                }
                placeholder="Add more details if needed."
              />
            </label>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => setActionModal(null)}>
                Close
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={
                  mutation.isSubmitting ||
                  (!actionModal.selectedReason.trim() && !actionModal.notes.trim())
                }
                onClick={async () => {
                  const reason = [actionModal.selectedReason.trim(), actionModal.notes.trim()]
                    .filter(Boolean)
                    .join(' - ')
                  const endpoint =
                    actionModal.action === 'cancel'
                      ? 'cancel'
                      : actionModal.action === 'refund'
                        ? 'refund'
                        : 'void'

                  const saved = await mutation.run(() =>
                    api.post(`/sales/${actionModal.sale.id}/${endpoint}`, {
                      reason,
                    }),
                  )

                  if (saved) {
                    const actionLabel =
                      actionModal.action === 'cancel'
                        ? 'cancelled'
                        : actionModal.action === 'refund'
                          ? 'refunded'
                          : 'voided'
                    await refetch()
                    setActionModal(null)
                    showToast({
                      tone: 'success',
                      title: `Sale ${actionLabel}`,
                      message: `${actionModal.sale.saleNumber} was ${actionLabel} successfully.`,
                    })
                  }
                }}
              >
                Confirm{' '}
                {actionModal.action === 'void'
                  ? 'Void'
                  : actionModal.action === 'cancel'
                    ? 'Cancel'
                    : 'Full Return / Refund'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedSale ? (
        <div className="modal-backdrop print-hide">
          <div className="modal-card receipt-modal">
            <div className="split-line">
              <h3>Receipt Reprint</h3>
              <button className="ghost-button" type="button" onClick={() => setSelectedSale(null)}>
                Close
              </button>
            </div>
            <div className="receipt-sheet">
              <h4>Gen Steel POS Receipt</h4>
              <p>Sale No: {selectedSale.saleNumber}</p>
              <p>Customer: {selectedSale.customerName || 'Walk-in Customer'}</p>
              <p>Address: {selectedSale.customerAddress || '-'}</p>
              <p>TIN: {selectedSale.customerTin || '-'}</p>
              <p>PO Number: {selectedSale.poNumber || '-'}</p>
              <p>Terms: {selectedSale.terms || '-'}</p>
              <p>Remarks: {selectedSale.remarks || '-'}</p>
              <p>Cashier: {selectedSale.cashierName}</p>
              <p>Date: {formatDateTime(selectedSale.createdAtUtc)}</p>
              <p>Status: {selectedSale.status}</p>
              <div className="list-stack top-gap">
                {selectedSale.items.map((item) => (
                  <div className="receipt-line" key={`${selectedSale.id}-${item.productId}`}>
                    <span>
                      {item.productName} ({item.quantity} x {formatCurrency(item.unitPrice)})
                    </span>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="receipt-panel top-gap">
                <div className="receipt-line">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(selectedSale.subtotal)}</strong>
                </div>
                <div className="receipt-line">
                  <span>Discount</span>
                  <strong>{formatCurrency(selectedSale.discountAmount)}</strong>
                </div>
                <div className="receipt-line">
                  <span>Tax</span>
                  <strong>{formatCurrency(selectedSale.taxAmount)}</strong>
                </div>
                <div className="receipt-line total-line">
                  <span>Total</span>
                  <strong>{formatCurrency(selectedSale.totalAmount)}</strong>
                </div>
              </div>
              <div className="receipt-panel top-gap">
                <div className="split-line">
                  <strong>Payments</strong>
                  <span className="muted">{selectedSale.payments.length} line(s)</span>
                </div>
                {selectedSale.payments.map((payment, index) => (
                  <div className="receipt-line" key={`${selectedSale.id}-payment-${index}`}>
                    <span>
                      {payment.paymentMethod}
                      {payment.referenceNumber ? ` / ${payment.referenceNumber}` : ''}
                    </span>
                    <strong>{formatCurrency(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  const opened = openPrintWindow(selectedSale)
                  if (!opened) {
                    showToast({
                      tone: 'error',
                      title: 'Print failed',
                      message: 'Allow pop-ups to open the printable receipt window.',
                    })
                  }
                }}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  )
}
