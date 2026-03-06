import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

const ALLOWED_EMAILS = ['brian@echolocalagency.com'];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!ALLOWED_EMAILS.includes(user.email ?? '')) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!login|api/webhook|api/agents|_next/static|_next/image|favicon\\.ico|echo-local-logo\\.png).*)',
  ],
};
