'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { GoalStatus, PlanSection, StartupStage, SwotQuadrant } from '@/lib/database.types';

export type StartupState = { error?: string; ok?: string } | undefined;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

export async function createStartup(_prev: StartupState, formData: FormData): Promise<StartupState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2) return { error: t('اكتب اسم المشروع.', 'Give the startup a name.') };

  const { data, error } = await supabase
    .from('startups')
    .insert({
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      name_ar: name,
      one_liner_ar: String(formData.get('one_liner') ?? '').trim() || null,
      description_ar: String(formData.get('description') ?? '').trim() || null,
      problem_ar: String(formData.get('problem') ?? '').trim() || null,
      solution_ar: String(formData.get('solution') ?? '').trim() || null,
      founder_id: user.id,
      is_public: formData.get('is_public') === 'on',
    })
    .select('id')
    .single();

  if (error || !data) return { error: t('تعذّر إنشاء المشروع.', 'The startup could not be created.') };

  revalidatePath('/startups');
  redirect(`/startups/${data.id}/canvas`);
}

export async function setStartupStage(formData: FormData) {
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('startups')
    .update({ stage: String(formData.get('stage') ?? 'idea') as StartupStage })
    .eq('id', startupId);

  revalidatePath(`/startups/${startupId}`);
}

export async function savePlanSection(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const startupId = String(formData.get('startup_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  await supabase.from('business_plan_sections').upsert(
    {
      startup_id: startupId,
      section: String(formData.get('section') ?? '') as PlanSection,
      body_ar: body || null,
      // An empty section cannot be complete; the database enforces it too.
      is_complete: formData.get('is_complete') === 'on' && body.length > 0,
      updated_by: user.id,
    },
    { onConflict: 'startup_id,section' },
  );

  revalidatePath(`/startups/${startupId}/plan`);
}

export async function saveStrategy(formData: FormData) {
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  await supabase.from('startup_strategy').upsert(
    {
      startup_id: startupId,
      vision_ar: String(formData.get('vision') ?? '').trim() || null,
      mission_ar: String(formData.get('mission') ?? '').trim() || null,
      values_ar: String(formData.get('values') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
    { onConflict: 'startup_id' },
  );

  revalidatePath(`/startups/${startupId}/strategy`);
}

export async function addSwotItem(formData: FormData) {
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  await supabase.from('swot_items').insert({
    startup_id: startupId,
    quadrant: String(formData.get('quadrant') ?? 'strength') as SwotQuadrant,
    body_ar: body,
  });

  revalidatePath(`/startups/${startupId}/strategy`);
}

export async function removeSwotItem(formData: FormData) {
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  await supabase.from('swot_items').delete().eq('id', String(formData.get('item_id') ?? ''));
  revalidatePath(`/startups/${startupId}/strategy`);
}

/** SMART, held to its letters: a metric with numbers and a date, or no goal. */
export async function saveSmartGoal(_prev: StartupState, formData: FormData): Promise<StartupState> {
  const t = await getT();
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  const baseline = Number(String(formData.get('baseline_value') ?? '0'));
  const target = Number(String(formData.get('target_value') ?? '0'));

  if (!Number.isFinite(baseline) || !Number.isFinite(target)) {
    return { error: t('القيم الرقمية غير صحيحة.', 'Those numbers are not valid.') };
  }
  if (baseline === target) {
    return { error: t('الهدف يجب أن يتحرك عن نقطة البداية، وإلا فهو غير قابل للقياس.', 'A goal has to move away from its baseline, otherwise there is nothing to measure.') };
  }

  const startsOn = String(formData.get('starts_on') ?? '');
  const dueOn = String(formData.get('due_on') ?? '');
  if (!startsOn || !dueOn || dueOn < startsOn) {
    return { error: t('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.', 'The end date has to come after the start date.') };
  }

  const { error } = await supabase.from('smart_goals').insert({
    startup_id: startupId,
    title_ar: String(formData.get('title') ?? '').trim(),
    specific_ar: String(formData.get('specific') ?? '').trim(),
    achievable_ar: String(formData.get('achievable') ?? '').trim() || null,
    relevant_ar: String(formData.get('relevant') ?? '').trim() || null,
    metric_label_ar: String(formData.get('metric_label') ?? '').trim(),
    baseline_value: baseline,
    target_value: target,
    current_value: Number(String(formData.get('current_value') ?? '0')) || 0,
    starts_on: startsOn,
    due_on: dueOn,
  });

  if (error) return { error: t('تعذّر حفظ الهدف.', 'The goal could not be saved.') };

  revalidatePath(`/startups/${startupId}/strategy`);
  return { ok: t('أُضيف الهدف.', 'Goal added.') };
}

export async function updateGoalProgress(formData: FormData) {
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  await supabase
    .from('smart_goals')
    .update({
      current_value: Number(String(formData.get('current_value') ?? '0')) || 0,
      status: String(formData.get('status') ?? 'on_track') as GoalStatus,
    })
    .eq('id', String(formData.get('goal_id') ?? ''));

  revalidatePath(`/startups/${startupId}/strategy`);
}

export async function applyToIncubator(_prev: StartupState, formData: FormData): Promise<StartupState> {
  const t = await getT();
  const supabase = await createClient();
  const startupId = String(formData.get('startup_id') ?? '');

  const { error } = await supabase.rpc('apply_to_incubator', {
    p_startup: startupId,
    p_pitch: String(formData.get('pitch') ?? '').trim(),
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('business model canvas')) {
      return { error: t('أكمل نموذج العمل أولاً — 6 بطاقات على الأقل قبل التقديم.', 'Fill in the business model first — at least six cards before applying.') };
    }
    if (message.includes('already under review')) return { error: t('لديك طلب قيد المراجعة بالفعل.', 'You already have an application under review.') };
    if (message.includes('only the founder')) return { error: t('المؤسس فقط يستطيع التقديم.', 'Only the founder can apply.') };
    if (message.includes('pitch')) return { error: t('اكتب نبذة عن سبب تقديمك.', 'Write a short note on why you are applying.') };
    return { error: t('تعذّر إرسال الطلب.', 'The application could not be sent.') };
  }

  revalidatePath(`/startups/${startupId}`);
  return { ok: t('أُرسل طلبك للحاضنة.', 'Your application is with the incubator.') };
}
