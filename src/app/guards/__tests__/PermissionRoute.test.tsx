/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { PermissionRoute } from '../PermissionRoute'
import { renderWithAppProviders } from '@/test'

function App() {
  return (
    <Routes>
      <Route element={<PermissionRoute permission="audit.read" fallback="/dashboard" />}>
        <Route path="/activity-logs" element={<h1>Activity</h1>} />
      </Route>
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>
  )
}

describe('PermissionRoute', () => {
  it('allows route when permission present', () => {
    renderWithAppProviders(<App />, {
      route: '/activity-logs',
      permissions: ['audit.read'],
    })
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument()
  })

  it('redirects when permission missing', () => {
    renderWithAppProviders(<App />, {
      route: '/activity-logs',
      permissions: ['dashboard.read'],
    })
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows loader while auth loading', () => {
    renderWithAppProviders(<App />, {
      route: '/activity-logs',
      permissions: ['audit.read'],
      loading: true,
    })
    expect(screen.getByText(/Checking access/i)).toBeInTheDocument()
  })
})
