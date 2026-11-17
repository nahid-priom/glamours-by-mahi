import type { RouteObject } from 'react-router-dom'
import { Navigate, useLocation } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  AccountSettingsPage,
  AccountsDashboardPage,
  CashBankPage,
  DailyClosingPage,
  DueManagementPage,
  ExpensesPage,
  IncomePage,
  ProfitLossPage,
  ReconciliationCenterPage,
  TransactionsPage,
  withSuspense,
} from './lazy'

function RedirectPreserveQuery({ to }: { to: string }) {
  const location = useLocation()
  const target = `${to}${location.search || ''}`
  return <Navigate to={target} replace />
}

export const accountsRoutes: RouteObject = {
  element: <PermissionRoute permission="accounts.read" />,
  children: [
    { path: '/accounts', element: withSuspense(AccountsDashboardPage) },
    { path: '/accounts/dues', element: withSuspense(DueManagementPage) },
    { path: '/accounts/cash-bank', element: withSuspense(CashBankPage) },
    { path: '/accounts/income', element: withSuspense(IncomePage) },
    { path: '/accounts/expenses', element: withSuspense(ExpensesPage) },
    { path: '/accounts/customer-due', element: <Navigate to="/accounts/dues?tab=customers" replace /> },
    { path: '/accounts/supplier-due', element: <Navigate to="/accounts/dues?tab=suppliers" replace /> },
    { path: '/accounts/collections', element: <RedirectPreserveQuery to="/sales/collections" /> },
    { path: '/accounts/supplier-payments', element: <RedirectPreserveQuery to="/purchases/payments" /> },
    { path: '/accounts/daily-closing', element: withSuspense(DailyClosingPage) },
    { path: '/accounts/transactions', element: withSuspense(TransactionsPage) },
    { path: '/accounts/profit-loss', element: withSuspense(ProfitLossPage) },
    { path: '/accounts/reconciliation', element: withSuspense(ReconciliationCenterPage) },
    { path: '/accounts/settings', element: withSuspense(AccountSettingsPage) },
    { path: '/accounts/chart', element: <Navigate to="/accounts/settings" replace /> },
    { path: '/accounts/journals', element: <Navigate to="/accounts/transactions" replace /> },
    { path: '/accounts/general-ledger', element: <Navigate to="/accounts/transactions" replace /> },
    { path: '/accounts/trial-balance', element: <Navigate to="/accounts/profit-loss" replace /> },
    { path: '/accounts/balance-sheet', element: <Navigate to="/accounts/profit-loss" replace /> },
    { path: '/accounts/cash-flow', element: <Navigate to="/accounts/transactions" replace /> },
    { path: '/accounts/setup', element: <Navigate to="/accounts/settings" replace /> },
    { path: '/accounts/customer-ledger', element: <Navigate to="/accounts/dues?tab=customers" replace /> },
    { path: '/accounts/supplier-ledger', element: <Navigate to="/accounts/dues?tab=suppliers" replace /> },
    { path: '/accounts/cashbook', element: <Navigate to="/accounts/cash-bank" replace /> },
    { path: '/accounts/banks', element: <Navigate to="/accounts/cash-bank" replace /> },
    { path: '/accounts/mobile-banking', element: <Navigate to="/accounts/cash-bank" replace /> },
    { path: '/accounts/customer-dues', element: <Navigate to="/accounts/dues?tab=customers" replace /> },
    { path: '/accounts/supplier-dues', element: <Navigate to="/accounts/dues?tab=suppliers" replace /> },
  ],
}
