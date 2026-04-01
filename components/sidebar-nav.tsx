'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/db/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard/ads-intel', label: 'Ads Intelligence', letter: 'C' },
  { href: '/dashboard/creative', label: 'Creative Factory', letter: 'D' },
  { href: '/dashboard/crm', label: 'Pay-Per-Call CRM', letter: 'E' },
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

  return (
    <>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-colors',
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                {item.letter}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p className="mb-2 truncate text-xs text-zinc-400">{email}</p>
        <button
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-1.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          Sign out
        </button>
      </div>
    </>
  )
}
