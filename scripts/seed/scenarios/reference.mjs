import { NS, txnKey } from '../_lib/constants.mjs'
import { client } from '../_lib/clients.mjs'
import { daysAgo } from '../_lib/dates.mjs'
import { backdateCustomer } from '../_lib/backdate.mjs'
import { findByNotesMarker } from '../_lib/resolve.mjs'

const SUPPLIERS = [
  { ref: 'DEMO-SUP-001', name: 'Dhaka Fabrics Ltd', contact: 'Abdul Jabbar', phone: '01819001001', district: 'Dhaka', terms: 'Net 15' },
  { ref: 'DEMO-SUP-002', name: 'Narayanganj Garments Hub', contact: 'Salma Khatun', phone: '01819001002', district: 'Narayanganj', terms: 'Net 30' },
  { ref: 'DEMO-SUP-003', name: 'Chittagong Trading Co', contact: 'Rafiq Uddin', phone: '01819001003', district: 'Chattogram', terms: 'Cash' },
  { ref: 'DEMO-SUP-004', name: 'Bogra Wholesale House', contact: 'Mizanur Rahman', phone: '01819001004', district: 'Bogra', terms: 'Net 7' },
  { ref: 'DEMO-SUP-005', name: 'Sylhet Silk Mart', contact: 'Nazma Begum', phone: '01819001005', district: 'Sylhet', terms: 'Net 15' },
  { ref: 'DEMO-SUP-006', name: 'Gazipur Knitwear', contact: 'Kamal Hossain', phone: '01819001006', district: 'Gazipur', terms: 'Net 30' },
  { ref: 'DEMO-SUP-007', name: 'Khulna Fashion Import', contact: 'Shirin Akter', phone: '01819001007', district: 'Khulna', terms: 'Net 15' },
  { ref: 'DEMO-SUP-008', name: 'Mirpur Accessories Depot', contact: 'Tanvir Ahmed', phone: '01819001008', district: 'Dhaka', terms: 'Cash' },
]

const CUSTOMER_NAMES = [
  ['Ayesha Rahman', '01799001001', 'Dhanmondi'],
  ['Karim Uddin', '01799001002', 'Uttara'],
  ['Nusrat Jahan', '01799001003', 'Mirpur'],
  ['Rafi Ahmed', '01799001004', 'Gulshan'],
  ['Sadia Islam', '01799001005', 'Banani'],
  ['Imran Hossain', '01799001006', 'Mohammadpur'],
  ['Maliha Khatun', '01799001007', 'Farmgate'],
  ['Tanvir Chowdhury', '01799001008', 'Bashundhara'],
  ['Farhana Akter', '01799001009', 'Baridhara'],
  ['Sakib Mahmud', '01799001010', 'Motijheel'],
  ['Rupa Begum', '01799001011', 'Old Dhaka'],
  ['Arif Khan', '01799001012', 'Wari'],
  ['Lamia Sultana', '01799001013', 'Tejgaon'],
  ['Hasan Ali', '01799001014', 'Khilgaon'],
  ['Priya Das', '01799001015', 'Rampura'],
  ['Jahangir Alam', '01799001016', 'Jatrabari'],
  ['Nadia Chowdhury', '01799001017', 'Elephant Road'],
  ['Rubel Mia', '01799001018', 'Shyamoli'],
  ['Sumaiya Parvin', '01799001019', 'Badda'],
  ['Omar Faruk', '01799001020', 'Malibagh'],
  ['Tasnim Ahmed', '01799001021', 'Panthapath'],
  ['Zahid Hasan', '01799001022', 'Kakrail'],
  ['Mehjabin Islam', '01799001023', 'Green Road'],
  ['Parvez Hossain', '01799001024', 'Mirpur DOHS'],
  ['Shamima Akter', '01799001025', 'Uttara Sector 7'],
  ['Walk-in Regular', '01799001026', 'Dhaka'],
  ['Wholesale Buyer Ltd', '01799001027', 'Motijheel'],
  ['Boutique Partner', '01799001028', 'Gulshan'],
  ['Corporate Client', '01799001029', 'Banani'],
  ['Overdue Customer', '01799001030', 'Farmgate'],
  ['Settled Customer', '01799001031', 'Dhanmondi'],
  ['Partial Payer', '01799001032', 'Uttara'],
  ['Return Customer', '01799001033', 'Mirpur'],
  ['VIP Client', '01799001034', 'Baridhara'],
  ['Seasonal Buyer', '01799001035', 'Bashundhara'],
]

export async function seedSuppliers(ctx) {
  const existing = await findByNotesMarker('suppliers', ctx.org.id)
  const byPhone = new Map(existing.map((s) => [s.phone, s]))
  const created = []
  const skipped = []

  for (const spec of SUPPLIERS) {
    if (byPhone.has(spec.phone)) {
      skipped.push(spec.ref)
      continue
    }
    const branch = ctx.selected[created.length % ctx.selected.length]
    const { data, error } = await client
      .from('suppliers')
      .insert({
        organization_id: ctx.org.id,
        branch_id: branch.id,
        name: spec.name,
        phone: spec.phone,
        email: `${spec.ref.toLowerCase()}@demo.local`,
        address: `${spec.district}, Bangladesh`,
        status: 'active',
        notes: `${NS} · ${spec.ref} · ${spec.contact} · ${spec.terms}`,
      })
      .select('id, name')
      .single()
    if (error) {
      ctx.stats.errors.push(`supplier ${spec.ref}: ${error.message}`)
      continue
    }
    await backdateCustomer(data.id, 'suppliers', daysAgo(120 + created.length * 3))
    created.push(data)
  }

  ctx.suppliers = [...(await findByNotesMarker('suppliers', ctx.org.id))]
  ctx.stats.created.suppliers = created.length
  ctx.stats.skipped.suppliers = skipped.length
  console.log(`Suppliers: ${created.length} created, ${skipped.length} skipped (${ctx.suppliers.length} total demo)`)
  return ctx.suppliers
}

export async function seedCustomers(ctx) {
  const existing = await findByNotesMarker('customers', ctx.org.id)
  const byPhone = new Map(existing.map((c) => [c.phone, c]))
  const created = []
  const skipped = []

  CUSTOMER_NAMES.forEach((row, idx) => {
    const [name, phone, area] = row
    if (byPhone.has(phone)) {
      skipped.push(phone)
      return
    }
    const branch = ctx.selected[idx % ctx.selected.length]
    created.push({ name, phone, area, branch })
  })

  for (let i = 0; i < created.length; i++) {
    const spec = created[i]
    const { data, error } = await client
      .from('customers')
      .insert({
        organization_id: ctx.org.id,
        branch_id: spec.branch.id,
        name: spec.name,
        phone: spec.phone,
        address: `${spec.area}, Dhaka`,
        district: 'Dhaka',
        status: 'active',
        notes: `${NS} · DEMO-CUS-${String(i + 1).padStart(3, '0')}`,
      })
      .select('id, name, phone, branch_id')
      .single()
    if (error) {
      ctx.stats.errors.push(`customer ${spec.phone}: ${error.message}`)
      continue
    }
    await backdateCustomer(data.id, 'customers', daysAgo(90 + i))
  }

  ctx.customers = [...(await findByNotesMarker('customers', ctx.org.id))]
  ctx.customersByBranch = new Map()
  for (const b of ctx.selected) {
    ctx.customersByBranch.set(
      b.id,
      ctx.customers.filter((c) => c.branch_id === b.id),
    )
  }
  ctx.stats.created.customers = created.length - ctx.stats.errors.length
  ctx.stats.skipped.customers = skipped.length
  console.log(`Customers: ${ctx.stats.created.customers} created, ${skipped.length} skipped (${ctx.customers.length} total demo)`)
  return ctx.customers
}

export async function ensureExpenseCategories(ctx) {
  const names = [
    'Shop Rent',
    'Electricity',
    'Internet',
    'Staff Refreshments',
    'Delivery',
    'Packaging',
    'Local Transport',
    'Repair & Maintenance',
    'Marketing',
    'Office Supplies',
    'Cleaning',
    'Mobile Bill',
  ]
  const { data: existing } = await client
    .from('expense_categories')
    .select('id, name')
    .eq('organization_id', ctx.org.id)
    .is('deleted_at', null)

  const byName = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c]))
  ctx.expenseCategories = []

  for (const name of names) {
    const found = byName.get(name.toLowerCase())
    if (found) {
      ctx.expenseCategories.push(found)
      continue
    }
    const { data, error } = await client
      .from('expense_categories')
      .insert({ organization_id: ctx.org.id, name, is_active: true, sort_order: ctx.expenseCategories.length + 1 })
      .select('id, name')
      .single()
    if (!error && data) ctx.expenseCategories.push(data)
  }
  return ctx.expenseCategories
}

export async function runReference(ctx) {
  await seedSuppliers(ctx)
  await seedCustomers(ctx)
  await ensureExpenseCategories(ctx)
}
