import Link from 'next/link';
import QRCode from 'qrcode';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { Database } from '@/lib/database.types';

import { KIND_LABEL } from '../../types';
import { LogoMark } from '@/components/Logo';

type Verified = Database['public']['Functions']['verify_exhibition_entry']['Returns'][number];

export const metadata = { title: 'Verify a project — TechMood' };

/**
 * What a QR scan answers.
 *
 * The page a code resolves to for somebody who has never heard of TechMood: is
 * this real, who built it, who judged it, and what did they give it. It reads
 * through verify_exhibition_entry(), which answers for exhibited work only —
 * a project a mentor approved but its builders have not published is nobody
 * else's business, and a withdrawn project stops verifying, because the code
 * has to follow the decision rather than outlive it.
 */
export default async function VerifyProjectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { code } = await params;
  const supabase = await createClient();

  const entryCode = decodeURIComponent(code).toUpperCase();
  const [{ data }, { data: historyRows }] = await Promise.all([
    supabase.rpc('verify_exhibition_entry', { p_code: entryCode }),
    supabase.rpc('exhibition_entry_history', { p_code: entryCode }),
  ]);

  const project = ((data ?? []) as Verified[])[0] ?? null;
  const history = historyRows ?? [];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmood.io';
  const verifyUrl = `${siteUrl}/exhibition/${encodeURIComponent(project?.entry_code ?? entryCode)}/verify`;
  const qrDataUrl = project ? await QRCode.toDataURL(verifyUrl, { margin: 1, width: 264 }) : null;

  return (
    <main className="landing" style={{ maxWidth: 720 }}>
      <nav className="landing-nav no-print">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/exhibition">{t('المعرض', 'The exhibition')}</Link>
      </nav>

      {!project ? (
        <section className="panel" style={{ marginTop: 32 }}>
          <h1 style={{ fontSize: '1.1rem' }}>{t('لا مشروع موثّق بهذا الرقم', 'No verified project with that number')}</h1>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
            {t('الرقم ', 'The number ')}
            <span className="id-chip">{entryCode}</span>
            {t(' غير معروض في TechMood. قد يكون الرقم خاطئاً، أو سحب أصحابه المشروع من المعرض.',
               ' is not on the TechMood wall. Either the number is wrong, or its builders took the project down.')}
          </p>
        </section>
      ) : (
        <>
          <section className="cert" style={{ marginTop: 28 }}>
            <p className="cert-kicker">TECHMOOD PROJECT VERIFICATION</p>
            <p className="cert-name">{project.project_title}</p>

            <p className="muted" style={{ fontSize: '0.92rem' }}>
              {project.built_by}
              <span className="muted"> · {project.is_team ? t('مشروع فريق', 'Team project') : t('مشروع فردي', 'Solo project')}</span>
            </p>

            <div className="exhibit-headline" style={{ justifyContent: 'center' }}>
              {project.rating !== null && (
                <span className="exhibit-rating">
                  <Stars value={project.rating} />
                  <span className="eng">{project.rating.toFixed(1)} / 5</span>
                </span>
              )}
              <span className="status-pill status-ok">{t('✓ موثّق من TechMood', '✓ TechMood verified')}</span>
            </div>

            <dl className="verify-rows">
              <div>
                <dt>{t('رقم المشروع', 'Project number')}</dt>
                <dd className="eng">{project.entry_code}</dd>
              </div>
              <div>
                <dt>{t('نوع المشروع', 'Project type')}</dt>
                <dd>{KIND_LABEL[project.kind]?.[locale] ?? project.kind}</dd>
              </div>
              {project.path_title && (
                <div>
                  <dt>{t('المسار', 'Learning path')}</dt>
                  <dd>{project.path_title}</dd>
                </div>
              )}
              <div>
                <dt>{t('أُنجز في', 'Completed')}</dt>
                <dd className="eng">{project.completed_on}</dd>
              </div>
              {project.mentor_name && (
                <div>
                  <dt>{t('قيّمه', 'Evaluated by')}</dt>
                  <dd>{project.mentor_name}<span className="muted eng"> · {project.reviewed_on}</span></dd>
                </div>
              )}
              <div>
                <dt>{t('عُرض في', 'Exhibited')}</dt>
                <dd>{formatDate(locale, project.published_at)}</dd>
              </div>
            </dl>

            {qrDataUrl && (
              <div className="cert-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={t('رمز التحقق', 'Verification QR')} />
                <span className="muted eng" style={{ fontSize: '0.72rem' }}>{verifyUrl}</span>
              </div>
            )}
          </section>

          {history.length > 1 && (
            <section className="panel section-block no-print">
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
                {t('ملاحظات المنتور لا تظهر هنا: كُتبت لأصحاب العمل، وهم وحدهم من يقرؤها.',
                   'The mentor’s written notes are not shown here: they were written to the builders, and only they read them.')}
              </p>
            </section>
          )}

          <p className="muted no-print" style={{ fontSize: '0.78rem', textAlign: 'center', margin: '20px 0 48px' }}>
            <Link href={`/exhibition/${project.entry_code}`}>{t('افتح صفحة المشروع في المعرض', 'Open the project on the wall')}</Link>
          </p>
        </>
      )}
    </main>
  );
}
