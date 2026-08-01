/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '@/test'
import { ImportPreviewTable } from '../components/ImportPreviewTable'
import type { BulkImportAdapter, ImportPreviewRow } from '../types'

const adapter: BulkImportAdapter = {
  entityType: 'customers',
  title: 'Import customers',
  description: 'test',
  listPath: '/customers',
  permission: 'customers.import',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
  ],
  templateHeaders: ['name', 'phone'],
  templateSample: ['A', '017'],
  columnGuide: [],
  headerAliases: {},
  parseRows: () => [],
  enrichMatches: async (rows) => rows,
  revalidateRow: (row) => row,
  commitRow: async () => {},
}

describe('ImportPreviewTable', () => {
  it('allows overriding row action and disables commit path when errors remain', async () => {
    const user = userEvent.setup()
    const row: ImportPreviewRow = {
      rowNum: 2,
      action: 'create',
      matchKey: '01711111111',
      existingId: null,
      values: { name: 'Ada', phone: '01711111111' },
      diff: [],
      errors: [],
      notes: [],
    }
    const onChangeRow = vi.fn()
    renderWithAppProviders(
      <ImportPreviewTable
        adapter={adapter}
        rows={[row]}
        filter="all"
        onChangeRow={onChangeRow}
      />,
      { permissions: ['customers.import'] },
    )

    expect(screen.getByDisplayValue('Ada')).toBeInTheDocument()
    await user.selectOptions(screen.getByDisplayValue('Create'), 'skip')
    expect(onChangeRow).toHaveBeenCalled()
    const next = onChangeRow.mock.calls[0][1] as ImportPreviewRow
    expect(next.action).toBe('skip')
  })
})
