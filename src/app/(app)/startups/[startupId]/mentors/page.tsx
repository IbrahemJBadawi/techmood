import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { CANVAS_KIND } from '@/lib/incubator';
import type { CanvasKind } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { GrantForm } from './GrantForm';
import { revokeMentorAccess } from './actions';

/**
 * The mentors this company let in.
 *
 * A mentor cannot advise on what they cannot see — and should not see
 * everything either. Access is by name, to the canvases the company marked for
 * mentors, until a date the company chose.
 */
export default async function StartupMentorsPage({
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

  const [{ data: access }, { data: canManage }, { data: canvases }] = await Promise.all([
    supabase.from('startup_mentor_access')
      .select('mentor_id, note_ar, granted_at, expires_on')
      .eq('startup_id', startupId)
      .order('granted_at', { ascending: false }),
    supabase.rpc('can_manage_startup', { p_startup: startupId }),
    supabase.from('canvases')
      .select('id, kind, title_ar, visibility')
      .eq('startup_id', startupId),
  ]);

  const ids = (access ?? []).map((row) => row.mentor_id);
  const { data: people } = await supabase
    .from('profiles').select('id, full_name, techmood_id, headline')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const personOf = new Map((people ?? []).map((row) => [row.id, row]));
  const open = (canvases ?? []).filter((canvas) => canvas.visibility !== 'workspace');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar}{t(' — المنتورون', ' — mentors')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/mentors">{t('احجز جلسة', 'Book a session')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('المنتور الذي تمنحونه الوصول يرى اللوحات التي فتحتموها للمنتورين — لا خطة العمل ولا المال ولا بقية الغرفة. والوصول ينتهي في التاريخ الذي تحددونه، بلا حاجة لتذكّره.',
             'A mentor you let in sees the canvases you opened to mentors — not the business plan, not the money, not the rest of the room. And the access ends on the date you set, without anybody having to remember it.')}
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.96rem' }}>{t('ما هو مفتوح للمنتورين الآن', 'What is open to mentors right now')}</h3>
        {open.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
            {t('لا لوحة مفتوحة بعد — افتح لوحة من صفحتها، واختر «مساحة العمل والمنتورون».',
               'No canvas is open yet — open one from its own page and choose “the workspace and its mentors”.')}
          </p>
        ) : (
          <ul className="plain-list" style={{ marginTop: 10 }}>
            {open.map((canvas) => (
              <li className="row-between" key={canvas.id} style={{ fontSize: '0.86rem' }}>
                <span>
                  {canvas.title_ar}
                  <span className="muted"> · {t(CANVAS_KIND[canvas.kind as CanvasKind].label)}</span>
                </span>
                <span className="badge-pill">
                  {canvas.visibility === 'public' ? t('للعامة', 'Public') : t('للمنتورين', 'Mentors')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('من له وصول', 'Who has the keys')}</h3>
        {(access ?? []).length === 0 ? (
          <p className="notice">{t('لا منتور له وصول حالياً.', 'No mentor has access right now.')}</p>
        ) : (
          <table className="data booking-table">
            <thead>
              <tr>
                <th>{t('المنتور', 'Mentor')}</th>
                <th>{t('السبب', 'Why')}</th>
                <th>{t('منذ', 'Since')}</th>
                <th>{t('حتى', 'Until')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(access ?? []).map((row) => {
                const person = personOf.get(row.mentor_id);
                const lapsed = row.expires_on !== null && row.expires_on < today;

                return (
                  <tr key={row.mentor_id}>
                    <td data-label={t('المنتور', 'Mentor')}>
                      <Link href={`/u/${person?.techmood_id ?? ''}`}>{person?.full_name ?? '—'}</Link>
                      {person?.headline && <p className="muted" style={{ fontSize: '0.78rem' }}>{person.headline}</p>}
                    </td>
                    <td data-label={t('السبب', 'Why')} className="muted">{row.note_ar ?? '—'}</td>
                    <td data-label={t('منذ', 'Since')} className="muted">{formatDate(locale, row.granted_at)}</td>
                    <td data-label={t('حتى', 'Until')}>
                      {row.expires_on
                        ? <span className={`status-pill ${lapsed ? 'status-muted' : 'status-ok'}`}>
                            {formatDate(locale, row.expires_on)}
                          </span>
                        : <span className="muted">{t('بلا أجل', 'No end date')}</span>}
                    </td>
                    <td>
                      {canManage === true && (
                        <form action={revokeMentorAccess}>
                          <input type="hidden" name="startup_id" value={startupId} />
                          <input type="hidden" name="mentor_id" value={row.mentor_id} />
                          <button className="btn btn-ghost btn-sm">{t('اسحب الوصول', 'Revoke')}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {canManage === true && (
        <section className="section-block">
          <h3 className="academy-heading">{t('امنح منتوراً وصولاً', 'Let a mentor in')}</h3>
          <GrantForm startupId={startupId} />
        </section>
      )}
    </>
  );
}
