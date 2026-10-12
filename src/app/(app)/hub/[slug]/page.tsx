import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { BackLink } from '@/components/BackLink';
import { NameBadges } from '@/components/VerifiedBadge';
import { ShareButton } from '@/components/ShareButton';
import { badgesFor } from '@/lib/badges';
import { MemberAvatar } from '@/components/MemberAvatar';
import { OPPORTUNITY_KIND } from '@/lib/marketplace';

/**
 * A business page (0165): who they are, then what already exists on TechMood
 * about them — services, projects in the gallery, open opportunities and, for
 * a team, its members. Members only.
 */
export default async function BusinessPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/hub/${slug}`);

  const { data: page } = await supabase.from('business_pages').select('*').eq('slug', slug).maybeSingle();
  if (!page) notFound();

  const isTeam = !!page.team_id;
  const [{ data: owner }, { data: services }, { data: projects }, { data: openings }, { data: members }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, display_name, techmood_id, avatar_url, headline').eq('id', page.owner_id).maybeSingle(),
    isTeam ? Promise.resolve({ data: [] as { id: string; title_ar: string; detail_ar: string | null; from_usd: number | null }[] })
      : supabase.from('freelancer_services').select('id, title_ar, detail_ar, from_usd').eq('profile_id', page.owner_id).order('sort_order'),
    (isTeam ? supabase.from('projects').select('id, code, title_ar, tagline_ar, in_gallery').eq('team_id', page.team_id!)
            : supabase.from('projects').select('id, code, title_ar, tagline_ar, in_gallery').eq('owner_id', page.owner_id))
      .eq('in_gallery', true).limit(12),
    supabase.from('opportunities').select('id, kind, title_ar, compensation_ar, created_at').eq('posted_by', page.owner_id)
      .eq('status', 'published').order('created_at', { ascending: false }).limit(10),
    isTeam ? supabase.from('team_members').select('profile_id, role').eq('team_id', page.team_id!) : Promise.resolve({ data: [] as { profile_id: string; role: string | null }[] }),
  ]);
  const memberIds = (members ?? []).map((row) => row.profile_id);
  const [{ data: people }, marks] = await Promise.all([
    memberIds.length ? supabase.from('profiles').select('id, full_name, techmood_id, avatar_url').in('id', memberIds) : Promise.resolve({ data: [] as { id: string; full_name: string; techmood_id: string; avatar_url: string | null }[] }),
    badgesFor(supabase, [page.owner_id, ...memberIds]),
  ]);
  const mine = page.owner_id === user.id;

  return (
    <>
      <BackLink href="/hub" label={t('رجوع إلى الأعمال', 'Back to Business')} />

      <section className="section-block biz-page-head">
        <span className="biz-page-mark" aria-hidden="true">{page.name.trim().charAt(0)}</span>
        <div className="biz-page-titles">
          <p className="kicker">{isTeam ? t('صفحة فريق', 'Team page') : t('صفحة مستقل', 'Independent')}{page.sector && <> · {page.sector}</>}{page.city && <> · {page.city}</>}</p>
          <h1>{page.name}<NameBadges verified={marks.verified.has(page.owner_id)} premium={marks.premium.has(page.owner_id)} /></h1>
          {page.tagline && <p className="biz-page-tagline">{page.tagline}</p>}
          <div className="tags-row" style={{ marginTop: 8 }}>
            <ShareButton path={`/hub/${page.slug}`} title={page.name} text={t(`${page.name} على TechMood Business`, `${page.name} on TechMood Business`)} />
            {page.website_url && <a className="btn btn-ghost btn-sm" href={page.website_url} target="_blank" rel="noopener noreferrer">🌐 {t('الموقع', 'Website')}</a>}
            {owner?.techmood_id && <Link className="btn btn-ghost btn-sm" href={`/u/${owner.techmood_id}`}>{t('الملف المهني', 'Profile')}</Link>}
            {mine && <Link className="btn btn-primary btn-sm" href={isTeam ? `/hub/edit?team=${page.team_id}` : '/hub/edit'}>{t('عدّل الصفحة', 'Edit the page')}</Link>}
          </div>
        </div>
      </section>

      {!page.is_published && mine && <p className="notice section-block">{t('الصفحة مخفية — لا يراها غيرك.', 'Hidden — only you see it.')}</p>}

      {page.about && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{t('عن العمل', 'About')}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{page.about}</p>
          {page.contact_note && <p className="muted" style={{ marginTop: 10 }}>📩 {page.contact_note}</p>}
        </section>
      )}

      {(services ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>🛠️ {t('الخدمات', 'Services')}</h3>
          <ul className="biz-services">
            {(services ?? []).map((service) => (
              <li key={service.id}>
                <strong>{service.title_ar}</strong>
                {service.from_usd != null && <span className="eng">{t('من', 'from')} ${Number(service.from_usd)}</span>}
                {service.detail_ar && <p className="muted">{service.detail_ar}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(projects ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>🧩 {t('أعمال في المعرض', 'Work in the gallery')}</h3>
          <ul className="biz-projects">
            {(projects ?? []).map((project) => (
              <li key={project.id}><Link href={`/gallery/${project.code}`}>{project.title_ar}</Link>{project.tagline_ar && <span className="muted"> — {project.tagline_ar}</span>}</li>
            ))}
          </ul>
        </section>
      )}

      {(openings ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>💼 {t('فرص مفتوحة', 'Open opportunities')}</h3>
          <ul className="biz-projects">
            {(openings ?? []).map((row) => (
              <li key={row.id}>
                <Link href={`/marketplace/${row.id}`}>{row.title_ar}</Link>
                <span className="muted"> · {t(OPPORTUNITY_KIND[row.kind as keyof typeof OPPORTUNITY_KIND]?.label ?? { ar: row.kind, en: row.kind })}{row.compensation_ar && ` · ${row.compensation_ar}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isTeam && (people ?? []).length > 0 && (
        <section className="panel section-block">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>👥 {t('الفريق', 'The team')}</h3>
          <ul className="sc-people">
            {(people ?? []).map((person) => (
              <li key={person.id}>
                <MemberAvatar id={person.techmood_id} name={person.full_name} url={person.avatar_url} size={30} />
                <span><Link href={`/u/${person.techmood_id}`}>{person.full_name}</Link>
                  <NameBadges verified={marks.verified.has(person.id)} premium={marks.premium.has(person.id)} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
