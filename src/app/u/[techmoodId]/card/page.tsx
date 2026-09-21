import Link from 'next/link';
import QRCode from 'qrcode';

import { getLocale, getT } from '@/lib/i18n.server';
import { createClient } from '@/lib/supabase/server';

import { ProfileCard, type Card } from '../ProfileCard';
import { ShareButtons } from './ShareButtons';

export const metadata = { title: 'A TechMood identity card' };

/**
 * The identity card on its own, at 9:16.
 *
 * It is the same component as the one on the profile — the same numbers from
 * the same function — laid out for a phone screen so it can be captured and
 * posted. The QR on it leads back to the profile, which is the point: a card
 * shared anywhere walks the reader into the record behind it.
 */
export default async function ProfileCardPage({
  params,
}: {
  params: Promise<{ techmoodId: string }>;
}) {
  const t = await getT();
  const locale = await getLocale();
  const { techmoodId } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc('profile_card', { p_techmood_id: techmoodId });
  const card = ((data ?? []) as Card[])[0] ?? null;

  if (!card) {
    return (
      <main className="landing" style={{ maxWidth: 520 }}>
        <section className="panel" style={{ marginTop: 40 }}>
          <h1 style={{ fontSize: '1.1rem' }}>{t('لا ملف عام بهذا المعرّف', 'No public profile with that id')}</h1>
        </section>
      </main>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://techmood.io';
  const profileUrl = `${siteUrl}/u/${card.techmood_id}`;
  const qrDataUrl = await QRCode.toDataURL(profileUrl, { margin: 1, width: 360 });

  return (
    <main className="card-stage">
      <ProfileCard card={card} qrDataUrl={qrDataUrl} profileUrl={profileUrl} locale={locale} variant="story" />

      <div className="card-stage-actions no-print">
        <ShareButtons url={profileUrl} name={card.display_name ?? card.full_name} />
        <Link className="btn btn-ghost btn-sm" href={`/u/${card.techmood_id}`}>
          {t('الملف كاملاً', 'The full profile')}
        </Link>
      </div>

      <p className="muted no-print card-stage-note">
        {t('التقط البطاقة وانشرها — الـQR يعيد من يراها إلى ملفك على TechMood.',
           'Screenshot it and post it — the QR walks whoever sees it back to your TechMood profile.')}
      </p>
    </main>
  );
}
