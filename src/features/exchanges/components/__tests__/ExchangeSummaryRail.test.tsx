/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExchangeSummaryRail, differenceLabel } from '../ExchangeSummaryRail'

describe('ExchangeSummaryRail', () => {
  it('labels difference correctly', () => {
    expect(differenceLabel(100)).toBe('Customer pays')
    expect(differenceLabel(-50)).toBe('Refund')
    expect(differenceLabel(0)).toBe('Even')
  })

  it('renders returns, replacements, and difference', () => {
    render(
      <ExchangeSummaryRail
        returnTotal={2200}
        replacementTotal={1100}
        difference={-1100}
        returnCount={1}
        replacementCount={1}
      />,
    )
    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText(/Refund/i)).toBeInTheDocument()
  })
})
