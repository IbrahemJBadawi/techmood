import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import type { ExhibitionSnapshot } from '@/lib/database.types';

export const metadata = { title: 'مشروع في معرض TechMood' };

export default async function ExhibitionEntryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from('exhibition_gallery')
    .select('entry_code, published_at, snapshot')
    .eq('entry_code', decodeURIComponent(code).toUpperCase())
    .maybeSingle();

  return (
    <main className="landing" style={{ maxWidth: 860 }}>
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <span className="logo-mark" />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/exhibition">كل المعرض</Link>
      </nav>

      {!entry ? (
        <section className="panel" style={{ marginTop: 32 }}>
          <h1 style={{ fontSize: '1.1rem' }}>لا يوجد مشروع بهذا الرقم</h1>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
            الرقم <span className="id-chip">{decodeURIComponent(code)}</span> غير منشور في المعرض.
          </p>
        </section>
      ) : (
        (() => {
          const snapshot = entry.snapshot as ExhibitionSnapshot;
          return (
            <>
              <section className="panel" style={{ marginTop: 28 }}>
                <div className="row-between">
                  <span className="id-chip">{snapshot.project_code}</span>
                  <span className="badge-pill eng">{entry.entry_code}</span>
                </div>

                <h1 style={{ fontSize: '1.45rem', marginTop: 12 }}>{snapshot.project_title}</h1>
                <p className="muted" style={{ fontSize: '0.95rem', marginTop: 10 }}>{snapshot.summary}</p>

                <div className="tags-row" style={{ marginTop: 14 }}>
                  {(snapshot.technologies ?? []).map((tech) => (
                    <span className="tag eng" key={tech}>{tech}</span>
                  ))}
                </div>

                <div className="tags-row" style={{ marginTop: 14 }}>
                  {snapshot.team && <span className="badge-pill">{snapshot.team.title}</span>}
                  <span className="badge-pill eng">اكتمل {snapshot.completed_on}</span>
                </div>

                {snapshot.demo_url && (
                  <a
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 16 }}
                    href={snapshot.demo_url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    شاهد العرض التجريبي ↗
                  </a>
                )}
              </section>

              {snapshot.description && (
                <section className="panel section-block" style={{ marginTop: 18 }}>
                  <h2 style={{ fontSize: '1rem', marginBottom: 8 }}>عن المشروع</h2>
                  <p style={{ fontSize: '0.9rem' }}>{snapshot.description}</p>
                </section>
              )}

              <section className="panel section-block">
                <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>من بنى هذا المشروع</h2>
                <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
                  نصيب كل عضو محسوب من المهام التي أنجزها فعلاً على لوحة الفريق.
                </p>

                <table className="data">
                  <thead>
                    <tr><th>العضو</th><th>TechMood ID</th><th>المسؤولية</th><th>مهام منجزة</th></tr>
                  </thead>
                  <tbody>
                    {(snapshot.members ?? []).map((member) => (
                      <tr key={member.profile_id}>
                        <td>{member.full_name}</td>
                        <td><span className="id-chip">{member.techmood_id}</span></td>
                        <td>{member.responsibility ?? '—'}</td>
                        <td className="eng">{member.tasks_done}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {(snapshot.mentors?.length ?? 0) > 0 && (
                <section className="panel section-block">
                  <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>مراجعة المنتور</h2>
                  {snapshot.mentors.map((mentor) => (
                    <div className="row-between" key={mentor.full_name} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: '0.9rem' }}>{mentor.full_name}</span>
                      <Stars value={mentor.stars} />
                    </div>
                  ))}
                </section>
              )}

              {(snapshot.evidence?.length ?? 0) > 0 && (
                <section className="panel section-block">
                  <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>المخرجات والتوثيق</h2>
                  <div className="tags-row">
                    {snapshot.evidence.map((item) => (
                      <a
                        key={item.url}
                        className="badge-pill"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ textDecoration: 'none' }}
                      >
                        ↗ {item.label ?? item.kind}
                      </a>
                    ))}
                  </div>
                  {snapshot.documentation && (
                    <p className="muted" style={{ fontSize: '0.88rem', marginTop: 12 }}>
                      {snapshot.documentation}
                    </p>
                  )}
                </section>
              )}
            </>
          );
        })()
      )}
    </main>
  );
}
