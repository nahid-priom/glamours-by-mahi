import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

const allowedConsoleErrors = new WeakSet<object>()

declare global {
  // eslint-disable-next-line no-var
  var __allowConsoleError: ((err: unknown) => void) | undefined
}

globalThis.__allowConsoleError = (err: unknown) => {
  if (err && typeof err === 'object') allowedConsoleErrors.add(err)
}

const originalError = console.error
const originalWarn = console.warn

beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const first = args[0]
    if (first && typeof first === 'object' && allowedConsoleErrors.has(first)) {
      return
    }
    const msg = args.map(String).join(' ')
    if (msg.includes('not wrapped in act(') || msg.includes('ReactDOMTestUtils.act')) {
      return
    }
    originalError(...args)
    throw new Error(`Unexpected console.error: ${msg}`)
  }
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(' ')
    if (msg.includes('React Router Future Flag Warning')) return
    originalWarn(...args)
  }
})

afterEach(() => {
  cleanup()
  console.error = originalError
  console.warn = originalWarn
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const isDom =
  typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined'

if (isDom) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds: number[] = []
  }

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  }
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })

  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(window, 'print', {
    writable: true,
    value: vi.fn(),
  })
}
