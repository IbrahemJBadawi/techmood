import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * A tap on a sponsored course card (0162): counted for the mentor, then on to
 * the course. Only academy addresses are followed — never an outside link.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = request.nextUrl.searchParams.get('to') ?? '/academy';
  const safe = /^\/academy\/[\w-]+(\/[\w-]+)?$/.test(to) ? to : '/academy';
  if (/^[0-9a-f-]{36}$/.test(id)) {
    const supabase = await createClient();
    await supabase.rpc('sponsored_click', { p_promotion: id });
  }
  return NextResponse.redirect(new URL(safe, request.url));
}
