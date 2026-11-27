/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useReportFilters } from './use-report-filters'

function FilterProbe() {
  const { range, filters, setFilters } = useReportFilters()
  const location = useLocation()
  return (
    <div>
      <output>{`${range.from}|${range.to}|${filters.status}`}</output>
      <output data-testid="query">{location.search}</output>
      <button onClick={() => setFilters({ status: 'settled' })}>Change status</button>
    </div>
  )
}

describe('report URL date ownership', () => {
  it('uses explicit valid URL dates and keeps them when status changes', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/reports/cod-settlement?from=2024-02-29&to=2024-03-01&status=pending']}>
        <FilterProbe />
      </MemoryRouter>,
    )
    expect(screen.getByText('2024-02-29|2024-03-01|pending')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change status' }))
    expect(screen.getByText('2024-02-29|2024-03-01|settled')).toBeInTheDocument()
    expect(screen.getByTestId('query').textContent).toContain('from=2024-02-29')
    expect(screen.getByTestId('query').textContent).toContain('to=2024-03-01')
  })
})
