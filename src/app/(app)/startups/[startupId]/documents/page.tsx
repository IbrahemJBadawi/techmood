import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { DOCUMENT_KIND } from '@/lib/incubator';

import { StartupNav } from '../StartupNav';
import { DocumentForm } from './DocumentForm';
import { removeDocument } from './actions';

/**
 * The company's papers. Not a drive: a shelf where a new version of a document
 * is another row with a higher number, so nobody has to remember which file was
 * the one they sent.
 */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups').select('id, name_ar').eq('id', startupId).maybeSingle();
  if (!startup) notFound();

  const [{ data: documents }, { data: canEdit }] = await Promise.all([
    supabase.from('startup_documents')
      .select('id, kind, title_ar, summary_ar, url, version, created_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false }),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
  ]);

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — المستندات', ' — documents')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
      </section>

      <StartupNav startupId={startupId} />

      {(documents ?? []).length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '0.98rem' }}>{t('لا مستندات بعد', 'No documents yet')}</h3>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {t('خطة العمل ودراسة الجدوى والعرض التقديمي والتقارير — كلها تعيش هنا بنسخها.',
               'The business plan, the feasibility study, the pitch deck and the reports all live here, with their versions.')}
          </p>
        </div>
      ) : (
        <section className="section-block">
          <table className="data booking-table">
            <thead>
              <tr>
                <th>{t('المستند', 'Document')}</th>
                <th>{t('النوع', 'Kind')}</th>
                <th>{t('النسخة', 'Version')}</th>
                <th>{t('التاريخ', 'Added')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(documents ?? []).map((document) => (
                <tr key={document.id}>
                  <td data-label={t('المستند', 'Document')}>
                    <a href={document.url ?? '#'} target="_blank" rel="noreferrer noopener">{document.title_ar}</a>
                    {document.summary_ar && (
                      <p className="muted" style={{ fontSize: '0.78rem' }}>{document.summary_ar}</p>
                    )}
                  </td>
                  <td data-label={t('النوع', 'Kind')} className="muted">{t(DOCUMENT_KIND[document.kind])}</td>
                  <td data-label={t('النسخة', 'Version')} className="eng">v{document.version}</td>
                  <td data-label={t('التاريخ', 'Added')} className="muted">{formatDate(locale, document.created_at)}</td>
                  <td>
                    {canEdit === true && (
                      <form action={removeDocument}>
                        <input type="hidden" name="startup_id" value={startupId} />
                        <input type="hidden" name="document_id" value={document.id} />
                        <button className="btn btn-ghost btn-sm">{t('احذف', 'Remove')}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canEdit === true && (
        <section className="section-block">
          <h3 className="academy-heading">{t('أضف مستنداً', 'Add a document')}</h3>
          <DocumentForm startupId={startupId} />
        </section>
      )}
    </>
  );
}
