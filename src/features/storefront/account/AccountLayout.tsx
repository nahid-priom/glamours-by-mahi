import { Outlet } from 'react-router-dom'
import { AccountProvider, useAccount } from './account.context'
import { AccountSidebar, AccountMobileTabs } from './AccountSidebar'
import { GuestAccountPanel } from './GuestAccountPanel'

function AccountShell() {
  const { session } = useAccount()

  if (!session) {
    return (
      <div className="min-h-[60vh] px-4 py-8 sm:px-6 sm:py-12">
        <GuestAccountPanel />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 sm:py-8 lg:py-10">
      <div className="mb-6 lg:mb-8">
        <h1 className="font-serif text-3xl text-[#111111] sm:text-4xl">My Account</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Manage orders, profile, and saved details</p>
      </div>

      <AccountMobileTabs />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-8">
        <AccountSidebar />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function AccountLayout() {
  return (
    <AccountProvider>
      <AccountShell />
    </AccountProvider>
  )
}
