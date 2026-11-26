import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Star } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-session'
import { AppDateRangeField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getStorageItem, setStorageItem } from '@/lib/storage'
import { cn } from '@/lib/utils'
import {
  REPORT_CATEGORY_LABEL,
  reportsByCategory,
  visibleReports,
  type ReportCategory,
  type ReportDefinition,
} from '../config/report-registry'
import { ReportKPIGrid } from '../components/ReportKPIGrid'
import { useReportHubSummary } from '../hooks/use-report-hub-summary'
import { reportsRepository } from '../repositories/reports.repository'
import { DATE_PRESETS, resolveDatePreset } from '../reports.filters'

const FAV_KEY = 'reports_v4_favorites'
const RECENT_KEY = 'reports_v4_recent'

function prefKey(orgId: string | null | undefined, base: string) {
  return `${base}:${orgId ?? 'anon'}`
}

export function ReportsHubPage() {
  const { can, profile } = useAuth()
  const orgId = profile?.organization_id ?? null
  const [q, setQ] = useState('')
  const [range, setRange] = useState(() => reportsRepository.defaultRange())
  const [favorites, setFavorites] = useState<string[]>(() =>
    getStorageItem(prefKey(orgId, FAV_KEY), [] as string[]),
  )
  const [recent, setRecent] = useState<string[]>(() =>
    getStorageItem(prefKey(orgId, RECENT_KEY), [] as string[]),
  )

  const { kpis, secondaryKpis, loading, refetch, refreshedAt } = useReportHubSummary(range)

  const accessible = useMemo(() => visibleReports(can), [can])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return accessible
    return accessible.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle) ||
        r.category.includes(needle),
    )
  }, [accessible, q])

  const byCat = useMemo(() => reportsByCategory(filtered), [filtered])
  const categories = Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[]

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      setStorageItem(prefKey(orgId, FAV_KEY), next)
      return next
    })
  }

  function markRecent(id: string) {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8)
      setStorageItem(prefKey(orgId, RECENT_KEY), next)
      return next
    })
  }

  const favoriteDefs = accessible.filter((r) => favorites.includes(r.id))
  const recentDefs = recent
    .map((id) => accessible.find((r) => r.id === id))
    .filter(Boolean) as ReportDefinition[]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Reports &amp; Analytics</h1>
          <p className="text-sm text-[#6B7280]">
            Monitor your business performance, inventory and financial insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden flex-wrap gap-1 md:flex">
            {DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setRange(resolveDatePreset(p.id))}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <AppDateRangeField
            from={range.from}
            to={range.to}
            onChange={({ from, to }) => setRange({ from, to })}
            className="max-w-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            title="Refresh summary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-[#9CA3AF]">
        Summary updated {refreshedAt.toLocaleTimeString()} · Period KPIs use P&amp;L authority;
        receivables / payables / inventory cost are as-of balances.
      </p>

      <ReportKPIGrid items={kpis} loading={loading} />
      <ReportKPIGrid items={secondaryKpis} loading={false} />

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search reports…"
        className="max-w-md"
        aria-label="Search reports"
      />

      {favoriteDefs.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[#111827]">Favorites</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteDefs.map((r) => (
              <ReportNavCard
                key={r.id}
                report={r}
                favorited
                onToggleFavorite={() => toggleFavorite(r.id)}
                onNavigate={() => markRecent(r.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {recentDefs.length > 0 && !q.trim() ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[#111827]">Recently opened</h2>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {recentDefs.map((r) => (
              <ReportNavCard
                key={`recent-${r.id}`}
                report={r}
                favorited={favorites.includes(r.id)}
                onToggleFavorite={() => toggleFavorite(r.id)}
                onNavigate={() => markRecent(r.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {categories.map((cat) => {
        const items = byCat[cat]
        if (!items.length) return null
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-[#111827]">{REPORT_CATEGORY_LABEL[cat]}</h2>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <ReportNavCard
                  key={r.id}
                  report={r}
                  favorited={favorites.includes(r.id)}
                  onToggleFavorite={() => toggleFavorite(r.id)}
                  onNavigate={() => markRecent(r.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No reports match your search or permissions.</p>
      ) : null}
    </div>
  )
}

function ReportNavCard({
  report,
  favorited,
  onToggleFavorite,
  onNavigate,
}: {
  report: ReportDefinition
  favorited: boolean
  onToggleFavorite: () => void
  onNavigate: () => void
}) {
  const gated = report.status === 'gated'
  const body = (
    <div
      className={cn(
        'h-full rounded-xl border border-border bg-white p-3',
        gated ? 'opacity-70' : 'hover:border-[#D1D5DB]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#111827]">{report.title}</p>
          <p className="mt-1 text-xs text-[#6B7280]">{report.description}</p>
          {gated && report.gatedReason ? (
            <p className="mt-2 text-xs text-amber-800">{report.gatedReason}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-[#9CA3AF] hover:text-amber-500"
          aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Star className={cn('h-4 w-4', favorited && 'fill-amber-400 text-amber-500')} />
        </button>
      </div>
    </div>
  )

  if (gated) return body

  return (
    <Link
      to={report.path}
      onClick={onNavigate}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  )
}
