'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { ApplicationStage, CompensationKind, OpportunityKind } from '@/lib/database.types';

export type MarketState = { error?: string; ok?: string } | undefined;

export async function postOpportunity(_prev: MarketState, formData: FormData): Promise<MarketState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  if (title.length < 4) return { error: 'اكتب عنواناً واضحاً للفرصة.' };

  const toNumber = (field: string) => {
    const raw = String(formData.get(field) ?? '').trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };

  const min = toNumber('amount_min');
  const max = toNumber('amount_max');
  if (min !== null && max !== null && max < min) {
    return { error: 'الحد الأعلى للأجر يجب ألا يقل عن الحد الأدنى.' };
  }

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      kind: String(formData.get('kind') ?? 'freelance') as OpportunityKind,
      title_ar: title,
      organization_ar: String(formData.get('organization') ?? '').trim() || null,
      description_ar: String(formData.get('description') ?? '').trim() || null,
      posted_by: user.id,
      team_id: String(formData.get('team_id') ?? '') || null,
      compensation_kind: (String(formData.get('compensation_kind') ?? '') || null) as CompensationKind | null,
      amount_min: min,
      amount_max: max,
      currency: String(formData.get('currency') ?? 'USD').trim() || 'USD',
      location_ar: String(formData.get('location') ?? '').trim() || null,
      is_remote: formData.get('is_remote') === 'on',
      closes_on: String(formData.get('closes_on') ?? '') || null,
      seats: Number(String(formData.get('seats') ?? '1')) || 1,
      min_stars: toNumber('min_stars'),
      required_path_id: String(formData.get('required_path_id') ?? '') || null,
      required_skills: String(formData.get('required_skills') ?? '')
        .split(',').map((skill) => skill.trim()).filter(Boolean),
      tags: String(formData.get('tags') ?? '')
        .split(',').map((tag) => tag.trim()).filter(Boolean),
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: 'تعذّر نشر الفرصة — نشر الفرص يتطلب دوراً معتمداً (شركة، مؤسس، قائد فريق، أو فريلانسر).' };
  }

  revalidatePath('/marketplace');
  redirect(`/marketplace/${data.id}`);
}

export async function applyToOpportunity(_prev: MarketState, formData: FormData): Promise<MarketState> {
  const supabase = await createClient();
  const opportunityId = String(formData.get('opportunity_id') ?? '');

  const { error } = await supabase.rpc('apply_to_opportunity', {
    p_opportunity: opportunityId,
    p_cover: String(formData.get('cover') ?? '').trim() || null,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('your own posting')) return { error: 'لا يمكنك التقدّم على فرصة نشرتها بنفسك.' };
    if (message.includes('not open')) return { error: 'هذه الفرصة لم تعد مفتوحة.' };
    if (message.includes('have closed')) return { error: 'انتهى موعد التقديم على هذه الفرصة.' };
    if (message.includes('been filled')) return { error: 'اكتمل عدد المقاعد على هذه الفرصة.' };
    if (message.includes('already a member')) return { error: 'أنت عضو في هذا الفريق بالفعل.' };
    if (message.includes('duplicate')) return { error: 'قدّمت على هذه الفرصة من قبل.' };
    return { error: 'تعذّر إرسال الطلب.' };
  }

  revalidatePath(`/marketplace/${opportunityId}`);
  revalidatePath('/applications');
  return { ok: 'أُرسل طلبك.' };
}

export async function decideApplication(formData: FormData) {
  const supabase = await createClient();
  const opportunityId = String(formData.get('opportunity_id') ?? '');

  await supabase.rpc('decide_opportunity_application', {
    p_application: String(formData.get('application_id') ?? ''),
    p_stage: String(formData.get('stage') ?? 'submitted') as ApplicationStage,
    p_note: String(formData.get('note') ?? '').slice(0, 500) || null,
  });

  revalidatePath(`/marketplace/${opportunityId}`);
  revalidatePath('/applications');
}

export async function closeOpportunity(formData: FormData) {
  const supabase = await createClient();
  const opportunityId = String(formData.get('opportunity_id') ?? '');

  await supabase.from('opportunities').update({ status: 'archived' }).eq('id', opportunityId);

  revalidatePath(`/marketplace/${opportunityId}`);
  revalidatePath('/marketplace');
}
