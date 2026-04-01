import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/db/server'
import { SidebarNav } from '@/components/sidebar-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-[oklch(0.98_0.003_247)]">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-[oklch(0.13_0.02_264)] shadow-xl">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-white/8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 4L10 8L14 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L6 8L10 12L14 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">AgencyTool</p>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Pro</p>
          </div>
        </div>

        <SidebarNav email={user.email ?? ''} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
