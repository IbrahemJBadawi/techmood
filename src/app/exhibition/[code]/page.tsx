import Link from 'next/link';
import QRCode from 'qrcode';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { ExhibitionSnapshot, ReviewCriterion } from '@/lib/database.types';

import { CRITERION_LABEL, KIND_LABEL } from '../types';
import { LogoMark } from '@/components/Logo';

export const metadata = { title: 'A project in the TechMood exhibition' };

const CRITERIA: ReviewCriterion[] = [
  'requirements', 'technical_quality', 'ui_ux', 'problem_solving', 'documentation', 'completeness',
];

/**
 * One project, as evidence.
 *
 * Everything here is read from the snapshot frozen when a mentor approved the
 * work: the page cannot drift from what was judged, and it cannot reach into
 * the private workspace the project was built in. The page is public, so it
 * shows the final approved version — the road it took is in the builder's own
 * team page, not on the wall.
 */
export default async function ExhibitionEntryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { code } = await params;
  const supabase = await createClient();

  const entryCode = decodeURIComponent(code).toUpperCase();
  const [{ data: entry }, { data: historyRows }] = await Promise.all([
    supabase
      .from('exhibition_gallery')
      .select('entry_code, published_at, snapshot')
      .eq('entry_code', entryCode)
      .maybeSingle(),
    supabase.rpc('exhibition_entry_history', { p_code: entryCode }),
  ]);

  if (!entry) {
    return (
      <main className="landing" style={{ maxWidth: 860 }}>
        <nav className="landing-nav">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
            <LogoMark />
            TechMood
          </Link>
          <Link className="btn btn-ghost btn-sm" href="/exhibition">{t('كل المعرض', 'All projects')}</Link>
        </nav>
        <section className="panel" style={{ marginTop: 32 }}>
          <h1 style={{ fontSize: '1.1rem' }}>{t('لا يوجد مشروع بهذا الرقم', 'No project with that number')}</h1>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
            {t('الرقم ', 'The number ')}
            <span className="id-chip">{decodeURIComponent(code)}</span>
            {t(' غير معروض في المعرض.', ' is not on the wall.')}
          </p>
        </section>
      </main>
    );
  }

  const snapshot = entry.snapshot as ExhibitionSnapshot;
  const evaluation = snapshot.evaluation;
  const history = historyRows ?? [];

  // The QR a CV, a presentation or a printed page can carry.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmood.io';
  const verifyUrl = `${siteUrl}/exhibition/${entry.entry_code}/verify`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 });

  return (
    <main className="landing" style={{ maxWidth: 900 }}>
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/exhibition">{t('كل المعرض', 'All projects')}</Link>
      </nav>

      {/* ---- the work ---- */}
      <section className="panel" style={{ marginTop: 28 }}>
        <div className="row-between">
          <span className="id-chip">{snapshot.project_code}</span>
          <span className="badge-pill eng">{entry.entry_code}</span>
        </div>

        <h1 style={{ fontSize: '1.45rem', marginTop: 12 }}>{snapshot.project_title}</h1>
        <p className="exhibit-builder" style={{ marginTop: 6 }}>
          {snapshot.team?.title ?? snapshot.creator?.full_name}
          <span className="muted"> · {KIND_LABEL[snapshot.kind]?.[locale] ?? snapshot.kind}</span>
          {snapshot.path && <span className="muted"> · {snapshot.path.title}</span>}
        </p>

        <div className="exhibit-headline">
          {evaluation?.rating != null && (
            <span className="exhibit-rating">
              <Stars value={evaluation.rating} />
              <span className="eng">{evaluation.rating.toFixed(1)} / 5</span>
            </span>
          )}
          <span className="status-pill status-ok">{t('✓ موثّق من TechMood', '✓ TechMood verified')}</span>
        </div>

        <p className="muted" style={{ fontSize: '0.95rem', marginTop: 12 }}>{snapshot.summary}</p>

        <div className="tags-row" style={{ marginTop: 14 }}>
          {(snapshot.technologies ?? []).map((tech) => <span className="tag eng" key={tech}>{tech}</span>)}
        </div>
      </section>

      {/* ---- preview ---- */}
      {(snapshot.cover_url || snapshot.demo_url) && (
        <section className="panel section-block">
          {snapshot.cover_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="exhibit-cover" src={snapshot.cover_url} alt={snapshot.project_title} />
          )}
          {snapshot.demo_url && (
            <a className="btn btn-primary btn-sm" href={snapshot.demo_url} target="_blank" rel="noreferrer">
              {t('افتح العرض الحي', 'Open the live demo')}
            </a>
          )}
        </section>
      )}

      {/* ---- about ---- */}
      {(snapshot.description || snapshot.problem || snapshot.solution) && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('عن المشروع', 'About')}</h2>
          {snapshot.description && <p style={{ fontSize: '0.92rem', marginTop: 10 }}>{snapshot.description}</p>}

          {snapshot.problem && (
            <div className="exhibit-block">
              <h3>{t('المشكلة', 'The problem')}</h3>
              <p>{snapshot.problem}</p>
            </div>
          )}
          {snapshot.solution && (
            <div className="exhibit-block">
              <h3>{t('الحل', 'The solution')}</h3>
              <p>{snapshot.solution}</p>
            </div>
          )}
        </section>
      )}

      {/* ---- what was actually built ---- */}
      {(snapshot.outcomes ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('ماذا بُني فعلاً', 'What was actually built')}</h2>
          <ul className="lesson-outcomes">
            {snapshot.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </section>
      )}

      {/* ---- who built it ---- */}
      <section className="panel section-block">
        <h2 style={{ fontSize: '1rem' }}>
          {snapshot.team ? t('من بناه', 'Who built it') : t('صاحب المشروع', 'Built by')}
        </h2>

        {snapshot.team ? (
          <>
            <p className="muted" style={{ fontSize: '0.86rem', margin: '8px 0 12px' }}>
              {snapshot.team.title}
              <span className="eng"> · {snapshot.team.code}</span>
            </p>
            <table className="exhibit-members">
              <thead>
                <tr>
                  <th scope="col">{t('العضو', 'Member')}</th>
                  <th scope="col">{t('دوره في المشروع', 'Their part')}</th>
                  <th scope="col">{t('مهام منجزة', 'Tasks closed')}</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot.members ?? []).map((member) => (
                  <tr key={member.profile_id}>
                    <td>
                      <Link href={`/u/${member.techmood_id}`}>{member.full_name}</Link>
                    </td>
                    <td className="muted">{member.responsibility ?? t('—', '—')}</td>
                    <td className="eng">{member.tasks_done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              {t('نصيب كل عضو محسوب من المهام التي أغلقها على لوحة الفريق، لا من وصف كتبه عن نفسه.',
                 'Each share is counted from the tasks that person closed on the team board, not from a description they wrote about themselves.')}
            </p>
          </>
        ) : snapshot.creator ? (
          <p style={{ fontSize: '0.92rem', marginTop: 8 }}>
            <Link href={`/u/${snapshot.creator.techmood_id}`}>{snapshot.creator.full_name}</Link>
            <span className="muted eng"> · {snapshot.creator.techmood_id}</span>
          </p>
        ) : null}

        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10 }}>
          {t('أُنجز في ', 'Completed ')}<span className="eng">{snapshot.completed_on}</span>
          {' · '}
          {t('عُرض في ', 'Exhibited ')}{formatDate(locale, entry.published_at)}
        </p>
      </section>

      {/* ---- the judgement ---- */}
      {evaluation && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('تقييم المنتور', 'Mentor evaluation')}</h2>

          <div className="exhibit-headline" style={{ marginTop: 10 }}>
            <span className="exhibit-rating">
              <Stars value={evaluation.rating} />
              {evaluation.rating != null && <span className="eng">{evaluation.rating.toFixed(1)} / 5</span>}
            </span>
            <span className="muted" style={{ fontSize: '0.8rem' }}>{t('جودة العمل', 'Quality of the work')}</span>
          </div>

          <table className="exhibit-criteria">
            <tbody>
              {CRITERIA.map((criterion) => {
                const stars = evaluation.criteria?.[criterion];
                if (stars === undefined) return null;
                return (
                  <tr key={criterion}>
                    <th scope="row">{CRITERION_LABEL[criterion][locale]}</th>
                    <td><Stars value={stars} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {evaluation.feedback && (
            <div className="exhibit-block">
              <h3>{t('ملاحظات المنتور', 'Mentor feedback')}</h3>
              <p>{evaluation.feedback}</p>
            </div>
          )}

          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
            {t('قيّمه ', 'Evaluated by ')}
            <Link href={`/u/${evaluation.mentor_id}`}>{evaluation.mentor_name}</Link>
            {' · '}<span className="eng">{evaluation.reviewed_on}</span>
          </p>

          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 8 }}>
            {t('النجوم جودة العمل. نقاط XP التي حصل عليها من بنوه شيء آخر تماماً: هي تقدّمهم داخل TechMood، ولا تُحسب من هذا التقييم ولا يُحسب منها.',
               'Stars are the quality of the work. The XP its builders earned is something else entirely: their progress inside TechMood. Neither is computed from the other.')}
          </p>
        </section>
      )}

      {/* ---- evidence ---- */}
      {(snapshot.evidence ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('الأدلة', 'Evidence')}</h2>
          <ul className="lesson-links">
            {snapshot.evidence.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">{item.label ?? item.kind}</a>
                <span className="muted eng"> · {item.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.documentation && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('التوثيق', 'Documentation')}</h2>
          <p style={{ fontSize: '0.9rem', marginTop: 8, whiteSpace: 'pre-wrap' }}>{snapshot.documentation}</p>
        </section>
      )}

      {history.length > 1 && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('كيف وصل إلى هنا', 'How it got here')}</h2>
          <ol className="timeline" style={{ marginTop: 12 }}>
            {history.map((review) => (
              <li className={review.decision === 'approved' ? 'done' : ''} key={`${review.version}-${review.reviewed_on}`}>
                <span className="tl-dot" aria-hidden />
                <span className="tl-label">
                  <span className="eng">v{review.version}</span>
                  {' · '}
                  {review.decision === 'approved'
                    ? t('اعتمده منتور', 'A mentor approved it')
                    : t('أُعيد لأصحابه للتعديل', 'Sent back to its builders')}
                  {review.rating !== null && <span className="eng"> · {review.rating}/5</span>}
                  <span className="muted eng"> · {formatDate(locale, review.reviewed_on)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
            {t('النسخة المعروضة هي المعتمدة. ملاحظات المنتور على النسخ السابقة كُتبت لأصحاب العمل ولا تظهر هنا.',
               'What is on the wall is the approved version. The mentor’s notes on earlier versions were written to the builders and are not shown here.')}
          </p>
        </section>
      )}

      {/* ---- verification ---- */}
      <section className="panel section-block">
        <h2 style={{ fontSize: '1rem' }}>{t('تحقّق من هذا المشروع', 'Verify this project')}</h2>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
          {t('امسح الرمز أو افتح الرابط: يفتح صفحة تحقّق مستقلة تعمل بلا حساب — ضعها في سيرتك أو عرضك التقديمي.',
             'Scan it or open the link: it resolves to a standalone verification page that works without an account — put it on a CV or in a deck.')}
        </p>
        <div className="cert-qr" style={{ marginTop: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={t('رمز التحقق', 'Verification QR')} />
          <Link className="eng" href={`/exhibition/${entry.entry_code}/verify`} style={{ fontSize: '0.76rem' }}>
            {verifyUrl}
          </Link>
        </div>
      </section>

      <p className="muted" style={{ fontSize: '0.76rem', textAlign: 'center', margin: '24px 0 48px' }}>
        {t('هذه الصفحة تعرض النسخة المعتمدة من المشروع كما جُمّدت لحظة اعتمادها. ',
           'This page shows the approved version of the project, exactly as it was frozen when it was approved. ')}
        <span className="eng">{entry.entry_code}</span>
      </p>
    </main>
  );
}
