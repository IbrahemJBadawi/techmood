import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { ExhibitionSnapshot } from '@/lib/database.types';

export const metadata = {
  title: 'TechMood Exhibition',
  description: 'Real projects built by TechMood teams, credited to the people who built them.',
};

/**
 * The public gallery. It reads snapshots only — the teams behind these projects
 * are mostly private workspaces, and publishing a project must not open them.
 */
export default async function ExhibitionPage() {
  const t = await getT();
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
        <Link className="btn btn-primary btn-sm" href="/signup">{t('ابدأ رحلتك', 'Start your journey')}</Link>
      </nav>

      <section style={{ padding: '48px 0 28px', textAlign: 'center' }}>
        <p className="kicker">Exhibition</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', marginTop: 10 }}>
          {t('معرض الأعمال', 'The exhibition')}
        </h1>
        <p className="muted" style={{ marginTop: 12, fontSize: '0.98rem' }}>
          {t('مشاريع أنجزتها فرق TechMood ومرّت بمراجعة. كل مشروع موثّق بمن بناه، وبنصيب كل عضو من العمل — محسوباً من المهام المنجزة، لا من وصف كتبه أحد عن نفسه.',
             'Projects finished by TechMood teams and put through review. Each one is credited to the people who built it, with each member\u2019s share of the work counted from the tasks they closed — not from a description somebody wrote about themselves.')}
        </p>
      </section>

      {(entries?.length ?? 0) === 0 ? (
        <p className="notice">{t('لا مشاريع منشورة بعد.', 'Nothing published yet.')}</p>
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
                  <span>{snapshot.team?.title ?? t('مشروع فردي', 'Solo project')}</span>
                  <span>👥 {snapshot.members?.length ?? 0}</span>
                </div>

                <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
                  {t('عرض المشروع', 'View project')}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
