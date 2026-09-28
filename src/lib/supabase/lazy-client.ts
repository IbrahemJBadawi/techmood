/**
 * The browser Supabase client, fetched the first time something needs it.
 *
 * Components that only touch Supabase when the person acts — finishing a
 * focus session, uploading a photo or a file — use this, so the library
 * (the largest script the app ships) is not part of the page's first load.
 */
export async function browserClient() {
  const { createClient } = await import('./client');
  return createClient();
}
