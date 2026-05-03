import { formatDate, formatDateTime } from './datetime'
import type { Payment, Sale } from '../types/entities'

const companyProfile = {
  outletLabel: 'FACTORY OUTLET OF:',
  brand: 'PH EXCELLENT STAINLESS STEEL',
  tagline: 'THE NO. 1 STAINLESS BRAND IN PHILIPPINES',
  company: 'GEN STEEL SUPPLY CORPORATION',
  address: 'Davao City, Philippines',
  contact: '(082) 284-7487',
  documentTitle: 'SALES INVOICE / RECEIPT',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(amount: number) {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCurrency(amount: number) {
  return `PHP ${formatNumber(amount)}`
}

function formatPaymentLabel(payment: Payment) {
  const details = [
    payment.referenceNumber ? `Ref ${payment.referenceNumber}` : '',
    payment.bankName ? `Bank ${payment.bankName}` : '',
    payment.bankBranch ? `Branch ${payment.bankBranch}` : '',
    payment.checkNumber ? `Check ${payment.checkNumber}` : '',
    payment.checkDate ? `Date ${formatDate(payment.checkDate)}` : '',
    payment.dueDays ? `Due ${payment.dueDays} day(s)` : '',
    payment.details,
  ].filter(Boolean)

  return details.length > 0
    ? `${payment.paymentMethod} - ${details.join(' / ')}`
    : payment.paymentMethod
}

function getPreparedByName(sale: Sale) {
  return sale.cashierName || 'Store Cashier'
}

function renderReceiptShell(title: string, sale: Sale) {
  const totalPaid = sale.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const changeDue = Math.max(0, totalPaid - sale.totalAmount)
  const totalQty = sale.items.reduce((sum, item) => sum + item.quantity, 0)
  const printedAt = formatDateTime(new Date().toISOString())
  const balance = Math.max(0, sale.totalAmount - totalPaid)
  const taxLabel = sale.taxAmount < 0 ? 'WHT / Tax' : 'Tax'

  const items = sale.items
    .map(
      (item, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="num">${item.quantity}</td>
          <td class="center">PCS</td>
          <td>
            <strong>${escapeHtml(item.productName)}</strong>
          </td>
          <td class="num">${formatNumber(item.unitPrice)}</td>
          <td class="num">${formatNumber(item.lineTotal)}</td>
        </tr>`,
    )
    .join('')

  const payments = sale.payments.length
    ? sale.payments
        .map(
          (payment) => `
            <tr>
              <td>${escapeHtml(formatPaymentLabel(payment))}</td>
              <td class="num">${formatNumber(payment.amount)}</td>
            </tr>`,
        )
        .join('')
    : `
      <tr>
        <td>No payment lines recorded</td>
        <td class="num">0.00</td>
      </tr>`

  return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: Letter portrait;
            margin: 12mm;
          }

          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: "Arial", "Helvetica", sans-serif;
            color: #172033;
            background: #fff;
            font-size: 12px;
          }
          .sheet {
            max-width: 8.5in;
            margin: 0 auto;
            min-height: 10.35in;
            display: flex;
            flex-direction: column;
          }
          .center { text-align: center; }
          .muted { color: #5d6b7c; }
          .company-block {
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 2px solid #172033;
            line-height: 1.24;
          }
          .company-block .small { font-size: 11px; }
          .company-block .strong { font-size: 13px; font-weight: 800; letter-spacing: 0.02em; }
          .company-block .title {
            margin-top: 12px;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0.04em;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-top: 14px;
            margin-bottom: 14px;
          }
          .info-box {
            border: 1px solid #c7d1dc;
            border-radius: 6px;
            overflow: hidden;
          }
          .info-box-title {
            padding: 7px 10px;
            background: #edf4f7;
            border-bottom: 1px solid #c7d1dc;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .info-row {
            display: grid;
            grid-template-columns: 92px 1fr;
            min-height: 28px;
            border-bottom: 1px solid #e4e9ef;
          }
          .info-row:last-child { border-bottom: 0; }
          .info-row span {
            padding: 6px 10px;
          }
          .info-row .label {
            background: #f7fafb;
            color: #526173;
            font-weight: 700;
          }
          .line-table,
          .payments-table {
            width: 100%;
            border-collapse: collapse;
          }
          .line-table th,
          .line-table td,
          .payments-table th,
          .payments-table td {
            border-bottom: 1px solid #d9e0e7;
            padding: 8px 7px;
            vertical-align: top;
          }
          .line-table thead th {
            background: #edf4f7;
            border-top: 1px solid #c7d1dc;
            border-bottom: 1px solid #c7d1dc;
            color: #263547;
            font-weight: 700;
          }
          .line-table tfoot td {
            border-bottom: 0;
            font-weight: 800;
          }
          .num { text-align: right; white-space: nowrap; }
          .summary-wrap {
            display: grid;
            grid-template-columns: minmax(0, 1.25fr) 310px;
            gap: 18px;
            margin-top: 16px;
          }
          .box-title {
            margin-bottom: 7px;
            font-weight: 700;
            color: #263547;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #c7d1dc;
          }
          .summary-table td {
            padding: 7px 9px;
            border-bottom: 1px solid #e4e9ef;
          }
          .summary-table tr:last-child td { border-bottom: 0; }
          .summary-table .total-row td {
            border-top: 2px solid #172033;
            background: #f7fafb;
            font-weight: 700;
            font-size: 13px;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 18px;
            margin-top: auto;
            padding-top: 42px;
          }
          .signature {
            text-align: center;
            font-size: 11px;
            color: #263547;
          }
          .signature .line {
            border-top: 1px solid #172033;
            padding-top: 6px;
          }
          .footer {
            margin-top: 24px;
            padding-top: 9px;
            border-top: 1px solid #d9e0e7;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 11px;
            color: #526173;
          }
          .print-note {
            margin-top: 10px;
            padding: 8px 10px;
            border: 1px solid #d9e0e7;
            background: #fbfcfd;
            color: #526173;
          }
          @media print {
            body { padding: 0; }
            .sheet { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="company-block">
            <div class="small">${escapeHtml(companyProfile.outletLabel)}</div>
            <div class="strong">${escapeHtml(companyProfile.brand)}</div>
            <div class="small">${escapeHtml(companyProfile.tagline)}</div>
            <div class="strong">${escapeHtml(companyProfile.company)}</div>
            <div class="small">${escapeHtml(companyProfile.address)}</div>
            <div class="small">${escapeHtml(companyProfile.contact)}</div>
            <div class="title">${escapeHtml(companyProfile.documentTitle)}</div>
          </div>

          <div class="meta-grid">
            <div class="info-box">
              <div class="info-box-title">Customer</div>
              <div class="info-row"><span class="label">Name</span><span>${escapeHtml(sale.customerName || 'Walk-in Customer')}</span></div>
              <div class="info-row"><span class="label">Address</span><span>${escapeHtml(sale.customerAddress || '-')}</span></div>
              <div class="info-row"><span class="label">TIN</span><span>${escapeHtml(sale.customerTin || '-')}</span></div>
              <div class="info-row"><span class="label">Remarks</span><span>${escapeHtml(sale.remarks || '-')}</span></div>
            </div>
            <div class="info-box">
              <div class="info-box-title">Invoice</div>
              <div class="info-row"><span class="label">Doc No.</span><span>${escapeHtml(sale.saleNumber)}</span></div>
              <div class="info-row"><span class="label">Date</span><span>${escapeHtml(formatDate(sale.createdAtUtc))}</span></div>
              <div class="info-row"><span class="label">Cashier</span><span>${escapeHtml(sale.cashierName)}</span></div>
              <div class="info-row"><span class="label">Terms</span><span>${escapeHtml(sale.terms || '30 Days')}</span></div>
              <div class="info-row"><span class="label">PO No.</span><span>${escapeHtml(sale.poNumber || '-')}</span></div>
            </div>
          </div>

          <table class="line-table">
            <thead>
              <tr>
                <th class="center">#</th>
                <th class="num">Qty</th>
                <th class="center">Unit</th>
                <th>Item Description</th>
                <th class="num">Price</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td class="num">${totalQty}</td>
                <td colspan="4">Total quantity</td>
              </tr>
            </tfoot>
          </table>

          <div class="summary-wrap">
            <div>
              <div class="box-title">Payment Details</div>
              <table class="payments-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th class="num">Amount</th>
                  </tr>
                </thead>
                <tbody>${payments}</tbody>
              </table>
            </div>

            <div>
              <div class="box-title">Totals</div>
              <table class="summary-table">
                <tr>
                  <td>Subtotal</td>
                  <td class="num">${formatNumber(sale.subtotal)}</td>
                </tr>
                <tr>
                  <td>Discount</td>
                  <td class="num">${formatNumber(sale.discountAmount)}</td>
                </tr>
                <tr>
                  <td>${taxLabel}</td>
                  <td class="num">${formatNumber(sale.taxAmount)}</td>
                </tr>
                <tr>
                  <td>Total Paid</td>
                  <td class="num">${formatNumber(totalPaid)}</td>
                </tr>
                <tr>
                  <td>Balance</td>
                  <td class="num">${formatNumber(balance)}</td>
                </tr>
                <tr>
                  <td>Change</td>
                  <td class="num">${formatNumber(changeDue)}</td>
                </tr>
                <tr class="total-row">
                  <td>TOTAL</td>
                  <td class="num">${formatNumber(sale.totalAmount)}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="print-note">
            Goods received in good order and condition. Please verify quantities before signing.
          </div>

          <div class="signatures">
            <div class="signature"><div class="line">PREPARED BY</div></div>
            <div class="signature"><div class="line">APPROVED BY</div></div>
            <div class="signature"><div class="line">DELIVERED BY</div></div>
            <div class="signature"><div class="line">RECEIVED BY</div></div>
          </div>

          <div class="footer">
            <span>Date Printed: ${escapeHtml(printedAt)}</span>
            <span>Prepared by: ${escapeHtml(getPreparedByName(sale))}</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </body>
    </html>
  `
}

export function buildReceiptHtml(sale: Sale) {
  return renderReceiptShell(sale.saleNumber, sale)
}

export function openPrintWindow(sale: Sale) {
  const receiptWindow = window.open('', '_blank', 'width=980,height=760')
  if (!receiptWindow) {
    return false
  }

  receiptWindow.document.write(buildReceiptHtml(sale))
  receiptWindow.document.close()
  receiptWindow.focus()
  receiptWindow.print()
  return true
}
