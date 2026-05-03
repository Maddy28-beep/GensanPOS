import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { PageFrame } from '../components/PageFrame'
import { StatCard } from '../components/StatCard'
import { useApiMutation } from '../hooks/useApiMutation'
import { useApiData } from '../hooks/useApiData'
import { usePersistentState } from '../hooks/usePersistentState'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/datetime'
import { formatCurrency, openPrintWindow } from '../lib/receipt'
import { useConfirm } from '../state/ConfirmContext'
import { useToast } from '../state/ToastContext'
import type { Product, Sale } from '../types/entities'

const paymentMethods = [
  { label: 'Cash', value: 1 },
  { label: 'Online Bank', value: 3 },
  { label: 'QRPH', value: 6 },
  { label: 'Current Check', value: 7 },
  { label: 'Post-Dated Check (PDC)', value: 8 },
  { label: 'Charged / Utang', value: 9 },
]
const vatRate = 0.12
const whtRate = 0.01
type TaxMode = 'vat12' | 'wht1' | 'none' | 'manual'
type PaymentMode = 'cash' | 'qrph' | 'onlineBank' | 'currentCheck' | 'pdc' | 'credit' | 'mixed'

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function moneyInputValue(amount: number) {
  return roundMoney(amount).toFixed(2)
}

interface PaymentDraft {
  id: number
  paymentMethod: string
  amount: string
  referenceNumber: string
  bankName: string
  bankBranch: string
  checkNumber: string
  checkDate: string
  dueDays: string
  details: string
}

function createPaymentDraft(amount = '0', paymentMethod = '1'): Omit<PaymentDraft, 'id'> {
  return {
    paymentMethod,
    amount,
    referenceNumber: '',
    bankName: '',
    bankBranch: '',
    checkNumber: '',
    checkDate: '',
    dueDays: '',
    details: '',
  }
}

function getPaymentLabel(methodValue: string) {
  return paymentMethods.find((item) => String(item.value) === methodValue)?.label ?? 'Other'
}

export function PosPage() {
  const { confirm } = useConfirm()
  const { showToast } = useToast()
  const { data: products, isLoading, error } = useApiData<Product[]>('/products/pos', [])
  const mutation = useApiMutation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [discountAmount, setDiscountAmount] = usePersistentState('pos-discount', '0')
  const [taxMode, setTaxMode] = usePersistentState<TaxMode>('pos-tax-mode', 'none')
  const [manualTaxAmount, setManualTaxAmount] = usePersistentState('pos-manual-tax', '0')
  const [saleForm, setSaleForm] = usePersistentState('pos-sale-form', {
    customerName: '',
    customerAddress: '',
    customerTin: '',
    remarks: '',
    poNumber: '',
    terms: '',
  })
  const [paymentMode, setPaymentMode] = usePersistentState<PaymentMode>('pos-payment-mode', 'cash')
  const [cashReceived, setCashReceived] = usePersistentState('pos-cash-received', '0')
  const [paymentDraft, setPaymentDraft] = usePersistentState('pos-payment-draft', createPaymentDraft())
  const [paymentLines, setPaymentLines] = usePersistentState<PaymentDraft[]>('pos-payment-lines', [])
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)
  const [cart, setCart] = usePersistentState<
    Array<{ productId: number; name: string; price: number; unit: string; quantity: number }>
  >('pos-cart', [])
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const filteredProducts = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' || product.categoryName === selectedCategory
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query)

      return matchesCategory && matchesSearch
    })
  }, [products, deferredSearch, selectedCategory])

  const productCategories = useMemo(() => {
    const categories = products
      .map((product) => product.categoryName)
      .filter((category): category is string => Boolean(category?.trim()))

    return ['All', ...Array.from(new Set(categories)).sort()]
  }, [products])

  const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const discountValue = roundMoney(Math.max(0, Number(discountAmount) || 0))
  const taxableAmount = roundMoney(Math.max(0, subtotal - discountValue))
  const taxAmount =
    taxMode === 'vat12'
      ? roundMoney(taxableAmount * vatRate)
      : taxMode === 'wht1'
        ? -roundMoney(taxableAmount * whtRate)
      : taxMode === 'manual'
        ? roundMoney(Math.max(0, Number(manualTaxAmount) || 0))
        : 0
  const total = roundMoney(Math.max(0, taxableAmount + taxAmount))
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cashReceivedAmount = roundMoney(Math.max(0, Number(cashReceived) || 0))
  const effectivePaymentLines =
    paymentMode === 'cash'
      ? cashReceivedAmount > 0
        ? [{ id: 0, ...createPaymentDraft(cashReceived, '1') }]
        : []
      : paymentLines
  const totalPaid = roundMoney(
    effectivePaymentLines.reduce((sum, item) => sum + Number(item.amount), 0),
  )
  const balance = roundMoney(Math.max(0, total - totalPaid))
  const changeDue = roundMoney(Math.max(0, totalPaid - total))
  const isSinglePaymentMode = paymentMode !== 'cash' && paymentMode !== 'mixed'
  const selectedSingleDigitalMethod =
    paymentMode === 'qrph'
      ? '6'
      : paymentMode === 'onlineBank'
        ? '3'
        : paymentMode === 'currentCheck'
          ? '7'
          : paymentMode === 'pdc'
            ? '8'
            : paymentMode === 'credit'
              ? '9'
              : null
  const activePaymentMethod =
    isSinglePaymentMode && selectedSingleDigitalMethod
      ? selectedSingleDigitalMethod
      : paymentDraft.paymentMethod
  const showReferenceField = activePaymentMethod === '3' || activePaymentMethod === '6'
  const mixedPaymentMethods = paymentMethods
  const creditDueDays =
    paymentLines.find((line) => line.paymentMethod === '9')?.dueDays ||
    (activePaymentMethod === '9' ? paymentDraft.dueDays : '')
  const receiptTerms = creditDueDays
    ? `${creditDueDays} Days`
    : paymentMode === 'cash'
      ? 'Cash'
      : saleForm.terms.trim() || 'Paid'
  const showCustomerReceiptDetails = paymentMode !== 'cash'
  const currentEditingAmount =
    editingPaymentId !== null
      ? roundMoney(Number(paymentLines.find((line) => line.id === editingPaymentId)?.amount ?? 0))
      : 0
  const draftAmount = roundMoney(Math.max(0, Number(paymentDraft.amount) || 0))
  const hasPaymentInput =
    paymentMode === 'cash'
      ? cashReceivedAmount > 0
      : paymentLines.length > 0 || draftAmount > 0 || editingPaymentId !== null
  const hasInsufficientPayment = totalPaid + 0.005 < total
  const previewPaidAmount = roundMoney(
    paymentMode === 'cash'
      ? cashReceivedAmount
      : editingPaymentId !== null
        ? totalPaid - currentEditingAmount + draftAmount
        : paymentLines.length === 0
          ? draftAmount
          : totalPaid,
  )
  const hasPreviewInsufficientPayment = previewPaidAmount + 0.005 < total
  const previewChangeDue = roundMoney(Math.max(0, previewPaidAmount - total))
  const taxLabel =
    taxMode === 'vat12'
      ? 'VAT 12%'
      : taxMode === 'wht1'
        ? 'WHT 1%'
        : taxMode === 'manual'
          ? 'Manual Tax'
          : 'Tax'

  const paymentSummary = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const line of paymentLines) {
      const method = getPaymentLabel(line.paymentMethod)
      grouped.set(method, roundMoney((grouped.get(method) ?? 0) + Number(line.amount)))
    }

    return Array.from(grouped.entries())
  }, [paymentLines])

  const productStockById = useMemo(() => {
    const stock = new Map<number, number>()
    for (const product of products) {
      stock.set(product.id, product.quantityOnHand)
    }

    return stock
  }, [products])

  const productUnitById = useMemo(() => {
    const units = new Map<number, string>()
    for (const product of products) {
      units.set(product.id, product.unit || 'unit')
    }

    return units
  }, [products])

  const getCartQuantity = (productId: number) =>
    cart.find((item) => item.productId === productId)?.quantity ?? 0

  const addProductToCart = (product: Product) => {
    const cartQuantity = getCartQuantity(product.id)
    const remainingStock = Math.max(0, product.quantityOnHand - cartQuantity)

    if (remainingStock <= 0) {
      showToast({
        tone: 'error',
        title: 'No stock available',
        message: `${product.name} has no stock left.`,
      })
      return false
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, product.quantityOnHand),
              }
            : item,
        )
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit || 'unit',
          quantity: 1,
        },
      ]
    })

    return true
  }

  const addScannedProduct = () => {
    const code = search.trim().toLowerCase()
    if (!code) {
      return
    }

    const exactMatch = products.find((product) => product.sku.toLowerCase() === code)

    if (!exactMatch) {
      showToast({
        tone: 'error',
        title: 'Barcode not found',
        message: 'No product matches the scanned product code.',
      })
      return
    }

    if (addProductToCart(exactMatch)) {
      setSearch('')
      setSelectedCategory('All')
      searchInputRef.current?.focus()
      showToast({
        tone: 'success',
        title: 'Item added',
        message: `${exactMatch.name} was added to the cart.`,
      })
    }
  }

  const updateCartQuantity = (productId: number, quantity: number) => {
    const availableStock = productStockById.get(productId) ?? 0
    const nextQuantity = Math.min(Math.max(1, quantity), availableStock)

    setCart((current) =>
      current
        .map((entry) =>
          entry.productId === productId ? { ...entry, quantity: nextQuantity } : entry,
        )
        .filter((entry) => entry.quantity > 0),
    )
  }

  const resetTicket = () => {
    setCart([])
    setDiscountAmount('0')
    setTaxMode('none')
    setManualTaxAmount('0')
    setSaleForm({
      customerName: '',
      customerAddress: '',
      customerTin: '',
      remarks: '',
      poNumber: '',
      terms: '',
    })
    setPaymentMode('cash')
    setCashReceived('0')
    setPaymentLines([])
    setPaymentDraft(createPaymentDraft())
    setEditingPaymentId(null)
  }

  return (
    <PageFrame
      title="POS / Cashier"
      aside={<div className="badge">Cashier + Owner</div>}
    >
      <div className="pos-summary-grid">
        <StatCard label="Cart Lines" value={String(cart.length)} />
        <StatCard label="Items" value={String(itemCount)} />
        <StatCard label="Amount Due" value={formatCurrency(total)} />
        <StatCard label="Amount Paid" value={formatCurrency(totalPaid)} />
        <StatCard label="Change Due" value={formatCurrency(changeDue)} />
      </div>

      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <div className="pos-layout">
        <section className="panel catalog-panel">
          <div className="split-line">
            <h4>Products</h4>
            <span className="badge">{filteredProducts.length} available</span>
          </div>

          <div className="pos-category-strip" aria-label="Product categories">
            {productCategories.map((category) => (
              <button
                key={category}
                className={
                  selectedCategory === category ? 'category-chip active' : 'category-chip'
                }
                type="button"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="field search-field">
            <span>Search or scan barcode</span>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addScannedProduct()
                }
              }}
              placeholder="Scan barcode, or type product name/code"
            />
          </label>

          {isLoading ? <div className="subtle-panel">Loading products...</div> : null}
          {error ? <div className="error-panel">{error}</div> : null}

          <div className="list-stack top-gap catalog-list">
            {filteredProducts.map((product) => {
              const cartQuantity = getCartQuantity(product.id)
              const remainingStock = Math.max(0, product.quantityOnHand - cartQuantity)
              const isUnavailable = remainingStock <= 0

              return (
                <button
                  key={product.id}
                  className="list-button"
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => {
                    addProductToCart(product)
                  }}
                >
                  <div className="product-row">
                    <div className="product-main">
                      <strong>{product.name}</strong>
                      <span className={isUnavailable ? 'meta-chip stock-chip stock-chip-out' : 'meta-chip stock-chip'}>
                        Stock: {product.quantityOnHand} {product.unit || 'unit'}
                      </span>
                    </div>
                    <div className="product-meta product-meta-column">
                      <span className="meta-chip">Product Code: {product.sku}</span>
                      <span className="meta-chip">
                        Selling Price: {formatCurrency(product.price)}
                      </span>
                      {cartQuantity > 0 ? (
                        <span className="meta-chip">In Cart: {cartQuantity}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="add-hint" aria-hidden="true">
                    {isUnavailable ? 'No Stock' : '+ Add'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel ticket-panel sticky-panel">
          <div className="split-line">
            <h4>Current Ticket</h4>
            <button
              className="clear-cart-button"
              type="button"
              disabled={cart.length === 0}
              onClick={async () => {
                const accepted = await confirm({
                  title: 'Clear current cart?',
                  message: 'All unsaved items in this sale will be removed.',
                  confirmLabel: 'Clear Cart',
                  tone: 'danger',
                })

                if (!accepted) {
                  return
                }

                resetTicket()
                showToast({
                  tone: 'info',
                  title: 'Cart cleared',
                  message: 'The current ticket was cleared.',
                })
              }}
            >
              Clear Cart
            </button>
          </div>

          <div className="ticket-summary-grid">
            <div className="summary-card">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="summary-card">
              <span>Amount Due</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="empty-panel">No items</div>
          ) : (
            <div className="list-stack">
              {cart.map((item) => (
                <div className="list-row" key={item.productId}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {formatCurrency(item.price)} / {item.unit || productUnitById.get(item.productId) || 'unit'}
                    </span>
                    <span>
                      Available stock: {productStockById.get(item.productId) ?? 0}{' '}
                      {item.unit || productUnitById.get(item.productId) || 'unit'}
                    </span>
                  </div>
                  <div className="ticket-controls">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current
                            .map((entry) =>
                              entry.productId === item.productId
                                ? { ...entry, quantity: entry.quantity - 1 }
                                : entry,
                            )
                            .filter((entry) => entry.quantity > 0),
                        )
                      }
                    >
                      -
                    </button>
                    <input
                      className="quantity-input"
                      type="number"
                      min="1"
                      max={productStockById.get(item.productId) ?? 1}
                      value={item.quantity}
                      onChange={(event) => {
                        updateCartQuantity(item.productId, Number(event.target.value) || 1)
                      }}
                    />
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={item.quantity >= (productStockById.get(item.productId) ?? 0)}
                      onClick={() =>
                        updateCartQuantity(item.productId, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current.filter((entry) => entry.productId !== item.productId),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mini-grid">
            <label className="field">
              <span>Discount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Tax Option</span>
              <select
                value={taxMode}
                onChange={(event) =>
                  setTaxMode(event.target.value as TaxMode)
                }
              >
                <option value="none">No Tax</option>
                <option value="vat12">VAT 12%</option>
                <option value="wht1">Withholding Tax 1%</option>
                <option value="manual">Manual Tax Amount</option>
              </select>
            </label>
          </div>
          {taxMode === 'manual' ? (
            <label className="field">
              <span>Manual Tax Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualTaxAmount}
                onChange={(event) => setManualTaxAmount(event.target.value)}
              />
            </label>
          ) : (
            <div className="subtle-panel tax-note">
              {taxMode === 'vat12'
                ? `VAT is calculated at 12% of ${formatCurrency(taxableAmount)}.`
                : taxMode === 'wht1'
                  ? `WHT is deducted at 1% of ${formatCurrency(taxableAmount)}.`
                  : 'Tax is disabled for this sale.'}
            </div>
          )}

          <div className="panel nested-panel stack-form">
            <div className="split-line">
              <h4>Payments</h4>
              <span className="badge">Paid: {formatCurrency(totalPaid)}</span>
            </div>

            <div className="action-row">
              <button
                className={paymentMode === 'cash' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('cash')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0'))
                }}
              >
                Cash
              </button>
              <button
                className={paymentMode === 'qrph' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('qrph')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0', '6'))
                }}
              >
                QRPH
              </button>
              <button
                className={paymentMode === 'onlineBank' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('onlineBank')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0', '3'))
                }}
              >
                Online Bank
              </button>
              <button
                className={paymentMode === 'currentCheck' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('currentCheck')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0', '7'))
                }}
              >
                Current Check
              </button>
              <button
                className={paymentMode === 'pdc' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('pdc')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0', '8'))
                }}
              >
                PDC
              </button>
              <button
                className={paymentMode === 'credit' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('credit')
                  setEditingPaymentId(null)
                  setPaymentDraft(createPaymentDraft(balance > 0 ? moneyInputValue(balance) : '0', '9'))
                }}
              >
                Charged / Utang
              </button>
              <button
                className={paymentMode === 'mixed' ? 'primary-button' : 'ghost-button'}
                type="button"
                onClick={() => {
                  setPaymentMode('mixed')
                  setEditingPaymentId(null)
                  setPaymentDraft((current) => ({
                    paymentMethod:
                      current.paymentMethod === '4' ? '1' : current.paymentMethod || '1',
                    amount: balance > 0 ? moneyInputValue(balance) : current.amount,
                    referenceNumber: current.paymentMethod === '1' ? '' : current.referenceNumber,
                    bankName: current.bankName,
                    bankBranch: current.bankBranch,
                    checkNumber: current.checkNumber,
                    checkDate: current.checkDate,
                    dueDays: current.dueDays,
                    details: current.details,
                  }))
                }}
              >
                Mixed
              </button>
            </div>

            {paymentMode === 'cash' ? (
              <label className="field">
                <span>Cash Received</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                />
              </label>
            ) : (
              <>
                <div className="mini-grid">
                  {isSinglePaymentMode && selectedSingleDigitalMethod ? (
                    <div className="summary-card">
                      <span>Payment Method</span>
                      <strong>{getPaymentLabel(selectedSingleDigitalMethod)}</strong>
                    </div>
                  ) : (
                    <label className="field">
                      <span>Payment Method</span>
                      <select
                        value={paymentDraft.paymentMethod}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({
                            ...current,
                            paymentMethod: event.target.value,
                            referenceNumber:
                              event.target.value === '3' || event.target.value === '6'
                                ? current.referenceNumber
                                : '',
                          }))
                        }
                      >
                        {mixedPaymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentDraft.amount}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({ ...current, amount: event.target.value }))
                      }
                    />
                  </label>
                </div>

                {showReferenceField ? (
                  <label className="field">
                    <span>
                      {activePaymentMethod === '6'
                        ? 'QRPH Reference'
                        : activePaymentMethod === '3'
                          ? 'Online Bank Reference'
                          : 'Reference Number'}
                    </span>
                    <input
                      value={paymentDraft.referenceNumber}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({
                          ...current,
                          referenceNumber: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {['3', '7', '8'].includes(activePaymentMethod) ? (
                  <div className="mini-grid">
                    <label className="field">
                      <span>Bank Name</span>
                      <input
                        value={paymentDraft.bankName}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({ ...current, bankName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Branch</span>
                      <input
                        value={paymentDraft.bankBranch}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({ ...current, bankBranch: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {['7', '8'].includes(activePaymentMethod) ? (
                  <div className="mini-grid">
                    <label className="field">
                      <span>Check Number</span>
                      <input
                        value={paymentDraft.checkNumber}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({ ...current, checkNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Check Date</span>
                      <input
                        type="date"
                        value={paymentDraft.checkDate}
                        onChange={(event) =>
                          setPaymentDraft((current) => ({ ...current, checkDate: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                ) : null}

                {activePaymentMethod === '9' ? (
                  <label className="field">
                    <span>Days Before Due</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={paymentDraft.dueDays}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({ ...current, dueDays: event.target.value }))
                      }
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>Payment Details</span>
                  <input
                    value={paymentDraft.details}
                    placeholder="Optional notes"
                    onChange={(event) =>
                      setPaymentDraft((current) => ({ ...current, details: event.target.value }))
                    }
                  />
                </label>

                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    const amount = Number(paymentDraft.amount)
                    if (amount <= 0) {
                      mutation.setError('Payment amount must be greater than zero.')
                      return
                    }

                    const normalizedDraft = {
                      ...paymentDraft,
                      paymentMethod:
                        isSinglePaymentMode && selectedSingleDigitalMethod
                          ? selectedSingleDigitalMethod
                          : paymentDraft.paymentMethod,
                      referenceNumber:
                        ['3', '6'].includes(
                          isSinglePaymentMode && selectedSingleDigitalMethod
                            ? selectedSingleDigitalMethod
                            : paymentDraft.paymentMethod,
                        )
                          ? paymentDraft.referenceNumber
                          : '',
                    }

                    const nextPaidAmount = roundMoney(
                      editingPaymentId !== null
                        ? totalPaid - currentEditingAmount + amount
                        : totalPaid + amount
                    )
                    const nextRemaining = roundMoney(Math.max(0, total - nextPaidAmount))

                    if (editingPaymentId) {
                      setPaymentLines((current) =>
                        current.map((line) =>
                          line.id === editingPaymentId ? { ...line, ...normalizedDraft } : line,
                        ),
                      )
                      setEditingPaymentId(null)
                      showToast({
                        tone: 'success',
                        title: 'Payment updated',
                        message: 'The payment line was updated.',
                      })
                    } else {
                      setPaymentLines((current) => [
                        ...current,
                        {
                          id: Date.now(),
                          ...normalizedDraft,
                        },
                      ])
                      showToast({
                        tone: 'success',
                        title: 'Payment added',
                        message: 'A payment line was added to the ticket.',
                      })
                    }

                    mutation.clearMessages()
                    if (isSinglePaymentMode && selectedSingleDigitalMethod) {
                      setPaymentDraft(
                        createPaymentDraft(
                          nextRemaining > 0 ? moneyInputValue(nextRemaining) : '0',
                          selectedSingleDigitalMethod,
                        ),
                      )
                    } else {
                      setPaymentDraft(
                        createPaymentDraft(nextRemaining > 0 ? moneyInputValue(nextRemaining) : '0'),
                      )
                    }
                  }}
                >
                  {editingPaymentId ? 'Save Payment' : 'Add Payment'}
                </button>
              </>
            )}

            {cart.length > 0 && hasPaymentInput ? (
              <div className={hasPreviewInsufficientPayment ? 'error-panel' : 'subtle-panel'}>
                {hasPreviewInsufficientPayment
                  ? `Insufficient payment. Amount due is ${formatCurrency(total)} and amount entered is ${formatCurrency(previewPaidAmount)}.`
                  : `Payment is enough to continue. Change due is ${formatCurrency(previewChangeDue)}.`}
              </div>
            ) : null}

            {paymentMode !== 'cash' && paymentLines.length > 0 && editingPaymentId === null && draftAmount > 0 ? (
              <div className="subtle-panel">Draft payment not applied</div>
            ) : null}

            {paymentMode !== 'cash' && paymentSummary.length > 0 ? (
              <div className="receipt-panel">
                <div className="split-line">
                  <strong>Payment Breakdown</strong>
                  <span className="muted">{paymentLines.length} lines</span>
                </div>
                {paymentSummary.map(([method, amount]) => (
                  <div className="receipt-line" key={method}>
                    <span>{method}</span>
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {paymentMode === 'cash' ? (
              <div className="receipt-panel">
                <div className="receipt-line">
                  <span>Cash Received</span>
                  <strong>{formatCurrency(cashReceivedAmount)}</strong>
                </div>
                <div className="receipt-line">
                  <span>Change Due</span>
                  <strong>{formatCurrency(previewChangeDue)}</strong>
                </div>
              </div>
            ) : paymentLines.length > 0 ? (
              <div className="list-stack">
                {paymentLines.map((line) => (
                  <div className="list-row" key={line.id}>
                    <div>
                      <strong>{getPaymentLabel(line.paymentMethod)}</strong>
                      <span>
                        {formatCurrency(Number(line.amount))}
                        {line.referenceNumber ? ` / Ref ${line.referenceNumber}` : ''}
                        {line.bankName ? ` / Bank ${line.bankName}` : ''}
                        {line.bankBranch ? ` / Branch ${line.bankBranch}` : ''}
                        {line.checkNumber ? ` / Check ${line.checkNumber}` : ''}
                        {line.dueDays ? ` / Due ${line.dueDays} day(s)` : ''}
                      </span>
                      {line.details ? <span>{line.details}</span> : null}
                    </div>
                    <div className="action-row">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingPaymentId(line.id)
                          setPaymentDraft({
                            paymentMethod: line.paymentMethod,
                            amount: line.amount,
                            referenceNumber: line.referenceNumber,
                            bankName: line.bankName,
                            bankBranch: line.bankBranch,
                            checkNumber: line.checkNumber,
                            checkDate: line.checkDate,
                            dueDays: line.dueDays,
                            details: line.details,
                          })
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          setPaymentLines((current) =>
                            current.filter((payment) => payment.id !== line.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel">No payments</div>
            )}
          </div>

          {showCustomerReceiptDetails ? (
            <div className="panel nested-panel stack-form">
              <div className="split-line">
                <h4>Customer and Receipt Details</h4>
                <span className="badge">Printed on receipt</span>
              </div>
              <div className="subtle-panel">
                Terms are based on payment. Current terms: {receiptTerms}.
              </div>
              <div className="mini-grid">
                <label className="field">
                  <span>Customer Name</span>
                  <input
                    value={saleForm.customerName}
                    onChange={(event) =>
                      setSaleForm((current) => ({ ...current, customerName: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Address</span>
                  <input
                    value={saleForm.customerAddress}
                    onChange={(event) =>
                      setSaleForm((current) => ({ ...current, customerAddress: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="mini-grid">
                <label className="field">
                  <span>TIN</span>
                  <input
                    value={saleForm.customerTin}
                    onChange={(event) =>
                      setSaleForm((current) => ({ ...current, customerTin: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>PO Number</span>
                  <input
                    value={saleForm.poNumber}
                    onChange={(event) =>
                      setSaleForm((current) => ({ ...current, poNumber: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>Remarks</span>
                <input
                  value={saleForm.remarks}
                  onChange={(event) =>
                    setSaleForm((current) => ({ ...current, remarks: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="receipt-panel">
            <div className="split-line">
              <strong>Receipt Preview</strong>
              <span className="muted">{cart.length} line items</span>
            </div>
            <div className="receipt-line">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="receipt-line">
              <span>Discount</span>
              <strong>{formatCurrency(discountValue)}</strong>
            </div>
            <div className="receipt-line">
              <span>{taxLabel}</span>
              <strong>{formatCurrency(taxAmount)}</strong>
            </div>
            <div className="receipt-line total-line">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <div className="receipt-line">
              <span>Total Paid</span>
              <strong>{formatCurrency(totalPaid)}</strong>
            </div>
            <div className="receipt-line">
              <span>Balance</span>
              <strong>{formatCurrency(balance)}</strong>
            </div>
            <div className="receipt-line">
              <span>Change</span>
              <strong>{formatCurrency(changeDue)}</strong>
            </div>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={
              mutation.isSubmitting ||
              cart.length === 0 ||
              effectivePaymentLines.length === 0 ||
              hasInsufficientPayment
            }
            onClick={async () => {
              if (totalPaid < total) {
                mutation.setError('Checkout is blocked because the customer payment is less than the amount due.')
                return
              }

              const checkoutPayments =
                paymentMode === 'cash'
                  ? [
                      {
                        paymentMethod: 1,
                        amount: cashReceivedAmount,
                        referenceNumber: '',
                        bankName: '',
                        bankBranch: '',
                        checkNumber: '',
                        checkDate: null,
                        dueDays: null,
                        details: '',
                      },
                    ]
                  : paymentLines.map((line) => ({
                      paymentMethod: Number(line.paymentMethod),
                      amount: Number(line.amount),
                      referenceNumber: line.referenceNumber,
                      bankName: line.bankName,
                      bankBranch: line.bankBranch,
                      checkNumber: line.checkNumber,
                      checkDate: line.checkDate || null,
                      dueDays: line.dueDays ? Number(line.dueDays) : null,
                      details: line.details,
                    }))

              const response = await mutation.run(() =>
                api.post<Sale>('/pos/sales', {
                  items: cart.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                  })),
                  customerName: showCustomerReceiptDetails ? saleForm.customerName : '',
                  customerAddress: showCustomerReceiptDetails ? saleForm.customerAddress : '',
                  customerTin: showCustomerReceiptDetails ? saleForm.customerTin : '',
                  remarks: showCustomerReceiptDetails ? saleForm.remarks : '',
                  poNumber: showCustomerReceiptDetails ? saleForm.poNumber : '',
                  terms: receiptTerms,
                  payments: checkoutPayments,
                  discountAmount: discountValue,
                  taxAmount,
                }),
              )

              if (response) {
                setLastSale(response.data)
                setShowReceipt(true)
                resetTicket()
                showToast({
                  tone: 'success',
                  title: 'Sale completed',
                  message: `${response.data.saleNumber} was saved successfully.`,
                })
              }
            }}
          >
            Pay Now
          </button>

          {cart.length > 0 && effectivePaymentLines.length === 0 ? (
            <div className="subtle-panel">Payment required</div>
          ) : null}
        </section>
      </div>

      {showReceipt && lastSale ? (
        <div className="modal-backdrop print-hide">
          <div className="modal-card receipt-modal">
            <div className="split-line">
              <h3>Printable Receipt</h3>
              <button className="ghost-button" type="button" onClick={() => setShowReceipt(false)}>
                Close
              </button>
            </div>
            <div className="receipt-sheet" id="receipt-sheet">
              <h4>Gen Steel POS Receipt</h4>
              <p>Sale No: {lastSale.saleNumber}</p>
              <p>Customer: {lastSale.customerName || 'Walk-in Customer'}</p>
              <p>Address: {lastSale.customerAddress || '-'}</p>
              <p>TIN: {lastSale.customerTin || '-'}</p>
              <p>PO Number: {lastSale.poNumber || '-'}</p>
              <p>Terms: {lastSale.terms || '-'}</p>
              <p>Remarks: {lastSale.remarks || '-'}</p>
              <p>Cashier: {lastSale.cashierName}</p>
              <p>Date: {formatDateTime(lastSale.createdAtUtc)}</p>
              <div className="list-stack top-gap">
                {lastSale.items.map((item) => (
                  <div className="receipt-line" key={`${lastSale.id}-${item.productId}`}>
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
                  <strong>{formatCurrency(lastSale.subtotal)}</strong>
                </div>
                <div className="receipt-line">
                  <span>Discount</span>
                  <strong>{formatCurrency(lastSale.discountAmount)}</strong>
                </div>
                <div className="receipt-line">
                  <span>{lastSale.taxAmount < 0 ? 'WHT / Tax' : 'Tax'}</span>
                  <strong>{formatCurrency(lastSale.taxAmount)}</strong>
                </div>
                <div className="receipt-line total-line">
                  <span>Total</span>
                  <strong>{formatCurrency(lastSale.totalAmount)}</strong>
                </div>
                <div className="receipt-line">
                  <span>Total Paid</span>
                  <strong>
                    {formatCurrency(
                      lastSale.payments.reduce((sum, payment) => sum + payment.amount, 0),
                    )}
                  </strong>
                </div>
              </div>
              <div className="receipt-panel top-gap">
                <div className="split-line">
                  <strong>Payments</strong>
                  <span className="muted">{lastSale.payments.length} line(s)</span>
                </div>
                {lastSale.payments.map((payment, index) => (
                  <div className="receipt-line" key={`${lastSale.id}-payment-${index}`}>
                    <span>
                      {payment.paymentMethod}
                      {payment.referenceNumber ? ` / ${payment.referenceNumber}` : ''}
                      {payment.bankName ? ` / Bank ${payment.bankName}` : ''}
                      {payment.bankBranch ? ` / Branch ${payment.bankBranch}` : ''}
                      {payment.checkNumber ? ` / Check ${payment.checkNumber}` : ''}
                      {payment.dueDays ? ` / Due ${payment.dueDays} day(s)` : ''}
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
                  const opened = openPrintWindow(lastSale)
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
