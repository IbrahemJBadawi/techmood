import type { TicketCategory, TicketPriority, TicketRelated, TicketStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/** Help & Reports, in the words a person reads (0083). */
export const TICKET_CATEGORY: Record<TicketCategory, Text> = {
  payment:    { ar: 'مشكلة دفع',            en: 'Payment' },
  booking:    { ar: 'مشكلة حجز',            en: 'Booking' },
  mentor:     { ar: 'منتور',                en: 'Mentor' },
  mentee:     { ar: 'مستفيد من الإرشاد',     en: 'Mentee' },
  freelancer: { ar: 'فريلانسر',             en: 'Freelancer' },
  client:     { ar: 'عميل',                 en: 'Client' },
  content:    { ar: 'محتوى',                en: 'Content' },
  account:    { ar: 'الحساب',               en: 'Account' },
  behavior:   { ar: 'سلوك غير مناسب',        en: 'Inappropriate behaviour' },
  fraud:      { ar: 'احتيال أو محاولة احتيال', en: 'Fraud or attempted fraud' },
  copyright:  { ar: 'حقوق محتوى',           en: 'Content rights' },
  technical:  { ar: 'مشكلة تقنية',          en: 'Technical problem' },
  other:      { ar: 'أخرى',                 en: 'Other' },
};

export const TICKET_STATUS: Record<TicketStatus, { label: Text; className: string }> = {
  open:         { label: { ar: 'جديد',               en: 'New' },               className: 'status-pending' },
  assistant:    { label: { ar: 'مع المساعد',          en: 'With the assistant' }, className: 'status-pending' },
  needs_human:  { label: { ar: 'حُوّل لفريق الدعم',   en: 'With the support team' }, className: 'status-pending' },
  pending_user: { label: { ar: 'بانتظار ردّك',        en: 'Waiting for you' },    className: 'status-danger' },
  under_review: { label: { ar: 'قيد المراجعة',        en: 'Under review' },       className: 'status-pending' },
  resolved:     { label: { ar: 'تم الحل',             en: 'Resolved' },           className: 'status-ok' },
  rejected:     { label: { ar: 'مرفوض',               en: 'Rejected' },           className: 'status-muted' },
  closed:       { label: { ar: 'مغلق',                en: 'Closed' },             className: 'status-muted' },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: Text; className: string }> = {
  urgent: { label: { ar: 'عاجل',   en: 'Urgent' }, className: 'status-danger' },
  high:   { label: { ar: 'عالٍ',   en: 'High' },   className: 'status-danger' },
  medium: { label: { ar: 'متوسط',  en: 'Medium' }, className: 'status-pending' },
  low:    { label: { ar: 'منخفض',  en: 'Low' },    className: 'status-muted' },
};

export const TICKET_RELATED: Record<TicketRelated, Text> = {
  booking:       { ar: 'حجز جلسة',   en: 'Booking' },
  payment:       { ar: 'دفعة',       en: 'Payment' },
  escrow:        { ar: 'مبلغ محتجز', en: 'Escrow' },
  project:       { ar: 'مشروع',      en: 'Project' },
  team:          { ar: 'فريق',       en: 'Team' },
  video_session: { ar: 'جلسة فيديو', en: 'Video session' },
  course:        { ar: 'دورة',       en: 'Course' },
  profile:       { ar: 'مستخدم',     en: 'User' },
  opportunity:   { ar: 'فرصة عمل',   en: 'Opportunity' },
  payout:        { ar: 'طلب سحب',    en: 'Withdrawal' },
  message:       { ar: 'رسالة',      en: 'Message' },
};

export const ESCALATION: Record<string, Text> = {
  fraud:                { ar: 'اتهام أو شبهة احتيال',            en: 'Fraud allegation' },
  abuse:                { ar: 'إساءة أو تحرش أو سلوك مخالف',    en: 'Abuse, harassment or misconduct' },
  account_risk:         { ar: 'حساب معرّض للخطر',               en: 'Account at risk' },
  refund:               { ar: 'طلب استرداد',                    en: 'Refund request' },
  repeated_complaints:  { ar: 'شكاوى متكررة عن الشخص نفسه',     en: 'Repeated complaints' },
  project_dispute:      { ar: 'نزاع على مشروع',                 en: 'Project dispute' },
  money_dispute:        { ar: 'نزاع مالي',                      en: 'Money dispute' },
  relationship_dispute: { ar: 'خلاف بين طرفي علاقة إرشاد',      en: 'Mentor–mentee dispute' },
  content_rights:       { ar: 'حقوق محتوى',                     en: 'Content rights' },
  asked_for_person:     { ar: 'طلب التحدث مع شخص',              en: 'Asked for a person' },
  unknown:              { ar: 'حالة لا يستطيع المساعد تحديدها', en: 'Could not be placed' },
};

export const TICKET_EVENT: Record<string, Text> = {
  created:              { ar: 'أُنشئ البلاغ',                 en: 'Ticket created' },
  assistant_collected:  { ar: 'جمع المساعد معلومات العملية',   en: 'The assistant collected the details' },
  escalated:            { ar: 'حُوّل إلى فريق الدعم',          en: 'Sent to the support team' },
  admin_replied:        { ar: 'ردّ فريق الدعم',               en: 'Support replied' },
  user_answered:        { ar: 'ردّ صاحب البلاغ',              en: 'You replied' },
  status_pending_user:  { ar: 'طلب فريق الدعم معلومات',        en: 'Support asked for information' },
  status_under_review:  { ar: 'قيد المراجعة',                  en: 'Under review' },
  status_resolved:      { ar: 'حُلّ البلاغ',                   en: 'Resolved' },
  status_rejected:      { ar: 'رُفض البلاغ',                   en: 'Rejected' },
  status_closed:        { ar: 'أُغلق البلاغ',                  en: 'Closed' },
  internal_note:        { ar: 'ملاحظة داخلية',                en: 'Internal note' },
  case_opened:          { ar: 'فُتحت قضية',                    en: 'A case was opened' },
  action:               { ar: 'إجراء إداري',                   en: 'Admin action' },
};
