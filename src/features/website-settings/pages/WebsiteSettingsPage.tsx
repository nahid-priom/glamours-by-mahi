import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { HeroSlideList } from '../components/HeroSlideList'

const TABS = [
  { to: '/settings/website', label: 'Hero Carousel', end: true },
  { to: '/settings/website/homepage', label: 'Homepage Sections', end: false },
  { to: '/settings/website/seo', label: 'SEO', end: false },
  { to: '/settings/website/social', label: 'Social Links', end: false },
  { to: '/settings/website/contact', label: 'Contact', end: false },
]

function WebsiteTabs() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--sf-border)] pb-3">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-[var(--sf-primary)] text-white'
                : 'bg-white text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary)]',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function WebsiteSettingsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Website Settings</h1>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">
          Configure storefront homepage campaigns, SEO and contact details.
        </p>
      </div>
      <WebsiteTabs />
      <HeroSlideList />
    </div>
  )
}

export function WebsitePlaceholderTabPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-serif text-3xl text-[var(--sf-ink)]">Website Settings</h1>
        <p className="mt-1 text-sm text-[var(--sf-muted)]">
          Configure storefront homepage campaigns, SEO and contact details.
        </p>
      </div>
      <WebsiteTabs />
      <div className="rounded-2xl border border-dashed border-[var(--sf-border)] bg-white p-10 text-center">
        <p className="font-medium text-[var(--sf-ink)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--sf-muted)]">
          Use company settings for shared brand details. Hero Carousel is fully available under the
          first tab.
        </p>
      </div>
    </div>
  )
}

export function WebsiteHomepageTabPage() {
  return <WebsitePlaceholderTabPage title="Homepage Sections" />
}

export function WebsiteSeoTabPage() {
  return <WebsitePlaceholderTabPage title="SEO" />
}

export function WebsiteSocialTabPage() {
  return <WebsitePlaceholderTabPage title="Social Links" />
}

export function WebsiteContactTabPage() {
  return <WebsitePlaceholderTabPage title="Contact Information" />
}
