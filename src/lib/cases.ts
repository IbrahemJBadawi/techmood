import type { AdminActionKind, CaseStatus, RestrictedFeature } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

export const CASE_STATUS: Record<CaseStatus, { label: Text; className: string }> = {
  open:          { label: { ar: 'مفتوحة',          en: 'Open' },            className: 'status-pending' },
  investigating: { label: { ar: 'قيد التحقيق',     en: 'Investigating' },   className: 'status-pending' },
  awaiting_info: { label: { ar: 'بانتظار معلومات', en: 'Awaiting info' },   className: 'status-danger' },
  decided:       { label: { ar: 'صدر القرار',      en: 'Decided' },         className: 'status-ok' },
  closed:        { label: { ar: 'مغلقة',           en: 'Closed' },          className: 'status-muted' },
};

/** `sensitive` actions take something away: the form asks for confirmation. */
export const ADMIN_ACTION: Record<AdminActionKind, { label: Text; sensitive: boolean; needs: ('target_profile' | 'target_id' | 'feature' | 'duration')[] }> = {
  request_info:     { label: { ar: 'طلب معلومات إضافية', en: 'Request more information' }, sensitive: false, needs: [] },
  warn:             { label: { ar: 'تنبيه المستخدم',     en: 'Warn user' },                sensitive: true,  needs: ['target_profile'] },
  restrict_feature: { label: { ar: 'تقييد ميزة',         en: 'Restrict a feature' },       sensitive: true,  needs: ['target_profile', 'feature', 'duration'] },
  suspend_session:  { label: { ar: 'إيقاف جلسة',         en: 'Suspend a session' },        sensitive: true,  needs: ['target_id'] },
  cancel_booking:   { label: { ar: 'إلغاء حجز',          en: 'Cancel a booking' },         sensitive: true,  needs: ['target_id'] },
  refund:           { label: { ar: 'إرجاع مبلغ',         en: 'Refund' },                   sensitive: true,  needs: ['target_id'] },
  reject_report:    { label: { ar: 'رفض البلاغ',         en: 'Reject the report' },        sensitive: true,  needs: [] },
  resolve:          { label: { ar: 'حلّ القضية',          en: 'Resolve' },                  sensitive: false, needs: [] },
  escalate:         { label: { ar: 'تصعيد',              en: 'Escalate' },                 sensitive: false, needs: [] },
  suspend_account:  { label: { ar: 'إيقاف الحساب',       en: 'Suspend account' },          sensitive: true,  needs: ['target_profile', 'duration'] },
  lift_restriction: { label: { ar: 'رفع قيد',            en: 'Lift a restriction' },       sensitive: false, needs: ['target_id'] },
};

export const FEATURE: Record<Exclude<RestrictedFeature, 'everything'>, Text> = {
  booking:     { ar: 'حجز الجلسات',      en: 'Booking sessions' },
  messaging:   { ar: 'المراسلة',          en: 'Messaging' },
  marketplace: { ar: 'السوق (التقديم والنشر)', en: 'Marketplace (applying and posting)' },
  withdrawals: { ar: 'السحب',            en: 'Withdrawals' },
  reviews:     { ar: 'كتابة التقييمات',   en: 'Writing reviews' },
};
