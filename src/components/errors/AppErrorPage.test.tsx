/** @vitest-environment jsdom */
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppErrorPage } from './AppErrorPage'

function renderWithRouter(ui: ReactNode, initialPath = '/') {
  const router = createMemoryRouter(
    [{ path: '*', element: ui }],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppErrorPage', () => {
  it('shows public home action on storefront routes', () => {
    renderWithRouter(<AppErrorPage />, '/shop')
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Go to Home/i })).toBeTruthy()
  })

  it('shows dashboard action on ERP routes', () => {
    renderWithRouter(<AppErrorPage variant="erp" />, '/dashboard')
    expect(screen.getByRole('link', { name: /Go to Dashboard/i })).toBeTruthy()
  })

  it('shows offline messaging when offline variant is used', () => {
    renderWithRouter(<AppErrorPage variant="offline" />)
    expect(screen.getByRole('heading', { name: /offline/i })).toBeTruthy()
    expect(screen.getByText(/Check your internet connection/i)).toBeTruthy()
  })

  it('does not expose stack traces in production UI', () => {
    const previous = import.meta.env.DEV
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, DEV: false },
      configurable: true,
    })

    renderWithRouter(
      <AppErrorPage technicalDetails="TypeError: secret internals at /assets/foo.js" />,
    )
    expect(screen.queryByText(/secret internals/i)).toBeNull()

    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, DEV: previous },
      configurable: true,
    })
  })
})
