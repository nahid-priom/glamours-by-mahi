/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '@/test'
import { AppDateField } from '../AppDateField'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'

describe('AppDateField / ReportFilterBar', () => {
  it('renders without native type=date', () => {
    const { container } = renderWithAppProviders(
      <AppDateField value="2026-08-01" onChange={vi.fn()} />,
    )
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens calendar and picks a day', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithAppProviders(<AppDateField value="2026-08-01" onChange={onChange} />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('dialog', { name: /choose date/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  })

  it('ReportFilterBar uses SSOT range field', () => {
    const { container } = renderWithAppProviders(
      <ReportFilterBar range={{ from: '2026-08-01', to: '2026-08-07' }} onRangeChange={vi.fn()} />,
    )
    expect(container.querySelector('input[type="date"]')).toBeNull()
  })
})
