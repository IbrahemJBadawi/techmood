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
  cv_url: string | null;
  certificate_urls: string[];
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
  isOpen,
}: {
  fields: { slug: string; name_ar: string }[];
  existing: Existing;
  isOpen: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(submitMentorApplication, undefined as RoleState);

  return (
    <form action={formAction} className="panel section-block">
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 10 }}>
          {t('المطلوب ثلاثة فقط: سطر تعريفي، مجال واحد على الأقل، وسنوات خبرتك. الباقي اختياري ويقوّي طلبك، وتقدر تضيفه لاحقاً.',
             'Only three things are required: a headline, at least one field, and your years of experience. The rest is optional, strengthens your application, and can be added later.')}
        </p>
        <div className="field">
          <label htmlFor="headline">{t('سطر تعريفي كمنتور *', 'Mentor headline *')}</label>
          <input id="headline" name="headline" required minLength={5} maxLength={120}
                 defaultValue={existing?.headline_ar ?? ''}
                 placeholder={t('مهندس واجهات أمامية — 6 سنوات في منتجات إنتاجية', 'Frontend engineer — six years on production products')} />
        </div>

        <div className="field">
          <label htmlFor="bio">{t('نبذة عنك (اختياري)', 'About you (optional)')}</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={existing?.bio_ar ?? ''} />
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend>{t('مجالات الإرشاد *', 'What you can mentor in *')}</legend>
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
            <label htmlFor="years">{t('سنوات الخبرة *', 'Years of experience *')}</label>
            <input id="years" name="years" type="number" min={0} max={60} required
                   defaultValue={existing?.years_experience ?? ''} />
          </div>
          <div className="field">
            <label htmlFor="weekly_hours">{t('ساعات أسبوعياً (اختياري)', 'Hours a week (optional)')}</label>
            <input id="weekly_hours" name="weekly_hours" type="number" min={1} max={40}
                   defaultValue={existing?.weekly_hours ?? ''} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="experience">{t('خبرتك العملية (اختياري)', 'Your working experience (optional)')}</label>
          <textarea id="experience" name="experience" rows={4}
                    defaultValue={existing?.experience_ar ?? ''}
                    placeholder={t('أين عملت، ماذا بنيت، ومن راجعت أعمالهم من قبل.', 'Where you have worked, what you have built, and whose work you have reviewed before.')} />
        </div>

        <div className="field">
          <label htmlFor="motivation">{t('لماذا تريد أن تكون منتوراً؟ (اختياري)', 'Why do you want to mentor? (optional)')}</label>
          <textarea id="motivation" name="motivation" rows={3}
                    defaultValue={existing?.motivation_ar ?? ''} />
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

        <h3 style={{ fontSize: '0.98rem', marginTop: 8 }}>{t('أدلة (اختياري، وتقدر تضيفها أثناء المراجعة)', 'Evidence (optional — you can add it while under review)')}</h3>
        <div className="field">
          <label htmlFor="cv_url">{t('رابط السيرة الذاتية', 'CV link')}</label>
          <input id="cv_url" name="cv_url" type="url" dir="ltr" placeholder="https://"
                 defaultValue={existing?.cv_url ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="certificate_urls">{t('روابط الشهادات — رابط في كل سطر (حتى 10)', 'Certificate links — one per line (up to 10)')}</label>
          <textarea id="certificate_urls" name="certificate_urls" rows={3} dir="ltr" placeholder="https://"
                    defaultValue={(existing?.certificate_urls ?? []).join('\n')} />
        </div>

        <p className="notice">
          {t('مستواك كمنتور تحدّده الإدارة عند مراجعة طلبك: Peer / Junior أو Professional أو Senior / Specialist. المستوى يحدد نطاق السعر المسموح به، وأنت تحدد سعرك داخله. وبعدها تطلب الترقية متى شئت وتراجعها الإدارة على خبرتك وأعمالك وتقييماتك وجلساتك.',
             'TechMood sets your mentor level when it reviews your application: Peer / Junior, Professional or Senior / Specialist. A level sets the allowed price range; you name your own price inside it. Later you can request an upgrade whenever you like, reviewed on your experience, works, ratings and sessions.')}
        </p>

        {state?.error && <p className="notice notice-danger">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

        <button className="btn btn-primary" disabled={pending}>
          {pending ? t('جارٍ الإرسال…', 'Sending…') : isOpen ? t('حدّث طلبي', 'Update my application') : t('أرسل الطلب', 'Send application')}
        </button>
      </fieldset>
    </form>
  );
}
