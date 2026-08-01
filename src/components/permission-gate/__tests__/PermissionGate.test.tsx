/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { PermissionGate } from '../PermissionGate'
import { renderWithAppProviders } from '@/test'

describe('PermissionGate', () => {
  it('renders children when permission granted', () => {
    renderWithAppProviders(
      <PermissionGate permission="sales.read">
        <button type="button">Edit</button>
      </PermissionGate>,
      { permissions: ['sales.read'] },
    )
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('hides children when permission missing', () => {
    renderWithAppProviders(
      <PermissionGate permission="sales.void" fallback={<span>Denied</span>}>
        <button type="button">Void</button>
      </PermissionGate>,
      { permissions: ['sales.read'] },
    )
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument()
    expect(screen.getByText('Denied')).toBeInTheDocument()
  })

  it('allows wildcard Super Admin', () => {
    renderWithAppProviders(
      <PermissionGate permission="administration.roles.manage">
        <span>Roles</span>
      </PermissionGate>,
      { permissions: ['*'] },
    )
    expect(screen.getByText('Roles')).toBeInTheDocument()
  })
})
