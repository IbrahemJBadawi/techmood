import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './config';

export function createClient() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
  );
}
