import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/receipt'
import { useConfirm } from '../state/ConfirmContext'
import { useToast } from '../state/ToastContext'
import type { Category, Product, PurchaseOrder, StockInRecord, Supplier } from '../types/entities'

const productUnitOptions = ['pcs', 'sheet', 'plate', 'pipe', 'tube', 'bar', 'kg', 'meter', 'set', 'box']

export function PurchaseOrdersPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const {
    data: orders,
    isLoading,
    error,
    refetch,
  } = useApiData<PurchaseOrder[]>('/purchase-orders', [])
  const { data: suppliers, refetch: refetchSuppliers } = useApiData<Supplier[]>('/suppliers', [])
  const { data: products, refetch: refetchProducts } = useApiData<Product[]>('/products', [])
  const { data: categories, refetch: refetchCategories } = useApiData<Category[]>(
    '/categories',
    [],
  )
  const mutation = useApiMutation()
  const [form, setForm] = useState({
    supplierId: '0',
    remarks: '',
    productId: '0',
    quantity: '1',
    unitCost: '0',
  })
  const [draftItems, setDraftItems] = useState<
    Array<{ productId: number; productName: string; quantity: number; unitCost: number }>
  >([])
  const [actionReason, setActionReason] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [cancelOrder, setCancelOrder] = useState<PurchaseOrder | null>(null)
  const [receiveRemarks, setReceiveRemarks] = useState('')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    address: '',
  })
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    costPrice: '0',
    price: '0',
    unit: 'pcs',
    categoryId: '0',
    reorderLevel: '0',
    location: '',
  })
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === Number(form.productId)) ?? null,
    [form.productId, products],
  )

  const estimatedCost = draftItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)

  return (
    <PageFrame
      title="Purchase Orders"
      description="Stage supplier purchase commitments first, then receive a pending order into a real stock-in transaction when goods arrive."
      aside={<div className="badge">Owner Only</div>}
    >
      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <div className="two-column">
        <section className="panel stack-form">
          <div className="split-line">
            <h4>Create Purchase Order</h4>
            <span className="badge">{draftItems.length} item(s)</span>
          </div>
          <div className="supplier-picker">
            <label className="field">
              <span>Supplier</span>
              <select
                value={form.supplierId}
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
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowSupplierForm((current) => !current)}
            >
              {showSupplierForm ? 'Hide New Supplier' : 'New Supplier'}
            </button>
          </div>
          {showSupplierForm ? (
            <div className="panel nested-panel stack-form quick-supplier-panel">
              <div className="split-line">
                <h4>New Supplier</h4>
                <span className="badge">Saved to supplier list</span>
              </div>
              <div className="mini-grid">
                <label className="field">
                  <span>Supplier Name</span>
                  <input
                    value={supplierForm.name}
                    onChange={(event) =>
                      setSupplierForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Contact Person</span>
                  <input
                    value={supplierForm.contactPerson}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        contactPerson: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="mini-grid">
                <label className="field">
                  <span>Contact Number</span>
                  <input
                    value={supplierForm.contactNumber}
                    onChange={(event) =>
                      setSupplierForm((current) => ({
                        ...current,
                        contactNumber: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    value={supplierForm.email}
                    onChange={(event) =>
                      setSupplierForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Address</span>
                <input
                  value={supplierForm.address}
                  onChange={(event) =>
                    setSupplierForm((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={mutation.isSubmitting || !supplierForm.name.trim()}
                onClick={async () => {
                  const created = await mutation.run(
                    () =>
                      api.post<Supplier>('/suppliers', {
                        ...supplierForm,
                        name: supplierForm.name.trim(),
                      }),
                    'Supplier created.',
                  )

                  if (created) {
                    await refetchSuppliers()
                    setForm((current) => ({
                      ...current,
                      supplierId: String(created.data.id),
                    }))
                    setSupplierForm({
                      name: '',
                      contactPerson: '',
                      contactNumber: '',
                      email: '',
                      address: '',
                    })
                    setShowSupplierForm(false)
                    showToast({
                      tone: 'success',
                      title: 'Supplier added',
                      message: `${created.data.name} is selected for this purchase order.`,
                    })
                  }
                }}
              >
                Save and Select Supplier
              </button>
            </div>
          ) : null}
          <label className="field">
            <span>Remarks</span>
            <input
              value={form.remarks}
              onChange={(event) =>
                setForm((current) => ({ ...current, remarks: event.target.value }))
              }
            />
          </label>

          <div className="panel nested-panel stack-form">
            <h4>Add Purchase Line</h4>
            <div className="supplier-picker">
              <label className="field">
                <span>Product</span>
                <select
                  value={form.productId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, productId: event.target.value }))
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
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowProductForm((current) => !current)}
              >
                {showProductForm ? 'Hide New Product' : 'New Product'}
              </button>
            </div>
            {showProductForm ? (
              <div className="panel nested-panel stack-form quick-supplier-panel">
                <div className="split-line">
                  <h4>New Product</h4>
                  <span className="badge">Adds to products and inventory</span>
                </div>
                <div className="mini-grid">
                  <label className="field">
                    <span>Product Code</span>
                    <input
                      value={productForm.sku}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, sku: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Product Name</span>
                    <input
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="mini-grid">
                  <label className="field">
                    <span>Cost Price</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.costPrice}
                      onChange={(event) =>
                        setProductForm((current) => ({
                          ...current,
                          costPrice: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Selling Price</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={productForm.price}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, price: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="mini-grid">
                  <label className="field">
                    <span>Unit</span>
                    <select
                      value={productForm.unit}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, unit: event.target.value }))
                      }
                    >
                      {productUnitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="supplier-picker compact-picker">
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={productForm.categoryId}
                        onChange={(event) =>
                          setProductForm((current) => ({
                            ...current,
                            categoryId: event.target.value,
                          }))
                        }
                      >
                        <option value="0">Select category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setShowCategoryForm((current) => !current)}
                    >
                      {showCategoryForm ? 'Hide' : 'New'}
                    </button>
                  </div>
                </div>
                {showCategoryForm ? (
                  <div className="panel nested-panel stack-form quick-supplier-panel">
                    <div className="split-line">
                      <h4>New Category</h4>
                      <span className="badge">Reusable for products</span>
                    </div>
                    <div className="mini-grid">
                      <label className="field">
                        <span>Category Name</span>
                        <input
                          value={categoryForm.name}
                          onChange={(event) =>
                            setCategoryForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <input
                          value={categoryForm.description}
                          onChange={(event) =>
                            setCategoryForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={mutation.isSubmitting || !categoryForm.name.trim()}
                      onClick={async () => {
                        const created = await mutation.run(
                          () =>
                            api.post<Category>('/categories', {
                              name: categoryForm.name.trim(),
                              description: categoryForm.description,
                            }),
                          'Category created.',
                        )

                        if (created) {
                          await refetchCategories()
                          setProductForm((current) => ({
                            ...current,
                            categoryId: String(created.data.id),
                          }))
                          setCategoryForm({ name: '', description: '' })
                          setShowCategoryForm(false)
                          showToast({
                            tone: 'success',
                            title: 'Category added',
                            message: `${created.data.name} is selected for this product.`,
                          })
                        }
                      }}
                    >
                      Save and Select Category
                    </button>
                  </div>
                ) : null}
                <div className="mini-grid">
                  <label className="field">
                    <span>Reorder Level</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productForm.reorderLevel}
                      onChange={(event) =>
                        setProductForm((current) => ({
                          ...current,
                          reorderLevel: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <input
                      value={productForm.location}
                      onChange={(event) =>
                        setProductForm((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Description</span>
                  <input
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    mutation.isSubmitting ||
                    !productForm.sku.trim() ||
                    !productForm.name.trim() ||
                    Number(productForm.price) <= 0 ||
                    Number(productForm.categoryId) <= 0
                  }
                  onClick={async () => {
                    const created = await mutation.run(
                      () =>
                        api.post<Product>('/products', {
                          sku: productForm.sku.trim(),
                          name: productForm.name.trim(),
                          description: productForm.description,
                          costPrice: Number(productForm.costPrice),
                          price: Number(productForm.price),
                          unit: productForm.unit,
                          categoryId: Number(productForm.categoryId),
                          initialQuantity: 0,
                          reorderLevel: Number(productForm.reorderLevel),
                          location: productForm.location,
                        }),
                      'Product created.',
                    )

                    if (created) {
                      await refetchProducts()
                      setForm((current) => ({
                        ...current,
                        productId: String(created.data.id),
                        unitCost: String(created.data.costPrice),
                      }))
                      setProductForm({
                        sku: '',
                        name: '',
                        description: '',
                        costPrice: '0',
                        price: '0',
                        unit: 'pcs',
                        categoryId: '0',
                        reorderLevel: '0',
                        location: '',
                      })
                      setCategoryForm({ name: '', description: '' })
                      setShowCategoryForm(false)
                      setShowProductForm(false)
                      showToast({
                        tone: 'success',
                        title: 'Product added',
                        message: `${created.data.name} is ready for this purchase line.`,
                      })
                    }
                  }}
                >
                  Save and Select Product
                </button>
              </div>
            ) : null}
            <div className="mini-grid">
              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, unitCost: event.target.value }))
                  }
                />
              </label>
              <div className="subtle-panel panel-note">
                {selectedProduct
                  ? `${selectedProduct.sku} · current stock ${selectedProduct.quantityOnHand}`
                  : 'Choose a product to add it to this purchase order.'}
              </div>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                if (!selectedProduct) {
                  mutation.setError('Select a valid product first.')
                  return
                }

                const quantity = Number(form.quantity)
                const unitCost = Number(form.unitCost)

                if (quantity <= 0) {
                  mutation.setError('Quantity must be greater than zero.')
                  return
                }

                setDraftItems((current) => {
                  const existing = current.find((item) => item.productId === selectedProduct.id)
                  if (existing) {
                    return current.map((item) =>
                      item.productId === selectedProduct.id
                        ? { ...item, quantity: item.quantity + quantity, unitCost }
                        : item,
                    )
                  }

                  return [
                    ...current,
                    {
                      productId: selectedProduct.id,
                      productName: selectedProduct.name,
                      quantity,
                      unitCost,
                    },
                  ]
                })

                mutation.clearMessages()
                showToast({
                  tone: 'success',
                  title: 'Purchase line added',
                  message: `${selectedProduct.name} was added to the purchase order draft.`,
                })
                setForm((current) => ({
                  ...current,
                  productId: '0',
                  quantity: '1',
                  unitCost: '0',
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
                      Qty {item.quantity} @ {formatCurrency(item.unitCost)}
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
            <div className="subtle-panel">No purchase lines added yet.</div>
          )}

          <div className="receipt-panel">
            <div className="receipt-line">
              <span>Estimated Cost</span>
              <strong>{formatCurrency(estimatedCost)}</strong>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={mutation.isSubmitting || draftItems.length === 0}
            onClick={async () => {
              const created = await mutation.run(() =>
                api.post('/purchase-orders', {
                  supplierId: Number(form.supplierId),
                  remarks: form.remarks,
                  items: draftItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                  })),
                }),
              )

              if (created) {
                setForm({
                  supplierId: '0',
                  remarks: '',
                  productId: '0',
                  quantity: '1',
                  unitCost: '0',
                })
                setDraftItems([])
                await refetch()
                showToast({
                  tone: 'success',
                  title: 'Purchase order created',
                  message: 'The supplier order was saved successfully.',
                })
              }
            }}
          >
            Create Purchase Order
          </button>
        </section>

        <section className="panel stack-form">
          <h4>Pending Owner Actions</h4>
          <div className="subtle-panel">
            Receive delivered orders into inventory or cancel orders that will no longer be fulfilled.
          </div>
        </section>
      </div>

      <DataState
        isLoading={isLoading}
        error={error}
        emptyMessage="No purchase orders found."
        hasData={orders.length > 0}
      />

      {orders.length > 0 ? (
        <div className="timeline">
          {orders.map((order) => (
            <article className="panel stack-form" key={order.id}>
              <div className="split-line">
                <div>
                  <h4>{order.orderNumber}</h4>
                  <p className="muted">{order.supplierName}</p>
                </div>
                <span className="badge">{order.status}</span>
              </div>
              <p className="muted">
                Created by {order.createdByName} on {new Date(order.createdAtUtc).toLocaleString()}
              </p>
              {order.remarks ? <p>{order.remarks}</p> : null}
              <div className="list-stack">
                {order.items.map((item) => (
                  <div className="receipt-line" key={`${order.id}-${item.productId}`}>
                    <span>
                      {item.productName} ({item.quantity} x {formatCurrency(item.unitCost)})
                    </span>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="receipt-panel">
                <div className="receipt-line">
                  <span>Estimated Cost</span>
                  <strong>{formatCurrency(order.totalEstimatedCost)}</strong>
                </div>
                {order.receivedStockInReferenceNumber ? (
                  <div className="receipt-line">
                    <span>Received As</span>
                    <strong>{order.receivedStockInReferenceNumber}</strong>
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
                      setReceiveRemarks(`Received from purchase order ${order.orderNumber}.`)
                    }}
                  >
                    Receive Into Stock
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    disabled={mutation.isSubmitting}
                    onClick={() => {
                      setCancelOrder(order)
                      setActionReason('')
                    }}
                  >
                    Cancel Order
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="modal-backdrop print-hide">
          <div className="modal-card">
            <div className="split-line">
              <h3>Receive {selectedOrder.orderNumber}</h3>
              <button className="ghost-button" type="button" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
            <div className="receipt-panel">
              <div className="receipt-line">
                <span>Supplier</span>
                <strong>{selectedOrder.supplierName}</strong>
              </div>
              <div className="receipt-line">
                <span>Estimated Cost</span>
                <strong>{formatCurrency(selectedOrder.totalEstimatedCost)}</strong>
              </div>
            </div>
            <label className="field">
              <span>Receiving Remarks</span>
              <input
                value={receiveRemarks}
                onChange={(event) => setReceiveRemarks(event.target.value)}
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={mutation.isSubmitting}
              onClick={async () => {
                const received = await mutation.run(() =>
                  api.post<StockInRecord>(`/purchase-orders/${selectedOrder.id}/receive`, {
                    remarks: receiveRemarks,
                  }),
                )

                if (received) {
                  setSelectedOrder(null)
                  await refetch()
                  showToast({
                    tone: 'success',
                    title: 'Purchase order received',
                    message: `${selectedOrder.orderNumber} was received into ${received.data.referenceNumber}.`,
                  })
                }
              }}
            >
              Confirm Receiving
            </button>
          </div>
        </div>
      ) : null}

      {cancelOrder ? (
        <div className="modal-backdrop print-hide">
          <div className="modal-card">
            <div className="split-line">
              <h3>Cancel {cancelOrder.orderNumber}</h3>
              <button className="ghost-button" type="button" onClick={() => setCancelOrder(null)}>
                Close
              </button>
            </div>
            <div className="receipt-panel">
              <div className="receipt-line">
                <span>Supplier</span>
                <strong>{cancelOrder.supplierName}</strong>
              </div>
              <div className="receipt-line">
                <span>Estimated Cost</span>
                <strong>{formatCurrency(cancelOrder.totalEstimatedCost)}</strong>
              </div>
            </div>
            <label className="field">
              <span>Cancellation Reason</span>
              <input
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
              />
            </label>
            <button
              className="danger-button"
              type="button"
              disabled={mutation.isSubmitting || !actionReason.trim()}
              onClick={async () => {
                const accepted = await confirm({
                  title: 'Cancel this purchase order?',
                  message: `Order ${cancelOrder.orderNumber} will be cancelled.`,
                  confirmLabel: 'Cancel Order',
                  tone: 'danger',
                })

                if (!accepted) {
                  return
                }

                const cancelled = await mutation.run(() =>
                  api.post(`/purchase-orders/${cancelOrder.id}/cancel`, {
                    reason: actionReason.trim(),
                  }),
                )

                if (cancelled) {
                  await refetch()
                  setCancelOrder(null)
                  setActionReason('')
                  showToast({
                    tone: 'success',
                    title: 'Purchase order cancelled',
                    message: `${cancelOrder.orderNumber} was cancelled successfully.`,
                  })
                }
              }}
            >
              Confirm Cancellation
            </button>
          </div>
        </div>
      ) : null}
    </PageFrame>
  )
}
