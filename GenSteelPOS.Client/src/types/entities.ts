export interface Category {
  id: number
  name: string
  description: string
  isActive: boolean
}

export interface ProductUnit {
  id: number
  name: string
  isActive: boolean
}

export interface Product {
  id: number
  sku: string
  name: string
  description: string
  costPrice: number
  price: number
  unit: string
  isActive: boolean
  categoryName: string
  quantityOnHand: number
  reorderLevel: number
  location: string
}

export interface InventoryItem {
  productId: number
  productName: string
  sku: string
  categoryName: string
  quantityOnHand: number
  reorderLevel: number
  location: string
  isActiveProduct: boolean
  stockStatus: string
}

export interface InventorySummary {
  totalProducts: number
  inStockCount: number
  lowStockCount: number
  outOfStockCount: number
}

export interface InventoryListResponse {
  items: InventoryItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  summary: InventorySummary
  availableCategories: string[]
  availableLocations: string[]
}

export interface InventoryAdjustmentRequest {
  id: number
  productId: number
  productName: string
  sku: string
  requestType: string
  status: string
  quantityChange: number
  previousQuantity: number
  requestedQuantity: number
  requestedByName: string
  reason: string
  reviewedByName: string
  reviewNotes: string
  createdAtUtc: string
  reviewedAtUtc: string | null
}

export interface Supplier {
  id: number
  name: string
  contactPerson: string
  contactNumber: string
  email: string
  address: string
  isActive: boolean
}

export interface UserRecord {
  id: number
  fullName: string
  username: string
  email: string
  isActive: boolean
  roleName: string
}

export interface SaleItem {
  saleItemId: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  costPrice: number
  lineTotal: number
  costOfGoodsSold: number
  grossProfit: number
  returnedQuantity: number
  remainingReturnableQuantity: number
}

export interface Payment {
  paymentMethod: string
  amount: number
  referenceNumber: string
  bankName: string
  bankBranch: string
  checkNumber: string
  checkDate: string | null
  dueDays: number | null
  details: string
}

export interface Sale {
  id: number
  saleNumber: string
  cashierName: string
  processedByName: string
  processedByRole: string
  customerName: string
  customerAddress: string
  customerTin: string
  remarks: string
  poNumber: string
  terms: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  amountPaid: number
  changeDue: number
  costOfGoodsSold: number
  grossProfit: number
  profitMarginPercent: number
  status: string
  createdAtUtc: string
  totalReturnedAmount: number
  items: SaleItem[]
  payments: Payment[]
  returns: ReturnRecord[]
}

export interface ReturnItem {
  saleItemId: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  returnAmount: number
  condition: string
  remarks: string
}

export interface ReturnRecord {
  id: number
  returnNumber: string
  saleId: number
  saleNumber: string
  processedByName: string
  totalReturnAmount: number
  remarks: string
  createdAtUtc: string
  items: ReturnItem[]
}

export interface SaleActionRequest {
  id: number
  saleId: number
  saleNumber: string
  cashierName: string
  saleTotalAmount: number
  saleStatus: string
  requestType: string
  status: string
  requestReason: string
  reviewNotes: string
  requestedByName: string
  reviewedByName: string
  createdAtUtc: string
  reviewedAtUtc: string | null
  requestedReturnItems: SaleActionRequestedReturnItem[]
}

export interface SaleActionRequestedReturnItem {
  saleItemId: number
  productName: string
  quantity: number
  maxQuantity: number
  condition: string
  remarks: string
}

export interface SalesOrderItem {
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SalesOrder {
  id: number
  orderNumber: string
  customerName: string
  customerContact: string
  customerAddress: string
  remarks: string
  createdByName: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  status: string
  createdAtUtc: string
  convertedSaleId: number | null
  convertedSaleNumber: string
  items: SalesOrderItem[]
}

export interface StockInItem {
  productId: number
  productName: string
  quantity: number
  unitCost: number
}

export interface StockInRecord {
  id: number
  referenceNumber: string
  containerNumber: string
  stockNumber: string
  productReferenceNumber: string
  supplierName: string
  receivedByName: string
  reviewedByName: string
  receivedDateUtc: string
  reviewedAtUtc: string | null
  status: string
  remarks: string
  reviewNotes: string
  items: StockInItem[]
}

export interface PurchaseOrderItem {
  productId: number
  productName: string
  quantity: number
  unitCost: number
  lineTotal: number
}

export interface PurchaseOrder {
  id: number
  orderNumber: string
  supplierName: string
  createdByName: string
  remarks: string
  totalEstimatedCost: number
  status: string
  createdAtUtc: string
  receivedStockInRecordId: number | null
  receivedStockInReferenceNumber: string
  items: PurchaseOrderItem[]
}

export interface AuditLog {
  id: number
  action: string
  entityName: string
  entityId: string
  module: string
  record: string
  oldValue: string
  newValue: string
  details: string
  username: string
  role: string
  ipAddress: string
  createdAtUtc: string
}

export interface DashboardData {
  totalSalesToday: number
  totalReturnsToday: number
  netSalesToday: number
  cashierSalesToday: number
  cashierReturnsToday: number
  cashierNetSalesToday: number
  ownerSalesToday: number
  ownerReturnsToday: number
  ownerNetSalesToday: number
  totalTransactionsToday: number
  cashierTransactionsToday: number
  ownerTransactionsToday: number
  lowStockCount: number
  activeProductsCount: number
  totalInventoryValue: number
  totalSalesThisMonth: number
  totalReturnsThisMonth: number
  netSalesThisMonth: number
  cashierSalesThisMonth: number
  ownerSalesThisMonth: number
}

export interface SalesSummary {
  grossSales: number
  returnsAmount: number
  netSales: number
  cashierSales: number
  cashierReturns: number
  cashierNetSales: number
  ownerSales: number
  ownerReturns: number
  ownerNetSales: number
  totalDiscount: number
  totalTax: number
  netSalesExcludingTax: number
  costOfGoodsSold: number
  grossProfit: number
  profitMarginPercent: number
  transactionCount: number
  totalInventoryValue: number
}

export interface ProductSalesProfitReportRow {
  productId: number
  productName: string
  totalQuantitySold: number
  totalSales: number
  totalCost: number
  profit: number
}

export interface InventoryValueReportRow {
  productId: number
  productName: string
  categoryName: string
  currentStock: number
  costPrice: number
  sellingPrice: number
  inventoryValue: number
}

export interface SalesTransactionReportRow {
  saleId: number
  saleNumber: string
  createdAtUtc: string
  cashierName: string
  processedByName: string
  processedByRole: string
  paymentMethods: string
  totalAmount: number
  returnsAmount: number
  netAmount: number
  costOfGoodsSold: number
  profit: number
  status: string
}

export interface StockMovement {
  id: number
  productId: number
  productName: string
  sku: string
  movementType: string
  quantityChanged: number
  previousQuantity: number
  newQuantity: number
  referenceNo: string
  remarks: string
  performedByName: string
  createdAtUtc: string
}
