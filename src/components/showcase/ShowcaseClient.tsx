'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

import type { PaymentMethodPublic } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';
import { money } from '@/lib/booking';

import {
  addCommentAction, adminHideShowcase, buyShowcase, makeOfferAction, recordShowcaseHit,
  type ShowcaseState,
} from '@/app/(app)/projects/showcase-actions';

/** Counts the visit once the page is open (the database counts a visitor once a day). */
export function ViewPing({ projectId }: { projectId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordShowcaseHit(projectId, 'view').catch(() => {});
  }, [projectId]);
  return null;
}

/** A link on the page whose clicks are counted for its owner. */
export function TrackedLink({
  projectId, kind, href, className, children,
}: { projectId: string; kind: string; href: string; className?: string; children: React.ReactNode }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer nofollow"
       onClick={() => { recordShowcaseHit(projectId, kind).catch(() => {}); }}>
      {children}
    </a>
  );
}

function TermsCheck({ id }: { id: string }) {
  const t = useT();
  return (
    <label className="sc-switch sc-terms" htmlFor={id}>
      <input id={id} type="checkbox" name="accept_terms" required />
      <span>
        {t('أوافق على ', 'I accept ')}
        <Link href="/policies#market" target="_blank">{t('شروط البيع والشراء', 'the buying and selling terms')}</Link>
      </span>
    </label>
  );
}

/** Buying at the shown price — or at the price agreed in an accepted offer. */
export function BuyBox({
  listingId, methods, agreed,
}: { listingId: string; methods: PaymentMethodPublic[]; agreed: { offerId: string; amount: number } | null }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(buyShowcase, undefined as ShowcaseState);
  return (
    <form action={formAction} className="stack sc-buy">
      <input type="hidden" name="listing_id" value={listingId} />
      {agreed && <input type="hidden" name="offer_id" value={agreed.offerId} />}
      {agreed && (
        <p className="notice notice-ok" style={{ margin: 0 }}>
          {t('سعرك المتفق عليه: ', 'Your agreed price: ')}<b className="eng">{money(agreed.amount)}</b>
        </p>
      )}
      <select name="method_key" required defaultValue="" aria-label={t('طريقة الدفع', 'Payment method')}>
        <option value="" disabled>{t('اختر طريقة الدفع', 'Choose a payment method')}</option>
        {methods.map((method) => <option key={method.key} value={method.key}>{method.name_ar}</option>)}
      </select>
      <TermsCheck id={`buy-terms-${listingId}`} />
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? t('جارٍ…', 'Working…') : agreed ? t('اشترِ بالسعر المتفق عليه', 'Buy at the agreed price') : t('اشترِ الآن', 'Buy now')}
      </button>
      <small className="muted">
        {t('يُحتجز المبلغ لدى TechMood، ويصلك رابط التسليم بعد تأكيد الدفع، ولا يصل للبائع إلا بعد استلامك.',
           'TechMood holds the money; the delivery link reaches you once the payment is confirmed, and the seller is paid only after you receive it.')}
      </small>
    </form>
  );
}

/** A price offer (المفاصلة), when the seller accepts offers. */
export function OfferBox({ listingId, price, minPct }: { listingId: string; price: number; minPct: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(makeOfferAction, undefined as ShowcaseState);
  const min = Math.ceil((price * minPct) / 100);
  if (!open) {
    return <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>{t('💬 قدّم عرض سعر', '💬 Make an offer')}</button>;
  }
  return (
    <form action={formAction} className="stack sc-offer">
      <input type="hidden" name="listing_id" value={listingId} />
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`offer-${listingId}`}>{t(`عرضك بالدولار (من ${min} إلى أقل من ${price})`, `Your offer in USD (${min} to under ${price})`)}</label>
        <input id={`offer-${listingId}`} name="amount" type="number" min={min} max={Math.max(min, price - 1)} step={1} required />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`offer-msg-${listingId}`}>{t('رسالة قصيرة للبائع (اختياري)', 'A short note to the seller (optional)')}</label>
        <input id={`offer-msg-${listingId}`} name="message" maxLength={300} />
      </div>
      <TermsCheck id={`offer-terms-${listingId}`} />
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>}
      <button className="btn btn-sky btn-sm" disabled={pending}>{pending ? t('جارٍ…', 'Sending…') : t('أرسل العرض', 'Send the offer')}</button>
    </form>
  );
}

/** Writing a comment or a reply. */
export function CommentForm({ projectId, code, parentId, onDone }: { projectId: string; code: string; parentId?: string; onDone?: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(async (prev: ShowcaseState, data: FormData) => {
    const result = await addCommentAction(prev, data);
    if (result?.ok) onDone?.();
    return result;
  }, undefined as ShowcaseState);
  // React resets the form's fields once the action has run.
  return (
    <form action={formAction} className="sc-comment-form">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="code" value={code} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <textarea name="body" rows={parentId ? 2 : 3} maxLength={1000} required
                placeholder={parentId ? t('اكتب ردّك…', 'Write a reply…') : t('اكتب تعليقاً أو سؤالاً عن المشروع…', 'Comment or ask about the project…')} />
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      <div><button className="btn btn-primary btn-sm" disabled={pending}>{pending ? t('جارٍ…', 'Posting…') : parentId ? t('ردّ', 'Reply') : t('علّق', 'Comment')}</button></div>
    </form>
  );
}

/** A reply link that opens its form in place. */
export function ReplyToggle({ projectId, code, parentId }: { projectId: string; code: string; parentId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return open
    ? <CommentForm projectId={projectId} code={code} parentId={parentId} onDone={() => setOpen(false)} />
    : <button type="button" className="sc-mini" onClick={() => setOpen(true)}>{t('ردّ', 'Reply')}</button>;
}

/** Copy the permanent link, or share it straight to LinkedIn or WhatsApp. */
export function ShareRow({ url, title }: { url: string; title: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="sc-share">
      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
      }}>{copied ? t('✓ نُسخ الرابط', '✓ Link copied') : t('🔗 انسخ الرابط', '🔗 Copy link')}</button>
      <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer"
         href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}>LinkedIn</a>
      <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer"
         href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}>WhatsApp</a>
    </div>
  );
}

/** TechMood hides a page, with a reason its owner reads. */
export function AdminHideForm({ projectId, hidden }: { projectId: string; hidden: boolean }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(adminHideShowcase, undefined as ShowcaseState);
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="hide" value={hidden ? 'false' : 'true'} />
      {!hidden && <input name="note" required minLength={10} placeholder={t('سبب الإخفاء — يصل لصاحب المشروع', 'Why — the owner reads it')} />}
      {state?.error && <p className="notice notice-danger" style={{ margin: 0 }}>{state.error}</p>}
      {state?.ok && <p className="notice notice-ok" style={{ margin: 0 }}>{state.ok}</p>}
      <button className="btn btn-ghost btn-sm" disabled={pending}>{hidden ? t('أعد إظهاره', 'Show again') : t('أخفِ من المعرض والسوق', 'Hide from gallery and market')}</button>
    </form>
  );
}
