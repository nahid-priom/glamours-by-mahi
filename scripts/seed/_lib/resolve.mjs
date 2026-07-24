import { NS } from './constants.mjs'
import { client, db } from './clients.mjs'
import { SEED_ORG_SLUG } from './env.mjs'

/**
 * Phase 1 audit + dynamic org/branch resolution.
 * Never hardcodes UUIDs — resolves from the signed-in user's organization.
 */
export async function resolveOrganization() {
  const { data: profile, error: pErr } = await client
    .from('profiles')
    .select('organization_id, default_branch_id, full_name, email')
    .maybeSingle()
  if (pErr) throw new Error(`Cannot read profile: ${pErr.message}`)
  if (!profile?.organization_id) {
    throw new Error('Signed-in user has no organization_id on profile.')
  }

  let orgQuery = client
    .from('organizations')
    .select('id, name, slug, currency')
    .eq('id', profile.organization_id)
    .is('deleted_at', null)
  if (SEED_ORG_SLUG) orgQuery = orgQuery.eq('slug', SEED_ORG_SLUG)

  const { data: org, error: oErr } = await orgQuery.maybeSingle()
  if (oErr) throw new Error(`Cannot read organization: ${oErr.message}`)
  if (!org) throw new Error('Organization not found for signed-in user.')

  return { org, profile }
}

export async function resolveBranches(orgId, maxAdditional = 4) {
  const { data: branches, error } = await client
    .from('branches')
    .select('id, code, name, is_central, is_active, address, phone')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_central', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Cannot read branches: ${error.message}`)
  if (!branches?.length) throw new Error('No active branches found.')

  const main = branches.find((b) => b.is_central) ?? branches[0]
  const additional = branches.filter((b) => b.id !== main.id).slice(0, maxAdditional)
  const selected = [main, ...additional]

  return { main, additional, selected, allActive: branches }
}

export async function loadPaymentContext(orgId) {
  const { data: methods, error: mErr } = await client
    .from('payment_methods')
    .select('code, name, financial_account_id, is_due, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (mErr) throw new Error(`Cannot read payment methods: ${mErr.message}`)

  const { data: accounts, error: aErr } = await client
    .from('financial_accounts')
    .select('id, name, account_kind, branch_id, is_active, is_default')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (aErr) throw new Error(`Cannot read financial accounts: ${aErr.message}`)
  if (!accounts?.length) throw new Error('No active financial accounts.')

  const payMethods = methods ?? []
  const pick = (...codes) =>
    payMethods.find((m) => codes.includes((m.code || '').toLowerCase()) && !m.is_due)
  const cash = pick('cash') || payMethods.find((m) => !m.is_due)
  const bank = pick('bank', 'card') || cash
  const bkash = pick('bkash', 'nagad', 'rocket') || bank
  const due = payMethods.find((m) => m.is_due)
  if (!cash) throw new Error('No non-due payment method found.')

  const defaultAccountId = accounts.find((a) => a.is_default)?.id ?? accounts[0].id
  const accountFor = (m) => m?.financial_account_id || defaultAccountId

  return { payMethods, accounts, cash, bank, bkash, due, defaultAccountId, accountFor }
}

export async function loadBranchContext(branch, orgId) {
  const { data: locations, error: locErr } = await client
    .from('stock_locations')
    .select('id, location_type, name, is_default')
    .eq('branch_id', branch.id)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (locErr) throw new Error(`Cannot read locations for ${branch.code}: ${locErr.message}`)

  const saleable = (locations ?? []).filter((l) => l.location_type === 'saleable')
  const damaged = (locations ?? []).find((l) => l.location_type === 'damaged')
  const quarantine = (locations ?? []).find((l) => l.location_type === 'quarantine')
  if (!saleable.length) {
    throw new Error(`No saleable location in branch ${branch.name} (${branch.code}).`)
  }

  const { data: employees, error: eErr } = await client
    .from('employees')
    .select('id, employee_code, full_name, branch_id, commission_eligible, status')
    .eq('organization_id', orgId)
    .eq('branch_id', branch.id)
    .eq('status', 'active')
    .is('deleted_at', null)
  if (eErr) throw new Error(`Cannot read employees: ${eErr.message}`)

  return {
    branch,
    saleableLocations: saleable,
    saleableLocationId: saleable[0].id,
    damagedLocationId: damaged?.id ?? null,
    quarantineLocationId: quarantine?.id ?? null,
    employees: employees ?? [],
  }
}

export async function loadCatalogVariants(orgId, locationIds) {
  const database = db()
  const { data: balances, error: balErr } = await database
    .from('inventory_balances')
    .select('variant_id, location_id, quantity')
    .in('location_id', locationIds)
    .is('deleted_at', null)
  if (balErr) throw new Error(`Cannot read inventory: ${balErr.message}`)

  const stockByVariant = new Map()
  for (const b of balances ?? []) {
    stockByVariant.set(b.variant_id, (stockByVariant.get(b.variant_id) ?? 0) + Number(b.quantity ?? 0))
  }

  const { data: variants, error: vErr } = await database
    .from('product_variants')
    .select(
      'id, sku, name, barcode, selling_price, purchase_price, wholesale_price, is_active, products!inner(name, organization_id)',
    )
    .eq('is_active', true)
    .is('deleted_at', null)
    .eq('products.organization_id', orgId)
    .order('sku')
  if (vErr) throw new Error(`Cannot read variants: ${vErr.message}`)

  return (variants ?? []).map((v) => {
    const product = v.products
    return {
      id: v.id,
      sku: v.sku,
      name: v.name || product?.name,
      productName: product?.name,
      price: Number(v.selling_price ?? 0),
      cost: Number(v.purchase_price ?? 0),
      wholesale: Number(v.wholesale_price ?? 0),
      stock: Math.floor(stockByVariant.get(v.id) ?? 0),
    }
  })
}

export async function findByNotesMarker(table, orgId, marker = NS) {
  const database = db()
  const { data, error } = await database
    .from(table)
    .select('*')
    .eq('organization_id', orgId)
    .ilike('notes', `%${marker}%`)
    .is('deleted_at', null)
  if (error) throw new Error(`Cannot query ${table}: ${error.message}`)
  return data ?? []
}

export async function findByClientTxnKey(table, orgId, key) {
  const { data, error } = await client
    .from(table)
    .select('id, invoice_no, client_txn_key, status')
    .eq('organization_id', orgId)
    .eq('client_txn_key', key)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(`Cannot query ${table} by key: ${error.message}`)
  return data
}

export async function findTransferByNo(orgId, transferNo) {
  const { data, error } = await client
    .from('stock_transfers')
    .select('id, transfer_no, status')
    .eq('organization_id', orgId)
    .eq('transfer_no', transferNo)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(`Cannot query transfer: ${error.message}`)
  return data
}

export function printAuditSummary(ctx) {
  const { org, main, additional, selected, payment } = ctx
  console.log('\n═══ Phase 1: Legacy System Audit ═══')
  console.log(`Organization: ${org.name} (${org.slug})`)
  console.log(`Main Branch: ${main.name} [${main.code}]`)
  console.log(`Additional Branches (${additional.length}): ${additional.map((b) => `${b.name} [${b.code}]`).join(', ') || '(none)'}`)
  console.log(`Selected for seeding: ${selected.length} branch(es)`)
  console.log(`Payment methods: ${payment.payMethods.map((m) => m.code).join(', ')}`)
  console.log(`Financial accounts: ${payment.accounts.length}`)
  console.log('\nCanonical RPCs: complete_purchase, complete_pos_sale, dispatch/receive_stock_transfer,')
  console.log('  collect_customer_due, pay_supplier, approve_sales_return, approve_purchase_return,')
  console.log('  create_expense, approve/pay_sales_commission')
  console.log(`\nSeed namespace: ${NS}`)
  console.log('Legacy note: purchases are atomic (no partial receive RPC); partial receiving applies to transfers only.')
  console.log('═══════════════════════════════════\n')
}

export async function buildSeedContext(maxAdditional) {
  const { org, profile } = await resolveOrganization()
  const { main, additional, selected, allActive } = await resolveBranches(org.id, maxAdditional)
  const payment = await loadPaymentContext(org.id)

  const branchMap = new Map()
  for (const b of selected) {
    branchMap.set(b.id, await loadBranchContext(b, org.id))
  }

  const allSaleableIds = [...branchMap.values()].flatMap((bc) =>
    bc.saleableLocations.map((l) => l.id),
  )
  const catalog = await loadCatalogVariants(org.id, allSaleableIds)

  return {
    org,
    profile,
    main,
    additional,
    selected,
    allActive,
    payment,
    branchMap,
    catalog,
    stats: {
      created: {},
      skipped: {},
      errors: [],
    },
  }
}
