'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { TaxonomyKind } from '@/lib/database.types';

export async function reviewTerm(formData: FormData) {
  const supabase = await createClient();

  await supabase.rpc('review_taxonomy_term', {
    p_kind: String(formData.get('kind') ?? '') as TaxonomyKind,
    p_term_id: String(formData.get('term_id') ?? ''),
    p_approve: String(formData.get('approve') ?? '') === 'yes',
  });

  revalidatePath('/admin/taxonomy');
}
