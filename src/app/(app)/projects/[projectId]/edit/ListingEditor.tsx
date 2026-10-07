'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ListingStatus, SaleLicence } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';

import { deleteShowcase, saveShowcaseListing, withdrawShowcaseListing, type ShowcaseState } from '../../showcase-actions';
import { NumberStepper } from '@/components/NumberStepper';

export type EditorListing = {
  id: string; status: ListingStatus; price_usd: number; licence: SaleLicence; summary_ar: string;
  includes: string[]; demo_url: string | null; discount_pct: number; negotiable: boolean;
  review_note_ar: string | null; delivery_url: string | null;
} | null;

const STATUS_NOTE: Partial<Record<ListingStatus, { ar: string; en: string; tone: string }>> = {
  pending_review: { ar: 'العرض قيد مراجعة TechMood — يظهر في السوق بعد التحقق منه ومن رابط التسليم.', en: 'Under TechMood review — it shows once the listing and its delivery link are checked.', tone: '' },
  listed:         { ar: 'معروض في السوق ✓ موثّق.', en: 'Live in the market ✓ verified.', tone: 'notice-ok' },
  reserved:       { ar: 'محجوز — هناك شراء بنقل كامل جارٍ.', en: 'Reserved — a full-transfer purchase is in progress.', tone: '' },
  sold:           { ar: 'مباع بنقل كامل.', en: 'Sold as a full transfer.', tone: 'notice-ok' },
  withdrawn:      { ar: 'مسحوب من السوق (غير متاح). عدّل واحفظ لإعادة عرضه.', en: 'Withdrawn (unavailable). Edit and save to list it again.', tone: '' },
  rejected:       { ar: 'رُفض العرض', en: 'The listing was refused', tone: 'notice-danger' },
};

/** 🛒 Selling the page's work (0099, 0121): reviewed by TechMood before it shows. */
export function ListingEditor({ projectId, listing }: { projectId: string; listing: EditorListing }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveShowcaseListing, undefined as ShowcaseState);
  const note = listing ? STATUS_NOTE[listing.status] : null;

  return (
    <section className="panel section-block" id="sell">
      <h3 className="sc-h">🛒 {t('البيع في السوق', 'Selling in the market')}</h3>
      {note && (
        <p className={`notice ${note.tone}`}>
          {t(note.ar, note.en)}{listing?.status === 'rejected' && listing.review_note_ar ? `: ${listing.review_note_ar}` : ''}
        </p>
      )}

      <form action={formAction} className="stack">
        <input type="hidden" name="project_id" value={projectId} />
        <div className="field-row">
          <div className="field">
            <label htmlFor="price">{t('السعر (دولار)', 'Price (USD)')}</label>
            <NumberStepper id="price" name="price" min={1} step={1} required defaultValue={listing?.price_usd ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="licence">{t('ما الذي يشتريه المشتري؟', 'What does the buyer get?')}</label>
            <select id="licence" name="licence" defaultValue={listing?.licence ?? 'usage_rights'}>
              <option value="usage_rights">{t('حق استخدام — يُباع لأكثر من مشترٍ', 'Usage rights — sold to many buyers')}</option>
              <option value="full_transfer">{t('نقل كامل — يُباع مرة واحدة', 'Full transfer — sold once')}</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="summary">{t('ماذا يستلم المشتري بالضبط؟', 'What exactly does the buyer receive?')}</label>
          <textarea id="summary" name="summary" rows={3} required minLength={20} defaultValue={listing?.summary_ar ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="includes">{t('المشمولات (مفصولة بفاصلة)', 'Included (comma separated)')}</label>
          <input id="includes" name="includes" defaultValue={(listing?.includes ?? []).join('، ')}
                 placeholder={t('الكود المصدري، ملف التصميم، دليل التشغيل', 'Source code, design file, setup guide')} />
        </div>
        <div className="field">
          <label htmlFor="delivery_url">{t('رابط ملفات المشروع المباشر (مخفي حتى يتأكد الدفع) *', 'Direct link to the files (hidden until payment is confirmed) *')}</label>
          <input id="delivery_url" name="delivery_url" type="url" dir="ltr" required placeholder="https://" defaultValue={listing?.delivery_url ?? ''} />
          <small className="muted">{t('تراه الإدارة للتحقق، والمشتري فقط بعد تأكيد دفعه.', 'TechMood sees it to verify; a buyer only once their payment is confirmed.')}</small>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="sale_demo">{t('رابط معاينة للمشترين (اختياري)', 'Preview link for buyers (optional)')}</label>
            <input id="sale_demo" name="demo_url" type="url" dir="ltr" placeholder="https://" defaultValue={listing?.demo_url ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="discount_pct">{t('خصم % (اختياري)', 'Discount % (optional)')}</label>
            <NumberStepper id="discount_pct" name="discount_pct" min={0} max={90} defaultValue={listing?.discount_pct ?? 0} />
          </div>
        </div>
        <label className="sc-switch">
          <input type="checkbox" name="negotiable" defaultChecked={listing?.negotiable ?? false} />
          <span>{t('السعر قابل للتفاوض — أقبل عروض أسعار من المشترين (وفق الشروط)', 'The price is negotiable — I accept offers from buyers (under the terms)')}</span>
        </label>
        <label className="sc-switch">
          <input type="checkbox" name="accept_terms" required />
          <span>
            {t('قرأت ', 'I have read and accept ')}
            <Link href="/policies#market" target="_blank">{t('شروط البيع والشراء والمفاصلة', 'the terms for selling, buying and negotiating')}</Link>
            {t(' وأوافق عليها، وأؤكد أن العمل من إنجازي وأملك حق بيعه.', ', and I confirm the work is mine and I have the right to sell it.')}
          </span>
        </label>
        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
        <div className="row-actions">
          <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending}>
            {pending ? t('جارٍ…', 'Working…') : listing ? t('حدّث العرض وأرسله للمراجعة', 'Update and send for review') : t('اعرضه للبيع', 'Put it up for sale')}
          </button>
        </div>
      </form>

      {listing && (listing.status === 'listed' || listing.status === 'pending_review') && (
        <form action={withdrawShowcaseListing} style={{ marginTop: 10 }}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="listing_id" value={listing.id} />
          <button className="btn btn-ghost btn-sm">{t('اجعله غير متاح (اسحب العرض)', 'Make it unavailable (withdraw)')}</button>
        </form>
      )}
    </section>
  );
}

/** Deleting the page — the database refuses it once a copy was sold. */
export function DeleteShowcase({ projectId }: { projectId: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(deleteShowcase, undefined as ShowcaseState);
  return (
    <details className="panel section-block sc-danger">
      <summary>{t('حذف المشروع', 'Delete the project')}</summary>
      <form action={formAction} className="stack" style={{ marginTop: 10 }}>
        <input type="hidden" name="project_id" value={projectId} />
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          {t('يُحذف المشروع وصوره نهائياً. إن بيعت منه نسخ لا يُحذف — يبقى للمشترين، ويمكنك إخفاؤه من المعرض وسحبه من السوق.',
             'The project and its pictures are deleted for good. If copies were sold it cannot be deleted — buyers keep it; you can hide it and withdraw it instead.')}
        </p>
        <div className="field">
          <label htmlFor="confirm">{t('اكتب «حذف» للتأكيد', 'Type “delete” to confirm')}</label>
          <input id="confirm" name="confirm" autoComplete="off" />
        </div>
        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        <div><button className="btn btn-ghost btn-sm is-danger" disabled={pending} aria-busy={pending}>{t('احذف نهائياً', 'Delete for good')}</button></div>
      </form>
    </details>
  );
}
