import { useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { StatCard } from '../components/StatCard'
import { useApiData } from '../hooks/useApiData'
import { useApiMutation } from '../hooks/useApiMutation'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/datetime'
import { formatCurrency } from '../lib/receipt'
import { useToast } from '../state/ToastContext'
import type { ReturnRecord, Sale } from '../types/entities'

interface DraftReturnLine {
  saleItemId: number
  quantity: string
  remarks: string
}

export function ReturnsPage() {
  const { showToast } = useToast()
  const sales = useApiData<Sale[]>('/sales', [])
  const returns = useApiData<ReturnRecord[]>('/returns', [])
  const mutation = useApiMutation()
  const [saleSearch, setSaleSearch] = useState('')
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)
  const [remarks, setRemarks] = useState('')
  const [draftLines, setDraftLines] = useState<Record<number, DraftReturnLine>>({})

  const returnableSales = useMemo(
    () =>
      sales.data.filter(
        (sale) =>
          sale.status !== 'Cancelled' &&
          sale.status !== 'Voided' &&
          sale.items.some((item) => item.remainingReturnableQuantity > 0),
      ),
    [sales.data],
  )

  const filteredSales = useMemo(() => {
    const normalized = saleSearch.trim().toLowerCase()
    return returnableSales.filter((sale) => {
      if (!normalized) {
        return true
      }

      return (
        sale.saleNumber.toLowerCase().includes(normalized) ||
        sale.customerName.toLowerCase().includes(normalized) ||
        sale.cashierName.toLowerCase().includes(normalized)
      )
    })
  }, [returnableSales, saleSearch])

  const selectedSale = useMemo(
    () => returnableSales.find((sale) => sale.id === selectedSaleId) ?? null,
    [returnableSales, selectedSaleId],
  )

  const selectedReturnableItems = selectedSale?.items.filter((item) => item.remainingReturnableQuantity > 0) ?? []

  const draftCount = useMemo(
    () =>
      Object.values(draftLines).filter((line) => {
        const quantity = Number(line.quantity)
        return quantity > 0
      }).length,
    [draftLines],
  )

  const sortedReturns = useMemo(
    () => [...returns.data].sort((left, right) => right.createdAtUtc.localeCompare(left.createdAtUtc)),
    [returns.data],
  )
  const returnSummary = useMemo(() => {
    const totalReturns = sortedReturns.length
    const totalAmount = sortedReturns.reduce((sum, record) => sum + record.totalReturnAmount, 0)
    return { totalReturns, totalAmount }
  }, [sortedReturns])

  const updateDraftLine = (saleItemId: number, updater: (current: DraftReturnLine) => DraftReturnLine) => {
    setDraftLines((current) => {
      const existing = current[saleItemId] ?? {
        saleItemId,
        quantity: '',
        remarks: '',
      }

      return {
        ...current,
        [saleItemId]: updater(existing),
      }
    })
  }

  const resetForm = () => {
    setRemarks('')
    setDraftLines({})
    setSelectedSaleId(null)
  }

  return (
    <PageFrame
      title="Returns"
      description="Owner-only GRS processing for good-condition item returns with original invoice reference and preserved sales history."
    >
      <div className="subtle-panel">
        Goods Return Slip records reference the original invoice. Only good-condition items can be returned and added back to inventory. Damaged items are not accepted as returns.
      </div>

      <div className="stats-grid compact-stats">
        <StatCard label="Return Records" value={String(returnSummary.totalReturns)} />
        <StatCard label="Returned Amount" value={formatCurrency(returnSummary.totalAmount)} />
        <StatCard label="Slip Type" value="GRS" />
        <StatCard label="Returnable Sales" value={String(returnableSales.length)} />
      </div>

      {mutation.error ? <div className="error-panel">{mutation.error}</div> : null}

      <div className="two-column">
        <section className="panel stack-form">
          <div className="split-line">
            <h4>Create Return</h4>
            <span className="badge">{draftCount} line(s) ready</span>
          </div>

          <label className="field search-field">
            <span>Search Returnable Sales</span>
            <input
              value={saleSearch}
              onChange={(event) => setSaleSearch(event.target.value)}
              placeholder="Search sale number, customer, or cashier"
            />
          </label>

          <label className="field">
            <span>Select Sale</span>
            <select
              value={selectedSaleId ?? ''}
              onChange={(event) => {
                setSelectedSaleId(event.target.value ? Number(event.target.value) : null)
                setDraftLines({})
              }}
            >
              <option value="">Choose a returnable sale</option>
              {filteredSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.saleNumber} / {sale.customerName || 'Walk-in Customer'} / {formatCurrency(sale.totalAmount)}
                </option>
              ))}
            </select>
          </label>

          {selectedSale ? (
            <div className="section-stack">
              <div className="summary-block">
                <strong>{selectedSale.saleNumber}</strong>
                <span>Customer: {selectedSale.customerName || 'Walk-in Customer'}</span>
                <span>Status: {selectedSale.status}</span>
                <span>Created At: {formatDateTime(selectedSale.createdAtUtc)}</span>
                <span>Already Returned: {formatCurrency(selectedSale.totalReturnedAmount)}</span>
              </div>

              <div className="returns-summary-grid">
                <div className="summary-card">
                  <span>Sale Total</span>
                  <strong>{formatCurrency(selectedSale.totalAmount)}</strong>
                </div>
                <div className="summary-card">
                  <span>Returnable Items</span>
                  <strong>{selectedReturnableItems.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Items Sold</span>
                  <strong>{selectedSale.items.length}</strong>
                </div>
              </div>

              <label className="field">
                <span>Return Remarks</span>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Reason for this return batch"
                />
              </label>

              <div className="list-stack">
                {selectedReturnableItems.map((item) => {
                  const draft = draftLines[item.saleItemId] ?? {
                    saleItemId: item.saleItemId,
                    quantity: '',
                    remarks: '',
                  }

                  return (
                    <article className="panel nested-panel" key={item.saleItemId}>
                      <div className="split-line">
                        <div className="table-title-cell">
                          <strong>{item.productName}</strong>
                          <span>
                            Sold {item.quantity} / Returned {item.returnedQuantity} / Remaining {item.remainingReturnableQuantity}
                          </span>
                        </div>
                        <span className="badge">{formatCurrency(item.unitPrice)}</span>
                      </div>

                      <div className="mini-grid">
                        <label className="field">
                          <span>Return Quantity</span>
                          <input
                            type="number"
                            min="0"
                            max={item.remainingReturnableQuantity}
                            step="0.01"
                            value={draft.quantity}
                            onChange={(event) =>
                              updateDraftLine(item.saleItemId, (current) => ({
                                ...current,
                                quantity: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="summary-card">
                          <span>Condition</span>
                          <strong>Good only</strong>
                        </div>
                      </div>

                      <label className="field">
                        <span>Line Remarks</span>
                        <input
                          value={draft.remarks}
                          onChange={(event) =>
                            updateDraftLine(item.saleItemId, (current) => ({
                              ...current,
                              remarks: event.target.value,
                            }))
                          }
                          placeholder="Optional notes for this item"
                        />
                      </label>
                    </article>
                  )
                })}
              </div>

              <div className="action-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={mutation.isSubmitting}
                  onClick={async () => {
                    const payloadItems = selectedReturnableItems
                      .map((item) => {
                        const draft = draftLines[item.saleItemId]
                        const quantity = Number(draft?.quantity ?? 0)

                        return {
                          saleItemId: item.saleItemId,
                          quantity,
                          condition: 1,
                          remarks: draft?.remarks?.trim() ?? '',
                          maxQuantity: item.remainingReturnableQuantity,
                        }
                      })
                      .filter((item) => item.quantity > 0)

                    if (payloadItems.length === 0) {
                      mutation.setError('Add at least one return line with a quantity greater than zero.')
                      return
                    }

                    const invalidItem = payloadItems.find((item) => item.quantity > item.maxQuantity)
                    if (invalidItem) {
                      mutation.setError('One or more return quantities exceed the remaining returnable quantity.')
                      return
                    }

                    const saved = await mutation.run(() =>
                      api.post('/returns', {
                        saleId: selectedSale.id,
                        remarks: remarks.trim(),
                        items: payloadItems.map(({ maxQuantity, ...item }) => item),
                      }),
                    )

                    if (saved) {
                      await Promise.all([sales.refetch(), returns.refetch()])
                      showToast({
                        tone: 'success',
                        title: 'Return processed',
                        message: `Return saved for ${selectedSale.saleNumber}.`,
                      })
                      resetForm()
                    }
                  }}
                >
                  Process Return
                </button>
                <button className="ghost-button" type="button" onClick={resetForm}>
                  Reset Form
                </button>
              </div>
            </div>
          ) : (
            <div className="subtle-panel">
              Select a sale with remaining returnable quantity to start a return.
            </div>
          )}
        </section>

        <section className="panel stack-form">
          <div className="split-line">
            <h4>Return History</h4>
            <span className="badge">{sortedReturns.length} record(s)</span>
          </div>

          <DataState
            isLoading={sales.isLoading || returns.isLoading}
            error={sales.error ?? returns.error}
            emptyMessage="No return records found."
            hasData={sortedReturns.length > 0}
          />

          {sortedReturns.length > 0 ? (
            <div className="list-stack">
              {sortedReturns.map((record) => (
                <article className="panel nested-panel" key={record.id}>
                  <div className="split-line">
                    <div className="table-title-cell">
                      <strong>{record.returnNumber}</strong>
                      <span>
                        {record.saleNumber} / {record.processedByName}
                      </span>
                    </div>
                    <span className="badge">{formatCurrency(record.totalReturnAmount)}</span>
                  </div>
                  <p className="muted">
                    {formatDateTime(record.createdAtUtc)}
                    {record.remarks ? ` / ${record.remarks}` : ''}
                  </p>
                  <div className="list-stack">
                    {record.items.map((item) => (
                      <div className="list-row" key={`${record.id}-${item.saleItemId}`}>
                        <div className="table-title-cell">
                          <strong>{item.productName}</strong>
                          <span>
                            Qty {item.quantity} /
                            <span className="status-badge in inline-status">Good</span>
                            {item.remarks ? ` / ${item.remarks}` : ''}
                          </span>
                        </div>
                        <strong>{formatCurrency(item.returnAmount)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PageFrame>
  )
}
