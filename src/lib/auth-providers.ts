import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '@/lib/supabase/config';

/**
 * Whether Google sign-in is switched on for the project.
 *
 * Starting an OAuth sign-in does not check this: with the provider off, the
 * visitor is sent to Supabase and lands on a raw JSON error. The auth server's
 * public settings say which providers are on, so the button is shown only when
 * it will work — and appears by itself once Google is enabled in the dashboard.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLIC_KEY },
      next: { revalidate: 300 },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
