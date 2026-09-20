import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import type { ExhibitionSnapshot } from '@/lib/database.types';

export const metadata = {
  title: 'معرض أعمال TechMood',
  description: 'مشاريع حقيقية نفّذتها فرق TechMood، موثّقة بمن بناها وبماذا.',
};

/**
 * The public gallery. It reads snapshots only — the teams behind these projects
 * are mostly private workspaces, and publishing a project must not open them.
 */
export default async function ExhibitionPage() {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from('exhibition_gallery')
    .select('entry_code, published_at, snapshot')
    .order('published_at', { ascending: false });

  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <span className="logo-mark" />
          TechMood
        </Link>
        <Link className="btn btn-primary btn-sm" href="/signup">ابدأ رحلتك</Link>
      </nav>

      <section style={{ padding: '48px 0 28px', textAlign: 'center' }}>
        <p className="kicker">Exhibition</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', marginTop: 10 }}>معرض الأعمال</h1>
        <p className="muted" style={{ marginTop: 12, fontSize: '0.98rem' }}>
          مشاريع أنجزتها فرق TechMood ومرّت بمراجعة. كل مشروع موثّق بمن بناه، وبنصيب كل عضو
          من العمل — محسوباً من المهام المنجزة، لا من وصف كتبه أحد عن نفسه.
        </p>
      </section>

      {(entries?.length ?? 0) === 0 ? (
        <p className="notice">لا مشاريع منشورة بعد.</p>
      ) : (
        <div className="card-grid">
          {entries!.map((entry) => {
            const snapshot = entry.snapshot as ExhibitionSnapshot;
            return (
              <article className="card" key={entry.entry_code}>
                <div className="row-between">
                  <span className="id-chip">{snapshot.project_code}</span>
                  <span className="muted eng" style={{ fontSize: '0.74rem' }}>{snapshot.completed_on}</span>
                </div>

                <h3>{snapshot.project_title}</h3>
                <p>{snapshot.summary}</p>

                <div className="tags-row">
                  {(snapshot.technologies ?? []).slice(0, 4).map((tech) => (
                    <span className="tag eng" key={tech}>{tech}</span>
                  ))}
                </div>

                <div className="row-between" style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                  <span>{snapshot.team?.title ?? 'مشروع فردي'}</span>
                  <span>👥 {snapshot.members?.length ?? 0}</span>
                </div>

                <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
                  عرض المشروع
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
