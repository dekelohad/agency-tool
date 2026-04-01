'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/db/client'
import { cn } from '@/lib/utils'
import { BarChart2, Sparkles, PhoneCall, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  {
    href: '/dashboard/ads-intel',
    label: 'Ads Intelligence',
    sublabel: 'Keywords & competitors',
    icon: BarChart2,
  },
  {
    href: '/dashboard/creative',
    label: 'Creative Factory',
    sublabel: 'Generate ad creatives',
    icon: Sparkles,
  },
  {
    href: '/dashboard/crm',
    label: 'Pay-Per-Call CRM',
    sublabel: 'Calls & revenue',
    icon: PhoneCall,
  },
]

export function SidebarNav({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <>
      <nav className="flex-1 space-y-0.5 p-3 pt-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
          Modules
        </p>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150',
                active
                  ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/10 shadow-sm'
                  : 'hover:bg-white/5'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                  active
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30'
                    : 'bg-white/8 group-hover:bg-white/12'
                )}
              >
                <Icon
                  size={15}
                  className={active ? 'text-white' : 'text-white/50 group-hover:text-white/70'}
                  strokeWidth={2}
                />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium leading-none',
                    active ? 'text-white' : 'text-white/60 group-hover:text-white/80'
                  )}
                >
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-white/30">{item.sublabel}</p>
              </div>
              {active && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white/70">{email}</p>
            <p className="text-[10px] text-white/30">Pro plan</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/8 hover:text-white/60"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </>
  )
}
