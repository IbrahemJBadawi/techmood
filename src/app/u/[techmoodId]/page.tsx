import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { localizedTitle } from '@/lib/i18n.server';

import { ProfileBody } from './ProfileBody';

export async function generateMetadata({ params }: { params: Promise<{ techmoodId: string }> }) {
  const { techmoodId } = await params;
  return {
    ...(await localizedTitle('ملف على TechMood', 'A TechMood profile')()),
    alternates: { canonical: `/u/${techmoodId}` },
  };
}

/**
 * A member's public profile link (/u/…), for a CV or a QR code. A signed-in
 * member is taken to the same profile inside the app (/m/…), so they stay in
 * their account; a visitor sees it with the site's header.
 */
export default async function PublicProfilePage({ params }: { params: Promise<{ techmoodId: string }> }) {
  const { techmoodId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(`/m/${encodeURIComponent(techmoodId)}`);
  return <ProfileBody techmoodId={techmoodId} inApp={false} />;
}
