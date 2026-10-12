'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionFormState } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

/** Creates or updates a business page (0165); the database checks Premium and ownership. */
export async function saveBusinessPage(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const supabase = await createClient();
  const slug = text(formData, 'slug').toLowerCase();
  const team = text(formData, 'team_id') || null;
  const { error } = await supabase.rpc('save_business_page', {
    p_slug: slug, p_name: text(formData, 'name'), p_tagline: text(formData, 'tagline') || null,
    p_about: text(formData, 'about') || null, p_sector: text(formData, 'sector') || null,
    p_city: text(formData, 'city') || null, p_website: text(formData, 'website') || null,
    p_contact: text(formData, 'contact') || null, p_team: team, p_published: formData.get('published') === 'on',
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/hub');
  redirect(`/hub/${slug}`);
}
