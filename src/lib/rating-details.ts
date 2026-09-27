import type { createClient } from '@/lib/supabase/server';

/**
 * Adds the written answers and "would you recommend it" to a rating that was
 * just written (add_rating_details, 0081). Nothing is sent when none was given.
 */
export async function saveRatingDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: 'session' | 'client_work' | 'client',
  id: string | null | undefined,
  formData: FormData,
) {
  if (!id) return null;
  const recommend = formData.get('recommend');
  const liked = String(formData.get('liked') ?? '').trim();
  const improve = String(formData.get('improve') ?? '').trim();
  if (!recommend && !liked && !improve) return null;

  const { error } = await supabase.rpc('add_rating_details', {
    p_kind: kind,
    p_id: id,
    p_recommend: recommend === 'yes' ? true : recommend === 'no' ? false : null,
    p_liked: liked || null,
    p_improve: improve || null,
  });
  return error;
}
