import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { LinkedInAddCertificate } from '@/components/LinkedInButton';
import { linkedInCertificateUrl } from '@/lib/linkedin';
import { siteOrigin } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';

import { IssueCertificateButton } from './IssueCertificateButton';

export const generateMetadata = localizedTitle('شهاداتي — TechMood', 'My certificates — TechMood');

export default async function CertificatesPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: certificates }, { data: courses }, { data: paths }] = await Promise.all([
    supabase
      .from('certificates')
      .select('certificate_code, kind, issued_at, snapshot')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .order('issued_at', { ascending: false }),
    supabase.from('courses').select('id, slug, title_ar').eq('status', 'published'),
    supabase.from('learning_paths').select('id, slug, title_ar').eq('status', 'published'),
  ]);

  const origin = await siteOrigin();
  const issuedCourseIds = new Set<string>();
  const issuedPathIds = new Set<string>();

  // Which of the catalogue is finished but not yet claimed?
  const eligibleCourses: { id: string; title_ar: string }[] = [];
  for (const course of courses ?? []) {
    const { data } = await supabase.rpc('is_course_complete', { p_profile: user.id, p_course: course.id });
    if (data === true) eligibleCourses.push(course);
  }

  const eligiblePaths: { id: string; title_ar: string }[] = [];
  for (const path of paths ?? []) {
    const { data } = await supabase.rpc('is_path_complete', { p_profile: user.id, p_path: path.id });
    if (data === true) eligiblePaths.push(path);
  }

  for (const certificate of certificates ?? []) {
    const match = (courses ?? []).find((course) => course.title_ar === certificate.snapshot?.title);
    if (certificate.kind === 'course' && match) issuedCourseIds.add(match.id);
    const pathMatch = (paths ?? []).find((path) => path.title_ar === certificate.snapshot?.title);
    if (certificate.kind === 'path' && pathMatch) issuedPathIds.add(pathMatch.id);
  }

  const claimableCourses = eligibleCourses.filter((course) => !issuedCourseIds.has(course.id));
  const claimablePaths = eligiblePaths.filter((path) => !issuedPathIds.has(path.id));

  const readyCount = claimableCourses.length + claimablePaths.length;

  return (
    <>
      <section className="section-block">
        <h1 className="st-title" style={{ marginBottom: 4 }}>{t('شهاداتي', 'My certificates')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: '70ch' }}>
          {t('كل شهادة تحمل رقماً فريداً ورمز QR يقود إلى صفحة تحقق عامة، ويمكن لأي جهة التأكد منها دون الحاجة لحساب.',
             'Every certificate carries a unique number and a QR code that lead to a public verification page — anyone can check it without an account.')}
        </p>
      </section>

      {readyCount > 0 && (
        <section className="ct-ready section-block">
          <div className="ct-ready-head">
            <span aria-hidden="true">🎉</span>
            <div>
              <strong>{t(`${readyCount} ${readyCount === 1 ? 'شهادة جاهزة' : 'شهادات جاهزة'} للإصدار`, `${readyCount} ready to issue`)}</strong>
              <p>{t('أنهيت ما يلزم — أصدرها لتظهر على جوازك المهني.', 'You finished what it takes — issue it to put it on your passport.')}</p>
            </div>
          </div>
          <ul className="ct-ready-list">
            {claimableCourses.map((course) => (
              <li key={course.id}>
                <span className="ct-ready-kind">{t('دورة', 'Course')}</span>
                <span className="ct-ready-title">{course.title_ar}</span>
                <IssueCertificateButton kind="course" targetId={course.id} />
              </li>
            ))}
            {claimablePaths.map((path) => (
              <li key={path.id}>
                <span className="ct-ready-kind is-path">{t('مسار', 'Path')}</span>
                <span className="ct-ready-title">{path.title_ar}</span>
                <IssueCertificateButton kind="path" targetId={path.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section-block">
        {(certificates?.length ?? 0) === 0 ? (
          <div className="hm-card hm-empty">
            <span className="hm-empty-icon" aria-hidden="true">🎓</span>
            <div>
              <strong>{t('لا شهادات بعد', 'No certificates yet')}</strong>
              <p className="muted">
                {t('أكمل دروس دورة كاملة واحصل على اعتماد منتور لأعمالها المطلوبة، وستظهر الشهادة هنا جاهزة للإصدار.',
                   'Finish a whole course\u2019s lessons and get a mentor to approve its required work, and the certificate will appear here ready to issue.')}
              </p>
            </div>
            <Link className="btn btn-primary btn-sm" href="/academy">{t('إلى الأكاديمية', 'To the academy')}</Link>
          </div>
        ) : (
          <div className="ct-grid">
            {certificates!.map((certificate) => (
              <article className={`ct-card${certificate.kind === 'path' ? ' is-path' : ''}`} key={certificate.certificate_code}>
                <div className="ct-ribbon">
                  <span className="ct-seal" aria-hidden="true">{certificate.kind === 'path' ? '🏆' : '🎓'}</span>
                  <span>{certificate.kind === 'path' ? t('شهادة مسار', 'Path certificate') : t('شهادة دورة', 'Course certificate')}</span>
                </div>
                <div className="ct-body">
                  <h3>{certificate.snapshot?.title}</h3>
                  <p className="muted">
                    {t('صدرت في ', 'Issued ')}<span className="date">{formatDate(t.locale, certificate.issued_at)}</span>
                  </p>
                  <span className="id-chip">{certificate.certificate_code}</span>
                </div>
                <div className="ct-linkedin">
                  <LinkedInAddCertificate href={linkedInCertificateUrl({
                    name: certificate.snapshot?.title_en || certificate.snapshot?.title || 'TechMood Certificate',
                    code: certificate.certificate_code,
                    issuedAt: certificate.issued_at,
                    verifyUrl: `${origin}/verify/${certificate.certificate_code}`,
                  })} />
                </div>
                <Link className="ct-open" href={`/verify/${certificate.certificate_code}`}>
                  {t('عرض الشهادة والتحقق', 'View and verify')} <Icon name="arrow" size={14} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
