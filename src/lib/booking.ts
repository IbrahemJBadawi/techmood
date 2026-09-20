import type { BookingStatus, PaymentStatus, SlotState } from '@/lib/database.types';

/**
 * Booking, payment and slot are three separate state machines on purpose, so
 * the UI labels them separately too. "Paid but not yet accepted" has to be
 * sayable — that is the whole point of not collapsing them.
 */
export const BOOKING_STATUS: Record<BookingStatus, { text: string; className: string }> = {
  draft:             { text: 'مسودّة',                 className: 'status-muted' },
  payment_pending:   { text: 'بانتظار الدفع',           className: 'status-pending' },
  payment_submitted: { text: 'التحقق من الدفع',         className: 'status-pending' },
  payment_verified:  { text: 'تم التحقق من الدفع',      className: 'status-ok' },
  mentor_pending:    { text: 'بانتظار موافقة المنتور',  className: 'status-pending' },
  confirmed:         { text: 'مؤكَّد',                   className: 'status-ok' },
  completed:         { text: 'مكتملة',                  className: 'status-ok' },
  cancelled:         { text: 'ملغى',                    className: 'status-muted' },
  rejected:          { text: 'رفضه المنتور',            className: 'status-danger' },
  refunded:          { text: 'مسترد',                   className: 'status-muted' },
  expired:           { text: 'انتهت صلاحية الطلب',      className: 'status-muted' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { text: string; className: string }> = {
  pending:      { text: 'لم يُرسل بعد',        className: 'status-muted' },
  under_review: { text: 'قيد المراجعة',        className: 'status-pending' },
  verified:     { text: 'تم التحقق',           className: 'status-ok' },
  rejected:     { text: 'مرفوض',               className: 'status-danger' },
  failed:       { text: 'فشل',                 className: 'status-danger' },
  refunded:     { text: 'مسترد',               className: 'status-muted' },
};

export const SLOT_STATE: Record<SlotState, { label: string; selectable: boolean }> = {
  available:   { label: 'متاح',        selectable: true },
  pending:     { label: 'محجوز مؤقتاً', selectable: false },
  booked:      { label: 'محجوز',       selectable: false },
  unavailable: { label: 'غير متاح',    selectable: false },
};

/** The fixed journey shown on every booking, with the reached steps marked. */
export const BOOKING_TIMELINE: { key: string; label: string; matches: BookingStatus[] }[] = [
  { key: 'created',          label: 'إنشاء الطلب',          matches: ['payment_pending', 'payment_submitted', 'payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'payment_sent',     label: 'إرسال الدفع',          matches: ['payment_submitted', 'payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'payment_verified', label: 'التحقق من الدفع',      matches: ['payment_verified', 'mentor_pending', 'confirmed', 'completed'] },
  { key: 'mentor_approval',  label: 'موافقة المنتور',       matches: ['confirmed', 'completed'] },
  { key: 'confirmed',        label: 'تأكيد الحجز',          matches: ['confirmed', 'completed'] },
  { key: 'completed',        label: 'انتهاء الجلسة',        matches: ['completed'] },
];

export function formatSlot(iso: string) {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function money(amount: number) {
  return `$${Number(amount).toFixed(2).replace(/\.00$/, '')}`;
}
