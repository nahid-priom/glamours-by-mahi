import { BulkImportWizard } from '@/features/bulk-import/components/BulkImportWizard'
import { suppliersAdapter } from '@/features/bulk-import/adapters/suppliers.adapter'

export function SupplierImportPage() {
  return <BulkImportWizard adapter={suppliersAdapter} />
}
