import { intlTag, type Locale, type Text } from '@/lib/i18n';
import type { BookingStatus, PaymentStatus, SlotState } from '@/lib/database.types';

/**
 * Booking, payment and slot are three separate state machines on purpose, so
 * the UI labels them separately too. "Paid but not yet accepted" has to be
 * sayable — that is the whole point of not collapsing them.
 */
export const BOOKING_STATUS: Record<BookingStatus, { text: Text; className: string }> = {
  draft:             { text: { ar: 'مسودّة',                  en: 'Draft' },                  className: 'status-muted' },
  payment_pending:   { text: { ar: 'بانتظار الدفع',            en: 'Awaiting payment' },       className: 'status-pending' },
  payment_submitted: { text: { ar: 'بانتظار تأكيد TechMood للدفع', en: 'Waiting for TechMood to confirm payment' }, className: 'status-pending' },
  payment_verified:  { text: { ar: 'تم التحقق من الدفع',       en: 'Payment verified' },       className: 'status-ok' },
  mentor_pending:    { text: { ar: 'بانتظار موافقة المنتور',   en: 'Awaiting mentor' },        className: 'status-pending' },
  confirmed:         { text: { ar: 'مؤكَّد',                    en: 'Confirmed' },              className: 'status-ok' },
  completed:         { text: { ar: 'مكتملة',                   en: 'Completed' },              className: 'status-ok' },
  cancelled:         { text: { ar: 'ملغى',                     en: 'Cancelled' },              className: 'status-muted' },
  rejected:          { text: { ar: 'رفضه المنتور',             en: 'Declined by mentor' },     className: 'status-danger' },
  refunded:          { text: { ar: 'مسترد',                    en: 'Refunded' },               className: 'status-muted' },
  expired:           { text: { ar: 'انتهت صلاحية الطلب',       en: 'Reservation expired' },    className: 'status-muted' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { text: Text; className: string }> = {
  pending:      { text: { ar: 'لم يُرسل بعد',   en: 'Not sent yet' },  className: 'status-muted' },
  under_review: { text: { ar: 'بانتظار مراجعة TechMood', en: 'Waiting for TechMood' }, className: 'status-pending' },
  needs_info:   { text: { ar: 'سؤال بانتظار جوابك', en: 'A question for you' }, className: 'status-pending' },
  verified:     { text: { ar: 'تم استلام الدفعة', en: 'Payment received' }, className: 'status-ok' },
  rejected:     { text: { ar: 'مرفوض',          en: 'Rejected' },      className: 'status-danger' },
  failed:       { text: { ar: 'فشل',            en: 'Failed' },        className: 'status-danger' },
  refunded:     { text: { ar: 'مسترد',          en: 'Refunded' },      className: 'status-muted' },
};

export const SLOT_STATE: Record<SlotState, { label: Text; selectable: boolean }> = {
  available:   { label: { ar: 'متاح',         en: 'Available' },       selectable: true },
  pending:     { label: { ar: 'محجوز مؤقتاً',  en: 'Held' },            selectable: false },
  booked:      { label: { ar: 'محجوز',        en: 'Booked' },          selectable: false },
  unavailable: { label: { ar: 'غير متاح',     en: 'Unavailable' },     selectable: false },
};

/** The fixed journey shown on every booking, with the reached steps marked. */
export const BOOKING_TIMELINE: { key: string; label: Text; matches: BookingStatus[] }[] = [
  { key: 'created',          label: { ar: 'إنشاء الطلب',      en: 'Request created' },   matches: ['payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'payment_sent',     label: { ar: 'إرسال الدفع',      en: 'Payment sent' },      matches: ['payment_submitted', 'payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'payment_verified', label: { ar: 'التحقق من الدفع',  en: 'Payment verified' },  matches: ['payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'mentor_approval',  label: { ar: 'موافقة المنتور',   en: 'Mentor accepted' },   matches: ['confirmed', 'completed'] },
  { key: 'confirmed',        label: { ar: 'تأكيد الحجز',      en: 'Booking confirmed' }, matches: ['confirmed', 'completed'] },
  { key: 'completed',        label: { ar: 'انتهاء الجلسة',    en: 'Session held' },      matches: ['completed'] },
];

export function formatSlot(iso: string, locale: Locale = 'ar') {
  const date = new Date(iso);
  const tag = locale === 'ar' ? 'ar-EG' : intlTag(locale);
  return {
    date: date.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' }),
  };
}

export function money(amount: number) {
  return `$${Number(amount).toFixed(2).replace(/\.00$/, '')}`;
}
