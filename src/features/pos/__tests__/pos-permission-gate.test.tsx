/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { renderWithAppProviders } from '@/test'

function SalesShell() {
  return (
    <Routes>
      <Route element={<PermissionRoute permission="pos.create" fallback="/dashboard" />}>
        <Route path="/sales/pos" element={<h1>POS</h1>} />
      </Route>
      <Route
        element={<PermissionRoute permission="sales.commission.manage" fallback="/dashboard" />}
      >
        <Route path="/sales/commission-settings" element={<h1>Commission Settings</h1>} />
      </Route>
      <Route element={<PermissionRoute permission="audit.read" fallback="/dashboard" />}>
        <Route path="/activity-logs" element={<h1>Activity Logs</h1>} />
      </Route>
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>
  )
}

describe('POS / commission / activity gated flows', () => {
  it('allows POS when pos.create is granted', () => {
    renderWithAppProviders(<SalesShell />, {
      route: '/sales/pos',
      permissions: ['pos.create'],
    })
    expect(screen.getByRole('heading', { name: 'POS' })).toBeInTheDocument()
  })

  it('blocks commission settings without manage permission', () => {
    renderWithAppProviders(<SalesShell />, {
      route: '/sales/commission-settings',
      permissions: ['pos.create'],
    })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('allows activity logs with audit.read', () => {
    renderWithAppProviders(<SalesShell />, {
      route: '/activity-logs',
      permissions: ['audit.read'],
    })
    expect(screen.getByRole('heading', { name: 'Activity Logs' })).toBeInTheDocument()
  })
})
