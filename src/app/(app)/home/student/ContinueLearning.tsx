import Link from 'next/link';

export type Resume = {
  path_slug: string;
  path_title: string;
  course_slug: string;
  course_title: string;
  lesson_title: string;
  path_percent: number;
  course_percent: number;
  last_activity: string;
} | null;

export function ContinueLearning({ resume }: { resume: Resume }) {
  if (!resume) {
    return (
      <article className="panel resume-card is-empty">
        <h3>ابدأ أول مسار</h3>
        <p className="muted">
          لم تبدأ التعلّم بعد. المسارات مفتوحة دائماً — لا دفعات ولا انتظار.
        </p>
        <Link className="btn btn-primary btn-sm" href="/academy">تصفّح المسارات</Link>
      </article>
    );
  }

  return (
    <article className="panel resume-card">
      <p className="kicker">أكمل من حيث توقّفت</p>
      <h3>{resume.path_title}</h3>
      <p className="resume-course">{resume.course_title}</p>
      <p className="resume-lesson">{resume.lesson_title}</p>

      <div className="resume-bars">
        <div>
          <div className="row-between">
            <span className="muted">تقدّم الدورة</span>
            <span className="eng">{resume.course_percent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${resume.course_percent}%` }} />
          </div>
        </div>
        <div>
          <div className="row-between">
            <span className="muted">تقدّم المسار</span>
            <span className="eng">{resume.path_percent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${resume.path_percent}%` }} />
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.78rem' }}>
        آخر نشاط: {new Date(resume.last_activity).toLocaleDateString('ar')}
      </p>

      <Link className="btn btn-primary" href={`/academy/${resume.path_slug}/${resume.course_slug}`}>
        ▶ تابع التعلّم
      </Link>
    </article>
  );
}
