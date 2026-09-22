import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import type { ShareScope } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { ShareForm } from './ShareForm';
import { revokeShare } from './actions';

const SCOPE: Record<ShareScope, Text> = {
  canvas:   { ar: 'لوحة',          en: 'A canvas' },
  plan:     { ar: 'خطة العمل',     en: 'The plan' },
  roadmap:  { ar: 'خارطة الطريق',  en: 'The roadmap' },
  showcase: { ar: 'تعريف الشركة',  en: 'The overview' },
};

/**
 * Showing one thing, once, to somebody with no account.
 *
 * A screenshot loses what makes the thing worth showing; opening the workspace
 * gives away everything. A link sits between the two: one company, one thing,
 * one token, and a date it stops working.
 */
export default async function SharePage({
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

  const [{ data: shares }, { data: canvases }, { data: canManage }] = await Promise.all([
    supabase.from('startup_shares')
      .select('id, token, scope, canvas_id, label_ar, expires_on, revoked_at, views, created_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false }),
    supabase.from('canvases').select('id, title_ar').eq('startup_id', startupId).order('created_at'),
    supabase.rpc('can_manage_startup', { p_startup: startupId }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — المشاركة والطباعة', ' — sharing and printing')}</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>{t('نظرة عامة', 'Overview')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('الرابط يفتح شيئاً واحداً فقط لمن يحمله، وينتهي في تاريخه، ويمكن سحبه في أي لحظة. من يفتحه لا يدخل مساحة العمل ولا يرى شيئاً آخر.',
             'A link opens one thing, to whoever holds it, until its date — and can be pulled at any moment. Whoever opens it does not enter the workspace and sees nothing else.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      {(shares ?? []).length > 0 && (
        <section className="section-block">
          <table className="data booking-table">
            <thead>
              <tr>
                <th>{t('ماذا', 'What')}</th>
                <th>{t('لمن', 'For whom')}</th>
                <th>{t('الرابط', 'Link')}</th>
                <th>{t('ينتهي', 'Expires')}</th>
                <th>{t('فُتح', 'Opened')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(shares ?? []).map((share) => {
                const dead = share.revoked_at !== null
                  || (share.expires_on !== null && share.expires_on < today);

                return (
                  <tr key={share.id}>
                    <td data-label={t('ماذا', 'What')}>{t(SCOPE[share.scope])}</td>
                    <td data-label={t('لمن', 'For whom')} className="muted">{share.label_ar ?? '—'}</td>
                    <td data-label={t('الرابط', 'Link')}>
                      {dead ? (
                        <span className="muted">{t('لم يعد يعمل', 'No longer works')}</span>
                      ) : (
                        <code className="eng" style={{ fontSize: '0.74rem' }}>/s/{share.token}</code>
                      )}
                    </td>
                    <td data-label={t('ينتهي', 'Expires')} className="muted">
                      {share.expires_on ? formatDate(locale, share.expires_on) : t('بلا أجل', 'No end date')}
                    </td>
                    <td data-label={t('فُتح', 'Opened')} className="eng">{share.views}</td>
                    <td>
                      {canManage === true && !dead && (
                        <form action={revokeShare}>
                          <input type="hidden" name="startup_id" value={startupId} />
                          <input type="hidden" name="share_id" value={share.id} />
                          <button className="btn btn-ghost btn-sm">{t('اسحبه', 'Revoke')}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {canManage === true && (
        <section className="section-block">
          <h3 className="academy-heading">{t('رابط جديد', 'A new link')}</h3>
          <ShareForm startupId={startupId} canvases={canvases ?? []} />
        </section>
      )}

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.96rem' }}>{t('الطباعة والعرض', 'Printing and presenting')}</h3>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6, maxWidth: '64ch' }}>
          {t('أي صفحة هنا تُطبع كما هي: التنقّل والأزرار تختفي عند الطباعة، ويبقى المحتوى وحده على الورق أو في ملف PDF من نافذة الطباعة.',
             'Any page here prints as it stands: the navigation and the buttons drop away, and what is left on the paper — or in a PDF from the print dialog — is the content itself.')}
        </p>
        <div className="row-actions" style={{ marginTop: 12 }}>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/canvases`}>{t('اللوحات', 'Canvases')}</Link>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/plan`}>{t('خطة العمل', 'The plan')}</Link>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}/roadmap`}>{t('خارطة الطريق', 'The roadmap')}</Link>
        </div>
      </section>
    </>
  );
}
