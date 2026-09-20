import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

export default async function AcademyPage() {
  const supabase = await createClient();

  const { data: schools } = await supabase
    .from('schools')
    .select('id, slug, name_ar')
    .order('sort_order');

  const { data: paths } = await supabase
    .from('learning_paths')
    .select('id, slug, school_id, title_ar, description_ar, tagline_ar, tags, estimated_hours')
    .eq('status', 'published')
    .order('sort_order');

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>الأكاديمية</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          كل دورة تُكمَل بمشروع يُراجَع، وكل مسار يُختم بمشروع جماعي. الشهادة تأتي من العمل المعتمد،
          لا من عدد الدروس المفتوحة.
        </p>
      </section>

      {(schools ?? []).map((school) => {
        const schoolPaths = (paths ?? []).filter((path) => path.school_id === school.id);
        if (schoolPaths.length === 0) return null;

        return (
          <section className="section-block" key={school.id}>
            <h3 style={{ fontSize: '0.98rem', marginBottom: 12 }}>{school.name_ar}</h3>
            <div className="card-grid">
              {schoolPaths.map((path) => (
                <article className="card" key={path.id}>
                  <div className="tags-row">
                    {path.tags?.map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
                  </div>
                  <h3>{path.title_ar}</h3>
                  <p>{path.description_ar}</p>
                  {path.estimated_hours && (
                    <p className="muted eng" style={{ fontSize: '0.76rem' }}>~{path.estimated_hours}h</p>
                  )}
                  <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}`}>ابدأ المسار</Link>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
