'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import { PRIMARY_LINK_KINDS } from '@/lib/profile-links';
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

/**
 * An optional username (a handle like @ibrahem) — never asked for at signup.
 * The TechMood ID is the identity and never changes; this is only a name to
 * be found by. Empty removes it.
 */
export async function saveUsername(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const t = await getT();
  const { supabase, user } = await me();
  const username = String(formData.get('username') ?? '').trim().toLowerCase().replace(/^@/, '');

  if (username && !/^[a-z0-9_]{3,30}$/.test(username)) {
    return { error: t('اسم المستخدم: حروف إنجليزية صغيرة وأرقام و_ فقط، من 3 إلى 30 خانة.',
                      'Username: lowercase letters, digits and _ only, 3 to 30 characters.') };
  }
  if (username) {
    const { data: current } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (current?.username !== username) {
      const { data: available } = await supabase.rpc('is_username_available', { p_username: username });
      if (!available) return { error: t('اسم المستخدم هذا محجوز — اختر غيره.', 'That username is taken — pick another.') };
    }
  }

  const { error } = await supabase.from('profiles').update({ username: username || null }).eq('id', user.id);
  revalidatePath(HERE);
  revalidatePath('/passport');
  if (error) return { error: error.message.includes('username') ? t('اسم المستخدم غير صالح أو محجوز.', 'That username is invalid or taken.') : dbError(t, error.message) };
  return { ok: username ? t(`حُجز @${username}.`, `@${username} is yours.`) : t('أُزيل اسم المستخدم.', 'Username removed.') };
}

/** The main accounts, set apart from other links (0123): one of each kind. */
export async function savePrimaryLinks(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const t = await getT();
  const { supabase, user } = await me();

  for (const kind of PRIMARY_LINK_KINDS) {
    const url = String(formData.get(`link_${kind}`) ?? '').trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      return { error: t('كل رابط يبدأ بـ https://', 'Every link starts with https://') };
    }
  }
  for (const kind of PRIMARY_LINK_KINDS) {
    const url = String(formData.get(`link_${kind}`) ?? '').trim();
    await supabase.from('profile_links').delete().eq('profile_id', user.id).eq('kind', kind);
    if (url) {
      const { error } = await supabase.from('profile_links').insert({ profile_id: user.id, kind: kind as LinkKind, url, sort_order: -10 });
      if (error) return { error: dbError(t, error.message) };
    }
  }
  revalidatePath(HERE);
  return { ok: t('حُفظت حساباتك الأساسية.', 'Your main accounts are saved.') };
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

/**
 * The profile photo, saved the moment it is chosen or removed. Which addresses
 * are allowed is the database's rule (0108): the member's own folder in the
 * avatars bucket, or the photo their Google account brought.
 */
export async function setAvatar(url: string | null): Promise<ProfileState> {
  const t = await getT();
  const { supabase, user } = await me();
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
  if (error) return { error: t('تعذّر حفظ الصورة.', 'The photo could not be saved.') };
  revalidatePath('/', 'layout');
  return { ok: 'saved' };
}
