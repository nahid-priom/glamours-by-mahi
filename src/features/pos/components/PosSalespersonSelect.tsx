import { EntityCombobox, type EntityOption } from '@/components/entity-combobox/EntityCombobox'
import { commissionsRepository } from '@/features/sales/repositories/commissions.repository'
import { Label } from '@/components/ui/label'

type PosSalespersonSelectProps = {
  branchId: string | null
  value: string | null
  onChange: (employeeId: string | null, option?: EntityOption | null) => void
  disabled?: boolean
}

export function PosSalespersonSelect({
  branchId,
  value,
  onChange,
  disabled,
}: PosSalespersonSelectProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-[#6B7280]">Salesperson (commission)</Label>
      <EntityCombobox
        value={value}
        onChange={onChange}
        disabled={disabled || !branchId}
        allowClear={false}
        placeholder="Select salesperson…"
        aria-label="Salesperson"
        onSearch={async (q) => {
          const rows = await commissionsRepository.searchCommissionEmployees(q, branchId, true)
          return rows.map((r) => ({ id: r.id, label: r.label, description: r.description }))
        }}
      />
    </div>
  )
}
