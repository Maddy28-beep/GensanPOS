import { useEffect, useMemo, useState } from 'react'
import { DataState } from '../components/DataState'
import { PageFrame } from '../components/PageFrame'
import { StatCard } from '../components/StatCard'
import { useApiData } from '../hooks/useApiData'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/datetime'
import { formatCurrency } from '../lib/receipt'
import { useToast } from '../state/ToastContext'
import { useAuth } from '../state/AuthContext'
import { Roles } from '../types/auth'
import type {
  InventoryValueReportRow,
  ProductSalesProfitReportRow,
  SalesTransactionReportRow,
  SalesSummary,
} from '../types/entities'

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultRange() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 6)

  return {
    fromUtc: formatDateInput(from),
    toUtc: formatDateInput(today),
  }
}

function buildDateRangeParams(range: { fromUtc: string; toUtc: string }) {
  const params = new URLSearchParams()
  if (range.fromUtc) {
    params.set('fromUtc', new Date(`${range.fromUtc}T00:00:00`).toISOString())
  }
  if (range.toUtc) {
    params.set('toUtc', new Date(`${range.toUtc}T23:59:59`).toISOString())
  }

  return params
}

function formatDateRangeLabel(range: { fromUtc: string; toUtc: string }) {
  if (range.fromUtc && range.toUtc) {
    return `${range.fromUtc} to ${range.toUtc}`
  }

  if (range.fromUtc) {
    return `${range.fromUtc} to Today`
  }

  if (range.toUtc) {
    return `Start to ${range.toUtc}`
  }

  return 'All available dates'
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function money(value: number) {
  return value.toFixed(2)
}

export function ReportsPage() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [selectedRange, setSelectedRange] = useState(defaultRange)
  const [range, setRange] = useState(defaultRange)
  const [productProfitRows, setProductProfitRows] = useState<ProductSalesProfitReportRow[]>([])
  const [salesTransactionRows, setSalesTransactionRows] = useState<SalesTransactionReportRow[]>([])
  const [inventoryRows, setInventoryRows] = useState<InventoryValueReportRow[]>([])
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All')
  const [isApplyingRange, setIsApplyingRange] = useState(false)
  const [printMode, setPrintMode] = useState<'all' | 'sales' | 'inventory'>('all')
  const [reportError, setReportError] = useState<string | null>(null)
  const { showToast } = useToast()
  const { user } = useAuth()
  const isSuperAdmin = user?.roleName === Roles.SuperAdmin
  const { data, isLoading, error, setData } = useApiData<SalesSummary>(
    '/reports/sales-summary',
    {
      grossSales: 0,
      returnsAmount: 0,
      netSales: 0,
      totalDiscount: 0,
      totalTax: 0,
      netSalesExcludingTax: 0,
      costOfGoodsSold: 0,
      grossProfit: 0,
      profitMarginPercent: 0,
      transactionCount: 0,
      totalInventoryValue: 0,
    },
  )

  const reportRangeLabel = formatDateRangeLabel(range)
  const selectedRangeLabel = formatDateRangeLabel(selectedRange)
  const hasPendingRange =
    selectedRange.fromUtc !== range.fromUtc || selectedRange.toUtc !== range.toUtc
  const productProfitTotal = productProfitRows.reduce((sum, row) => sum + row.profit, 0)
  const inventoryCategories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          inventoryRows
            .map((row) => row.categoryName)
            .filter((category): category is string => Boolean(category?.trim())),
        ),
      ).sort(),
    ],
    [inventoryRows],
  )
  const filteredInventoryRows = useMemo(
    () =>
      inventoryRows.filter(
        (row) => inventoryCategoryFilter === 'All' || row.categoryName === inventoryCategoryFilter,
      ),
    [inventoryCategoryFilter, inventoryRows],
  )
  const inventoryValueTotal = filteredInventoryRows.reduce((sum, row) => sum + row.inventoryValue, 0)
  const totalQuantitySold = productProfitRows.reduce((sum, row) => sum + row.totalQuantitySold, 0)

  const updateReportRange = async (nextRange = selectedRange, showSuccess = true) => {
    setIsApplyingRange(true)
    setReportError(null)
    const params = buildDateRangeParams(nextRange)
    const suffix = params.toString()
    try {
      const [
        summaryResponse,
        productProfitResponse,
        salesTransactionResponse,
        inventoryResponse,
      ] = await Promise.all([
        api.get<SalesSummary>(`/reports/sales-summary${suffix ? `?${suffix}` : ''}`),
        api.get<ProductSalesProfitReportRow[]>(
          `/reports/sales/products-profit${suffix ? `?${suffix}` : ''}`,
        ),
        api.get<SalesTransactionReportRow[]>(
          `/reports/sales/transactions${suffix ? `?${suffix}` : ''}`,
        ),
        isSuperAdmin
          ? api.get<InventoryValueReportRow[]>('/reports/inventory/value')
          : Promise.resolve({ data: [] as InventoryValueReportRow[] }),
      ])

      setRange(nextRange)
      setData(summaryResponse.data)
      setProductProfitRows(productProfitResponse.data)
      setSalesTransactionRows(salesTransactionResponse.data)
      setInventoryRows(inventoryResponse.data)
      if (showSuccess) {
        showToast({
          tone: 'success',
          title: 'Report updated',
          message: `Now showing ${formatDateRangeLabel(nextRange)}.`,
        })
      }
    } catch {
      setReportError('Unable to load the report data.')
      showToast({
        tone: 'error',
        title: 'Update failed',
        message: 'Unable to apply the selected report range.',
      })
    } finally {
      setIsApplyingRange(false)
    }
  }

  useEffect(() => {
    void updateReportRange(defaultRange, false)
    // The initial load should run once with the default date range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLastFiveYears = () => {
    const today = new Date()
    const from = new Date(today)
    from.setFullYear(today.getFullYear() - 5)
    const nextRange = {
      fromUtc: formatDateInput(from),
      toUtc: formatDateInput(today),
    }
    setSelectedRange(nextRange)
    void updateReportRange(nextRange)
  }

  const printReport = (mode: 'sales' | 'inventory') => {
    setPrintMode(mode)
    window.setTimeout(() => {
      window.print()
      window.setTimeout(() => setPrintMode('all'), 500)
    }, 0)
  }

  const exportSalesExcel = () => {
    const summaryRows = [
      ['Sales Date Range', reportRangeLabel],
      ['Gross Sales', money(data.grossSales)],
      ['Returns', money(data.returnsAmount)],
      ['Net Sales', money(data.netSales)],
      ['Profit', money(productProfitTotal)],
      ['Transactions', String(salesTransactionRows.length)],
    ]
    const workbook = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; margin-bottom: 22px; width: 100%; }
            th { background: #d9ebe6; color: #17324d; font-weight: 700; }
            th, td { border: 1px solid #b7cbd6; padding: 8px 10px; white-space: nowrap; }
            .title { font-size: 18px; font-weight: 700; background: #17324d; color: #ffffff; }
            .section { font-size: 14px; font-weight: 700; background: #eef7f4; color: #0f3d63; }
            .number { text-align: right; mso-number-format: "#,##0.00"; }
            .qty { text-align: right; mso-number-format: "#,##0.##"; }
            .label { font-weight: 700; }
          </style>
        </head>
        <body>
          <table>
            <colgroup><col style="width: 220px" /><col style="width: 180px" /></colgroup>
            <tr><td class="title" colspan="2">GEN STEEL SALES REPORT</td></tr>
            ${summaryRows
              .map(
                ([label, value]) =>
                  `<tr><td class="label">${escapeHtml(label)}</td><td class="number">${escapeHtml(value)}</td></tr>`,
              )
      .join('')}
          </table>

          <table>
            <colgroup>
              <col style="width: 190px" />
              <col style="width: 180px" />
              <col style="width: 170px" />
              <col style="width: 180px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
              <col style="width: 120px" />
            </colgroup>
            <tr><td class="section" colspan="9">SALES TRANSACTIONS</td></tr>
            <tr>
              <th>Date/Time</th>
              <th>Sale No.</th>
              <th>Cashier/Owner</th>
              <th>Mode of Payment</th>
              <th>Total</th>
              <th>Returns</th>
              <th>Net</th>
              <th>Profit</th>
              <th>Status</th>
            </tr>
            ${salesTransactionRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(formatDateTime(row.createdAtUtc))}</td>
                    <td>${escapeHtml(row.saleNumber)}</td>
                    <td>${escapeHtml(row.cashierName)}</td>
                    <td>${escapeHtml(row.paymentMethods || '-')}</td>
                    <td class="number">${money(row.totalAmount)}</td>
                    <td class="number">${money(row.returnsAmount)}</td>
                    <td class="number">${money(row.netAmount)}</td>
                    <td class="number">${money(row.profit)}</td>
                    <td>${escapeHtml(row.status)}</td>
                  </tr>`,
              )
              .join('')}
          </table>

          <table>
            <colgroup>
              <col style="width: 320px" />
              <col style="width: 130px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
            </colgroup>
            <tr><td class="section" colspan="5">PRODUCT SALES PROFIT</td></tr>
            <tr>
              <th>Product Name</th>
              <th>Total Quantity Sold</th>
              <th>Total Sales</th>
              <th>Total Cost</th>
              <th>Profit</th>
            </tr>
            ${productProfitRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.productName)}</td>
                    <td class="qty">${row.totalQuantitySold}</td>
                    <td class="number">${money(row.totalSales)}</td>
                    <td class="number">${money(row.totalCost)}</td>
                    <td class="number">${money(row.profit)}</td>
                  </tr>`,
              )
              .join('')}
          </table>
        </body>
      </html>`

    downloadBlob(
      new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      'gensteel-sales-report.xls',
    )
  }

  const exportInventoryExcel = () => {
    const workbook = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; margin-bottom: 22px; width: 100%; }
            th { background: #d9ebe6; color: #17324d; font-weight: 700; }
            th, td { border: 1px solid #b7cbd6; padding: 8px 10px; white-space: nowrap; }
            .title { font-size: 18px; font-weight: 700; background: #17324d; color: #ffffff; }
            .section { font-size: 14px; font-weight: 700; background: #eef7f4; color: #0f3d63; }
            .number { text-align: right; mso-number-format: "#,##0.00"; }
            .qty { text-align: right; mso-number-format: "#,##0.##"; }
            .label { font-weight: 700; }
          </style>
        </head>
        <body>
          <table>
            <colgroup><col style="width: 220px" /><col style="width: 220px" /></colgroup>
            <tr><td class="title" colspan="2">GEN STEEL INVENTORY REPORT</td></tr>
            <tr><td class="label">Inventory Snapshot</td><td>${escapeHtml(new Date().toLocaleString())}</td></tr>
            <tr><td class="label">Category</td><td>${escapeHtml(inventoryCategoryFilter === 'All' ? 'All categories' : inventoryCategoryFilter)}</td></tr>
            <tr><td class="label">Total Products</td><td class="qty">${filteredInventoryRows.length}</td></tr>
            <tr><td class="label">Inventory Value</td><td class="number">${money(inventoryValueTotal)}</td></tr>
          </table>

          <table>
            <colgroup>
              <col style="width: 320px" />
              <col style="width: 180px" />
              <col style="width: 130px" />
              <col style="width: 140px" />
              <col style="width: 140px" />
              <col style="width: 150px" />
            </colgroup>
            <tr><td class="section" colspan="6">CURRENT INVENTORY LIST</td></tr>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Cost Price</th>
              <th>Selling Price</th>
              <th>Inventory Value</th>
            </tr>
            ${filteredInventoryRows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.productName)}</td>
                    <td>${escapeHtml(row.categoryName || '-')}</td>
                    <td class="qty">${row.currentStock}</td>
                    <td class="number">${money(row.costPrice)}</td>
                    <td class="number">${money(row.sellingPrice)}</td>
                    <td class="number">${money(row.inventoryValue)}</td>
                  </tr>`,
              )
              .join('')}
          </table>
        </body>
      </html>`

    downloadBlob(
      new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      'gensteel-inventory-report.xls',
    )
  }

  return (
    <PageFrame
      title="Reports"
      description={
        isSuperAdmin
          ? 'Owner report for sales, product profit, and the current downloadable inventory list.'
          : 'Sales report access. Inventory value is owner-only.'
      }
    >
      <section className="panel report-control-panel print-hide">
        <div className="split-line">
          <div>
            <h4>Report Controls</h4>
            <span className="muted">Sales range: {reportRangeLabel}</span>
          </div>
          <span className={hasPendingRange ? 'badge warning-badge' : 'badge'}>{hasPendingRange ? 'Range not applied' : 'Up to date'}</span>
        </div>
        <div className="report-control-grid">
          <label className="field">
            <span>From Date</span>
            <input
              type="date"
              value={selectedRange.fromUtc}
              onChange={(event) =>
                setSelectedRange((current) => ({ ...current, fromUtc: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>To Date</span>
            <input
              type="date"
              value={selectedRange.toUtc}
              onChange={(event) =>
                setSelectedRange((current) => ({ ...current, toUtc: event.target.value }))
              }
            />
          </label>
          <div className="report-control-actions">
            <button
              className="primary-button loading-button"
              type="button"
              disabled={isApplyingRange}
              onClick={() => void updateReportRange()}
            >
              {isApplyingRange ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Updating
                </>
              ) : (
                'Update'
              )}
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={isApplyingRange}
              onClick={() => {
                setSelectedRange(defaultRange)
                void updateReportRange(defaultRange)
              }}
            >
              Last 7 Days
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={isApplyingRange}
              onClick={setLastFiveYears}
            >
              Last 5 Years
            </button>
          </div>
        </div>
        {hasPendingRange ? (
          <div className="subtle-panel range-status pending">
            Selected {selectedRangeLabel}. Click Update to refresh the report.
          </div>
        ) : null}
      </section>

      <section className="report-export-grid print-hide">
        <div className="panel report-export-card">
          <div>
            <h4>Sales Export</h4>
            <span className="muted">PDF or Excel for {reportRangeLabel}</span>
          </div>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={() => printReport('sales')}>
              Print PDF
            </button>
            <button className="ghost-button" type="button" onClick={exportSalesExcel}>
              Excel
            </button>
          </div>
        </div>

        {isSuperAdmin ? (
          <div className="panel report-export-card">
            <div>
              <h4>Inventory Export</h4>
              <span className="muted">Current stock snapshot</span>
            </div>
            <label className="field compact-field">
              <span>Category</span>
              <select
                value={inventoryCategoryFilter}
                onChange={(event) => setInventoryCategoryFilter(event.target.value)}
              >
                {inventoryCategories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'All' ? 'All categories' : category}
                  </option>
                ))}
              </select>
            </label>
            <div className="action-row">
              <button className="primary-button" type="button" onClick={() => printReport('inventory')}>
                Print PDF
              </button>
              <button className="ghost-button" type="button" onClick={exportInventoryExcel}>
                Excel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={`report-print-area print-${printMode}`}>
        <div className="panel report-print-header">
          <div>
            <h4>Gen Steel POS Owner Report</h4>
            <span className="muted">
              Sales range: {reportRangeLabel} / Inventory snapshot: {new Date().toLocaleString()}
            </span>
          </div>
          <span className="badge">Generated {new Date().toLocaleString()}</span>
        </div>

        <div className="stats-grid compact-stats report-kpi-grid sales-summary-cards">
          <StatCard label="Gross Sales" value={formatCurrency(data.grossSales)} />
          <StatCard label="Returns" value={formatCurrency(data.returnsAmount)} />
          <StatCard label="Net Sales" value={formatCurrency(data.netSales)} />
          <StatCard label="Profit" value={formatCurrency(productProfitTotal)} />
        </div>

        {isSuperAdmin ? (
        <div className="stats-grid compact-stats report-kpi-grid inventory-summary-cards">
          <StatCard label="Products" value={String(filteredInventoryRows.length)} />
          <StatCard label="Inventory Value" value={formatCurrency(inventoryValueTotal)} />
        </div>
        ) : null}

        <div className="table-panel report-table-card sales-report-section">
          <div className="split-line report-section-header">
            <div>
              <h4>Sales Transactions</h4>
              <span className="muted">{reportRangeLabel}</span>
            </div>
            <span className="badge">{salesTransactionRows.length} transactions</span>
          </div>
          {salesTransactionRows.length === 0 ? (
            <div className="subtle-panel report-empty">No sales transactions found for this date range.</div>
          ) : (
            <table className="report-table compact-report-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Sale No.</th>
                  <th>Cashier/Owner</th>
                  <th>Mode of Payment</th>
                  <th>Total</th>
                  <th>Returns</th>
                  <th>Net</th>
                  <th>Profit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salesTransactionRows.map((row) => (
                  <tr key={row.saleId}>
                    <td>{formatDateTime(row.createdAtUtc)}</td>
                    <td>
                      <strong>{row.saleNumber}</strong>
                    </td>
                    <td>{row.cashierName}</td>
                    <td>{row.paymentMethods || '-'}</td>
                    <td>{formatCurrency(row.totalAmount)}</td>
                    <td>{formatCurrency(row.returnsAmount)}</td>
                    <td>{formatCurrency(row.netAmount)}</td>
                    <td>
                      <strong>{formatCurrency(row.profit)}</strong>
                    </td>
                    <td className="report-status-cell">
                      <span className="status-badge in">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-panel report-table-card sales-report-section">
          <div className="split-line report-section-header">
            <div>
              <h4>Product Sales Profit</h4>
              <span className="muted">Grouped by product / {reportRangeLabel}</span>
            </div>
            <span className="badge">
              {productProfitRows.length} products / {totalQuantitySold} sold
            </span>
          </div>
          {productProfitRows.length === 0 ? (
            <div className="subtle-panel report-empty">No product sales found for this date range.</div>
          ) : (
            <table className="report-table compact-report-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Qty Sold</th>
                  <th>Total Sales</th>
                  <th>Total Cost</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {productProfitRows.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <strong>{row.productName}</strong>
                    </td>
                    <td>{row.totalQuantitySold}</td>
                    <td>{formatCurrency(row.totalSales)}</td>
                    <td>{formatCurrency(row.totalCost)}</td>
                    <td>
                      <strong>{formatCurrency(row.profit)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {isSuperAdmin ? (
        <div className="table-panel report-table-card inventory-report-section">
          <div className="split-line report-section-header">
            <div>
              <h4>Current Inventory List</h4>
              <span className="muted">
                {inventoryCategoryFilter === 'All'
                  ? 'All categories'
                  : inventoryCategoryFilter}
              </span>
            </div>
            <span className="badge">{filteredInventoryRows.length} products</span>
          </div>
          {filteredInventoryRows.length === 0 ? (
            <div className="subtle-panel report-empty">No inventory products found.</div>
          ) : (
            <table className="report-table compact-report-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Inventory Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventoryRows.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <strong>{row.productName}</strong>
                    </td>
                    <td>{row.categoryName || '-'}</td>
                    <td>{row.currentStock}</td>
                    <td>{formatCurrency(row.costPrice)}</td>
                    <td>{formatCurrency(row.sellingPrice)}</td>
                    <td>{formatCurrency(row.inventoryValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        ) : null}

        <details className="panel stack-form report-detail-panel">
          <summary className="nav-section-title nav-summary">Advanced Details</summary>
          <div className="stats-grid compact-stats">
            <StatCard label="Transactions" value={String(data.transactionCount)} />
            <StatCard label="Discounts" value={formatCurrency(data.totalDiscount)} />
            <StatCard label="Tax" value={formatCurrency(data.totalTax)} />
            <StatCard label="Margin" value={`${data.profitMarginPercent.toFixed(2)}%`} />
          </div>
        </details>
      </section>

      <DataState
        isLoading={isLoading || isApplyingRange}
        error={error ?? reportError}
        emptyMessage="Report data will appear here."
        hasData
      />
    </PageFrame>
  )
}
