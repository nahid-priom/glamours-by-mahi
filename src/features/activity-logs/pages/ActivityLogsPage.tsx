import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { AppDateRangeField } from '@/components/date-picker'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toQueryBounds } from '@/lib/datetime/bd'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/auth-session'
import {
  ACTIVITY_MODULE_OPTIONS,
  activityEntityPath,
  formatActivitySentence,
  friendlyDiffEntries,
  relativeActivityTime,
  type ActivityFeedItem,
} from '../lib/activity-copy'
import { listActivityFeed } from '../repositories/activity-logs.repository'

const PAGE_SIZE = 40

export function ActivityLogsPage() {
  const { activeBranchId } = useAuth()
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [branchScoped, setBranchScoped] = useState(false)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ActivityFeedItem | null>(null)
  const [showTechnical, setShowTechnical] = useState(false)

  const filters = useMemo(() => {
    const bounds = toQueryBounds(fromDate || null, toDate || null)
    return {
      search: search.trim() || null,
      module: module === 'all' ? null : module,
      from: bounds.fromIso,
      to: bounds.toIso,
      branchId: branchScoped ? activeBranchId : null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }
  }, [search, module, fromDate, toDate, branchScoped, activeBranchId, page])

  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-feed', filters],
    queryFn: () => listActivityFeed(filters),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const diffs = selected
    ? friendlyDiffEntries(selected.before_data, selected.after_data)
    : []

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Activity logs</h1>
        <p className="text-sm text-[#6B7280]">
          Easy-to-read history of what people did across the system — no technical codes required.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-3">
        <div className="min-w-[12rem] flex-1">
          <p className="mb-1 text-xs font-medium text-[#6B7280]">Search</p>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(0)
            }}
            placeholder="Person, invoice, action…"
            inputClassName="h-9"
          />
        </div>
        <div className="w-[11rem]">
          <p className="mb-1 text-xs font-medium text-[#6B7280]">Module</p>
          <Select
            value={module}
            onValueChange={(v) => {
              setModule(v)
              setPage(0)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_MODULE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AppDateRangeField
          label="Date range"
          from={fromDate}
          to={toDate}
          onChange={({ from, to }) => {
            setFromDate(from)
            setToDate(to)
            setPage(0)
          }}
          className="min-w-[14rem]"
        />
        <Button
          type="button"
          size="sm"
          variant={branchScoped ? 'default' : 'outline'}
          className="h-9"
          disabled={!activeBranchId}
          onClick={() => {
            setBranchScoped((v) => !v)
            setPage(0)
          }}
        >
          {branchScoped ? 'This branch' : 'All branches'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-[#E11D48]">
          {(error as Error).message || 'Failed to load activity.'}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <ul className="divide-y divide-border">
          {(data?.items ?? []).map((item) => {
            const path = activityEntityPath(item)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#F9FAFB]"
                  onClick={() => {
                    setSelected(item)
                    setShowTechnical(false)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="default" className="text-[10px] capitalize">
                        {item.module}
                      </Badge>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {relativeActivityTime(item.created_at)}
                      </span>
                      {item.branch_name ? (
                        <span className="text-[11px] text-[#9CA3AF]">· {item.branch_name}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#111827]">{formatActivitySentence(item)}</p>
                    {path ? (
                      <Link
                        to={path}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#E11D48]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open record <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No activity found.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#9CA3AF]">
          {data?.total ?? 0} event{(data?.total ?? 0) === 1 ? '' : 's'}
          {totalPages > 1 ? ` · page ${page + 1} of ${totalPages}` : ''}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Activity detail</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <p className="text-base font-medium text-[#111827]">
                  {formatActivitySentence(selected)}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[#9CA3AF]">When</p>
                    <p>{new Date(selected.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#9CA3AF]">Module</p>
                    <p className="capitalize">{selected.module}</p>
                  </div>
                  <div>
                    <p className="text-[#9CA3AF]">Person</p>
                    <p>{selected.actor_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[#9CA3AF]">Branch</p>
                    <p>{selected.branch_name ?? '—'}</p>
                  </div>
                </div>

                {diffs.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      What changed
                    </p>
                    <ul className="space-y-2">
                      {diffs.map((d) => (
                        <li key={d.key} className="rounded-lg border border-border bg-[#F9FAFB] p-2">
                          <p className="text-xs font-medium capitalize text-[#111827]">{d.key}</p>
                          <p className="text-[11px] text-[#6B7280]">
                            <span className="line-through">{d.from}</span>
                            {' → '}
                            <span className="font-medium text-[#111827]">{d.to}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activityEntityPath(selected) ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={activityEntityPath(selected)!}>Open related record</Link>
                  </Button>
                ) : null}

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => setShowTechnical((v) => !v)}
                  >
                    {showTechnical ? 'Hide technical details' : 'Show technical details'}
                  </Button>
                  {showTechnical ? (
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-[#111827] p-3 text-[10px] text-[#E5E7EB]">
                      {JSON.stringify(
                        {
                          action: selected.action,
                          entity_type: selected.entity_type,
                          entity_id: selected.entity_id,
                          reason: selected.reason,
                          before_data: selected.before_data,
                          after_data: selected.after_data,
                          request_meta: selected.request_meta,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
