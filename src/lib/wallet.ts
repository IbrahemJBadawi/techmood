import type { Text } from '@/lib/i18n';
import type { LedgerKind, LedgerStatus, PayoutStatus } from '@/lib/database.types';

export const LEDGER_KIND: Record<LedgerKind, Text> = {
  earning:    { ar: 'أرباح',   en: 'Earning' },
  fee:        { ar: 'رسوم',    en: 'Fee' },
  commission: { ar: 'عمولة',   en: 'Commission' },
  payout:     { ar: 'سحب',     en: 'Payout' },
  refund:     { ar: 'استرداد', en: 'Refund' },
};

export const LEDGER_STATUS: Record<LedgerStatus, { text: Text; className: string }> = {
  pending:   { text: { ar: 'قيد الانتظار', en: 'Pending' },   className: 'status-pending' },
  available: { text: { ar: 'متاح',         en: 'Available' }, className: 'status-ok' },
  paid:      { text: { ar: 'مدفوع',        en: 'Paid out' },  className: 'status-muted' },
  cancelled: { text: { ar: 'ملغى',         en: 'Cancelled' }, className: 'status-muted' },
};

export const PAYOUT_STATUS: Record<PayoutStatus, { text: Text; className: string }> = {
  requested: { text: { ar: 'بانتظار المراجعة', en: 'Awaiting review' }, className: 'status-pending' },
  approved:  { text: { ar: 'قيد التحويل',      en: 'Transferring' },    className: 'status-pending' },
  paid:      { text: { ar: 'تم التحويل',       en: 'Transferred' },     className: 'status-ok' },
  rejected:  { text: { ar: 'مرفوض',            en: 'Rejected' },        className: 'status-danger' },
};

/** Signed money, so a debit reads as a debit rather than a bare number. */
export function signedMoney(amount: number) {
  const value = Number(amount);
  const formatted = `$${Math.abs(value).toFixed(2).replace(/\.00$/, '')}`;
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}

/** The statement's tabs, as the spec named them. */
export const TRANSACTION_FILTERS: { key: string; label: Text }[] = [
  { key: 'all',         label: { ar: 'الكل',       en: 'All' } },
  { key: 'income',      label: { ar: 'الدخل',      en: 'Income' } },
  { key: 'payments',    label: { ar: 'المدفوعات',  en: 'Payments' } },
  { key: 'withdrawals', label: { ar: 'السحوبات',   en: 'Withdrawals' } },
  { key: 'refunds',     label: { ar: 'المستردّ',   en: 'Refunds' } },
  { key: 'fees',        label: { ar: 'الرسوم',     en: 'Fees' } },
  { key: 'pending',     label: { ar: 'قيد الانتظار', en: 'Pending' } },
  { key: 'completed',   label: { ar: 'المكتملة',   en: 'Completed' } },
];

/**
 * A line on a timeline. The database writes the status it moved to; this is
 * how a person reads it. Keys it does not know fall back to the raw status
 * rather than to nothing — an unexplained line is better than a missing one.
 */
export const FINANCE_EVENT: Record<string, { label: Text; dot: string }> = {
  created:      { label: { ar: 'أُنشئت الدفعة',            en: 'Payment created' },            dot: '🟡' },
  under_review: { label: { ar: 'أبلغ الدافع أنه حوّل المبلغ', en: 'Payer reported the transfer' }, dot: '🟠' },
  needs_info:   { label: { ar: 'سؤال من TechMood',          en: 'TechMood asked a question' },  dot: '🟠' },
  verified:     { label: { ar: 'أكّدت TechMood الاستلام',   en: 'TechMood confirmed receipt' }, dot: '🟢' },
  rejected:     { label: { ar: 'لم يُقبل الإيصال',          en: 'Receipt not accepted' },       dot: '🔴' },
  refunded:     { label: { ar: 'استُرد المبلغ',             en: 'Refunded' },                   dot: '↩️' },
  failed:       { label: { ar: 'فشلت العملية',              en: 'Failed' },                     dot: '🔴' },
  requested:    { label: { ar: 'طُلب السحب',                en: 'Withdrawal requested' },       dot: '🟡' },
  approved:     { label: { ar: 'بدأ التحويل',               en: 'Transfer in progress' },       dot: '🟠' },
  paid:         { label: { ar: 'تمّ التحويل',               en: 'Transfer confirmed' },         dot: '🟢' },
  opened:       { label: { ar: 'فُتح الحجز المالي',          en: 'Hold opened' },                dot: '🟡' },
  awaiting_payment: { label: { ar: 'بانتظار الدفع',         en: 'Awaiting payment' },           dot: '🟡' },
  funded:       { label: { ar: 'وصل المبلغ وحُجز',          en: 'Funded and held' },            dot: '🟢' },
  released:     { label: { ar: 'أُفرج عن المبلغ',           en: 'Released' },                   dot: '🟢' },
  disputed:     { label: { ar: 'فُتح نزاع',                 en: 'Disputed' },                   dot: '🔴' },
  cancelled:    { label: { ar: 'أُلغي',                     en: 'Cancelled' },                  dot: '⚪' },
  // the booking's own steps, woven into its payment's story
  'booking:booking_created':   { label: { ar: 'طُلب الحجز',               en: 'Booking requested' },  dot: '🟡' },
  'booking:payment_pending':   { label: { ar: 'الحجز بانتظار الدفع',       en: 'Booking awaiting payment' }, dot: '🟡' },
  'booking:payment_submitted': { label: { ar: 'الحجز بانتظار تأكيد الدفع', en: 'Booking awaiting confirmation' }, dot: '🟠' },
  'booking:payment_verified':  { label: { ar: 'تأكّد الدفع للحجز',          en: 'Payment confirmed for the booking' }, dot: '🟢' },
  'booking:mentor_pending':    { label: { ar: 'أُرسل الطلب للمنتور',        en: 'Sent to the mentor' },  dot: '🔵' },
  'booking:confirmed':         { label: { ar: 'وافق المنتور',              en: 'Mentor accepted' },     dot: '🟢' },
  'booking:rejected':          { label: { ar: 'اعتذر المنتور',             en: 'Mentor declined' },     dot: '🔴' },
  'booking:completed':         { label: { ar: 'انعقدت الجلسة',             en: 'Session held' },        dot: '🟢' },
  'booking:cancelled':         { label: { ar: 'أُلغي الحجز',               en: 'Booking cancelled' },   dot: '⚪' },
  'booking:refunded':          { label: { ar: 'استُرد مبلغ الحجز',         en: 'Booking refunded' },    dot: '↩️' },
  'booking:expired':           { label: { ar: 'انتهت مهلة الحجز',          en: 'Booking expired' },     dot: '⚪' },
};
