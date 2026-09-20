import type { LedgerKind, LedgerStatus, PayoutStatus } from '@/lib/database.types';

export const LEDGER_KIND: Record<LedgerKind, string> = {
  earning: 'أرباح',
  fee: 'رسوم',
  commission: 'عمولة',
  payout: 'سحب',
  refund: 'استرداد',
};

export const LEDGER_STATUS: Record<LedgerStatus, { text: string; className: string }> = {
  pending: { text: 'قيد الانتظار', className: 'status-pending' },
  available: { text: 'متاح', className: 'status-ok' },
  paid: { text: 'مدفوع', className: 'status-muted' },
  cancelled: { text: 'ملغى', className: 'status-muted' },
};

export const PAYOUT_STATUS: Record<PayoutStatus, { text: string; className: string }> = {
  requested: { text: 'بانتظار المراجعة', className: 'status-pending' },
  approved: { text: 'قيد التحويل', className: 'status-pending' },
  paid: { text: 'تم التحويل', className: 'status-ok' },
  rejected: { text: 'مرفوض', className: 'status-danger' },
};

/** Signed money, so a debit reads as a debit rather than a bare number. */
export function signedMoney(amount: number) {
  const value = Number(amount);
  const formatted = `$${Math.abs(value).toFixed(2).replace(/\.00$/, '')}`;
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}
