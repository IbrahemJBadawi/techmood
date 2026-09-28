/**
 * Where the app's Supabase project is.
 *
 * Both values are public by design — every browser that opens TechMood receives
 * them — and every row is protected by row-level security, not by hiding them.
 * The environment wins when it is set (under either of the names Supabase's own
 * integrations use); otherwise the live project's public values are used, so a
 * deployment with a missing or misnamed variable still works instead of failing
 * every page with a 500.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yvtqacdsyejlpumylylc.supabase.co';

export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  || 'sb_publishable_UzF5XvObPGLUg5wOG6EkXA_3jSw8vLd';
