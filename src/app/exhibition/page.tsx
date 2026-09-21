import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { ExhibitionExplorer } from './ExhibitionExplorer';
import type { GalleryEntry } from './types';
import { LogoMark } from '@/components/Logo';

export const metadata = {
  title: 'TechMood Exhibition',
  description: 'Real projects built by TechMood students and teams, evaluated by mentors and verified.',
};

/**
 * The public gallery.
 *
 * It reads snapshots only — the teams behind these projects are mostly private
 * workspaces, and exhibiting a project must not open them. What separates this
 * from a gallery of screenshots is on every card: a mentor judged the work
 * against criteria, and the work was published by the people who built it
 * after that judgement, not before.
 */
export default async function ExhibitionPage() {
  const t = await getT();
  const supabase = await createClient();

  const [{ data }, { data: featuredRows }] = await Promise.all([
    supabase
      .from('exhibition_gallery')
      .select('entry_code, published_at, snapshot')
      .order('published_at', { ascending: false }),
    supabase.rpc('exhibition_featured', { p_limit: 3 }),
  ]);

  const entries = (data ?? []) as GalleryEntry[];
  const featured = (featuredRows ?? []) as GalleryEntry[];

  // Counted from what is on the wall, not from a number kept somewhere.
  const teams = new Set(entries.map((entry) => entry.snapshot.team?.code).filter(Boolean));
  const builders = new Set<string>();
  const mentors = new Set<string>();
  for (const entry of entries) {
    for (const member of entry.snapshot.members ?? []) builders.add(member.profile_id);
    if (entry.snapshot.creator) builders.add(entry.snapshot.creator.profile_id);
    if (entry.snapshot.evaluation) mentors.add(entry.snapshot.evaluation.mentor_id);
  }

  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <LogoMark />
          TechMood
        </Link>
        <Link className="btn btn-primary btn-sm" href="/signup">{t('ابدأ رحلتك', 'Start your journey')}</Link>
      </nav>

      <section style={{ padding: '48px 0 24px', textAlign: 'center' }}>
        <p className="kicker">Exhibition</p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', marginTop: 10 }}>
          {t('معرض أعمال TechMood', 'The TechMood exhibition')}
        </h1>
        <p className="muted" style={{ marginTop: 12, fontSize: '0.98rem', maxWidth: '62ch', marginInline: 'auto' }}>
          {t('مشاريع بناها طلاب وفرق TechMood، قيّمها منتور معياراً معياراً، ثم اختار أصحابها عرضها. ليس ما بنيته فقط — بل ما تعلّمته وسلّمته وأثبتّه.',
             'Projects built by TechMood students and teams, judged by a mentor criterion by criterion, then put on the wall by the people who built them. Not just what you built — what you learned, delivered, and proved.')}
        </p>
      </section>

      <section className="stat-tiles" style={{ marginBottom: 28 }}>
        <div className="stat-tile">
          <span className="val eng">{entries.length}</span>
          <span className="lbl">{t('مشاريع معروضة', 'Projects exhibited')}</span>
        </div>
        <div className="stat-tile">
          <span className="val eng">{builders.size}</span>
          <span className="lbl">{t('من بنوها', 'People who built them')}</span>
        </div>
        <div className="stat-tile">
          <span className="val eng">{teams.size}</span>
          <span className="lbl">{t('فرق', 'Teams')}</span>
        </div>
        <div className="stat-tile">
          <span className="val eng">{mentors.size}</span>
          <span className="lbl">{t('منتورون قيّموا', 'Mentors who evaluated')}</span>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section-block">
          <h2 className="academy-heading">{t('مشاريع مميّزة', 'Featured projects')}</h2>
          <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
            {t('كل مشروع هنا استوفى الشرط نفسه: تقييم كامل على المعايير الستة بمتوسط ٤٫٥ فأعلى، وما بُني موصوف، ودليل يمكن فتحه. لا ترتيب ولا أرقام — من استوفى الشرط ظهر.',
               'Every project here met the same bar: a full rubric averaging 4.5 or better, a described outcome, and evidence anyone can open. No ranking and no numbers — whatever clears the bar is here.')}
          </p>
          <div className="card-grid">
            {featured.map((entry) => (
              <article className="card exhibit-card exhibit-featured" key={entry.entry_code}>
                <div className="row-between academy-card-head">
                  <span className="kicker">{t('مميّز', 'Featured')}</span>
                  <span className="id-chip">{entry.snapshot.project_code}</span>
                </div>
                <h3>{entry.snapshot.project_title}</h3>
                <p className="exhibit-builder">
                  {entry.snapshot.team?.title ?? entry.snapshot.creator?.full_name}
                </p>
                <p>{entry.snapshot.summary}</p>
                {entry.snapshot.evaluation?.rating != null && (
                  <p className="exhibit-rating">
                    <Stars value={entry.snapshot.evaluation.rating} />
                    <span className="eng">{entry.snapshot.evaluation.rating.toFixed(1)} / 5</span>
                  </p>
                )}
                <Link className="btn btn-ghost btn-sm" href={`/exhibition/${entry.entry_code}`}>
                  {t('عرض المشروع', 'View project')}
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {entries.length === 0 ? (
        <p className="notice">{t('لا مشاريع معروضة بعد.', 'Nothing on the wall yet.')}</p>
      ) : (
        <ExhibitionExplorer entries={entries} />
      )}
    </main>
  );
}
