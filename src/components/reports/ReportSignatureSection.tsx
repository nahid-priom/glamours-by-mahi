export function ReportSignatureSection({
  preparedBy,
  approvedBy,
}: {
  preparedBy?: string
  approvedBy?: string
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-8 border-t pt-6 text-sm print:mt-12">
      <div>
        <p className="text-[#6B7280]">Prepared by</p>
        <div className="mt-8 border-t border-[#111827]" />
        <p className="mt-1">{preparedBy ?? '________________'}</p>
      </div>
      <div>
        <p className="text-[#6B7280]">Approved by</p>
        <div className="mt-8 border-t border-[#111827]" />
        <p className="mt-1">{approvedBy ?? '________________'}</p>
      </div>
    </div>
  )
}
