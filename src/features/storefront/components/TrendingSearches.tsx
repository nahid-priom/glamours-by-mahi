import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TRENDING = [
  { label: 'Dresses', to: '/category/dress' },
  { label: 'Kurti', to: '/category/kurti' },
  { label: 'Co-Ord', to: '/category/co-ord-set' },
  { label: 'Party Wear', to: '/shop?style=party' },
  { label: 'Wedding', to: '/shop?style=wedding' },
] as const

interface TrendingSearchesProps {
  className?: string
}

export function TrendingSearches({ className }: TrendingSearchesProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#6B7280]">
        Trending Searches
      </p>
      <div className="flex flex-wrap gap-2">
        {TRENDING.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="rounded-full border border-[#22171C]/10 bg-white px-4 py-2 text-xs font-medium text-[#22171C] shadow-sm transition hover:border-[#FF3F7F]/30 hover:text-[#FF3F7F] hover:shadow-md"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
