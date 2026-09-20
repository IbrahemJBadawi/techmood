import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export default async function PathPage({ params }: { params: Promise<{ pathSlug: string }> }) {
  const { pathSlug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: path } = await supabase
    .from('learning_paths')
    .select('id, slug, title_ar, description_ar, tagline_ar, tags, estimated_hours')
    .eq('slug', pathSlug)
    .single();

  if (!path) notFound();

  const { data: pathCourses } = await supabase
    .from('path_courses')
    .select('is_required, sort_order, courses(id, slug, title_ar, description_ar, estimated_hours)')
    .eq('path_id', path.id)
    .order('sort_order');

  const courses = (pathCourses ?? []).map((row) => ({
    ...(row.courses as unknown as { id: string; slug: string; title_ar: string; description_ar: string | null; estimated_hours: number | null }),
    isRequired: row.is_required,
  }));

  // Completion is asked of the database so the UI and the certificate rule can
  // never disagree about what "complete" means.
  const completion = await Promise.all(
    courses.map(async (course) => {
      const { data } = await supabase.rpc('is_course_complete', { p_profile: user.id, p_course: course.id });
      return { courseId: course.id, complete: data === true };
    }),
  );

  const { data: pathComplete } = await supabase.rpc('is_path_complete', { p_profile: user.id, p_path: path.id });

  const { data: groupProject } = await supabase
    .from('assignments')
    .select('id, title_ar, brief_ar, required_evidence')
    .eq('path_id', path.id)
    .eq('kind', 'path_project')
    .maybeSingle();

  const doneCount = completion.filter((item) => item.complete).length;
  const percent = courses.length ? Math.round((doneCount / courses.length) * 100) : 0;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/academy">→ رجوع للأكاديمية</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="tags-row">
          {path.tags?.map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
        </div>
        <h2 style={{ fontSize: '1.25rem', marginTop: 10 }}>{path.title_ar}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>{path.description_ar}</p>
        {path.tagline_ar && (
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 8 }}>{path.tagline_ar}</p>
        )}

        <div className="row-between" style={{ marginTop: 18 }}>
          <span className="muted" style={{ fontSize: '0.82rem' }}>الدورات المكتملة</span>
          <span className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)' }}>
            {doneCount}/{courses.length} · {percent}%
          </span>
        </div>
        <div className="progress-track" style={{ marginTop: 6 }}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <div className="detail-grid">
        <section>
          {courses.map((course, index) => {
            const complete = completion.find((item) => item.courseId === course.id)?.complete;
            return (
              <article className="card section-block" key={course.id}>
                <div className="row-between">
                  <span className="muted eng" style={{ fontSize: '0.76rem' }}>
                    Course {index + 1} / {courses.length}
                  </span>
                  <span className={`status-pill ${complete ? 'status-ok' : 'status-muted'}`}>
                    {complete ? 'مكتملة' : course.isRequired ? 'مطلوبة' : 'اختيارية'}
                  </span>
                </div>
                <h3>{course.title_ar}</h3>
                <p>{course.description_ar}</p>
                <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}/${course.slug}`}>
                  افتح الدورة
                </Link>
              </article>
            );
          })}
        </section>

        <aside>
          {groupProject && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>🏆 {groupProject.title_ar}</h3>
              <span className="badge-pill" style={{ marginTop: 8 }}>مشروع جماعي</span>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 10 }}>{groupProject.brief_ar}</p>
            </div>
          )}

          <div className="panel">
            <h3 style={{ fontSize: '0.98rem' }}>شهادة المسار</h3>
            <p className="muted" style={{ fontSize: '0.84rem', marginTop: 8 }}>
              {pathComplete
                ? 'اكتملت متطلبات المسار — يمكنك إصدار شهادته من صفحة الشهادات.'
                : 'تُصدَر بعد اعتماد كل الأعمال المطلوبة في دورات المسار ومشروعه الجماعي.'}
            </p>
            {pathComplete && (
              <Link className="btn btn-sky btn-sm" style={{ marginTop: 10 }} href="/certificates">
                إصدار الشهادة
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
