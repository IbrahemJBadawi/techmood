import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { IssueCertificateButton } from './IssueCertificateButton';

export default async function CertificatesPage() {
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

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>الشهادات</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          كل شهادة تحمل رقماً فريداً ورمز QR يقود إلى صفحة تحقق عامة، ويمكن لأي جهة التأكد منها
          دون الحاجة لحساب.
        </p>
      </section>

      {(claimableCourses.length > 0 || claimablePaths.length > 0) && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>جاهزة للإصدار</h3>
          {claimableCourses.map((course) => (
            <div className="row-between" key={course.id} style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>{course.title_ar}</span>
              <IssueCertificateButton kind="course" targetId={course.id} />
            </div>
          ))}
          {claimablePaths.map((path) => (
            <div className="row-between" key={path.id} style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>{path.title_ar} — شهادة مسار</span>
              <IssueCertificateButton kind="path" targetId={path.id} />
            </div>
          ))}
        </section>
      )}

      <section>
        {(certificates?.length ?? 0) === 0 ? (
          <p className="notice">
            لا شهادات بعد. أكمل دروس دورة كاملة واحصل على اعتماد منتور لأعمالها المطلوبة، وستظهر
            الشهادة هنا جاهزة للإصدار.
          </p>
        ) : (
          <div className="card-grid">
            {certificates!.map((certificate) => (
              <article className="card" key={certificate.certificate_code}>
                <span className="badge-pill">
                  {certificate.kind === 'path' ? 'شهادة مسار' : 'شهادة دورة'}
                </span>
                <h3>{certificate.snapshot?.title}</h3>
                <span className="id-chip">{certificate.certificate_code}</span>
                <p className="muted eng" style={{ fontSize: '0.78rem' }}>
                  {new Date(certificate.issued_at).toLocaleDateString('ar-EG')}
                </p>
                <Link className="btn btn-ghost btn-sm" href={`/verify/${certificate.certificate_code}`}>
                  عرض الشهادة والتحقق
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
