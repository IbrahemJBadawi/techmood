import { redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { WorkshopForm } from '../WorkshopForm';

export const generateMetadata = localizedTitle('أعلن ورشة — TechMood', 'Announce a workshop — TechMood');

export default async function NewWorkshopPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: canHost } = await supabase.rpc('can_host_workshop');
  if (!canHost) redirect('/workshops');

  return (
    <>
      <BackLink href="/workshops" label={t('ورش العمل', 'Workshops')} />
      <h2 className="section-block" style={{ fontSize: '1.2rem' }}>{t('أعلن ورشة', 'Announce a workshop')}</h2>
      <WorkshopForm workshop={null} />
    </>
  );
}
