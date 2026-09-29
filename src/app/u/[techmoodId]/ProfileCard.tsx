import Image from 'next/image';

import { Stars } from '@/components/Stars';
import { contentText, type Locale } from '@/lib/i18n';
import { getT } from '@/lib/i18n.server';
import type { Database } from '@/lib/database.types';

export type Card = Database['public']['Functions']['profile_card']['Returns'][number];

/**
 * The identity card at the top of a profile.
 *
 * It is the first thing a visitor reads and the thing its owner shares, so it
 * carries only what the platform can prove: the level comes from the XP
 * ladder, the stars from approved evaluations, and every count from a record —
 * certificates issued, projects exhibited, sessions completed. Nothing on it
 * can be typed in.
 *
 * `variant="story"` is the same card at 9:16 for sharing; the layout is the
 * same markup measured in container units, so the two cannot drift apart. The
 * units are measured against the shell around the card, never the card itself
 * (a container's own padding would be measured against the whole window).
 */
export async function ProfileCard({
  card,
  qrDataUrl,
  profileUrl,
  locale,
  variant = 'page',
}: {
  card: Card;
  qrDataUrl: string;
  profileUrl: string;
  locale: Locale;
  variant?: 'page' | 'story';
}) {
  const t = await getT();
  const name = card.display_name ?? card.full_name;
  const initial = name.trim().charAt(0);

  const stats: { value: string; label: string }[] = [
    { value: String(card.points), label: t('نقطة', 'Points') },
    { value: String(card.projects), label: t('مشاريع', 'Projects') },
    { value: String(card.certificates), label: t('شهادات', 'Certificates') },
    { value: String(card.skills_proven), label: t('مهارات موثّقة', 'Proven skills') },
  ];

  return (
    <div className={`identity-shell identity-shell-${variant}`}>
    <article className={`identity-card identity-${variant}`} id={variant === 'story' ? 'identity-story' : undefined}>
      {variant === 'story' && (
        <div className="identity-top">
          <Image src="/logo.png" alt="" width={64} height={64} />
          <span>TechMood</span>
          <span className="identity-top-kicker">{t('الهوية المهنية', 'Professional identity')}</span>
        </div>
      )}

      <div className="identity-head">
        {card.avatar_url ? (
          // unoptimized: the photo may come from Supabase Storage or from the
          // sign-in provider (Google), and is already small.
          <Image className="identity-avatar" src={card.avatar_url} alt="" width={128} height={128} unoptimized />
        ) : (
          <span className="identity-avatar identity-initial" aria-hidden>{initial}</span>
        )}

        <div className="identity-who">
          <h1>{name}</h1>
          {card.headline && <p className="identity-title">{card.headline}</p>}
          {card.primary_field && <p className="identity-field">{card.primary_field}</p>}
        </div>
      </div>

      <div className="identity-meters">
        <span className="identity-level">
          {t(`المستوى ${card.level_no ?? 1}`, `Level ${card.level_no ?? 1}`)}
          {card.level_title && <span className="identity-level-title"> · {card.level_title}</span>}
        </span>
        {card.stars_avg !== null && (
          <span className="identity-stars">
            <Stars value={card.stars_avg} />
            <span className="eng">{card.stars_avg.toFixed(1)}</span>
          </span>
        )}
      </div>

      <dl className="identity-stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="eng">{stat.value}</dt>
            <dd>{stat.label}</dd>
          </div>
        ))}
      </dl>

      <footer className="identity-foot">
        <div className="identity-id">
          <span className="id-chip">{card.techmood_id}</span>
          <span className="identity-url eng">{profileUrl.replace(/^https?:\/\//, '')}</span>
          <span className="identity-brand">
            <Image src="/logo.png" alt="" width={48} height={48} />
            <span>TechMood</span>
          </span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="identity-qr" src={qrDataUrl} alt={contentText(locale, `ملف ${name}`, `${name}'s profile`)} />
      </footer>
    </article>
    </div>
  );
}
