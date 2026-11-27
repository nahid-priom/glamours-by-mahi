/** @vitest-environment jsdom */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '@/test'
import { AppDateRangeField } from '../AppDateRangeField'

function ControlledRange() {
  const [range, setRange] = useState({ from: '2026-08-01', to: '2026-08-01' })
  return <AppDateRangeField from={range.from} to={range.to} onChange={setRange} />
}

describe('AppDateRangeField', () => {
  it('keeps the navigated month while choosing a cross-month custom range', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<ControlledRange />)
    await user.click(screen.getByRole('button', { name: '01 Aug 2026' }))
    await user.click(screen.getByRole('button', { name: '31 Aug 2026' }))
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getAllByText('Sep 2026').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: '02 Sep 2026' }))
    expect(screen.getByRole('button', { name: /31 Aug 2026.*02 Sep 2026/ })).toBeInTheDocument()
  })
})
