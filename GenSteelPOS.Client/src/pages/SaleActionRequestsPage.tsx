import { useEffect, useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { api } from '../lib/api'
import { formatDateTime, parseApiDate } from '../lib/datetime'
import { formatCurrency } from '../lib/receipt'
import { useAuth } from '../state/AuthContext'
import { useToast } from '../state/ToastContext'
import { Roles } from '../types/auth'
import type { InventoryAdjustmentRequest, SaleActionRequest, StockInRecord } from '../types/entities'

const presetReviewNotes = [
  'Approved by owner',
  'Insufficient basis for approval',
  'Verified against transaction record',
  'Please confirm with cashier and customer',
]

const requestPageSize = 5

type ActionRequestListItem =
  | { type: 'stockReceiving'; id: number; createdAtUtc: string; request: StockInRecord }
  | { type: 'inventory'; id: number; createdAtUtc: string; request: InventoryAdjustmentRequest }
  | { type: 'sale'; id: number; createdAtUtc: string; request: SaleActionRequest }

function getRequestStatusClass(status: SaleActionRequest['status']) {
  switch (status) {
    case 'Pending':
      return 'status-badge low'
    case 'Approved':
      return 'status-badge in'
    case 'Rejected':
      return 'status-badge out'
    default:
      return 'status-badge'
  }
}

function getInventoryRequestTypeLabel(request: InventoryAdjustmentRequest) {
  if (request.requestType === 'SetActualCount') {
    return 'Set Actual Count'
  }

  return request.requestType
}

export function SaleActionRequestsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const { data, isLoading, error, refetch } = useApiData<SaleActionRequest[]>('/sale-action-requests', [])
  const {
    data: inventoryRequests,
    isLoading: inventoryRequestsLoading,
    error: inventoryRequestsError,
    refetch: refetchInventoryRequests,
  } = useApiData<InventoryAdjustmentRequest[]>('/inventory-adjustment-requests', [])
  const {
    data: stockReceivingRequests,
    isLoading: stockReceivingRequestsLoading,
    error: stockReceivingRequestsError,
    refetch: refetchStockReceivingRequests,
  } = useApiData<StockInRecord[]>('/stock-in', [])
  const mutation = useApiMutation()
  const [reviewModal, setReviewModal] = useState<{
    request: SaleActionRequest
    action: 'approve' | 'reject'
    note: string
  } | null>(null)
  const [inventoryReviewModal, setInventoryReviewModal] = useState<{
    request: InventoryAdjustmentRequest
    action: 'approve' | 'reject'
    note: string
  } | null>(null)
  const [stockReceivingReviewModal, setStockReceivingReviewModal] = useState<{
    request: StockInRecord
    action: 'approve' | 'reject'
    note: string
  } | null>(null)
  const [requestPage, setRequestPage] = useState(1)

  const sortedRequests = useMemo(
    () =>
      [...data].sort(
        (left, right) =>
          parseApiDate(right.createdAtUtc).getTime() - parseApiDate(left.createdAtUtc).getTime(),
      ),
    [data],
  )
  const requestSummary = useMemo(() => {
    const allRequests = [...sortedRequests, ...inventoryRequests, ...stockReceivingRequests]
    const pendingCount = allRequests.filter((request) => request.status === 'Pending').length
    const approvedCount = allRequests.filter((request) => request.status === 'Approved').length
    const rejectedCount = allRequests.filter((request) => request.status === 'Rejected').length
    return { pendingCount, approvedCount, rejectedCount }
  }, [inventoryRequests, sortedRequests, stockReceivingRequests])
  const combinedRequests = useMemo<ActionRequestListItem[]>(
    () =>
      [
        ...stockReceivingRequests.map((request) => ({
          type: 'stockReceiving' as const,
          id: request.id,
          createdAtUtc: request.receivedDateUtc,
          request,
        })),
        ...inventoryRequests.map((request) => ({
          type: 'inventory' as const,
          id: request.id,
          createdAtUtc: request.createdAtUtc,
          request,
        })),
        ...sortedRequests.map((request) => ({
          type: 'sale' as const,
          id: request.id,
          createdAtUtc: request.createdAtUtc,
          request,
        })),
      ].sort(
        (left, right) =>
          parseApiDate(right.createdAtUtc).getTime() - parseApiDate(left.createdAtUtc).getTime(),
      ),
    [inventoryRequests, sortedRequests, stockReceivingRequests],
  )
  const totalRequestPages = Math.max(1, Math.ceil(combinedRequests.length / requestPageSize))
  const currentRequestPage = Math.min(requestPage, totalRequestPages)
  const pagedRequests = combinedRequests.slice(
    (currentRequestPage - 1) * requestPageSize,
    currentRequestPage * requestPageSize,
  )
  const requestPageStart =
    combinedRequests.length === 0 ? 0 : (currentRequestPage - 1) * requestPageSize + 1
  const requestPageEnd = Math.min(currentRequestPage * requestPageSize, combinedRequests.length)

  useEffect(() => {
    if (requestPage > totalRequestPages) {
      setRequestPage(totalRequestPages)
    }
  }, [requestPage, totalRequestPages])

  return (
    <PageFrame
      title="Action Requests"
      description={
        isSuperAdmin
          ? 'Owner approval queue for cashier sale actions, inventory adjustments, and stock receiving.'
          : 'Submit and track your sale, inventory, and stock receiving requests for owner approval.'
      }
    >
      <div className="stats-grid compact-stats">
        <div className="stat-card">
          <span>Total Requests</span>
          <strong>{sortedRequests.length + inventoryRequests.length + stockReceivingRequests.length}</strong>
        </div>
        <div className="stat-card alert">
          <span>Pending</span>
          <strong>{requestSummary.pendingCount}</strong>
        </div>
        <div className="stat-card">
          <span>Approved</span>
          <strong>{requestSummary.approvedCount}</strong>
        </div>
        <div className="stat-card">
          <span>Rejected</span>
          <strong>{requestSummary.rejectedCount}</strong>
        </div>
      </div>

      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <DataState
        isLoading={isLoading || inventoryRequestsLoading || stockReceivingRequestsLoading}
        error={error ?? inventoryRequestsError ?? stockReceivingRequestsError}
        emptyMessage="No action requests found."
        hasData={
          sortedRequests.length > 0 ||
          inventoryRequests.length > 0 ||
          stockReceivingRequests.length > 0
        }
      />

      {combinedRequests.length > 0 ? (
        <>
          <div className="request-list-toolbar">
            <strong>Request Queue</strong>
            <span>
              Showing {requestPageStart}-{requestPageEnd} of {combinedRequests.length}
            </span>
          </div>
          <div className="request-board compact-request-board">
            {pagedRequests.map((entry) => {
              if (entry.type === 'stockReceiving') {
                const request = entry.request
                const totalQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0)
                const totalCost = request.items.reduce(
                  (sum, item) => sum + item.quantity * item.unitCost,
                  0,
                )

                return (
                  <article
                    className="request-card compact-request-card stock-receiving-request-card"
                    key={`stock-in-${request.id}`}
                  >
                    <div className="request-card-main">
                      <div className="request-card-title">
                        <div>
                          <h4>{request.referenceNumber || `RR-${request.id}`}</h4>
                          <span>
                            Stock receiving / {request.receivedByName || '-'} /{' '}
                            {formatDateTime(request.receivedDateUtc)}
                          </span>
                        </div>
                        <span className={getRequestStatusClass(request.status)}>{request.status}</span>
                      </div>

                      <div className="compact-request-summary">
                        <span>
                          Supplier <strong>{request.supplierName || '-'}</strong>
                        </span>
                        <span>
                          Items <strong>{request.items.length}</strong>
                        </span>
                        <span>
                          Qty <strong>{totalQuantity}</strong>
                        </span>
                        <span>
                          Cost <strong>{formatCurrency(totalCost)}</strong>
                        </span>
                      </div>

                      <div className="request-return-items compact-request-items">
                        <span>Delivered Items</span>
                        {request.items.map((item) => (
                          <div className="request-return-item" key={item.productId}>
                            <strong>{item.productName}</strong>
                            <span>
                              Qty {item.quantity} / Unit cost {formatCurrency(item.unitCost)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {request.remarks ? (
                        <p className="compact-request-note">Remarks: {request.remarks}</p>
                      ) : null}
                    </div>

                    <div className="request-card-review">
                      {isSuperAdmin && request.status === 'Pending' ? (
                        <div className="review-actions compact-review-actions">
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() =>
                              setStockReceivingReviewModal({ request, action: 'approve', note: '' })
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() =>
                              setStockReceivingReviewModal({ request, action: 'reject', note: '' })
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="request-review-summary compact-review-summary">
                          <span>Reviewed</span>
                          <strong>{request.reviewedByName || '-'}</strong>
                          <span>{request.reviewedAtUtc ? formatDateTime(request.reviewedAtUtc) : '-'}</span>
                          {request.reviewNotes ? <p>{request.reviewNotes}</p> : null}
                        </div>
                      )}
                    </div>
                  </article>
                )
              }

              if (entry.type === 'inventory') {
                const request = entry.request

                return (
                  <article className="request-card compact-request-card" key={`inventory-${request.id}`}>
                    <div className="request-card-main">
                      <div className="request-card-title">
                        <div>
                          <h4>{request.productName}</h4>
                          <span>
                            Inventory {getInventoryRequestTypeLabel(request)} / {request.requestedByName} /{' '}
                            {formatDateTime(request.createdAtUtc)}
                          </span>
                        </div>
                        <span className={getRequestStatusClass(request.status)}>{request.status}</span>
                      </div>

                      <div className="compact-request-summary">
                        <span>
                          Current <strong>{request.previousQuantity}</strong>
                        </span>
                        <span>
                          Requested <strong>{request.requestedQuantity}</strong>
                        </span>
                        <span>
                          Change <strong>{request.quantityChange}</strong>
                        </span>
                      </div>

                      <p className="compact-request-note">Reason: {request.reason || '-'}</p>
                    </div>

                    <div className="request-card-review">
                      {isSuperAdmin && request.status === 'Pending' ? (
                        <div className="review-actions compact-review-actions">
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => setInventoryReviewModal({ request, action: 'approve', note: '' })}
                          >
                            Approve
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => setInventoryReviewModal({ request, action: 'reject', note: '' })}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="request-review-summary compact-review-summary">
                          <span>Reviewed</span>
                          <strong>{request.reviewedByName || '-'}</strong>
                          <span>{request.reviewedAtUtc ? formatDateTime(request.reviewedAtUtc) : '-'}</span>
                          {request.reviewNotes ? <p>{request.reviewNotes}</p> : null}
                        </div>
                      )}
                    </div>
                  </article>
                )
              }

              const request = entry.request

              return (
                <article className="request-card compact-request-card" key={`sale-${request.id}`}>
                  <div className="request-card-main">
                    <div className="request-card-title">
                      <div>
                        <h4>{request.saleNumber}</h4>
                        <span>
                          {request.requestType} / {request.requestedByName} /{' '}
                          {formatDateTime(request.createdAtUtc)}
                        </span>
                      </div>
                      <span className={getRequestStatusClass(request.status)}>{request.status}</span>
                    </div>

                    <div className="compact-request-summary">
                      <span>
                        Amount <strong>{formatCurrency(request.saleTotalAmount)}</strong>
                      </span>
                      <span>
                        Cashier <strong>{request.cashierName || '-'}</strong>
                      </span>
                    </div>

                    <p className="compact-request-note">Reason: {request.requestReason || '-'}</p>

                    {request.requestedReturnItems.length > 0 ? (
                      <div className="request-return-items compact-request-items">
                        <span>Requested Return Items</span>
                        {request.requestedReturnItems.map((item) => (
                          <div className="request-return-item" key={item.saleItemId}>
                            <strong>{item.productName}</strong>
                            <span>
                              Qty {item.quantity} / {item.condition}
                              {item.remarks ? ` / ${item.remarks}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="request-card-review">
                    {isSuperAdmin && request.status === 'Pending' ? (
                      <div className="review-actions compact-review-actions">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => setReviewModal({ request, action: 'approve', note: '' })}
                        >
                          Approve
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => setReviewModal({ request, action: 'reject', note: '' })}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="request-review-summary compact-review-summary">
                        <span>Reviewed</span>
                        <strong>{request.reviewedByName || '-'}</strong>
                        <span>{request.reviewedAtUtc ? formatDateTime(request.reviewedAtUtc) : '-'}</span>
                        {request.reviewNotes ? <p>{request.reviewNotes}</p> : null}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          {totalRequestPages > 1 ? (
            <div className="pagination-bar request-pagination">
              <span>
                Page {currentRequestPage} of {totalRequestPages}
              </span>
              <div className="action-row">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={currentRequestPage <= 1}
                  onClick={() => setRequestPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={currentRequestPage >= totalRequestPages}
                  onClick={() =>
                    setRequestPage((current) => Math.min(totalRequestPages, current + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {stockReceivingReviewModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Owner Review</p>
            <h3>
              {stockReceivingReviewModal.action === 'approve'
                ? 'Approve Stock Receiving'
                : 'Reject Stock Receiving'}
            </h3>
            <p className="page-copy">
              {stockReceivingReviewModal.request.referenceNumber || `RR-${stockReceivingReviewModal.request.id}`}{' '}
              from {stockReceivingReviewModal.request.supplierName || 'selected supplier'}.
              Approval will add the delivered quantities to inventory.
            </p>
            <div className="request-return-items review-return-items">
              <span>Delivered lines</span>
              {stockReceivingReviewModal.request.items.map((item) => (
                <div className="request-return-item" key={item.productId}>
                  <strong>{item.productName}</strong>
                  <span>
                    Qty {item.quantity} / Unit cost {formatCurrency(item.unitCost)}
                  </span>
                </div>
              ))}
            </div>
            <label className="field">
              <span>Quick Note</span>
              <div className="reason-chip-row">
                {presetReviewNotes.map((note) => (
                  <button
                    key={note}
                    className={
                      stockReceivingReviewModal.note === note ? 'reason-chip active' : 'reason-chip'
                    }
                    type="button"
                    onClick={() =>
                      setStockReceivingReviewModal((current) =>
                        current ? { ...current, note } : current,
                      )
                    }
                  >
                    {note}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={stockReceivingReviewModal.note}
                onChange={(event) =>
                  setStockReceivingReviewModal((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Add owner notes for this receiving decision."
              />
            </label>
            <div className="action-row">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setStockReceivingReviewModal(null)}
              >
                Close
              </button>
              <button
                className={
                  stockReceivingReviewModal.action === 'approve' ? 'primary-button' : 'danger-button'
                }
                type="button"
                disabled={mutation.isSubmitting}
                onClick={async () => {
                  const saved = await mutation.run(() =>
                    api.post(
                      `/stock-in/${stockReceivingReviewModal.request.id}/${stockReceivingReviewModal.action}`,
                      {
                        notes: stockReceivingReviewModal.note,
                      },
                    ),
                  )

                  if (saved) {
                    await refetchStockReceivingRequests()
                    setStockReceivingReviewModal(null)
                    showToast({
                      tone: 'success',
                      title:
                        stockReceivingReviewModal.action === 'approve'
                          ? 'Stock receiving approved'
                          : 'Stock receiving rejected',
                      message:
                        stockReceivingReviewModal.action === 'approve'
                          ? 'Delivered quantities were added to inventory.'
                          : 'Inventory was not changed.',
                    })
                  }
                }}
              >
                Confirm {stockReceivingReviewModal.action === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inventoryReviewModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Owner Review</p>
            <h3>
              {inventoryReviewModal.action === 'approve'
                ? 'Approve Inventory Request'
                : 'Reject Inventory Request'}
            </h3>
            <p className="page-copy">
              {inventoryReviewModal.request.productName}: stock will move from{' '}
              {inventoryReviewModal.request.previousQuantity} to{' '}
              {inventoryReviewModal.request.requestedQuantity} only if approved.
            </p>
            <label className="field">
              <span>Quick Note</span>
              <div className="reason-chip-row">
                {presetReviewNotes.map((note) => (
                  <button
                    key={note}
                    className={inventoryReviewModal.note === note ? 'reason-chip active' : 'reason-chip'}
                    type="button"
                    onClick={() =>
                      setInventoryReviewModal((current) => (current ? { ...current, note } : current))
                    }
                  >
                    {note}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={inventoryReviewModal.note}
                onChange={(event) =>
                  setInventoryReviewModal((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Add owner notes for this inventory decision."
              />
            </label>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => setInventoryReviewModal(null)}>
                Close
              </button>
              <button
                className={inventoryReviewModal.action === 'approve' ? 'primary-button' : 'danger-button'}
                type="button"
                disabled={mutation.isSubmitting}
                onClick={async () => {
                  const saved = await mutation.run(() =>
                    api.post(
                      `/inventory-adjustment-requests/${inventoryReviewModal.request.id}/${inventoryReviewModal.action}`,
                      {
                        notes: inventoryReviewModal.note,
                      },
                    ),
                  )

                  if (saved) {
                    await refetchInventoryRequests()
                    setInventoryReviewModal(null)
                    showToast({
                      tone: 'success',
                      title:
                        inventoryReviewModal.action === 'approve'
                          ? 'Inventory request approved'
                          : 'Inventory request rejected',
                      message: `${inventoryReviewModal.request.productName} request was ${inventoryReviewModal.action}d successfully.`,
                    })
                  }
                }}
              >
                Confirm {inventoryReviewModal.action === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Owner Review</p>
            <h3>{reviewModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}</h3>
            <p className="page-copy">
              {reviewModal.request.requestType} request for sale {reviewModal.request.saleNumber}.
              {reviewModal.request.requestedReturnItems.length > 0
                ? ' Approval will process only the listed return item quantities.'
                : ''}
            </p>
            {reviewModal.request.requestedReturnItems.length > 0 ? (
              <div className="request-return-items review-return-items">
                <span>Return lines to approve</span>
                {reviewModal.request.requestedReturnItems.map((item) => (
                  <div className="request-return-item" key={item.saleItemId}>
                    <strong>{item.productName}</strong>
                    <span>
                      Qty {item.quantity} / {item.condition}
                      {item.remarks ? ` / ${item.remarks}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="field">
              <span>Quick Note</span>
              <div className="reason-chip-row">
                {presetReviewNotes.map((note) => (
                  <button
                    key={note}
                    className={reviewModal.note === note ? 'reason-chip active' : 'reason-chip'}
                    type="button"
                    onClick={() =>
                      setReviewModal((current) => (current ? { ...current, note } : current))
                    }
                  >
                    {note}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={reviewModal.note}
                onChange={(event) =>
                  setReviewModal((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Add owner notes for this decision."
              />
            </label>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => setReviewModal(null)}>
                Close
              </button>
              <button
                className={reviewModal.action === 'approve' ? 'primary-button' : 'danger-button'}
                type="button"
                disabled={mutation.isSubmitting}
                onClick={async () => {
                  const saved = await mutation.run(() =>
                    api.post(`/sale-action-requests/${reviewModal.request.id}/${reviewModal.action}`, {
                      notes: reviewModal.note,
                    }),
                  )

                  if (saved) {
                    await refetch()
                    setReviewModal(null)
                    showToast({
                      tone: 'success',
                      title: reviewModal.action === 'approve' ? 'Request approved' : 'Request rejected',
                      message: `${reviewModal.request.saleNumber} request was ${reviewModal.action}d successfully.`,
                    })
                  }
                }}
              >
                Confirm {reviewModal.action === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageFrame>
  )
}
