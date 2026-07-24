import { demoRef } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { daysAgo, currentYear } from '../_lib/dates.mjs'
import { backdateTransfer } from '../_lib/backdate.mjs'
import { findTransferByNo } from '../_lib/resolve.mjs'

async function getBranchStock(ctx, branchId, minQty = 5) {
  const bc = ctx.branchMap.get(branchId)
  const { data: balances } = await client
    .from('inventory_balances')
    .select('variant_id, quantity')
    .eq('location_id', bc.saleableLocationId)
    .is('deleted_at', null)
    .gt('quantity', minQty)
  const stockMap = new Map((balances ?? []).map((b) => [b.variant_id, Number(b.quantity)]))
  return ctx.catalog
    .filter((v) => (stockMap.get(v.id) ?? 0) >= minQty)
    .slice(0, 20)
    .map((v) => ({ variant_id: v.id, quantity_sent: Math.min(8, Math.floor(stockMap.get(v.id) / 2)), unit_cost: v.cost || 200 }))
}

export async function runTransfers(ctx) {
  const year = currentYear()
  const main = ctx.main
  const targets = ctx.additional.slice(0, Math.min(3, ctx.additional.length))
  if (!targets.length) {
    console.log('Transfers: skipped (no additional branches)')
    return []
  }

  const scenarios = [
    { suffix: '0001', branch: targets[0], mode: 'full', daysAgo: 70 },
    { suffix: '0002', branch: targets[0], mode: 'partial', daysAgo: 45 },
    { suffix: '0003', branch: targets[1] ?? targets[0], mode: 'in_transit', daysAgo: 8 },
  ]
  if (targets[1]) {
    scenarios.push({ suffix: '0004', branch: targets[1], mode: 'damaged', daysAgo: 30 })
  }
  scenarios.push({ suffix: '0005', branch: targets[0], mode: 'draft', daysAgo: 3 })

  const created = []
  const skipped = []

  for (const sc of scenarios) {
    const transferNo = demoRef('TRF', main.code, sc.suffix, year)
    const existing = await findTransferByNo(ctx.org.id, transferNo)
    if (existing) {
      skipped.push(transferNo)
      continue
    }

    const items = await getBranchStock(ctx, main.id, 6)
    if (!items.length) {
      ctx.stats.errors.push(`transfer ${transferNo}: insufficient HQ stock`)
      continue
    }
    const pick = items.slice(0, 2)

    const bcFrom = ctx.branchMap.get(main.id)
    const bcTo = ctx.branchMap.get(sc.branch.id)

    const { data: transfer, error: insErr } = await client
      .from('stock_transfers')
      .insert({
        organization_id: ctx.org.id,
        transfer_no: transferNo,
        from_branch_id: main.id,
        to_branch_id: sc.branch.id,
        from_location_id: bcFrom.saleableLocationId,
        to_location_id: bcTo.saleableLocationId,
        status: 'draft',
        notes: `legacy_multibranch_demo_v1 · ${transferNo}`,
      })
      .select('id')
      .single()
    if (insErr) {
      ctx.stats.errors.push(`transfer ${transferNo}: ${insErr.message}`)
      continue
    }

    const rows = pick.map((item) => ({
      organization_id: ctx.org.id,
      transfer_id: transfer.id,
      variant_id: item.variant_id,
      quantity_sent: item.quantity_sent,
      unit_cost: item.unit_cost,
    }))
    await client.from('stock_transfer_items').insert(rows)

    if (sc.mode === 'draft') {
      created.push({ transferNo, status: 'draft' })
      console.log(`  ✓ ${transferNo} (draft)`)
      continue
    }

    const { error: dispErr } = await client.rpc('dispatch_stock_transfer', { transfer_id: transfer.id })
    if (dispErr) {
      ctx.stats.errors.push(`dispatch ${transferNo}: ${dispErr.message}`)
      continue
    }
    await backdateTransfer(transfer.id, daysAgo(sc.daysAgo))

    if (sc.mode === 'in_transit') {
      created.push({ transferNo, status: 'in_transit' })
      console.log(`  ✓ ${transferNo} (in transit)`)
      continue
    }

    const { data: trItems } = await client
      .from('stock_transfer_items')
      .select('id, variant_id, quantity_sent')
      .eq('transfer_id', transfer.id)
      .is('deleted_at', null)

    const receiveItems = (trItems ?? []).map((row) => {
      const sent = Number(row.quantity_sent)
      if (sc.mode === 'partial') {
        return { id: row.id, variant_id: row.variant_id, quantity_received: Math.max(1, Math.floor(sent / 2)) }
      }
      if (sc.mode === 'damaged') {
        const recv = Math.max(1, sent - 1)
        return {
          id: row.id,
          variant_id: row.variant_id,
          quantity_received: recv,
          quantity_damaged: 1,
          condition: 'damaged',
        }
      }
      return { id: row.id, variant_id: row.variant_id, quantity_received: sent }
    })

    const finalize = sc.mode === 'full' || sc.mode === 'damaged'
    const { error: recvErr } = await client.rpc('receive_stock_transfer', {
      transfer_id: transfer.id,
      items: receiveItems,
      finalize,
    })
    if (recvErr) {
      ctx.stats.errors.push(`receive ${transferNo}: ${recvErr.message}`)
      continue
    }

    created.push({ transferNo, status: sc.mode })
    console.log(`  ✓ ${transferNo} (${sc.mode})`)
  }

  ctx.stats.created.transfers = created.length
  ctx.stats.skipped.transfers = skipped.length
  console.log(`Transfers: ${created.length} created, ${skipped.length} skipped`)
  return created
}
