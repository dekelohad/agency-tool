import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/db/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseProxyClient(request, response)

  // Refresh the session — writes updated tokens back to cookies
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard/crm', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
