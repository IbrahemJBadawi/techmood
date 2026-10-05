'use server';

import { createClient } from '@/lib/supabase/server';

/** The welcome guide was finished or skipped: do not show it again (0129). */
export async function markWelcomed() {
  const supabase = await createClient();
  await supabase.rpc('mark_welcomed');
}
