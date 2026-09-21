'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { submitMentorApplication, type RoleState } from '../actions';

type Existing = {
  headline_ar: string | null;
  bio_ar: string | null;
  domains: string[];
  years_experience: number | null;
  weekly_hours: number | null;
  motivation_ar: string | null;
  experience_ar: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  languages: string[];
} | null;

const LANGUAGES = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
];

export function MentorApplicationForm({
  fields,
  existing,
  locked,
}: {
  fields: { slug: string; name_ar: string }[];
  existing: Existing;
  locked: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitMentorApplication, undefined as RoleState);

  return (
    <form action={formAction} className="panel section-block">
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="field">
          <label htmlFor="headline">{t('سطر تعريفي كمنتور', 'Mentor headline')}</label>
          <input id="headline" name="headline" required maxLength={120}
                 defaultValue={existing?.headline_ar ?? ''}
                 placeholder={t('مهندس واجهات أمامية — 6 سنوات في منتجات إنتاجية', 'Frontend engineer — six years on production products')} />
        </div>

        <div className="field">
          <label htmlFor="bio">{t('نبذة عنك', 'About you')}</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={existing?.bio_ar ?? ''} />
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>{t('مجالات الإرشاد', 'What you can mentor in')}</legend>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
            {t('اختر ما تستطيع مراجعته فعلاً — عليها تُبنى مطابقة الطلبات إليك.', 'Pick what you can genuinely review — this is what requests are matched against.')}
          </p>
          <div className="tags-row term-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {fields.map((field) => (
              <label className="tag" key={field.slug}>
                <input type="checkbox" name="domains" value={field.slug}
                       defaultChecked={existing?.domains?.includes(field.slug)} />
                {' '}{field.name_ar}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label htmlFor="years">{t('سنوات الخبرة', 'Years of experience')}</label>
            <input id="years" name="years" type="number" min={0} max={60} required
                   defaultValue={existing?.years_experience ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="weekly_hours">{t('ساعات أسبوعية تستطيع تخصيصها', 'Hours a week you can give')}</label>
            <input id="weekly_hours" name="weekly_hours" type="number" min={1} max={40} required
                   defaultValue={existing?.weekly_hours ?? 4} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="experience">{t('خبرتك العملية', 'Your working experience')}</label>
          <textarea id="experience" name="experience" rows={4} required minLength={40}
                    defaultValue={existing?.experience_ar ?? ''}
                    placeholder={t('أين عملت، ماذا بنيت، ومن راجعت أعمالهم من قبل.', 'Where you have worked, what you have built, and whose work you have reviewed before.')} />
          <small className="muted">{t('40 حرفاً على الأقل.', 'At least 40 characters.')}</small>
        </div>

        <div className="field">
          <label htmlFor="motivation">{t('لماذا تريد أن تكون منتوراً؟', 'Why do you want to mentor?')}</label>
          <textarea id="motivation" name="motivation" rows={4} required minLength={40}
                    defaultValue={existing?.motivation_ar ?? ''} />
          <small className="muted">{t('40 حرفاً على الأقل.', 'At least 40 characters.')}</small>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>{t('لغات الجلسات', 'Session languages')}</legend>
          <div className="tags-row">
            {LANGUAGES.map((language) => (
              <label className="tag" key={language.value}>
                <input type="checkbox" name="languages" value={language.value}
                       defaultChecked={existing?.languages?.includes(language.value) ?? language.value === 'ar'} />
                {' '}{language.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label htmlFor="linkedin_url">LinkedIn</label>
            <input id="linkedin_url" name="linkedin_url" type="url" dir="ltr"
                   defaultValue={existing?.linkedin_url ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="portfolio_url">{t('معرض أعمال أو موقع', 'Portfolio or website')}</label>
            <input id="portfolio_url" name="portfolio_url" type="url" dir="ltr"
                   defaultValue={existing?.portfolio_url ?? ''} />
          </div>
        </div>

        <p className="notice">
          {t('مستواك كمنتور وسعر جلستك تحدّدهما المنصة، لا الطلب. كل منتور جديد يبدأ من المستوى الأول ويرتقي بجلسات حقيقية وتقييمات حقيقية.',
             'Your mentor level and your session price are set by the platform, not by this form. Every new mentor starts at level one and moves up on real sessions and real ratings.')}
        </p>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}

        <button className="btn btn-primary" disabled={pending}>
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الطلب', 'Send application')}
        </button>
      </fieldset>

      {locked && (
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 10 }}>
          {t('طلبك قيد المراجعة الآن، لذلك النموذج مقفل. سيُفتح إن طُلبت منك معلومات إضافية.',
             'Your application is under review, so the form is locked. It reopens if more information is asked of you.')}
        </p>
      )}
    </form>
  );
}
