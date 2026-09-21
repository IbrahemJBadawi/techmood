import Link from 'next/link';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { levelInfo } from '@/lib/xp';

export const metadata = { title: 'A TechMood profile' };

/**
 * The public side of a TechMood identity.
 *
 * This is what a project in the exhibition links to, and what a CV can point
 * at: one account, one id, one record. It shows only what the person has
 * already made public — the profile flag decides, in the database, not here —
 * and only work that survived review: exhibited projects and active
 * certificates. Nothing on this page can be self-declared.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ techmoodId: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { techmoodId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, techmood_id, username, avatar_url, headline, bio, is_public')
    .eq('techmood_id', decodeURIComponent(techmoodId).toUpperCase())
    .maybeSingle();

  const shell = (children: React.ReactNode) => (
    <main className="landing" style={{ maxWidth: 820 }}>
      <nav className="landing-nav">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, textDecoration: 'none' }}>
          <span className="logo-mark" />
          TechMood
        </Link>
        <Link className="btn btn-ghost btn-sm" href="/exhibition">{t('المعرض', 'The exhibition')}</Link>
      </nav>
      {children}
    </main>
  );

  // A private profile and a profile that does not exist look the same on
  // purpose: the answer must not leak which ids are taken.
  if (!profile) {
    return shell(
      <section className="panel" style={{ marginTop: 32 }}>
        <h1 style={{ fontSize: '1.1rem' }}>{t('لا ملف عام بهذا المعرّف', 'No public profile with that id')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
          {t('إما أن المعرّف غير صحيح، أو أن صاحبه اختار ألا يكون ملفه عاماً.',
             'Either the id is wrong, or the person chose not to make their profile public.')}
        </p>
      </section>,
    );
  }

  const [{ data: xp }, { data: stars }, { data: projects }, { data: certificates }] = await Promise.all([
    supabase.from('profile_xp').select('total_xp').eq('profile_id', profile.id).maybeSingle(),
    supabase.from('profile_stars').select('stars_avg, rated_count').eq('profile_id', profile.id).maybeSingle(),
    supabase.rpc('profile_exhibition_entries', { p_profile: profile.id }),
    supabase
      .from('certificates')
      .select('certificate_code, kind, issued_at, snapshot')
      .eq('profile_id', profile.id)
      .eq('status', 'active'),
  ]);

  const totalXp = xp?.total_xp ?? 0;
  const level = levelInfo(totalXp);
  const name = profile.display_name ?? profile.full_name;

  return shell(
    <>
      <section className="panel" style={{ marginTop: 28 }}>
        <div className="row-between">
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>{name}</h1>
            {profile.headline && <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>{profile.headline}</p>}
          </div>
          <span className="id-chip">{profile.techmood_id}</span>
        </div>

        {profile.bio && <p style={{ fontSize: '0.92rem', marginTop: 12 }}>{profile.bio}</p>}

        <div className="profile-meters">
          <div>
            <span className="meter-label">{t('جودة العمل', 'Quality of work')}</span>
            <Stars value={stars?.stars_avg ?? null} />
            <span className="muted" style={{ fontSize: '0.74rem' }}>
              {stars?.rated_count
                ? t(`من ${stars.rated_count} تقييماً معتمداً`, `from ${stars.rated_count} approved reviews`)
                : t('لا تقييمات بعد', 'No reviews yet')}
            </span>
          </div>
          <div>
            <span className="meter-label">{t('التقدّم', 'Progress')}</span>
            <span className="eng" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{totalXp} XP</span>
            <span className="muted" style={{ fontSize: '0.74rem' }}>{level.current.title[locale]}</span>
          </div>
        </div>

        <p className="muted" style={{ fontSize: '0.72rem', marginTop: 12 }}>
          {t('النجوم جودة، وXP تقدّم. لا يُحسب أحدهما من الآخر.',
             'Stars are quality, XP is progress. Neither is computed from the other.')}
        </p>
      </section>

      <section className="panel section-block">
        <h2 style={{ fontSize: '1rem' }}>{t('مشاريع في المعرض', 'Projects in the exhibition')}</h2>
        {(projects ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
            {t('لا مشاريع معروضة بعد.', 'Nothing exhibited yet.')}
          </p>
        ) : (
          <ul className="profile-project-list">
            {(projects ?? []).map((project) => (
              <li key={project.entry_code}>
                <Link href={`/exhibition/${project.entry_code}`}>{project.project_title}</Link>
                {project.team_title && <span className="muted"> · {project.team_title}</span>}
                <span className="muted eng"> · {formatDate(locale, project.published_at)}</span>
                <span className="status-pill status-ok">{t('✓ موثّق', '✓ Verified')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(certificates ?? []).length > 0 && (
        <section className="panel section-block">
          <h2 style={{ fontSize: '1rem' }}>{t('الشهادات', 'Certificates')}</h2>
          <ul className="profile-project-list">
            {(certificates ?? []).map((certificate) => (
              <li key={certificate.certificate_code}>
                <Link href={`/verify/${certificate.certificate_code}`}>
                  {(certificate.snapshot as { title?: string } | null)?.title ?? certificate.certificate_code}
                </Link>
                <span className="muted eng"> · {formatDate(locale, certificate.issued_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted" style={{ fontSize: '0.76rem', textAlign: 'center', margin: '24px 0 48px' }}>
        {t('كل ما على هذه الصفحة مرّ بمراجعة: مشروع اعتمده منتور، أو شهادة صادرة عن عمل معتمد.',
           'Everything on this page went through review: a project a mentor approved, or a certificate issued from approved work.')}
      </p>
    </>,
  );
}
