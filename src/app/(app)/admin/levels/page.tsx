import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { reviewLevelUpgrade } from '../sections-actions';

export const generateMetadata = localizedTitle('ترقيات المستوى — TechMood', 'Level upgrades — TechMood');

/** Mentors asking to move up (0101): their answers, with the numbers beside them. */
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
                {' · '}<span className="eng">{request.from_level} → {request.to_level}</span>
              </h3>
              <span className="muted eng" style={{ fontSize: '0.82rem' }}>
                {request.sessions_now} {t('جلسة', 'sessions')} · ★ {request.rating_now ?? '—'}
              </span>
            </div>
            <dl style={{ marginTop: 10 }}>
              {Object.entries(request.answers ?? {}).map(([key, answer]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <dt className="muted" style={{ fontSize: '0.8rem' }}>{questionOf.get(key) ?? key}</dt>
                  <dd style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>{answer}</dd>
                </div>
              ))}
            </dl>
            <div className="row-actions" style={{ alignItems: 'flex-start' }}>
              <ActionForm action={reviewLevelUpgrade} submitLabel={t('وافق ورقِّه', 'Approve')}>
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="decision" value="approve" />
                <input name="note" placeholder={t('ملاحظة (اختيارية)', 'Note (optional)')} />
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
