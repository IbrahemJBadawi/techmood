'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { sendInquiry, type InquiryState } from './actions';

/** «تواصل معنا» for companies: what they need, and how to reach them. */
export function InquiryForm() {
  const t = useT();
  const [state, action, pending] = useActionState(sendInquiry, undefined as InquiryState);

  if (state?.ok) {
    return (
      <div className="biz-sent" role="status">
        <span aria-hidden>✓</span>
        <strong>{t('وصلتنا رسالتك', 'We have your message')}</strong>
        <p className="muted">{t('يرد عليك فريق TechMood على بريدك خلال يومي عمل.', 'The TechMood team replies to your email within two working days.')}</p>
      </div>
    );
  }

  const needs = [
    { value: 'hire', label: t('توظيف طلاب أو خريجين', 'Hire students or graduates') },
    { value: 'project', label: t('تنفيذ مشروع مع فريق', 'Have a team build a project') },
    { value: 'training', label: t('تدريب موظفيكم', 'Train your staff') },
    { value: 'sponsor', label: t('رعاية تحدٍّ أو ورشة', 'Sponsor a challenge or workshop') },
    { value: 'other', label: t('شيء آخر', 'Something else') },
  ];

  return (
    <form action={action} className="biz-form">
      <fieldset className="biz-needs">
        <legend>{t('بماذا نساعدكم؟', 'How can we help?')}</legend>
        {needs.map((need, index) => (
          <label key={need.value} className="choice-chip">
            <input type="radio" name="need" value={need.value} defaultChecked={index === 0} />
            <span>{need.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="field-row">
        <div className="field">
          <label htmlFor="biz-company">{t('اسم الشركة', 'Company')}</label>
          <input id="biz-company" name="company" required minLength={2} maxLength={120} autoComplete="organization" />
        </div>
        <div className="field">
          <label htmlFor="biz-name">{t('اسمك', 'Your name')}</label>
          <input id="biz-name" name="contact_name" required minLength={2} maxLength={120} autoComplete="name" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="biz-email">{t('البريد الإلكتروني', 'Email')}</label>
          <input id="biz-email" name="email" type="email" dir="ltr" required maxLength={200} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="biz-phone">{t('الهاتف (اختياري)', 'Phone (optional)')}</label>
          <input id="biz-phone" name="phone" type="tel" dir="ltr" maxLength={40} autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="biz-message">{t('أخبرنا بما تحتاجه', 'Tell us what you need')}</label>
        <textarea id="biz-message" name="message" rows={5} required minLength={10} maxLength={3000}
                  placeholder={t('مثال: نبحث عن مطوّري واجهات لمشروع مدته 3 أشهر…', 'For example: we need front-end developers for a three-month project…')} />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp-field" aria-hidden />
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send')}
      </button>
    </form>
  );
}
