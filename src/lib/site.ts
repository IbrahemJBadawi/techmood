import { headers } from 'next/headers';

/**
 * The address the visitor is actually on. The request says it for certain; a
 * configured NEXT_PUBLIC_SITE_URL is only the fallback, so a stale localhost
 * value left in a deployment's settings cannot put localhost into a QR code
 * or send somebody returning from Google to their own machine.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) {
    const proto = h.get('x-forwarded-proto')?.split(',')[0]
      ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmoodtech.com').replace(/\/$/, '');
}
