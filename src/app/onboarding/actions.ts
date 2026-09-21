'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';
import { SELECTABLE_ROLES } from '@/lib/roles';
import type { TaxonomyKind, UiLanguage, UserRole } from '@/lib/database.types';

export type StepState = { error?: string; ok?: string } | undefined;

const TABLE = {
  field: { link: 'profile_fields', column: 'field_id' },
  interest: { link: 'profile_interests', column: 'interest_id' },
  skill: { link: 'profile_skills', column: 'skill_id' },
} as const satisfies Record<TaxonomyKind, { link: string; column: string }>;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/**
 * Step 1 — who you are.
 *
 * The username is a handle, not the identity: the TechMood ID was issued when
 * the account was created and never changes, whatever the person calls
 * themselves here.
 */
export async function saveBasics(_prev: StepState, formData: FormData): Promise<StepState> {
  const t = await getT();
  const { supabase, user } = await me();

  const fullName = String(formData.get('full_name') ?? '').trim();
  const displayName = String(formData.get('display_name') ?? '').trim();
  const username = String(formData.get('username') ?? '').trim().toLowerCase();

  if (fullName.length < 2) return { error: t('الاسم الكامل مطلوب.', 'Your full name is required.') };
  if (displayName.length < 2) return { error: t('الاسم الظاهر مطلوب.', 'A display name is required.') };
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return {
      error: t('اسم المستخدم: حروف إنجليزية صغيرة وأرقام و_ فقط، من 3 إلى 30 خانة.',
               'Username: lowercase letters, digits and _ only, 3 to 30 characters.'),
    };
  }

  const { data: available } = await supabase.rpc('is_username_available', { p_username: username });
  if (!available) return { error: t('اسم المستخدم هذا محجوز — اختر غيره.', 'That username is taken — pick another.') };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      display_name: displayName,
      username,
      country: String(formData.get('country') ?? '').trim() || null,
      city: String(formData.get('city') ?? '').trim() || null,
      language: (String(formData.get('language') ?? 'ar') as UiLanguage),
      avatar_url: String(formData.get('avatar_url') ?? '').trim() || null,
      headline: String(formData.get('headline') ?? '').trim() || null,
    })
    .eq('id', user.id);

  if (error) {
    return {
      error: error.message.includes('username')
        ? t('اسم المستخدم غير صالح أو محجوز.', 'That username is invalid or taken.')
        : t('تعذّر الحفظ.', 'Could not save.'),
    };
  }

  revalidatePath('/onboarding');
  return { ok: 'saved' };
}

/**
 * Step 2 — the roles you are asking for.
 *
 * Student is already yours and is not listed here. Everything else is a request
 * that a human reads: apply_for_role() files it as pending and opens the trail.
 */
export async function requestRoles(_prev: StepState, formData: FormData): Promise<StepState> {
  const t = await getT();
  const { supabase } = await me();

  const wanted = formData
    .getAll('roles')
    .map(String)
    .filter((role): role is UserRole =>
      SELECTABLE_ROLES.some((r) => r.value === role && r.needsReview));

  for (const role of wanted) {
    const note = String(formData.get(`note_${role}`) ?? '').trim();
    const { error } = await supabase.rpc('apply_for_role', {
      p_role: role,
      p_note: note || null,
      p_evidence_url: null,
    });
    // "already held" and "already pending" are both fine to walk past: the
    // person is re-submitting a step, not doing anything wrong.
    if (error && !/بالفعل/.test(error.message)) {
      return { error: dbError(t, error.message) };
    }
  }

  revalidatePath('/onboarding');
  return { ok: 'saved' };
}

/**
 * Steps 3-5 — fields, interests and skills.
 *
 * Three calls into one action, but never into one table: what you work in, what
 * you care about and what you can do stay separate all the way down, because
 * mentor matching, team matching and search each read a different one.
 */
export async function saveTerms(_prev: StepState, formData: FormData): Promise<StepState> {
  const t = await getT();
  const { supabase, user } = await me();

  const kind = String(formData.get('kind') ?? '') as TaxonomyKind;
  if (!(kind in TABLE)) return { error: t('نوع غير معروف.', 'Unknown kind.') };

  const ids = formData.getAll('term').map(String).filter(Boolean);
  if (kind === 'field' && ids.length > 3) {
    return { error: t('المجالات: ثلاثة كحد أقصى.', 'Fields: three at most.') };
  }

  // Replace, not merge: the step shows the whole selection, so the whole
  // selection is what gets saved. Each link table is written on its own — the
  // three axes never meet.
  await supabase.from(TABLE[kind].link).delete().eq('profile_id', user.id);

  if (ids.length > 0) {
    const rows =
      kind === 'field' ? ids.map((id) => ({ profile_id: user.id, field_id: id }))
      : kind === 'interest' ? ids.map((id) => ({ profile_id: user.id, interest_id: id }))
      : ids.map((id) => ({ profile_id: user.id, skill_id: id }));

    const { error } =
      kind === 'field'
        ? await supabase.from('profile_fields').insert(rows as { profile_id: string; field_id: string }[])
        : kind === 'interest'
          ? await supabase.from('profile_interests').insert(rows as { profile_id: string; interest_id: string }[])
          : await supabase.from('profile_skills').insert(rows as { profile_id: string; skill_id: string }[]);

    if (error) return { error: dbError(t, error.message) };
  }

  revalidatePath('/onboarding');
  return { ok: 'saved' };
}

/** Suggesting a term files it for review. It does not appear in the list yet. */
export async function suggestTerm(_prev: StepState, formData: FormData): Promise<StepState> {
  const t = await getT();
  const { supabase } = await me();

  const { error } = await supabase.rpc('suggest_taxonomy_term', {
    p_kind: String(formData.get('kind') ?? '') as TaxonomyKind,
    p_name_ar: String(formData.get('name_ar') ?? ''),
    p_name_en: String(formData.get('name_en') ?? ''),
  });

  if (error) return { error: dbError(t, error.message) };

  revalidatePath('/onboarding');
  return {
    ok: t('اقتراحك وصل — سيظهر في القائمة بعد مراجعته.',
          'Your suggestion is in — it will appear in the list once it has been reviewed.'),
  };
}

/** Step 6 — the account is ready. */
export async function finishOnboarding(_prev: StepState, formData: FormData): Promise<StepState> {
  const t = await getT();
  const { supabase, user } = await me();

  const primary = String(formData.get('primary_role') ?? 'student') as UserRole;

  const { error } = await supabase
    .from('profiles')
    .update({ primary_role: primary, onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return { error: t('تعذّر إنهاء الإعداد.', 'Could not finish setting up.') };

  revalidatePath('/', 'layout');
  redirect('/home');
}
