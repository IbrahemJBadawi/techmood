import type { ApplicationStage, CompensationKind, OpportunityKind } from '@/lib/database.types';

export const OPPORTUNITY_KIND: Record<OpportunityKind, { label: string; hint: string }> = {
  freelance:  { label: 'عمل حر',       hint: 'مشروع محدد بمخرجات ومدة.' },
  job:        { label: 'وظيفة',        hint: 'دور مستمر بدوام كامل أو جزئي.' },
  team_seat:  { label: 'مقعد في فريق', hint: 'انضمام إلى فريق قائم داخل TechMood.' },
  cofounder:  { label: 'شريك مؤسس',    hint: 'شراكة في مشروع ناشئ.' },
  internship: { label: 'تدريب',        hint: 'فرصة تدريب عملي.' },
  remote:     { label: 'عمل عن بُعد',  hint: 'دور عن بُعد بالكامل.' },
};

export const COMPENSATION_KIND: Record<CompensationKind, string> = {
  fixed: 'مبلغ مقطوع',
  hourly: 'بالساعة',
  monthly: 'شهري',
  equity: 'حصة ملكية',
  revenue_share: 'نسبة من الإيرادات',
  unpaid: 'غير مدفوع',
};

export const APPLICATION_STAGE: Record<ApplicationStage, { text: string; className: string }> = {
  submitted:   { text: 'قيد النظر',       className: 'status-pending' },
  shortlisted: { text: 'قائمة مختصرة',   className: 'status-pending' },
  accepted:    { text: 'مقبول',           className: 'status-ok' },
  declined:    { text: 'غير مقبول',       className: 'status-danger' },
  withdrawn:   { text: 'مسحوب',           className: 'status-muted' },
};

/** Reads the pay as a human would say it, from whatever the poster filled in. */
export function compensationLabel(opportunity: {
  compensation_kind: CompensationKind | null;
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  compensation_ar: string | null;
}) {
  if (opportunity.compensation_kind === 'unpaid') return 'غير مدفوع';

  const { amount_min: min, amount_max: max, currency } = opportunity;
  const unit = opportunity.compensation_kind ? COMPENSATION_KIND[opportunity.compensation_kind] : null;

  if (min === null && max === null) return opportunity.compensation_ar ?? unit ?? '—';

  const range =
    min !== null && max !== null && min !== max
      ? `${min}–${max}`
      : String(min ?? max);

  return `${range} ${currency}${unit ? ` · ${unit}` : ''}`;
}
