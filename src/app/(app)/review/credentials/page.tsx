import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { ReviewRow } from './ReviewRow';

export const metadata = { title: 'Credentials to verify — TechMood' };

/**
 * Credentials waiting for somebody to open them at the provider.
 *
 * There is no API behind this page on purpose: a provider's own badge page is
 * the only authority on whether a credential is real, so verifying one means
 * opening it and checking the name, the credential and the date. The row says
 * whether the practical task is already approved, because a verified
 * credential without it still does not complete the lesson.
 */
export default async function CredentialQueuePage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: isAdmin }, { data: isMentor }] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_mentor'),
  ]);

  if (!isAdmin && !isMentor) redirect('/home');

  const { data: queue } = await supabase.rpc('credential_review_queue');
  const rows = queue ?? [];

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('شهادات بانتظار التوثيق', 'Credentials to verify')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: '66ch' }}>
          {t('افتح الرابط عند المُصدِر، وتأكّد أن الاسم هو اسم المتعلّم، وأن الشهادة هي المطلوبة في الدرس، وأنها صدرت فعلاً. الرفض يحتاج سبباً يقرؤه.',
             'Open the link at the provider and check that the name is the learner’s, that the credential is the one the lesson asks for, and that it was actually issued. A refusal needs a reason they can read.')}
        </p>
      </section>

      {rows.length === 0 ? (
        <p className="notice">{t('لا شيء بانتظارك.', 'Nothing waiting on you.')}</p>
      ) : (
        <ul className="goal-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <strong>{row.credential_name}</strong>
                  <span className="muted"> · {row.provider_name}</span>
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    {row.learner_name} <span className="eng">({row.techmood_id})</span>
                    {' — '}{row.course_title} / {row.lesson_title}
                  </p>
                  <p style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    <a href={row.evidence_url} target="_blank" rel="noreferrer noopener" dir="ltr">
                      {row.evidence_url}
                    </a>
                    {row.credential_code && <span className="muted eng"> · {row.credential_code}</span>}
                    {row.issued_on && <span className="muted eng"> · {row.issued_on}</span>}
                  </p>
                </div>
                <span className={`status-pill ${row.application_done ? 'status-ok' : 'status-pending'}`}>
                  {row.application_done
                    ? t('التطبيق معتمد', 'Practice approved')
                    : t('التطبيق لم يُعتمد بعد', 'Practice not yet approved')}
                </span>
              </div>
              <ReviewRow submissionId={row.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
