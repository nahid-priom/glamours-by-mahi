import { brandConfig } from '@/config/brand'
import type {
  ERPDatabase,
  Product,
  Customer,
  Sale,
  Order,
  Purchase,
  StockBalance,
  StockMovement,
  AttendanceRecord,
  FinancialTransaction,
  ActivityLog,
  Notification,
  Commission,
  CourierBooking,
  CourierSettlement,
  Payroll,
  Collection,
  SupplierPayment,
} from './schema'
import { ERP_DB_VERSION } from './schema'

const now = () => new Date().toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const id = (prefix: string, n: number) => `${prefix}_${String(n).padStart(3, '0')}`

const PRODUCT_NAMES = [
  'Floral Midi Dress', 'Linen Co-ord Set', 'Embroidered Kurti', 'Silk Party Gown',
  'Cotton Casual Top', 'Anarkali Suit', 'Denim Jacket', 'Pleated Skirt',
  'Wrap Blouse', 'Chiffon Dupatta Set', 'Office Formal Shirt', 'Summer Maxi Dress',
  'Velvet Evening Dress', 'Printed Palazzo Set', 'Knit Cardigan', 'Lace Crop Top',
  'Tailored Blazer', 'Georgette Saree Style', 'Kids Party Frock', 'Men Linen Shirt',
]

const BD_NAMES = [
  'Rahim Ahmed', 'Fatima Begum', 'Karim Hossain', 'Nusrat Jahan', 'Sakib Hasan',
  'Ayesha Siddique', 'Tanvir Islam', 'Maliha Rahman', 'Imran Khan', 'Sadia Islam',
  'Rafiul Karim', 'Nadia Chowdhury', 'Mehedi Hasan', 'Shabnam Akter', 'Farhan Ali',
]

const DISTRICTS = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi', 'Khulna', 'Gazipur']
const COURIERS = ['Steadfast', 'Pathao Courier', 'RedX', 'Paperfly', 'Sundarban Courier']

export function createSeedDatabase(): ERPDatabase {
  const seededAt = now()

  const branches = [
    { id: 'br_001', name: 'Bashundhara City Flagship', code: 'BC', address: 'Level 2, Bashundhara City, Dhaka', phone: '01700000001', isCentral: true, isActive: true, created_at: daysAgo(400) },
    { id: 'br_002', name: 'Jamuna Future Park', code: 'JFP', address: 'Jamuna Future Park, Dhaka', phone: '01700000002', isCentral: false, isActive: true, created_at: daysAgo(300) },
    { id: 'br_003', name: 'Gulshan Boutique', code: 'GLN', address: 'Road 11, Gulshan-1, Dhaka', phone: '01700000003', isCentral: false, isActive: true, created_at: daysAgo(200) },
    { id: 'br_004', name: 'Central Warehouse', code: 'WH', address: 'Tejgaon Industrial Area, Dhaka', phone: '01700000004', isCentral: false, isActive: true, created_at: daysAgo(400) },
  ]

  const categories = [
    { id: 'cat_001', name: 'Dresses', slug: 'dress' },
    { id: 'cat_002', name: 'Co-ord Sets', slug: 'co-ord-set' },
    { id: 'cat_003', name: 'Kurtis', slug: 'kurti' },
    { id: 'cat_004', name: 'Tops & Tunics', slug: 'tops-tunic' },
    { id: 'cat_005', name: 'Party Wear', slug: 'party' },
    { id: 'cat_006', name: 'Accessories', slug: 'accessories' },
    { id: 'cat_007', name: 'Outerwear', slug: 'outerwear' },
    { id: 'cat_008', name: 'New Arrival', slug: 'new-arrival' },
    { id: 'cat_009', name: 'Best Seller', slug: 'best-seller' },
    { id: 'cat_010', name: 'Sale', slug: 'sale' },
    { id: 'cat_011', name: 'Wedding', slug: 'wedding' },
    { id: 'cat_012', name: 'Casual Wear', slug: 'casual' },
  ]

  const brands = [
    { id: 'brand_001', name: 'Glamourous Essentials' },
    { id: 'brand_002', name: 'Mahi Luxe' },
    { id: 'brand_003', name: 'Bashundhara Edit' },
    { id: 'brand_004', name: 'Urban Bloom' },
    { id: 'brand_005', name: 'Silk & Grace' },
    { id: 'brand_006', name: 'Daily Muse' },
    { id: 'brand_007', name: 'Festive Atelier' },
    { id: 'brand_008', name: 'Studio Mahi' },
  ]

  const products: Product[] = Array.from({ length: 100 }, (_, i) => {
    const n = i + 1
    const base = 1200 + (i % 20) * 250
    const cost = Math.round(base * 0.55)
    return {
      id: id('pr', n),
      sku: `GBM-${String(n).padStart(4, '0')}`,
      name: `${PRODUCT_NAMES[i % PRODUCT_NAMES.length]} ${Math.floor(i / PRODUCT_NAMES.length) + 1}`,
      categoryId: categories[i % categories.length].id,
      brandId: brands[i % brands.length].id,
      price: base,
      cost,
      salePrice: i % 5 === 0 ? Math.round(base * 0.85) : undefined,
      image: `https://images.unsplash.com/photo-${['1595777457583-95e05998dd29', '1483985988355-763728dc32e1', '1581044777550-4cfa60707c03', '1515372039744-b8f02a3ae446'][i % 4]}?w=600&q=80&auto=format&fit=crop`,
      status: 'active',
      created_at: daysAgo(90 - (i % 60)),
      deleted_at: null,
    }
  })

  const stockBalances: StockBalance[] = []
  const stockMovements: StockMovement[] = []
  products.forEach((p, i) => {
    branches.forEach((b, bi) => {
      const qty = b.code === 'WH' ? 40 + (i % 30) : 8 + ((i + bi) % 20)
      const reserved = i % 17 === 0 ? 1 : 0
      stockBalances.push({
        id: `sb_${p.id}_${b.id}`,
        productId: p.id,
        branchId: b.id,
        quantity: qty,
        reserved,
        updated_at: seededAt,
      })
      stockMovements.push({
        id: `sm_open_${p.id}_${b.id}`,
        productId: p.id,
        branchId: b.id,
        type: 'Opening',
        quantity: qty,
        referenceType: 'opening',
        referenceId: 'seed',
        note: 'Opening stock',
        created_at: daysAgo(100),
        created_by: 'System',
      })
    })
  })

  const suppliers = Array.from({ length: 15 }, (_, i) => ({
    id: id('sup', i + 1),
    name: `${['Dhaka Textiles', 'Chittagong Fabrics', 'Sylhet Silk House', 'Rajshahi Cotton', 'Bangla Fashion Supply'][i % 5]} ${i + 1}`,
    phone: `018${String(10000000 + i).slice(0, 8)}`,
    email: `supplier${i + 1}@vendor.bd`,
    address: `${DISTRICTS[i % DISTRICTS.length]}, Bangladesh`,
    status: 'active' as const,
    created_at: daysAgo(200 - i),
    deleted_at: null,
  }))

  const customers: Customer[] = Array.from({ length: 80 }, (_, i) => {
    const name = BD_NAMES[i % BD_NAMES.length]
    return {
      id: id('cu', i + 1),
      name: `${name.split(' ')[0]} ${i + 1}`,
      phone: `017${String(20000000 + i).slice(0, 8)}`,
      email: `customer${i + 1}@mail.com`,
      address: `House ${i + 10}, Road ${(i % 20) + 1}, ${DISTRICTS[i % DISTRICTS.length]}`,
      district: DISTRICTS[i % DISTRICTS.length],
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      totalSpent: 0,
      totalPaid: 0,
      currentDue: 0,
      preferredBranchId: branches[i % 3].id,
      preferredChannel: (['Physical Shop', 'Website', 'Facebook', 'WhatsApp', 'Phone Order'] as const)[i % 5],
      status: 'active',
      created_at: daysAgo(150 - (i % 100)),
      deleted_at: null,
    }
  })

  const departments = [
    { id: 'dep_001', name: 'Sales' },
    { id: 'dep_002', name: 'Accounts' },
    { id: 'dep_003', name: 'Warehouse' },
    { id: 'dep_004', name: 'HR' },
    { id: 'dep_005', name: 'Operations' },
  ]

  const designations = [
    { id: 'des_001', name: 'Store Manager', departmentId: 'dep_001' },
    { id: 'des_002', name: 'Sales Executive', departmentId: 'dep_001' },
    { id: 'des_003', name: 'Accountant', departmentId: 'dep_002' },
    { id: 'des_004', name: 'Warehouse Officer', departmentId: 'dep_003' },
    { id: 'des_005', name: 'HR Executive', departmentId: 'dep_004' },
  ]

  const employees = Array.from({ length: 20 }, (_, i) => ({
    id: id('emp', i + 1),
    name: BD_NAMES[i % BD_NAMES.length],
    phone: `016${String(30000000 + i).slice(0, 8)}`,
    email: `emp${i + 1}@glamourousbymahi.com`,
    department: departments[i % departments.length].name,
    designation: designations[i % designations.length].name,
    branchId: branches[i % 3].id,
    joiningDate: daysAgo(365 - i * 10).slice(0, 10),
    basicSalary: 18000 + (i % 8) * 2500,
    commissionRule: (i % 3 === 0 ? 'percent_sale' : i % 3 === 1 ? 'fixed' : 'none') as 'fixed' | 'percent_sale' | 'none',
    commissionValue: i % 3 === 0 ? 2.5 : i % 3 === 1 ? 150 : 0,
    deviceId: `DEV-${1000 + i}`,
    status: 'active' as const,
    created_at: daysAgo(300),
  }))

  const roles = [
    { id: 'role_001', name: 'Super Admin' as const, permissions: ['*'] },
    { id: 'role_002', name: 'Owner' as const, permissions: ['*'] },
    { id: 'role_003', name: 'Branch Admin' as const, permissions: ['sales', 'orders', 'inventory', 'customers', 'reports'] },
    { id: 'role_004', name: 'Sales Manager' as const, permissions: ['sales', 'orders', 'customers', 'commission'] },
    { id: 'role_005', name: 'Accounts User' as const, permissions: ['accounts', 'reports', 'suppliers', 'purchases'] },
    { id: 'role_006', name: 'HR User' as const, permissions: ['hr', 'payroll', 'attendance'] },
    { id: 'role_007', name: 'Salesperson' as const, permissions: ['sales', 'customers'] },
  ]

  const users = [
    { id: 'user_001', name: 'Mahi Rahman', email: 'owner@glamourousbymahi.com', phone: '01700000010', role: 'Owner' as const, branchId: null, employeeId: 'emp_001', isActive: true, password: 'demo123' },
    { id: 'user_002', name: 'Admin User', email: 'admin@glamourousbymahi.com', phone: '01700000011', role: 'Super Admin' as const, branchId: null, employeeId: null, isActive: true, password: 'demo123' },
    { id: 'user_003', name: 'Branch Manager BC', email: 'bc@glamourousbymahi.com', phone: '01700000012', role: 'Branch Admin' as const, branchId: 'br_001', employeeId: 'emp_002', isActive: true, password: 'demo123' },
    { id: 'user_004', name: 'Sales Lead', email: 'sales@glamourousbymahi.com', phone: '01700000013', role: 'Sales Manager' as const, branchId: 'br_001', employeeId: 'emp_003', isActive: true, password: 'demo123' },
    { id: 'user_005', name: 'Accounts Officer', email: 'accounts@glamourousbymahi.com', phone: '01700000014', role: 'Accounts User' as const, branchId: 'br_001', employeeId: 'emp_004', isActive: true, password: 'demo123' },
    { id: 'user_006', name: 'HR Officer', email: 'hr@glamourousbymahi.com', phone: '01700000015', role: 'HR User' as const, branchId: 'br_001', employeeId: 'emp_005', isActive: true, password: 'demo123' },
    { id: 'user_007', name: 'Floor Salesperson', email: 'sp@glamourousbymahi.com', phone: '01700000016', role: 'Salesperson' as const, branchId: 'br_002', employeeId: 'emp_006', isActive: true, password: 'demo123' },
  ]

  const financialAccounts = [
    { id: 'fa_001', name: 'Main Cash', type: 'Cash' as const, branchId: null, balance: 250000, isActive: true },
    { id: 'fa_002', name: 'Bashundhara Cash', type: 'Cash' as const, branchId: 'br_001', balance: 85000, isActive: true },
    { id: 'fa_003', name: 'Jamuna Cash', type: 'Cash' as const, branchId: 'br_002', balance: 42000, isActive: true },
    { id: 'fa_004', name: 'Dutch-Bangla Bank', type: 'Bank' as const, branchId: null, balance: 1250000, isActive: true },
    { id: 'fa_005', name: 'bKash Merchant', type: 'Mobile Banking' as const, branchId: null, balance: 185000, isActive: true },
    { id: 'fa_006', name: 'Nagad', type: 'Mobile Banking' as const, branchId: null, balance: 96000, isActive: true },
  ]

  const sales: Sale[] = []
  const commissions: Commission[] = []
  const financialTransactions: FinancialTransaction[] = []
  const activities: ActivityLog[] = []

  for (let i = 0; i < 120; i++) {
    const product = products[i % products.length]
    const qty = 1 + (i % 3)
    const unitPrice = product.salePrice ?? product.price
    const discount = i % 7 === 0 ? 100 : 0
    const total = unitPrice * qty - discount
    const paid = i % 5 === 0 ? Math.round(total * 0.6) : total
    const due = total - paid
    const customer = customers[i % customers.length]
    const salesperson = employees[i % 8]
    const saleId = id('sale', i + 1)
    const created = daysAgo(i % 45)

    sales.push({
      id: saleId,
      saleNo: `SL-${String(1000 + i)}`,
      customerId: customer.id,
      branchId: branches[i % 3].id,
      salespersonId: salesperson.id,
      channel: (['Physical Shop', 'Website', 'Facebook', 'WhatsApp', 'Phone Order', 'Marketplace'] as const)[i % 6],
      items: [{
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitPrice,
        discount,
        total,
        cost: product.cost,
      }],
      subtotal: unitPrice * qty,
      discount,
      total,
      paidAmount: paid,
      dueAmount: due,
      paymentMethod: (['Cash', 'bKash', 'Nagad', 'Card', 'COD', 'Mixed'] as const)[i % 6],
      accountId: financialAccounts[i % 3 === 0 ? 1 : i % 3 === 1 ? 4 : 0].id,
      deliveryMethod: i % 4 === 0 ? 'Courier' : i % 4 === 1 ? 'Home Delivery' : 'Pickup',
      courierId: null,
      note: '',
      status: i % 19 === 0 ? 'Returned' : due > 0 && paid > 0 ? 'Partial Paid' : due > 0 ? 'Processing' : 'Completed',
      created_at: created,
      updated_at: created,
      deleted_at: null,
      idempotencyKey: `seed-sale-${i}`,
    })

    customer.totalOrders += 1
    customer.totalSpent += total
    customer.totalPaid += paid
    customer.currentDue += due
    if (i % 19 !== 0) customer.deliveredOrders += 1
    else customer.returnedOrders += 1

    if (salesperson.commissionRule !== 'none') {
      const amount = salesperson.commissionRule === 'fixed'
        ? salesperson.commissionValue
        : Math.round(total * (salesperson.commissionValue / 100))
      commissions.push({
        id: id('com', i + 1),
        employeeId: salesperson.id,
        saleId,
        amount,
        status: due === 0 ? 'Approved' : 'Pending',
        created_at: created,
        paid_at: null,
      })
    }

    financialTransactions.push({
      id: id('ft', i + 1),
      accountId: financialAccounts[1].id,
      type: 'Income',
      category: 'Sales',
      amount: paid,
      referenceType: 'sale',
      referenceId: saleId,
      description: `Sale ${sales[i].saleNo}`,
      created_at: created,
      created_by: salesperson.name,
    })
  }

  const orders: Order[] = []
  for (let i = 0; i < 50; i++) {
    const product = products[(i + 10) % products.length]
    const customer = customers[(i + 5) % customers.length]
    const qty = 1 + (i % 2)
    const unitPrice = product.salePrice ?? product.price
    const subtotal = unitPrice * qty
    const deliveryCharge = subtotal >= 3000 ? 0 : 120
    const total = subtotal + deliveryCharge
    const statuses = ['New', 'Confirmed', 'Packed', 'Courier Booked', 'In Transit', 'Delivered', 'Returned', 'Cancelled'] as const
    const status = statuses[i % statuses.length]
    const created = daysAgo(i % 30)
    orders.push({
      id: id('ord', i + 1),
      orderNo: `GBM-W-${String(2000 + i)}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      deliveryAddress: customer.address,
      district: customer.district,
      branchId: 'br_001',
      items: [{
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: qty,
        unitPrice,
        total: subtotal,
      }],
      subtotal,
      deliveryCharge,
      total,
      paymentMethod: 'COD',
      paymentStatus: status === 'Delivered' ? 'collected' : 'pending',
      status,
      source: 'Website',
      courierId: null,
      trackingId: status.includes('Courier') || status === 'In Transit' || status === 'Delivered' ? `CN${900000 + i}` : null,
      courierCharge: 80,
      note: '',
      timeline: [
        { status: 'New', at: created, note: 'Order placed from website' },
        ...(status !== 'New' ? [{ status, at: daysAgo((i % 30) - 1), note: `Moved to ${status}` }] : []),
      ],
      reserved: !['Cancelled', 'Delivered', 'Returned'].includes(status),
      stockFinalized: ['Confirmed', 'Packed', 'Courier Booked', 'In Transit', 'Delivered'].includes(status),
      created_at: created,
      updated_at: created,
      deleted_at: null,
    })
  }

  const purchases: Purchase[] = []
  const supplierPayments: SupplierPayment[] = []
  for (let i = 0; i < 40; i++) {
    const supplier = suppliers[i % suppliers.length]
    const product = products[i % products.length]
    const qty = 10 + (i % 20)
    const unitCost = product.cost
    const subtotal = qty * unitCost
    const paid = i % 3 === 0 ? Math.round(subtotal * 0.5) : subtotal
    const purchaseId = id('pur', i + 1)
    purchases.push({
      id: purchaseId,
      purchaseNo: `PO-${String(500 + i)}`,
      supplierId: supplier.id,
      branchId: i % 2 === 0 ? 'br_004' : 'br_001',
      items: [{ productId: product.id, quantity: qty, unitCost, discount: 0, total: subtotal }],
      subtotal,
      discount: 0,
      transportCost: i % 4 === 0 ? 500 : 0,
      total: subtotal + (i % 4 === 0 ? 500 : 0),
      paidAmount: paid,
      dueAmount: subtotal - paid + (i % 4 === 0 ? 500 : 0),
      accountId: 'fa_004',
      status: 'Finalized',
      note: '',
      created_at: daysAgo(60 - (i % 50)),
      finalized_at: daysAgo(60 - (i % 50)),
    })
    if (paid > 0) {
      supplierPayments.push({
        id: id('spay', i + 1),
        supplierId: supplier.id,
        amount: paid,
        accountId: 'fa_004',
        reference: purchases[i].purchaseNo,
        note: 'Purchase payment',
        created_at: daysAgo(60 - (i % 50)),
      })
    }
  }

  const courierBookings: CourierBooking[] = []
  const courierSettlements: CourierSettlement[] = []
  orders.filter((o) => o.trackingId).slice(0, 30).forEach((o, i) => {
    const courierName = COURIERS[i % COURIERS.length]
    courierBookings.push({
      id: id('cb', i + 1),
      orderId: o.id,
      courierName,
      consignmentId: o.trackingId!,
      charge: 80,
      codAmount: o.total,
      status: o.status === 'Delivered' ? 'Delivered' : o.status === 'Returned' ? 'Returned' : o.status === 'In Transit' ? 'In Transit' : 'Booked',
      booked_at: o.created_at,
      updated_at: o.updated_at,
    })
    if (i < 15) {
      courierSettlements.push({
        id: id('cs', i + 1),
        courierName,
        orderId: o.id,
        codAmount: o.total,
        courierCharge: 80,
        returnCharge: o.status === 'Returned' ? 50 : 0,
        settlementAmount: o.status === 'Delivered' ? o.total - 80 : 0,
        status: o.status === 'Delivered' ? 'Settled' : 'Pending',
        settlementDate: o.status === 'Delivered' ? daysAgo(2) : null,
      })
    }
  })

  const attendance: AttendanceRecord[] = []
  for (let d = 0; d < 15; d++) {
    employees.slice(0, 12).forEach((emp, ei) => {
      const statuses = ['Present', 'Late', 'Present', 'Present', 'Early Leave', 'Absent', 'Leave', 'Overtime'] as const
      attendance.push({
        id: `att_${d}_${ei}`,
        employeeId: emp.id,
        date: daysAgo(d).slice(0, 10),
        checkIn: statuses[(d + ei) % 8] === 'Absent' || statuses[(d + ei) % 8] === 'Leave' ? null : '09:05',
        checkOut: statuses[(d + ei) % 8] === 'Absent' || statuses[(d + ei) % 8] === 'Leave' ? null : '18:00',
        status: statuses[(d + ei) % 8],
        source: 'Biometric Device',
        notes: '',
      })
    })
  }

  const payrolls: Payroll[] = employees.slice(0, 20).map((emp, i) => {
    const commission = commissions.filter((c) => c.employeeId === emp.id && c.status === 'Approved').reduce((s, c) => s + c.amount, 0)
    const net = emp.basicSalary + commission - (i % 5 === 0 ? 500 : 0)
    return {
      id: id('pay', i + 1),
      employeeId: emp.id,
      month: '2026-06',
      basicSalary: emp.basicSalary,
      overtime: 0,
      commission: Math.min(commission, 5000),
      bonus: i % 7 === 0 ? 1000 : 0,
      absenceDeduction: i % 5 === 0 ? 500 : 0,
      lateDeduction: 0,
      advance: 0,
      otherDeduction: 0,
      netSalary: net,
      status: i % 3 === 0 ? 'Paid' : i % 3 === 1 ? 'Approved' : 'Draft',
      paidAt: i % 3 === 0 ? daysAgo(5) : null,
      accountId: i % 3 === 0 ? 'fa_004' : null,
    }
  })

  const collections: Collection[] = customers
    .filter((c) => c.currentDue > 0)
    .slice(0, 20)
    .map((c, i) => {
      const amount = Math.min(c.currentDue, 500 + i * 100)
      c.currentDue -= amount
      c.totalPaid += amount
      return {
        id: id('col', i + 1),
        customerId: c.id,
        saleId: null,
        amount,
        accountId: 'fa_002',
        reference: `COL-${100 + i}`,
        note: 'Customer collection',
        created_at: daysAgo(i % 10),
      }
    })

  const notifications: Notification[] = [
    { id: 'nt_001', title: 'Low Stock Alert', message: '12 products are below threshold at Bashundhara City.', type: 'warning', read: false, created_at: daysAgo(0) },
    { id: 'nt_002', title: 'Courier Returns', message: '3 courier returns pending stock restore review.', type: 'danger', read: false, created_at: daysAgo(1) },
    { id: 'nt_003', title: 'Supplier Due', message: 'Supplier payments due this week: ৳1,25,000', type: 'info', read: true, created_at: daysAgo(2) },
  ]

  for (let i = 0; i < 80; i++) {
    activities.push({
      id: id('act', i + 1),
      action: ['Sale Created', 'Purchase Finalized', 'Order Confirmed', 'Collection Received', 'Courier Booked'][i % 5],
      entityType: ['sale', 'purchase', 'order', 'collection', 'courier'][i % 5],
      entityId: id(['sale', 'pur', 'ord', 'col', 'cb'][i % 5], (i % 20) + 1),
      userName: users[i % users.length].name,
      details: 'Seed activity log entry',
      created_at: daysAgo(i % 40),
    })
  }

  return {
    meta: {
      version: ERP_DB_VERSION,
      brand: brandConfig.name,
      seededAt,
      updatedAt: seededAt,
    },
    settings: {
      companyName: brandConfig.name,
      address: brandConfig.address,
      phone: brandConfig.phone,
      email: brandConfig.email,
      website: brandConfig.website,
      currency: brandConfig.currency,
      lowStockThreshold: 10,
      deliveryCharge: 120,
      freeDeliveryThreshold: 3000,
    },
    branches,
    users,
    roles,
    employees,
    departments,
    designations,
    attendance,
    leaves: employees.slice(0, 5).map((e, i) => ({
      id: id('leave', i + 1),
      employeeId: e.id,
      fromDate: daysAgo(10 - i).slice(0, 10),
      toDate: daysAgo(9 - i).slice(0, 10),
      type: (['Casual', 'Sick', 'Annual'] as const)[i % 3],
      status: 'Approved' as const,
      reason: 'Personal',
    })),
    payrolls,
    products,
    categories,
    brands,
    stockBalances,
    stockMovements: stockMovements.slice(0, 200),
    stockTransfers: [],
    suppliers,
    purchases,
    purchaseReturns: purchases.slice(0, 15).map((p, i) => ({
      id: id('pret', i + 1),
      purchaseId: p.id,
      supplierId: p.supplierId,
      branchId: p.branchId,
      items: p.items.map((it) => ({ ...it, quantity: 1, total: it.unitCost })),
      total: p.items[0]?.unitCost ?? 0,
      reason: 'Damaged on arrival',
      created_at: daysAgo(20 - i),
    })),
    supplierPayments,
    customers,
    addresses: customers.slice(0, 40).map((c, i) => ({
      id: id('addr', i + 1),
      customerId: c.id,
      label: (['Home', 'Office', 'Other'] as const)[i % 3],
      fullName: c.name,
      phone: c.phone,
      district: c.district,
      area: 'Main Area',
      address: c.address,
      isDefault: true,
    })),
    sales,
    saleReturns: sales.filter((s) => s.status === 'Returned').map((s, i) => ({
      id: id('sret', i + 1),
      saleId: s.id,
      items: s.items,
      total: s.total,
      reason: 'Customer return',
      created_at: s.created_at,
    })),
    orders,
    collections,
    courierBookings,
    courierSettlements,
    financialAccounts,
    financialTransactions,
    commissions,
    activities,
    notifications,
  }
}
