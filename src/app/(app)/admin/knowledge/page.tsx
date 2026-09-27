import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_CATEGORY } from '@/lib/support';
import type { ContentStatus, TicketCategory } from '@/lib/database.types';

import { deleteArticle, saveArticle } from '../sections-actions';
import { STATUS_LABEL, STATUS_PILL, STATUS_SHORT } from '../academy/status';

export const metadata = { title: 'Knowledge base — TechMood admin' };

type Article = {
  id: string; slug: string; category: TicketCategory | null; title_ar: string; title_en: string | null;
  body_ar: string; status: ContentStatus; sort_order: number;
};

/**
 * Help articles. A published article appears in Help & reports, and on a
 * ticket of its category — so the answer to a common question reaches the
 * person before anybody has to type it again.
 */
export default async function AdminKnowledgePage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: articles } = await supabase.from('kb_articles')
    .select('id, slug, category, title_ar, title_en, body_ar, status, sort_order')
    .order('category').order('sort_order');

  const form = (article: Article | null) => (
    <ActionForm action={saveArticle} className="admin-lesson-form" submitLabel={article ? t('احفظ', 'Save') : t('أضف المقال', 'Add the article')}>
      {article && <input type="hidden" name="id" value={article.id} />}
      <div className="field-row">
        <div className="field">
          <label>{t('العنوان', 'Title')}<input name="title_ar" required minLength={3} defaultValue={article?.title_ar ?? ''} /></label>
        </div>
        <div className="field">
          <label>{t('العنوان بالإنجليزية', 'English title')}<input name="title_en" defaultValue={article?.title_en ?? ''} /></label>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="eng" defaultValue={article?.slug ?? ''} /></label>
        </div>
        <div className="field">
          <label>{t('يظهر مع بلاغات من نوع', 'Shown with tickets about')}
            <select name="category" defaultValue={article?.category ?? ''}>
              <option value="">{t('— عام —', '— General —')}</option>
              {(Object.keys(TICKET_CATEGORY) as TicketCategory[]).map((key) => <option key={key} value={key}>{t(TICKET_CATEGORY[key])}</option>)}
            </select>
          </label>
        </div>
        <div className="field">
          <label>{t('الحالة', 'Status')}
            <select name="status" defaultValue={article?.status ?? 'draft'}>
              {(['published', 'draft', 'archived'] as ContentStatus[]).map((status) => <option key={status} value={status}>{t(STATUS_LABEL[status])}</option>)}
            </select>
          </label>
        </div>
        <div className="field">
          <label>{t('الترتيب', 'Order')}<input name="sort_order" type="number" defaultValue={article?.sort_order ?? 0} style={{ width: 80 }} /></label>
        </div>
      </div>
      <div className="field">
        <label>{t('النص', 'Body')}<textarea name="body_ar" rows={6} required minLength={20} defaultValue={article?.body_ar ?? ''} /></label>
      </div>
    </ActionForm>
  );

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('قاعدة المعرفة', 'Knowledge base')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('المقال المنشور يظهر في «المساعدة والبلاغات» وعلى صفحة كل بلاغ من نوعه، فيصل الجواب قبل أن يُسأل مرة أخرى.',
             'A published article appears in Help & reports and on every ticket of its type, so the answer arrives before it is asked again.')}
        </p>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('مقال جديد', 'New article')}</h3>
        {form(null)}
      </section>

      {((articles ?? []) as Article[]).map((article) => (
        <details className="panel admin-lesson" key={article.id}>
          <summary>
            <span>{article.title_ar}</span>
            <span className="muted">{article.category ? t(TICKET_CATEGORY[article.category]) : t('عام', 'General')}</span>
            <span className={`status-pill ${STATUS_PILL[article.status]}`}>{t(STATUS_SHORT[article.status])}</span>
          </summary>
          {form(article)}
          <ActionForm action={deleteArticle} variant="ghost" submitLabel={t('احذف المقال', 'Delete the article')} confirm={t('حذف المقال نهائياً؟', 'Delete this article for good?')}>
            <input type="hidden" name="id" value={article.id} />
          </ActionForm>
        </details>
      ))}
    </>
  );
}
