/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from '../EmptyState'
import { renderWithAppProviders } from '@/test'

describe('EmptyState', () => {
  it('renders default title and description', () => {
    renderWithAppProviders(<EmptyState />)
    expect(screen.getByText('No records found')).toBeInTheDocument()
    expect(screen.getByText(/adjusting your search/i)).toBeInTheDocument()
  })

  it('renders custom copy and fires action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderWithAppProviders(
      <EmptyState title="No sales" description="Create one" actionLabel="New sale" onAction={onAction} />,
    )
    expect(screen.getByText('No sales')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New sale' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('hides action when handler missing', () => {
    renderWithAppProviders(<EmptyState actionLabel="Hidden" />)
    expect(screen.queryByRole('button', { name: 'Hidden' })).not.toBeInTheDocument()
  })
})
