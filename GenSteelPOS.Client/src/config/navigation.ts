import { Roles, type RoleName } from '../types/auth'

export interface NavigationItem {
  label: string
  path: string
  roles: RoleName[]
  caption: string
  group: 'Run' | 'Stock' | 'Orders' | 'Reports' | 'Management'
}

export const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Daily pulse and low-stock alerts',
    group: 'Run',
  },
  {
    label: 'POS',
    path: '/pos',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Cashier flow and sale capture',
    group: 'Run',
  },
  {
    label: 'Products',
    path: '/products',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Product names, categories, and prices',
    group: 'Stock',
  },
  {
    label: 'Inventory',
    path: '/inventory',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Check and update stock quantities',
    group: 'Stock',
  },
  {
    label: 'Stock Receiving',
    path: '/stock-in',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Delivery encoding and owner approval',
    group: 'Stock',
  },
  {
    label: 'Suppliers',
    path: '/suppliers',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Supplier records for stock receiving',
    group: 'Stock',
  },
  {
    label: 'Sales',
    path: '/sales',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Transactions, refunds, cancellations',
    group: 'Run',
  },
  {
    label: 'Returns',
    path: '/returns',
    roles: [Roles.SuperAdmin],
    caption: 'Owner-only return processing and history',
    group: 'Run',
  },
  {
    label: 'Action Requests',
    path: '/sale-action-requests',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Cashier requests and owner approval queue',
    group: 'Run',
  },
  {
    label: 'Reports',
    path: '/reports',
    roles: [Roles.Admin, Roles.SuperAdmin],
    caption: 'Sales and inventory exports by date range',
    group: 'Reports',
  },
  {
    label: 'Users',
    path: '/users',
    roles: [Roles.SuperAdmin],
    caption: 'Cashier and owner account control',
    group: 'Management',
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    roles: [Roles.SuperAdmin],
    caption: 'Sensitive action traceability',
    group: 'Management',
  },
]
