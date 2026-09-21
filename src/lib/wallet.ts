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
