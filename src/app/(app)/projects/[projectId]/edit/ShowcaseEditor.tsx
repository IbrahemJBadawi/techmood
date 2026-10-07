'use client';

import { useActionState, useState } from 'react';

import { ProjectImagesUploader } from '@/components/ProjectImagesUploader';
import type { ProductType, ProjectLink } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';
import { CATEGORIES, LINK_KINDS, PRODUCT_TYPES } from '@/lib/showcase';

import { saveShowcase, type ShowcaseState } from '../../showcase-actions';

export type EditorProject = {
  id: string; title: string; tagline: string; description: string;
  product_type: ProductType | null; category: string | null;
  technologies: string[]; skills: string[];
  demo_url: string; video_url: string; links: ProjectLink[]; images: string[];
  in_gallery: boolean; hidden_note: string | null; academic: string; is_team: boolean;
};

export type AcademicOption = { value: string; label: string };

/**
 * The project's page, as its owner edits it (0121). What a complete gallery
 * page needs — a short description (20+), a description (40+), one picture —
 * is shown next to the switch, and checked again by the database on save.
 */
export function ShowcaseEditor({ project, academicOptions }: { project: EditorProject; academicOptions: AcademicOption[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveShowcase, undefined as ShowcaseState);
  // Rows carry their own key, so removing one does not shift the others' values.
  const [links, setLinks] = useState<(ProjectLink & { key: number })[]>(
    (project.links.length ? project.links : [{ kind: 'github', url: '' }]).map((link, key) => ({ ...link, key })));

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="project_id" value={project.id} />

      <section className="panel section-block">
        <h3 className="sc-h">1 · {t('الأساسيات', 'The basics')}</h3>
        <div className="field">
          <label htmlFor="title">{t('اسم المشروع', 'Project name')}</label>
          <input id="title" name="title" required minLength={3} maxLength={160} defaultValue={project.title} />
        </div>
        <div className="field">
          <label htmlFor="tagline">{t('وصف مختصر (سطر واحد يظهر على البطاقة)', 'Short description (one line on the card)')}</label>
          <input id="tagline" name="tagline" maxLength={200} defaultValue={project.tagline}
                 placeholder={t('مثال: قالب متجر عربي كامل بسلة ودفع ولوحة طلبات', 'e.g. A complete Arabic shop template with cart, checkout and orders')} />
        </div>
        <div className="field">
          <label htmlFor="description">{t('الوصف التفصيلي: ما هو، لمن، المشكلة التي يحلها، وما بداخله', 'Full description: what it is, who it is for, the problem it solves, what is inside')}</label>
          <textarea id="description" name="description" rows={7} maxLength={8000} defaultValue={project.description} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="product_type">{t('نوع المنتج', 'Product type')}</label>
            <select id="product_type" name="product_type" defaultValue={project.product_type ?? 'full_project'}>
              {Object.entries(PRODUCT_TYPES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">{t('التصنيف', 'Category')}</label>
            <select id="category" name="category" defaultValue={project.category ?? 'web'}>
              {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="technologies">{t('التقنيات المستخدمة (مفصولة بفاصلة)', 'Technologies (comma separated)')}</label>
            <input id="technologies" name="technologies" dir="ltr" defaultValue={project.technologies.join(', ')} placeholder="Next.js, Supabase, Figma" />
          </div>
          <div className="field">
            <label htmlFor="skills">{t('المهارات (مفصولة بفاصلة)', 'Skills (comma separated)')}</label>
            <input id="skills" name="skills" defaultValue={project.skills.join('، ')} placeholder={t('تصميم واجهات، قواعد بيانات', 'UI design, databases')} />
          </div>
        </div>
      </section>

      <section className="panel section-block">
        <h3 className="sc-h">2 · {t('الصور', 'Pictures')}</h3>
        <ProjectImagesUploader projectId={project.id} initial={project.images} />
      </section>

      <section className="panel section-block">
        <h3 className="sc-h">3 · {t('الديمو والروابط', 'Demo and links')}</h3>
        <div className="field-row">
          <div className="field">
            <label htmlFor="demo_url">{t('رابط الديمو (تجربة مباشرة)', 'Live demo link')}</label>
            <input id="demo_url" name="demo_url" type="url" dir="ltr" placeholder="https://" defaultValue={project.demo_url} />
          </div>
          <div className="field">
            <label htmlFor="video_url">{t('فيديو شرح (YouTube أو Vimeo)', 'Walkthrough video (YouTube or Vimeo)')}</label>
            <input id="video_url" name="video_url" type="url" dir="ltr" placeholder="https://youtu.be/…" defaultValue={project.video_url} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0 8px' }}>
          {t('روابط إثبات العمل: GitHub، Behance، Figma، ملفات… (رابط ملفات البيع يوضع في قسم البيع ويبقى مخفياً حتى الدفع).',
             'Proof links: GitHub, Behance, Figma, files… (the files you sell go in the sale section and stay hidden until payment).')}
        </p>
        {links.map((link) => (
          <div className="sc-link-row" key={link.key}>
            <select name="link_kind" defaultValue={link.kind} aria-label={t('نوع الرابط', 'Link type')}>
              {Object.entries(LINK_KINDS).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select>
            <input name="link_url" type="url" dir="ltr" placeholder="https://" defaultValue={link.url} aria-label={t('الرابط', 'Link')} />
            <button type="button" className="btn btn-ghost btn-sm" aria-label={t('احذف الرابط', 'Remove link')}
                    onClick={() => setLinks((current) => current.filter((row) => row.key !== link.key))}>✕</button>
          </div>
        ))}
        {links.length < 10 && (
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setLinks((current) => [...current, { kind: 'website', url: '', key: Date.now() }])}>
            {t('+ رابط آخر', '+ Another link')}
          </button>
        )}
      </section>

      {!project.is_team && (
        <section className="panel section-block">
          <h3 className="sc-h">4 · {t('العلاقة مع الأكاديمية (اختياري)', 'Link to the academy (optional)')}</h3>
          <div className="field">
            <label htmlFor="academic">{t('هل أُنجز هذا المشروع ضمن تسليم أو مسار أو دورة؟', 'Was it built for a hand-in, a path or a course?')}</label>
            <select id="academic" name="academic" defaultValue={project.academic}>
              <option value="">{t('لا — مشروع مستقل', 'No — an independent project')}</option>
              {academicOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small className="muted">
              {t('يظهر على الصفحة «أُنجز ضمن…»، وتقييم المنتور للتسليم المرتبط يظهر كشارة جودة — ليس شرطاً للنشر.',
                 'The page says “built in…”, and a mentor’s evaluation of a linked hand-in shows as a quality badge — never a condition for publishing.')}
            </small>
          </div>
        </section>
      )}

      <section className="panel section-block">
        <h3 className="sc-h">🖼️ {t('النشر في المعرض', 'Publish in the gallery')}</h3>
        {project.hidden_note ? (
          <p className="notice notice-danger">{t('أخفت TechMood هذا المشروع: ', 'TechMood hid this project: ')}{project.hidden_note}</p>
        ) : (
          <label className="sc-switch">
            <input type="checkbox" name="in_gallery" defaultChecked={project.in_gallery} />
            <span>{t('اعرضه في معرض TechMood العام — يظهر فوراً برابط دائم يمكن مشاركته.',
                     'Show it in the public TechMood gallery — live at once, with a permanent link to share.')}</span>
          </label>
        )}
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
          {t('يلزم: وصف مختصر (20 حرفاً+)، وصف تفصيلي (40 حرفاً+)، وصورة واحدة على الأقل.',
             'Needed: a short description (20+ characters), a full description (40+), and at least one picture.')}
        </p>
      </section>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <div className="sc-save-bar">
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>{pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ الصفحة', 'Save the page')}</button>
      </div>
    </form>
  );
}
