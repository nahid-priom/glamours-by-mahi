import { useCallback, useRef, useState } from 'react'
import { findVariantByBarcodeExact } from '../repositories/pos.repository'
import { normalizeBarcode } from '../cart-utils'
import type { PosVariant } from '../types'

export type BarcodeLookupResult =
  | { status: 'found'; variant: PosVariant }
  | { status: 'not_found'; code: string }
  | { status: 'out_of_stock'; variant: PosVariant }
  | { status: 'empty' }

export function usePosBarcodeLookup(branchId: string | null | undefined) {
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef<string | null>(null)

  const lookup = useCallback(
    async (rawCode: string): Promise<BarcodeLookupResult> => {
      const code = normalizeBarcode(rawCode)
      if (!code || !branchId) return { status: 'empty' }

      // Prevent duplicate concurrent submissions of the same code
      if (inFlightRef.current === code) return { status: 'empty' }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      inFlightRef.current = code
      setLoading(true)

      try {
        const variant = await findVariantByBarcodeExact(code, branchId)
        if (controller.signal.aborted) return { status: 'empty' }
        if (!variant) return { status: 'not_found', code }
        if (variant.availableStock <= 0) return { status: 'out_of_stock', variant }
        return { status: 'found', variant }
      } finally {
        if (inFlightRef.current === code) inFlightRef.current = null
        if (abortRef.current === controller) {
          setLoading(false)
        }
      }
    },
    [branchId],
  )

  return { lookup, loading }
}
