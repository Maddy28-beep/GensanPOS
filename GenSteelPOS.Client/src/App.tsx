import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PosPage } from './pages/PosPage'
import { ProductsPage } from './pages/ProductsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SalesPage } from './pages/SalesPage'
import { SaleActionRequestsPage } from './pages/SaleActionRequestsPage'
import { UsersPage } from './pages/UsersPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { ReturnsPage } from './pages/ReturnsPage'
import { StockInPage } from './pages/StockInPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { Roles } from './types/auth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route
          path="products"
          element={
            <ProtectedRoute allowedRoles={[Roles.Admin, Roles.SuperAdmin]}>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sale-action-requests" element={<SaleActionRequestsPage />} />
        <Route
          path="returns"
          element={
            <ProtectedRoute allowedRoles={[Roles.SuperAdmin]}>
              <ReturnsPage />
            </ProtectedRoute>
          }
        />
        <Route path="sales-orders" element={<Navigate to="/dashboard" replace />} />
        <Route path="stock-movements" element={<Navigate to="/dashboard" replace />} />
        <Route path="purchase-orders" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="suppliers"
          element={
            <ProtectedRoute allowedRoles={[Roles.Admin, Roles.SuperAdmin]}>
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock-in"
          element={
            <ProtectedRoute allowedRoles={[Roles.Admin, Roles.SuperAdmin]}>
              <StockInPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={[Roles.Admin, Roles.SuperAdmin]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={[Roles.SuperAdmin]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <ProtectedRoute allowedRoles={[Roles.SuperAdmin]}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
