import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase/client'
import { placeEcommerceOrder } from '@/features/storefront/repositories/storefront-orders.repository'
import { onlineOrdersRepository } from '@/features/sales/repositories/online-orders.repository'
import { reconciliationRepository } from '@/features/accounting/repositories/reconciliation.repository'

describe('unified core RPC wrappers', () => {
  it('placeEcommerceOrder maps storefront payload to place_online_order', async () => {
    const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
    rpc.mockResolvedValueOnce({
      data: {
        sale_id: 'sale-1',
        invoice_no: 'WEB-000001',
        grand_total: 500,
        shipping: 80,
        public_share_token: 'abc',
      },
      error: null,
    })

    const result = await placeEcommerceOrder({
      org_slug: 'glamourous-by-mahi',
      client_txn_key: 'web-key-1',
      customer_name: 'Test',
      customer_phone: '01700000000',
      delivery_address: 'Dhaka address line',
      district: 'Dhaka',
      shipping: 80,
      items: [{ variant_id: 'var-1', quantity: 2 }],
    })

    expect(rpc).toHaveBeenCalledWith('place_online_order', {
      payload: expect.objectContaining({
        organization_slug: 'glamourous-by-mahi',
        client_txn_key: 'web-key-1',
        items: [{ variant_id: 'var-1', qty: 2 }],
      }),
    })
    expect(result.invoice_no).toBe('WEB-000001')
    expect(result.grand_total).toBe(500)
  })

  it('fulfilOnlineOrder calls fulfil_online_order', async () => {
    const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
    rpc.mockResolvedValueOnce({ data: { sale_id: 's1', idempotent: false }, error: null })
    await onlineOrdersRepository.fulfilOnlineOrder('s1')
    expect(rpc).toHaveBeenCalledWith('fulfil_online_order', {
      payload: { sale_id: 's1', payments: undefined },
    })
  })

  it('reconciliation dry-runs use mode=dry_run', async () => {
    const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>
    rpc.mockResolvedValueOnce({ data: { affected_balances: 3 }, error: null })
    await reconciliationRepository.dryRunOpeningStock()
    expect(rpc).toHaveBeenCalledWith('recon_opening_stock_ledger', {
      payload: { mode: 'dry_run' },
    })
  })
})
