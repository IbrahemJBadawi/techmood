'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';
import type { ClientCriterion, EscrowStatus, PaymentMethod, SaleLicence } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import {
  buyProject, escrowAction, listForSale, openEscrow, reviewWork,
  submitEscrowProof, withdrawListing, type MoneyState,
} from './money-actions';

export const ESCROW_STATUS: Record<EscrowStatus, { text: Text; className: string }> = {
  awaiting_payment: { text: { ar: 'بانتظار الدفع', en: 'Awaiting payment' }, className: 'status-pending' },
  funded:           { text: { ar: 'محتجز',         en: 'Held' },             className: 'status-ok' },
  released:         { text: { ar: 'أُفرج عنه',      en: 'Released' },         className: 'status-ok' },
  refunded:         { text: { ar: 'مسترد',         en: 'Refunded' },         className: 'status-muted' },
  disputed:         { text: { ar: 'في نزاع',       en: 'Disputed' },         className: 'status-danger' },
  cancelled:        { text: { ar: 'ملغى',          en: 'Cancelled' },        className: 'status-muted' },
};

const CLIENT_CRITERION: Record<ClientCriterion, Text> = {
  quality:         { ar: 'جودة العمل',     en: 'Quality' },
  communication:   { ar: 'التواصل',        en: 'Communication' },
  deadline:        { ar: 'الالتزام بالموعد', en: 'Deadline' },
  professionalism: { ar: 'الاحترافية',     en: 'Professionalism' },
  scope:           { ar: 'الالتزام بالنطاق', en: 'Scope' },
};

const CRITERIA: ClientCriterion[] = ['quality', 'communication', 'deadline', 'professionalism', 'scope'];

/**
 * Opening the hold. The client names the amount; the commission and the net are
 * the database's answer, and they are shown before anybody pays rather than
 * discovered afterwards.
 */
export function OpenEscrowForm({
  projectId,
  payeeId,
  payeeName,
  methods,
  suggested,
  commissionOf,
}: {
  projectId: string;
  payeeId: string;
  payeeName: string;
  methods: PaymentMethod[];
  suggested: number | null;
  /** What the platform takes at the suggested amount, worked out server-side. */
  commissionOf: number | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(openEscrow, undefined as MoneyState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('ادفع للحساب المحتجز', 'Pay into escrow')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6, maxWidth: '62ch' }}>
        {t(`يبقى المبلغ محتجزاً لدى TechMood حتى تستلم العمل وتفرج عنه بنفسك. ${payeeName} يرى أنه وصل، ولا يستطيع سحبه قبل ذلك.`,
           `The money stays with TechMood until you receive the work and release it yourself. ${payeeName} can see it has arrived, and cannot take it before then.`)}
      </p>

      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="payee" value={payeeId} />

      <div className="rules-grid">
        <div className="field">
          <label htmlFor="amount">{t('المبلغ (دولار)', 'Amount (USD)')}</label>
          <input id="amount" name="amount" type="number" min="1" step="1" defaultValue={suggested ?? ''} required />
        </div>
        <div className="field">
          <label htmlFor="method_key">{t('طريقة الدفع', 'Payment method')}</label>
          <select id="method_key" name="method_key" required defaultValue="">
            <option value="" disabled>{t('اختر…', 'Choose…')}</option>
            {methods.map((method) => (
              <option key={method.key} value={method.key}>{method.name_ar}</option>
            ))}
          </select>
        </div>
      </div>

      {suggested !== null && commissionOf !== null && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {t('عند هذا المبلغ: عمولة المنصة ', 'At this amount: the platform takes ')}
          <span className="eng">{money(commissionOf)}</span>
          {t('، ويصل المنفّذ ', ', and the freelancer receives ')}
          <span className="eng">{money(suggested - commissionOf)}</span>.
        </p>
      )}

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : t('افتح الحجز المالي', 'Open the hold')}
      </button>
    </form>
  );
}

/** The receipt for a hold that is waiting for its money. */
export function EscrowProofForm({ escrowId, revalidate }: { escrowId: string; revalidate: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitEscrowProof, undefined as MoneyState);

  return (
    <form action={formAction} className="meeting-form">
      <input type="hidden" name="escrow_id" value={escrowId} />
      <input type="hidden" name="revalidate" value={revalidate} />

      <div className="field">
        <label htmlFor="reference">{t('رقم العملية', 'Reference')}</label>
        <input id="reference" name="reference" dir="ltr" />
      </div>
      <div className="field">
        <label htmlFor="proof_path">{t('مسار الإيصال', 'Receipt')}</label>
        <input id="proof_path" name="proof_path" dir="ltr" placeholder="receipts/…" />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Sending…') : t('أرسل الإثبات', 'Send the receipt')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}

/** Releasing it, or saying the two sides disagree. */
export function EscrowControls({
  escrowId,
  isPayer,
  status,
  revalidate,
}: {
  escrowId: string;
  isPayer: boolean;
  status: EscrowStatus;
  revalidate: string;
}) {
  const t = useT();

  if (status !== 'funded' && status !== 'disputed') return null;

  return (
    <form action={escrowAction} className="row-actions" style={{ marginTop: 12 }}>
      <input type="hidden" name="escrow_id" value={escrowId} />
      <input type="hidden" name="revalidate" value={revalidate} />

      {isPayer && status === 'funded' && (
        <button className="btn btn-primary btn-sm" name="action" value="release">
          {t('استلمت العمل — أفرج عن المبلغ', 'I have the work — release it')}
        </button>
      )}

      {status === 'funded' && (
        <>
          <input
            name="reason"
            className="invite-message"
            placeholder={t('سبب الخلاف', 'What is the disagreement?')}
            aria-label={t('سبب الخلاف', 'Reason')}
          />
          <button className="btn btn-ghost btn-sm" name="action" value="dispute">
            {t('افتح نزاعاً', 'Open a dispute')}
          </button>
        </>
      )}

      {status === 'disputed' && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          {t('المبلغ مجمّد حتى تفصل الإدارة.', 'The money is frozen until TechMood decides.')}
        </p>
      )}
    </form>
  );
}

/** What the client says about the work, once the money has moved. */
export function ClientReviewForm({ projectId }: { projectId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(reviewWork, undefined as MoneyState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('قيّم هذا العمل', 'Review this work')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
        {t('تقييمك يصبح جزءاً من سجلّ من نفّذ العمل، ويظهر على صفحته المهنية.',
           'Your review becomes part of the record of whoever did the work, and shows on their professional page.')}
      </p>

      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="criteria" value={CRITERIA.join(',')} />

      <table className="exhibit-criteria" style={{ marginTop: 14 }}>
        <tbody>
          {CRITERIA.map((criterion) => (
            <tr key={criterion}>
              <th scope="row"><label htmlFor={`c-${criterion}`}>{t(CLIENT_CRITERION[criterion])}</label></th>
              <td>
                <select id={`c-${criterion}`} name={criterion} defaultValue="">
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option value={value} key={value}>{'★'.repeat(value)}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="comment">{t('ملاحظة', 'A note')}</label>
        <textarea id="comment" name="comment" rows={3} />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Sending…') : t('أرسل التقييم', 'Send the review')}
      </button>
    </form>
  );
}

/** Putting finished work on the shelf. */
export function SellForm({
  projectId,
  listing,
}: {
  projectId: string;
  listing: { id: string; price_usd: number; licence: SaleLicence; summary_ar: string; includes: string[]; status: string } | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(listForSale, undefined as MoneyState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('اعرضه للبيع', 'Put it up for sale')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6, maxWidth: '62ch' }}>
        {t('البيع ينقل العمل، لا نسبته إليك: تبقى مشاركتك في المعرض وتقييمها ومهاراتها في سجلّك مهما تغيّر المالك.',
           'A sale moves the work, never the authorship: your exhibition entry, its evaluation and the skills it proved stay on your record whoever owns it.')}
      </p>

      <input type="hidden" name="project_id" value={projectId} />

      <div className="rules-grid">
        <div className="field">
          <label htmlFor="price">{t('السعر (دولار)', 'Price (USD)')}</label>
          <input id="price" name="price" type="number" min="1" step="1" defaultValue={listing?.price_usd ?? ''} required />
        </div>
        <div className="field">
          <label htmlFor="licence">{t('ما الذي يشتريه؟', 'What is being bought?')}</label>
          <select id="licence" name="licence" defaultValue={listing?.licence ?? 'usage_rights'}>
            <option value="usage_rights">{t('حق الاستخدام', 'Usage rights')}</option>
            <option value="full_transfer">{t('نقل كامل', 'Full transfer')}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="summary">{t('ماذا يحصل عليه المشتري؟', 'What does the buyer get?')}</label>
        <textarea id="summary" name="summary" rows={3} required minLength={20}
                  defaultValue={listing?.summary_ar ?? ''} />
      </div>

      <div className="field">
        <label htmlFor="includes">{t('المشمولات (مفصولة بفاصلة)', 'Included (comma separated)')}</label>
        <input id="includes" name="includes" defaultValue={(listing?.includes ?? []).join('، ')} />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <div className="row-actions">
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ…', 'Working…') : listing ? t('حدّث العرض', 'Update the listing') : t('اعرضه للبيع', 'List it')}
        </button>
      </div>

      {listing && listing.status === 'listed' && (
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
          {t('العرض منشور في السوق.', 'The listing is live in the market.')}
        </p>
      )}
    </form>
  );
}

/** Taking it off the shelf. */
export function WithdrawListing({ listingId, revalidate }: { listingId: string; revalidate: string }) {
  const t = useT();

  return (
    <form action={withdrawListing}>
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <button className="btn btn-ghost btn-sm">{t('اسحب العرض', 'Withdraw the listing')}</button>
    </form>
  );
}

/** Buying one — which opens a hold rather than moving money. */
export function BuyForm({ listingId, methods }: { listingId: string; methods: PaymentMethod[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(buyProject, undefined as MoneyState);

  return (
    <form action={formAction} className="row-actions">
      <input type="hidden" name="listing_id" value={listingId} />
      <select name="method_key" required defaultValue="" aria-label={t('طريقة الدفع', 'Payment method')}>
        <option value="" disabled>{t('طريقة الدفع', 'Payment method')}</option>
        {methods.map((method) => (
          <option key={method.key} value={method.key}>{method.name_ar}</option>
        ))}
      </select>
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : t('اشترِ', 'Buy')}
      </button>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
