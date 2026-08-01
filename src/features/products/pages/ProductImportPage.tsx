import { BulkImportWizard } from '@/features/bulk-import/components/BulkImportWizard'
import { productsAdapter } from '@/features/bulk-import/adapters/products.adapter'

export function ProductImportPage() {
  return <BulkImportWizard adapter={productsAdapter} />
}
