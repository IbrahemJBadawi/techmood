'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { ActionFormState } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { dbError } from '@/lib/db-errors';

/*
 * The four newer studio tools (0166). Each write goes straight to its table;
 * row-level security decides who may write (the team, never a viewer), and
 * the table's checks keep the numbers sane — so these only read the form.
 */

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const textOrNull = (formData: FormData, key: string) => text(formData, key) || null;

/** An empty box is «not known yet», never zero. */
function numberOrNull(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/[,\s$]/g, '');
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function numberOr(formData: FormData, key: string, fallback: number) {
  return numberOrNull(formData, key) ?? fallback;
}

/** A 1–5 position, or nothing. */
function level(formData: FormData, key: string) {
  const value = numberOrNull(formData, key);
  return value != null && value >= 1 && value <= 5 ? Math.round(value) : null;
}

async function signedIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function saveMarket(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase, user } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const { error } = await supabase.from('startup_market').upsert({
    startup_id: startupId,
    segment_ar: textOrNull(formData, 'segment'),
    tam_usd: numberOrNull(formData, 'tam'),
    sam_usd: numberOrNull(formData, 'sam'),
    som_usd: numberOrNull(formData, 'som'),
    method_ar: textOrNull(formData, 'method'),
    trends_ar: textOrNull(formData, 'trends'),
    sources_ar: textOrNull(formData, 'sources'),
    our_price: level(formData, 'our_price'),
    our_quality: level(formData, 'our_quality'),
    updated_by: user.id,
  }, { onConflict: 'startup_id' });
  if (error) {
    if (error.message.includes('startup_market_nested')) {
      return { error: t('الدوائر الثلاث متداخلة: السوق الممكن ≤ المخدوم ≤ الكلي.', 'The three circles nest: obtainable ≤ served ≤ total.') };
    }
    return { error: dbError(t, error.message) };
  }
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: t('حُفظ السوق.', 'The market is saved.') };
}

export async function saveCompetitor(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase, user } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const id = text(formData, 'id');
  const kind = text(formData, 'kind');
  const row = {
    startup_id: startupId,
    name: text(formData, 'name'),
    kind: (['direct', 'indirect', 'substitute'].includes(kind) ? kind : 'direct') as 'direct' | 'indirect' | 'substitute',
    website_url: textOrNull(formData, 'website'),
    pricing_ar: textOrNull(formData, 'pricing'),
    strengths_ar: textOrNull(formData, 'strengths'),
    weaknesses_ar: textOrNull(formData, 'weaknesses'),
    our_edge_ar: textOrNull(formData, 'edge'),
    price_level: level(formData, 'price_level'),
    quality_level: level(formData, 'quality_level'),
  };
  if (!row.name) return { error: t('اكتب اسم المنافس.', 'Name the competitor.') };
  if (row.website_url && !/^https?:\/\//.test(row.website_url)) row.website_url = `https://${row.website_url}`;

  const { error } = id
    ? await supabase.from('startup_competitors').update(row).eq('id', id).eq('startup_id', startupId)
    : await supabase.from('startup_competitors').insert({ ...row, created_by: user.id });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: id ? t('حُدّث.', 'Updated.') : t('أُضيف المنافس.', 'Competitor added.') };
}

export async function deleteCompetitor(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const { error } = await supabase.from('startup_competitors').delete().eq('id', text(formData, 'id')).eq('startup_id', startupId);
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: t('حُذف.', 'Removed.') };
}

export async function savePersona(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase, user } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const id = text(formData, 'id');
  const row = {
    startup_id: startupId,
    name: text(formData, 'name'),
    age_range: textOrNull(formData, 'age_range'),
    occupation_ar: textOrNull(formData, 'occupation'),
    goals_ar: textOrNull(formData, 'goals'),
    pains_ar: textOrNull(formData, 'pains'),
    channels_ar: textOrNull(formData, 'channels'),
    quote_ar: textOrNull(formData, 'quote'),
    pays_usd: numberOrNull(formData, 'pays'),
    is_primary: formData.get('is_primary') === 'on',
  };
  if (!row.name) return { error: t('أعطِ الشخصية اسماً.', 'Give the persona a name.') };

  // One persona leads; choosing a new one steps the others back.
  if (row.is_primary) {
    await supabase.from('startup_personas').update({ is_primary: false }).eq('startup_id', startupId).neq('id', id || '00000000-0000-0000-0000-000000000000');
  }
  const { error } = id
    ? await supabase.from('startup_personas').update(row).eq('id', id).eq('startup_id', startupId)
    : await supabase.from('startup_personas').insert({ ...row, created_by: user.id });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: id ? t('حُدّث.', 'Updated.') : t('أُضيفت الشخصية.', 'Persona added.') };
}

export async function deletePersona(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const { error } = await supabase.from('startup_personas').delete().eq('id', text(formData, 'id')).eq('startup_id', startupId);
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: t('حُذفت.', 'Removed.') };
}

export async function saveFeasibility(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const t = await getT();
  const { supabase, user } = await signedIn();
  const startupId = text(formData, 'startup_id');
  const months = Math.round(numberOr(formData, 'months', 12));
  const { error } = await supabase.from('startup_feasibility').upsert({
    startup_id: startupId,
    unit_ar: textOrNull(formData, 'unit'),
    price_usd: numberOr(formData, 'price', 0),
    variable_cost_usd: numberOr(formData, 'variable_cost', 0),
    fixed_monthly_usd: numberOr(formData, 'fixed_monthly', 0),
    startup_cost_usd: numberOr(formData, 'startup_cost', 0),
    units_month1: Math.round(numberOr(formData, 'units_month1', 0)),
    growth_pct: numberOr(formData, 'growth', 0),
    months: Math.min(36, Math.max(6, months)),
    notes_ar: textOrNull(formData, 'notes'),
    updated_by: user.id,
  }, { onConflict: 'startup_id' });
  if (error) {
    if (error.message.includes('check')) {
      return { error: t('راجع الأرقام: لا قيم سالبة، والنمو الشهري بين ‎-50%‎ و‎200%‎.', 'Check the numbers: nothing negative, monthly growth between -50% and 200%.') };
    }
    return { error: dbError(t, error.message) };
  }
  revalidatePath(`/startups/${startupId}`, 'layout');
  return { ok: t('أُعيد الحساب.', 'Recalculated.') };
}
