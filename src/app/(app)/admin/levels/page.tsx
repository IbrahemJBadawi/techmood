import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { reviewLevelUpgrade } from '../sections-actions';

// Links a mentor typed themselves open only if they are ordinary web links.
const isWebLink = (url: string | null) => !!url && /^https?:\/\//i.test(url);

export const generateMetadata = localizedTitle('ترقيات المستوى — TechMood', 'Level upgrades — TechMood');

/**
 * Mentors asking to move up (0101, 0120). The decision is the admin's, on the
 * whole picture — experience, specialty, works (with links), what learners
 * said, and the sessions record — never on stars alone. The level's usual
 * sessions and rating are shown as a guide, and a reason is required either way.
 */
export default async function AdminLevelsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const [{ data: pending }, { data: questions }] = await Promise.all([
    supabase.rpc('admin_level_upgrades'),
    supabase.from('level_upgrade_questions').select('key, question_ar').order('sort_order'),
  ]);
  const questionOf = new Map((questions ?? []).map((q) => [q.key, q.question_ar]));

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('طلبات ترقية المستوى', 'Level upgrade requests')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/guide">{t('الدليل', 'The guide')}</Link>
        </div>
      </section>

      {(pending ?? []).length === 0 ? (
        <p className="notice">{t('لا طلبات بانتظار المراجعة.', 'No requests waiting.')}</p>
      ) : (
        (pending ?? []).map((request) => (
          <article className="panel section-block" key={request.id}>
            <div className="row-between">
              <h3 style={{ fontSize: '1rem' }}>
                <Link href={`/admin/users/${request.mentor_id}`}>{request.mentor_name}</Link>
                {' · '}<bdi className="eng">{request.from_title ?? request.from_level}</bdi>
                {t(' ← ', ' → ')}<bdi className="eng">{request.to_title ?? request.to_level}</bdi>
              </h3>
            </div>
            <dl className="admin-facts" style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: '0.84rem' }}>
              <div>
                <dt className="muted" style={{ display: 'inline' }}>{t('سجل الجلسات والتقييم: ', 'Sessions and rating: ')}</dt>
                <dd style={{ display: 'inline', margin: 0 }}>
                  {t(`${request.sessions_now} جلسة`, `${request.sessions_now} sessions`)} · <bdi>★ {request.rating_now ?? '—'}</bdi>
                  <span className="muted">
                    {' '}({t(`الدليل ${request.sessions_guide ?? 0} جلسة`, `guide ${request.sessions_guide ?? 0} sessions`)} · <bdi>★ {request.rating_guide ?? 0}</bdi>
                    {(request.sessions_now >= (request.sessions_guide ?? 0) && Number(request.rating_now ?? 0) >= Number(request.rating_guide ?? 0))
                      ? t(' — مستوفى', ' — met') : t(' — دون الدليل، والقرار لك', ' — below the guide; your call')})
                  </span>
                </dd>
              </div>
              {request.years_experience != null && (
                <div><dt className="muted" style={{ display: 'inline' }}>{t('سنوات الخبرة: ', 'Years of experience: ')}</dt>
                  <dd className="eng" style={{ display: 'inline', margin: 0 }}>{request.years_experience}</dd></div>
              )}
              {(request.domains ?? []).length > 0 && (
                <div><dt className="muted" style={{ display: 'inline' }}>{t('التخصص: ', 'Specialty: ')}</dt>
                  <dd style={{ display: 'inline', margin: 0 }}>{(request.domains ?? []).join('، ')}{request.headline_ar ? ` — ${request.headline_ar}` : ''}</dd></div>
              )}
              {(isWebLink(request.portfolio_url) || isWebLink(request.linkedin_url)) && (
                <div className="tags-row">
                  {isWebLink(request.portfolio_url) && <a href={request.portfolio_url!} target="_blank" rel="noreferrer noopener">{t('معرض الأعمال ↗', 'Portfolio ↗')}</a>}
                  {isWebLink(request.linkedin_url) && <a href={request.linkedin_url!} target="_blank" rel="noreferrer noopener">LinkedIn ↗</a>}
                </div>
              )}
            </dl>
            <dl style={{ marginTop: 10 }}>
              {Object.entries(request.answers ?? {}).map(([key, answer]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <dt className="muted" style={{ fontSize: '0.8rem' }}>{questionOf.get(key) ?? key}</dt>
                  <dd style={{ margin: '2px 0 0', fontSize: '0.88rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{answer}</dd>
                </div>
              ))}
            </dl>
            <div className="row-actions" style={{ alignItems: 'flex-start' }}>
              <ActionForm action={reviewLevelUpgrade} submitLabel={t('وافق ورقِّه', 'Approve')}>
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <input name="note" required minLength={10} placeholder={t('سبب الموافقة — يصل للمنتور', 'Why — the mentor reads it')} />
              </ActionForm>
              <ActionForm action={reviewLevelUpgrade} submitLabel={t('اعتذر', 'Decline')} variant="ghost">
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="decision" value="decline" />
                <input name="note" required minLength={10} placeholder={t('السبب — يصل للمنتور', 'Reason — the mentor reads it')} />
              </ActionForm>
            </div>
          </article>
        ))
      )}
    </>
  );
}
