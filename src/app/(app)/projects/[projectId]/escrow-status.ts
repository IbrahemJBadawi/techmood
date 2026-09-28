import type { EscrowStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

/**
 * How a held payment's state is shown. A plain module, not the client
 * component beside it: a server page that imports a value from a 'use client'
 * file receives a client reference, not the object.
 */
export const ESCROW_STATUS: Record<EscrowStatus, { text: Text; className: string }> = {
  awaiting_payment: { text: { ar: 'بانتظار الدفع', en: 'Awaiting payment' }, className: 'status-pending' },
  funded:           { text: { ar: 'محتجز',         en: 'Held' },             className: 'status-ok' },
  released:         { text: { ar: 'أُفرج عنه',      en: 'Released' },         className: 'status-ok' },
  refunded:         { text: { ar: 'مسترد',         en: 'Refunded' },         className: 'status-muted' },
  disputed:         { text: { ar: 'في نزاع',       en: 'Disputed' },         className: 'status-danger' },
  cancelled:        { text: { ar: 'ملغى',          en: 'Cancelled' },        className: 'status-muted' },
};
