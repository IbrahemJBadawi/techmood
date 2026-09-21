'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { EvaluationDecision } from '@/lib/database.types';

export type ReviewState = { error?: string; ok?: string } | undefined;

const DECISIONS: EvaluationDecision[] = ['approved', 'changes_requested', 'rejected'];

/**
 * Records a mentor's evaluation. The role check, the version it attaches to and
 * the resulting submission status all live in evaluate_submission(); this action
 * only validates the shape of the form.
 */
export async function evaluateSubmission(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const submissionId = String(formData.get('submission_id') ?? '');
  const decision = String(formData.get('decision') ?? '') as EvaluationDecision;

  if (!DECISIONS.includes(decision)) {
    return { error: t('قرار غير معروف.', 'Unknown decision.') };
  }

  const rawStars = String(formData.get('stars') ?? '').trim();
  const stars = rawStars ? Number(rawStars) : null;

  if (decision === 'approved' && (stars === null || Number.isNaN(stars) || stars < 1 || stars > 5)) {
    return { error: t('الاعتماد يتطلب تقييم جودة من 1 إلى 5 نجوم.', 'Approving needs a quality rating from 1 to 5 stars.') };
  }

  const feedback = String(formData.get('feedback') ?? '').trim();
  if (decision !== 'approved' && feedback.length < 10) {
    return { error: t('اكتب ملاحظات واضحة تشرح المطلوب قبل إعادة العمل للطالب.', 'Write clear notes explaining what is needed before sending the work back.') };
  }

  const { error } = await supabase.rpc('evaluate_submission', {
    p_submission_id: submissionId,
    p_decision: decision,
    p_stars: stars,
    p_feedback: feedback || null,
    p_score: null,
  });

  if (error) {
    return { error: t('تعذّر حفظ التقييم — تأكد أن لديك دور منتور معتمد.', 'The evaluation could not be saved — check that you hold an approved mentor role.') };
  }

  // An open re-evaluation request on this submission is answered by this review.
  await supabase
    .from('reevaluation_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('submission_id', submissionId)
    .eq('status', 'open');

  revalidatePath('/review');
  revalidatePath(`/review/${submissionId}`);
  return { ok: t('تم حفظ التقييم.', 'Evaluation saved.') };
}

/** A student contests an evaluation and asks for another look. */
export async function requestReevaluation(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const reason = String(formData.get('reason') ?? '').trim();
  if (reason.length < 10) {
    return { error: t('اشرح سبب طلب إعادة التقييم في جملة واضحة على الأقل.', 'Explain why you are asking for a re-evaluation, in at least one clear sentence.') };
  }

  const { error } = await supabase.from('reevaluation_requests').insert({
    submission_id: String(formData.get('submission_id') ?? ''),
    evaluation_id: String(formData.get('evaluation_id') ?? ''),
    requested_by: user.id,
    reason_ar: reason,
  });

  if (error) {
    return { error: t('تعذّر إرسال الطلب — ربما لديك طلب مفتوح بالفعل.', 'The request could not be sent — you may already have one open.') };
  }

  revalidatePath(String(formData.get('revalidate') ?? '/academy'));
  return { ok: t('تم إرسال طلب إعادة التقييم.', 'Re-evaluation request sent.') };
}
