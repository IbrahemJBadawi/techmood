'use client';

import { useActionState } from 'react';

import { APPLICATION_STAGE } from '@/lib/marketplace';
import type { ApplicationStage } from '@/lib/database.types';

import { applyToOpportunity, decideApplication, type MarketState } from '../actions';
import { useT } from '@/lib/i18n.client';

/** What a person can put in front of a poster — all of it already theirs. */
const SHAREABLE = [
  { key: 'profile',      label: { ar: 'ملفي المهني',      en: 'My profile' } },
  { key: 'portfolio',    label: { ar: 'أعمالي المعروضة',  en: 'My exhibited work' } },
  { key: 'certificates', label: { ar: 'شهاداتي',          en: 'My certificates' } },
  { key: 'skills',       label: { ar: 'مهاراتي الموثّقة',  en: 'My verified skills' } },
  { key: 'evaluations',  label: { ar: 'تقييمات المنتورين', en: 'Mentor evaluations' } },
];

export function ApplyForm({
  opportunityId,
  isOpen,
  needsProposal,
  application,
}: {
  opportunityId: string;
  isOpen: boolean;
  /** A freelance project is answered with a price and a duration; a job is not. */
  needsProposal: boolean;
  application: {
    id: string; stage: ApplicationStage; cover_note_ar: string | null;
    proposed_amount_usd?: number | null; proposed_days?: number | null;
  } | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(applyToOpportunity, undefined as MarketState);

  if (application) {
    const stage = APPLICATION_STAGE[application.stage];

    return (
      <div className="panel">
        <div className="row-between">
          <h3 style={{ fontSize: '0.98rem' }}>{t('طلبك', 'Your application')}</h3>
          <span className={`status-pill ${stage.className}`}>{t(stage.text)}</span>
        </div>

        {application.cover_note_ar && (
          <p style={{ fontSize: '0.88rem', marginTop: 12 }}>{application.cover_note_ar}</p>
        )}

        {(application.proposed_amount_usd ?? null) !== null && (
          <p className="muted eng" style={{ fontSize: '0.84rem', marginTop: 8 }}>
            ${application.proposed_amount_usd}
            {application.proposed_days ? ` · ${application.proposed_days} ${t('يوم', 'days')}` : ''}
          </p>
        )}

        {application.stage === 'submitted' && (
          <form action={decideApplication} style={{ marginTop: 14 }}>
            <input type="hidden" name="application_id" value={application.id} />
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <input type="hidden" name="stage" value="withdrawn" />
            <button className="btn btn-ghost btn-sm">{t('اسحب الطلب', 'Withdraw')}</button>
          </form>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="panel">
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          {t('هذه الفرصة مغلقة ولا تستقبل طلبات جديدة.', 'This opening is closed and is not taking new applications.')}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('تقدّم على هذه الفرصة', 'Apply for this opening')}</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 14 }}>
        {t('سيرى الناشر سجلك في TechMood تلقائياً — نقاطك، نجومك، شهاداتك، وأعمالك المنشورة. اكتب هنا ما لا تقوله الأرقام.',
           'The poster sees your TechMood record automatically — points, stars, certificates and published work. Write here what the numbers do not say.')}
      </p>

      <input type="hidden" name="opportunity_id" value={opportunityId} />

      <div className="field">
        <label htmlFor="cover">{t('لماذا أنت المناسب؟', 'Why you?')}</label>
        <textarea id="cover" name="cover" rows={5} required />
      </div>

      {needsProposal && (
        <div className="rules-grid">
          <div className="field">
            <label htmlFor="amount">{t('عرضك (دولار)', 'Your price (USD)')}</label>
            <input id="amount" name="amount" type="number" min="0" step="1" />
          </div>
          <div className="field">
            <label htmlFor="days">{t('المدة (أيام)', 'How long (days)')}</label>
            <input id="days" name="days" type="number" min="1" max="365" step="1" />
          </div>
        </div>
      )}

      <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
        <legend className="muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
          {t('ما الذي تشاركه معه من هويتك في TechMood؟', 'What of your TechMood identity are you sharing?')}
        </legend>
        <div className="tags-row">
          {SHAREABLE.map((item) => (
            <label className="badge-pill" key={item.key} style={{ cursor: 'pointer', gap: 6 }}>
              <input type="checkbox" name="share" value={item.key} defaultChecked={item.key !== 'evaluations'} />
              {t(item.label)}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send application')}
      </button>
    </form>
  );
}
