'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { addService, saveListing, removeService, type ListingState } from './actions';

export type Listing = {
  is_available: boolean;
  headline_ar: string | null;
  summary_ar: string | null;
  rate_kind: 'hourly' | 'project';
  rate_min_usd: number | null;
  rate_max_usd: number | null;
} | null;

export type Service = { id: string; title_ar: string; detail_ar: string | null; from_usd: number | null };

/**
 * Your listing in the market. Nothing here is a second profile: the market
 * reads your one TechMood identity — this only says whether you are open to
 * work, and from what price.
 */
export function ListingForm({ listing, services }: { listing: Listing; services: Service[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveListing, undefined as ListingState);
  const [serviceState, serviceAction, addingService] = useActionState(addService, undefined as ListingState);

  return (
    <>
      <form action={formAction} className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('إدراجك في السوق', 'Your market listing')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6, maxWidth: '62ch' }}>
          {t('ما يظهر للعميل هو سجلّك نفسه: مهاراتك الموثّقة، مشاريعك المعروضة، شهاداتك وتقييماتك. هذه الصفحة تقول فقط إنك متاح، ومن أي سعر تبدأ.',
             'What a client sees is your own record: your verified skills, your exhibited projects, your certificates and evaluations. This page only says that you are open to work, and from what price.')}
        </p>

        <label className="switch-row" style={{ marginTop: 14 }}>
          <input type="checkbox" name="available" defaultChecked={listing?.is_available ?? false} />
          <span>{t('أنا متاح للعمل الآن', 'I am available for work')}</span>
        </label>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="headline">{t('سطر التعريف', 'Headline')}</label>
          <input id="headline" name="headline" defaultValue={listing?.headline_ar ?? ''}
                 placeholder={t('مطوّر واجهات · محلل بيانات', 'Front-end developer · data analyst')} />
        </div>

        <div className="field">
          <label htmlFor="summary">{t('نبذة قصيرة', 'A short summary')}</label>
          <textarea id="summary" name="summary" rows={3} defaultValue={listing?.summary_ar ?? ''} />
        </div>

        <div className="rules-grid">
          <div className="field">
            <label htmlFor="rate_kind">{t('طريقة التسعير', 'How you price')}</label>
            <select id="rate_kind" name="rate_kind" defaultValue={listing?.rate_kind ?? 'hourly'}>
              <option value="hourly">{t('بالساعة', 'Hourly')}</option>
              <option value="project">{t('بالمشروع', 'Per project')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rate_min">{t('من (دولار)', 'From (USD)')}</label>
            <input id="rate_min" name="rate_min" type="number" min="0" step="1"
                   defaultValue={listing?.rate_min_usd ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="rate_max">{t('إلى (دولار)', 'To (USD)')}</label>
            <input id="rate_max" name="rate_max" type="number" min="0" step="1"
                   defaultValue={listing?.rate_max_usd ?? ''} />
          </div>
        </div>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ', 'Save')}
        </button>
      </form>

      <section className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('ما تقدّمه', 'What you offer')}</h3>

        {services.length > 0 && (
          <ul className="plain-list" style={{ margin: '12px 0' }}>
            {services.map((service) => (
              <li className="row-between" key={service.id} style={{ fontSize: '0.88rem' }}>
                <span>
                  {service.title_ar}
                  {service.from_usd !== null && (
                    <span className="muted eng"> · {t('من', 'from')} ${service.from_usd}</span>
                  )}
                </span>
                <form action={removeService}>
                  <input type="hidden" name="service_id" value={service.id} />
                  <button className="btn btn-ghost btn-sm">{t('احذف', 'Remove')}</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={serviceAction} className="meeting-form">
          <div className="field">
            <label htmlFor="service-title">{t('الخدمة', 'Service')}</label>
            <input id="service-title" name="title" required placeholder={t('بناء واجهة منتج', 'Build a product UI')} />
          </div>
          <div className="field">
            <label htmlFor="service-detail">{t('تفصيل', 'Detail')}</label>
            <input id="service-detail" name="detail" />
          </div>
          <div className="field">
            <label htmlFor="service-from">{t('يبدأ من', 'Starting from')}</label>
            <input id="service-from" name="from_usd" type="number" min="0" step="1" />
          </div>
          <button className="btn btn-ghost btn-sm" disabled={addingService}>
            {addingService ? t('جارٍ…', 'Adding…') : t('أضف', 'Add')}
          </button>

          {serviceState?.error && <p className="notice notice-danger">{serviceState.error}</p>}
          {serviceState?.ok && <p className="notice notice-ok">{serviceState.ok}</p>}
        </form>
      </section>
    </>
  );
}
