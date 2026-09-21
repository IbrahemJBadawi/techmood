'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type {
  ExperienceKind, LinkKind, ProfileAudience, ProfileSection,
} from '@/lib/database.types';

export type ProfileState = { error?: string; ok?: string } | undefined;

const HERE = '/settings/profile';

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/**
 * The public face of the account: what a visitor reads before anything else,
 * and the one switch that turns the whole profile off.
 */
export async function saveProfileBasics(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const t = await getT();
  const { supabase, user } = await me();

  const { error } = await supabase
    .from('profiles')
    .update({
      headline: String(formData.get('headline') ?? '').trim() || null,
      bio: String(formData.get('bio') ?? '').trim() || null,
      is_public: formData.get('is_public') === 'on',
    })
    .eq('id', user.id);

  revalidatePath(HERE);
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('حُفظ.', 'Saved.') };
}

/** Narrowing one section. Anything left alone stays public. */
export async function setSectionAudience(formData: FormData) {
  const { supabase, user } = await me();

  await supabase.from('profile_section_visibility').upsert({
    profile_id: user.id,
    section: String(formData.get('section') ?? '') as ProfileSection,
    audience: String(formData.get('audience') ?? 'public') as ProfileAudience,
  }, { onConflict: 'profile_id,section' });

  revalidatePath(HERE);
}

export async function addLink(formData: FormData) {
  const { supabase, user } = await me();

  await supabase.from('profile_links').insert({
    profile_id: user.id,
    kind: String(formData.get('kind') ?? 'other') as LinkKind,
    label: String(formData.get('label') ?? '').trim() || null,
    url: String(formData.get('url') ?? '').trim(),
  });

  revalidatePath(HERE);
}

export async function addEducation(formData: FormData) {
  const { supabase, user } = await me();

  await supabase.from('profile_education').insert({
    profile_id: user.id,
    institution: String(formData.get('institution') ?? '').trim(),
    degree: String(formData.get('degree') ?? '').trim() || null,
    field: String(formData.get('field') ?? '').trim() || null,
    started_on: String(formData.get('started_on') ?? '') || null,
    ended_on: String(formData.get('ended_on') ?? '') || null,
    is_current: formData.get('is_current') === 'on',
  });

  revalidatePath(HERE);
}

export async function addExperience(formData: FormData) {
  const { supabase, user } = await me();

  await supabase.from('profile_experience').insert({
    profile_id: user.id,
    organisation: String(formData.get('organisation') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'job') as ExperienceKind,
    summary: String(formData.get('summary') ?? '').trim() || null,
    started_on: String(formData.get('started_on') ?? '') || null,
    ended_on: String(formData.get('ended_on') ?? '') || null,
    is_current: formData.get('is_current') === 'on',
  });

  revalidatePath(HERE);
}

/**
 * A participation somewhere else. It is the one thing on a TechMood profile
 * that the platform did not witness, so it is filed as a claim and an admin
 * checks the evidence before anybody else sees it.
 */
export async function addExternalExhibition(formData: FormData) {
  const { supabase, user } = await me();

  await supabase.from('external_exhibitions').insert({
    profile_id: user.id,
    title: String(formData.get('title') ?? '').trim(),
    organiser: String(formData.get('organiser') ?? '').trim() || null,
    role_ar: String(formData.get('role') ?? '').trim() || null,
    result_ar: String(formData.get('result') ?? '').trim() || null,
    evidence_url: String(formData.get('evidence_url') ?? '').trim() || null,
    held_on: String(formData.get('held_on') ?? '') || null,
  });

  revalidatePath(HERE);
}

/** One remover for every list, because they are all the owner's own rows. */
export async function removeRow(formData: FormData) {
  const { supabase } = await me();
  const table = String(formData.get('table') ?? '');
  const id = String(formData.get('id') ?? '');

  if (table === 'profile_links') await supabase.from('profile_links').delete().eq('id', id);
  if (table === 'profile_education') await supabase.from('profile_education').delete().eq('id', id);
  if (table === 'profile_experience') await supabase.from('profile_experience').delete().eq('id', id);
  if (table === 'external_exhibitions') await supabase.from('external_exhibitions').delete().eq('id', id);

  revalidatePath(HERE);
}
