import type { Locale, Text } from '@/lib/i18n';
import type { ApplicationStage, CompensationKind, OpportunityKind } from '@/lib/database.types';

export const OPPORTUNITY_KIND: Record<OpportunityKind, { label: Text; hint: Text }> = {
  freelance:  {
    label: { ar: 'عمل حر', en: 'Freelance' },
    hint:  { ar: 'مشروع محدد بمخرجات ومدة.', en: 'A defined project with deliverables and a deadline.' },
  },
  job: {
    label: { ar: 'وظيفة', en: 'Job' },
    hint:  { ar: 'دور مستمر بدوام كامل أو جزئي.', en: 'An ongoing role, full time or part time.' },
  },
  team_seat: {
    label: { ar: 'مقعد في فريق', en: 'Team seat' },
    hint:  { ar: 'انضمام إلى فريق قائم داخل TechMood.', en: 'Joining an existing team inside TechMood.' },
  },
  cofounder: {
    label: { ar: 'شريك مؤسس', en: 'Co-founder' },
    hint:  { ar: 'شراكة في مشروع ناشئ.', en: 'A partnership in a startup.' },
  },
  internship: {
    label: { ar: 'تدريب', en: 'Internship' },
    hint:  { ar: 'فرصة تدريب عملي.', en: 'A hands-on training placement.' },
  },
  remote: {
    label: { ar: 'عمل عن بُعد', en: 'Remote' },
    hint:  { ar: 'دور عن بُعد بالكامل.', en: 'A fully remote role.' },
  },
};

export const COMPENSATION_KIND: Record<CompensationKind, Text> = {
  fixed:         { ar: 'مبلغ مقطوع',        en: 'Fixed fee' },
  hourly:        { ar: 'بالساعة',           en: 'Hourly' },
  monthly:       { ar: 'شهري',              en: 'Monthly' },
  equity:        { ar: 'حصة ملكية',         en: 'Equity' },
  revenue_share: { ar: 'نسبة من الإيرادات', en: 'Revenue share' },
  unpaid:        { ar: 'غير مدفوع',         en: 'Unpaid' },
};

/**
 * The ladder an application climbs. Each step exists because it is a different
 * answer to "where do I stand?" — being read is not the same as being ignored,
 * and an offer is not yet a yes.
 */
export const APPLICATION_STAGE: Record<ApplicationStage, { text: Text; className: string }> = {
  submitted:    { text: { ar: 'وصل الطلب',      en: 'Submitted' },           className: 'status-muted' },
  under_review: { text: { ar: 'قيد القراءة',    en: 'Under review' },        className: 'status-pending' },
  shortlisted:  { text: { ar: 'قائمة مختصرة',   en: 'Shortlisted' },         className: 'status-pending' },
  interview:    { text: { ar: 'مقابلة',         en: 'Interview' },           className: 'status-pending' },
  offer:        { text: { ar: 'عرض',            en: 'Offer' },               className: 'status-ok' },
  accepted:     { text: { ar: 'مقبول',          en: 'Accepted' },            className: 'status-ok' },
  declined:     { text: { ar: 'غير مقبول',      en: 'Not accepted' },        className: 'status-danger' },
  withdrawn:    { text: { ar: 'مسحوب',          en: 'Withdrawn' },           className: 'status-muted' },
};

/** The order a poster moves somebody through, before a yes or a no. */
export const STAGE_LADDER: ApplicationStage[] =
  ['submitted', 'under_review', 'shortlisted', 'interview', 'offer', 'accepted'];

/** Reads the pay as a human would say it, from whatever the poster filled in. */
export function compensationLabel(
  locale: Locale,
  opportunity: {
    compensation_kind: CompensationKind | null;
    amount_min: number | null;
    amount_max: number | null;
    currency: string;
    compensation_ar: string | null;
  },
) {
  const say = (text: Text) => (locale === 'ar' ? text.ar : text.en);

  if (opportunity.compensation_kind === 'unpaid') return say(COMPENSATION_KIND.unpaid);

  const { amount_min: min, amount_max: max, currency } = opportunity;
  const unit = opportunity.compensation_kind ? say(COMPENSATION_KIND[opportunity.compensation_kind]) : null;

  // compensation_ar is what the poster typed; it has no translation, and
  // inventing one would put words in their mouth.
  if (min === null && max === null) return opportunity.compensation_ar ?? unit ?? '—';

  const range =
    min !== null && max !== null && min !== max
      ? `${min}–${max}`
      : String(min ?? max);

  return `${range} ${currency}${unit ? ` · ${unit}` : ''}`;
}
