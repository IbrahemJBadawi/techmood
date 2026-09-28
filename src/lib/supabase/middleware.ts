import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './config';
import { pathInScope } from '@/lib/scope';

/** Routes a signed-out visitor may open. Everything else redirects to /login. */
const PUBLIC_PREFIXES = ['/', '/login', '/signup', '/about', '/verify', '/exhibition', '/auth'];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)),
  );
}

export async function updateSession(request: NextRequest) {
  // Outside the MVP's scope (src/lib/scope.ts): the page exists, it is just not
  // part of the product people see. Home is the honest answer.
  if (!pathInScope(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // The pages read which section they are in (the admin area shows the admin
  // navigation to an admin whatever role they last browsed as).
  // Rebuilt after a session refresh too, so the page sees the new cookies.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set('x-tm-path', request.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase; getSession() would trust the
  // cookie as-is, which is not good enough to gate a page on.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
