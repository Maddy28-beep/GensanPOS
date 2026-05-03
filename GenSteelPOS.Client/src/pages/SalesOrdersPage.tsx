import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { api } from '../lib/api'
import { formatDateTime, parseApiDate } from '../lib/datetime'
import { formatCurrency } from '../lib/receipt'
import { useToast } from '../state/ToastContext'
import type { Product, Sale, SalesOrder } from '../types/entities'

const paymentMethods = [
  { label: 'Cash', value: 1 },
  { label: 'Card', value: 2 },
  { label: 'Transfer', value: 3 },
  { label: 'Mixed', value: 4 },
]

const presetReasons = [
  'Customer changed mind',
  'Wrong item encoded',
  'Duplicate transaction',
  'Requested by client',
]

export function SalesOrdersPage() {
  const { showToast } = useToast()
  const {
    data: orders,
    isLoading,
    error,
    refetch,
  } = useApiData<SalesOrder[]>('/sales-orders', [])
  const { data: products } = useApiData<Product[]>('/products/pos', [])
  const mutation = useApiMutation()
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    customerContact: '',
    customerAddress: '',
    remarks: '',
    productId: '0',
    quantity: '1',
    discountAmount: '0',
    taxAmount: '0',
  })
  const [draftItems, setDraftItems] = useState<
    Array<{ productId: number; productName: string; quantity: number; unitPrice: number }>
  >([])
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const [cancelModal, setCancelModal] = useState<{
    order: SalesOrder
    selectedReason: string
    notes: string
  } | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: '1',
    amount: '0',
    referenceNumber: '',
  })

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === Number(orderForm.productId)) ?? null,
    [orderForm.productId, products],
  )

  const subtotal = draftItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = subtotal - Number(orderForm.discountAmount) + Number(orderForm.taxAmount)
  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) =>
          parseApiDate(right.createdAtUtc).getTime() - parseApiDate(left.createdAtUtc).getTime(),
      ),
    [orders],
  )

  return (
    <PageFrame
      title="Sales Orders"
      description="Create customer orders ahead of checkout, then convert a pending order into a completed sale when payment is ready."
    >
      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <div className="two-column">
        <section className="panel stack-form">
          <div className="split-line">
            <h4>Create Sales Order</h4>
            <span className="badge">{draftItems.length} item(s)</span>
          </div>
          <label className="field">
            <span>Customer Name</span>
            <input
              value={orderForm.customerName}
              onChange={(event) =>
                setOrderForm((current) => ({ ...current, customerName: event.target.value }))
              }
            />
          </label>
          <div className="mini-grid">
            <label className="field">
              <span>Customer Contact</span>
              <input
                value={orderForm.customerContact}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, customerContact: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Customer Address</span>
              <input
                value={orderForm.customerAddress}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, customerAddress: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Remarks</span>
            <input
              value={orderForm.remarks}
              onChange={(event) =>
                setOrderForm((current) => ({ ...current, remarks: event.target.value }))
              }
            />
          </label>

          <div className="panel nested-panel stack-form">
            <h4>Add Order Line</h4>
            <div className="mini-grid">
              <label className="field">
                <span>Product</span>
                <select
                  value={orderForm.productId}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, productId: event.target.value }))
                  }
                >
                  <option value="0">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
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
                  value={orderForm.quantity}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="subtle-panel panel-note">
              {selectedProduct
                ? `${selectedProduct.sku} · ${formatCurrency(selectedProduct.price)} · Stock ${selectedProduct.quantityOnHand}`
                : 'Choose an active product to add it to the order.'}
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                if (!selectedProduct) {
                  mutation.setError('Select a valid product first.')
                  return
                }

                const quantity = Number(orderForm.quantity)
                if (quantity <= 0) {
                  mutation.setError('Quantity must be greater than zero.')
                  return
                }

                setDraftItems((current) => {
                  const existing = current.find((item) => item.productId === selectedProduct.id)
                  if (existing) {
                    return current.map((item) =>
                      item.productId === selectedProduct.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item,
                    )
                  }

                  return [
                    ...current,
                    {
                      productId: selectedProduct.id,
                      productName: selectedProduct.name,
                      quantity,
                      unitPrice: selectedProduct.price,
                    },
                  ]
                })

                mutation.clearMessages()
                showToast({
                  tone: 'success',
                  title: 'Order line added',
                  message: `${selectedProduct.name} was added to the draft order.`,
                })
                setOrderForm((current) => ({
                  ...current,
                  productId: '0',
                  quantity: '1',
                }))
              }}
            >
              Add Line
            </button>
          </div>

          {draftItems.length > 0 ? (
            <div className="list-stack">
              {draftItems.map((item) => (
                <div className="list-row" key={item.productId}>
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      Qty {item.quantity} · {formatCurrency(item.unitPrice)} each
                    </span>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      setDraftItems((current) =>
                        current.filter((entry) => entry.productId !== item.productId),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="subtle-panel">No order lines added yet.</div>
          )}

          <div className="mini-grid">
            <label className="field">
              <span>Discount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderForm.discountAmount}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, discountAmount: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Tax</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderForm.taxAmount}
                onChange={(event) =>
                  setOrderForm((current) => ({ ...current, taxAmount: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="receipt-panel">
            <div className="receipt-line">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="receipt-line">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={mutation.isSubmitting || draftItems.length === 0}
            onClick={async () => {
              const created = await mutation.run(() =>
                api.post('/sales-orders', {
                  customerName: orderForm.customerName,
                  customerContact: orderForm.customerContact,
                  customerAddress: orderForm.customerAddress,
                  remarks: orderForm.remarks,
                  discountAmount: Number(orderForm.discountAmount),
                  taxAmount: Number(orderForm.taxAmount),
                  items: draftItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                  })),
                }),
              )

              if (created) {
                setOrderForm({
                  customerName: '',
                  customerContact: '',
                  customerAddress: '',
                  remarks: '',
                  productId: '0',
                  quantity: '1',
                  discountAmount: '0',
                  taxAmount: '0',
                })
                setDraftItems([])
                await refetch()
                showToast({
                  tone: 'success',
                  title: 'Sales order created',
                  message: 'The customer order was saved successfully.',
                })
              }
            }}
          >
            Create Sales Order
          </button>
        </section>

        <section className="panel stack-form">
          <h4>Order Workflow</h4>
          <div className="subtle-panel">
            Pending orders can be converted into a sale later without affecting inventory until checkout.
          </div>
          <div className="subtle-panel">
            If the client cancels before checkout, use the order’s <strong>Client Cancelled</strong> button and enter the reason in the popup.
          </div>
        </section>
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No sales orders found."
        hasData={sortedOrders.length > 0}
      />

      {sortedOrders.length > 0 ? (
        <div className="timeline">
          {sortedOrders.map((order) => (
            <article className="panel stack-form" key={order.id}>
              <div className="split-line">
                <div>
                  <h4>{order.orderNumber}</h4>
                  <p className="muted">
                    {order.customerName}
                    {order.customerContact ? ` · ${order.customerContact}` : ''}
                  </p>
                </div>
                <span className="badge">{order.status}</span>
              </div>
              <p className="muted">
                Created by {order.createdByName} on {formatDateTime(order.createdAtUtc)}
              </p>
              {order.customerAddress ? <p>{order.customerAddress}</p> : null}
              {order.remarks ? <p>{order.remarks}</p> : null}
              <div className="list-stack">
                {order.items.map((item) => (
                  <div className="receipt-line" key={`${order.id}-${item.productId}`}>
                    <span>
                      {item.productName} ({item.quantity} x {formatCurrency(item.unitPrice)})
                    </span>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="receipt-panel">
                <div className="receipt-line">
                  <span>Total</span>
                  <strong>{formatCurrency(order.totalAmount)}</strong>
                </div>
                {order.convertedSaleNumber ? (
                  <div className="receipt-line">
                    <span>Converted Sale</span>
                    <strong>{order.convertedSaleNumber}</strong>
                  </div>
                ) : null}
              </div>
              {order.status === 'Pending' ? (
                <div className="action-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setSelectedOrder(order)
                      setPaymentForm({
                        paymentMethod: '1',
                        amount: order.totalAmount.toFixed(2),
                        referenceNumber: '',
                      })
                    }}
                  >
                    Convert To Sale
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutation.isSubmitting}
                    onClick={() =>
                      setCancelModal({
                        order,
                        selectedReason: '',
                        notes: '',
                      })
                    }
                  >
                    Client Cancelled
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {cancelModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p className="eyebrow">Client Cancellation</p>
            <h3>Cancel Sales Order</h3>
            <p className="page-copy">
              {cancelModal.order.orderNumber} will be marked as cancelled before checkout.
            </p>
            <label className="field">
              <span>Quick Reason</span>
              <div className="reason-chip-row">
                {presetReasons.map((reason) => (
                  <button
                    key={reason}
                    className={
                      cancelModal.selectedReason === reason ? 'reason-chip active' : 'reason-chip'
                    }
                    type="button"
                    onClick={() =>
                      setCancelModal((current) =>
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
                value={cancelModal.notes}
                onChange={(event) =>
                  setCancelModal((current) =>
                    current ? { ...current, notes: event.target.value } : current,
                  )
                }
                placeholder="Add more details if needed."
              />
            </label>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => setCancelModal(null)}>
                Close
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={
                  mutation.isSubmitting ||
                  (!cancelModal.selectedReason.trim() && !cancelModal.notes.trim())
                }
                onClick={async () => {
                  const reason = [cancelModal.selectedReason.trim(), cancelModal.notes.trim()]
                    .filter(Boolean)
                    .join(' - ')
                  const cancelled = await mutation.run(() =>
                    api.post(`/sales-orders/${cancelModal.order.id}/cancel`, {
                      reason,
                    }),
                  )

                  if (cancelled) {
                    await refetch()
                    setCancelModal(null)
                    showToast({
                      tone: 'success',
                      title: 'Sales order cancelled',
                      message: `${cancelModal.order.orderNumber} was cancelled successfully.`,
                    })
                  }
                }}
              >
                Confirm Client Cancellation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="modal-backdrop print-hide">
          <div className="modal-card">
            <div className="split-line">
              <h3>Convert {selectedOrder.orderNumber} To Sale</h3>
              <button className="ghost-button" type="button" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
            <div className="receipt-panel">
              <div className="receipt-line">
                <span>Customer</span>
                <strong>{selectedOrder.customerName}</strong>
              </div>
              <div className="receipt-line">
                <span>Total Due</span>
                <strong>{formatCurrency(selectedOrder.totalAmount)}</strong>
              </div>
            </div>
            <div className="mini-grid">
              <label className="field">
                <span>Payment Method</span>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))
                  }
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Reference Number</span>
              <input
                value={paymentForm.referenceNumber}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    referenceNumber: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={mutation.isSubmitting}
              onClick={async () => {
                const converted = await mutation.run(() =>
                  api.post<Sale>(`/sales-orders/${selectedOrder.id}/convert-to-sale`, {
                    payments: [
                      {
                        paymentMethod: Number(paymentForm.paymentMethod),
                        amount: Number(paymentForm.amount),
                        referenceNumber: paymentForm.referenceNumber,
                      },
                    ],
                  }),
                )

                if (converted) {
                  setSelectedOrder(null)
                  await refetch()
                  showToast({
                    tone: 'success',
                    title: 'Order converted',
                    message: `${selectedOrder.orderNumber} was converted into ${converted.data.saleNumber}.`,
                  })
                }
              }}
            >
              Complete Checkout
            </button>
          </div>
        </div>
      ) : null}
    </PageFrame>
  )
}
