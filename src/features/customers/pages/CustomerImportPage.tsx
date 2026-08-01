import { BulkImportWizard } from '@/features/bulk-import/components/BulkImportWizard'
import { customersAdapter } from '@/features/bulk-import/adapters/customers.adapter'

export function CustomerImportPage() {
  return <BulkImportWizard adapter={customersAdapter} />
}
