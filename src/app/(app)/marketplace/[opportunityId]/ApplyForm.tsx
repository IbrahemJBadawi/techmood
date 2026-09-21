'use client';

import { useActionState } from 'react';

import { APPLICATION_STAGE } from '@/lib/marketplace';
import type { ApplicationStage } from '@/lib/database.types';

import { applyToOpportunity, decideApplication, type MarketState } from '../actions';
import { useT } from '@/lib/i18n.client';

export function ApplyForm({
  opportunityId,
  isOpen,
  application,
}: {
  opportunityId: string;
  isOpen: boolean;
  application: { id: string; stage: ApplicationStage; cover_note_ar: string | null } | null;
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

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}
      {state?.ok && <p className="notice" style={{ marginBottom: 12 }}>{state.ok}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send application')}
      </button>
    </form>
  );
}
