import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { WorkshopForm } from '../../WorkshopForm';

export const generateMetadata = localizedTitle('تعديل ورشة — TechMood', 'Edit a workshop — TechMood');

export default async function EditWorkshopPage({ params }: { params: Promise<{ workshopId: string }> }) {
  const t = await getT();
  const { workshopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.rpc('workshop_detail', { p_id: workshopId });
  const w = data?.[0];
  if (!w) notFound();
  if (!w.can_edit) redirect(`/workshops/${workshopId}`);

  // the form speaks Palestine's clock, like the rest of the platform
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(w.starts_at)).map((part) => [part.type, part.value]));

  return (
    <>
      <BackLink href={`/workshops/${workshopId}`} label={w.title} />
      <h2 className="section-block" style={{ fontSize: '1.2rem' }}>{t('تعديل الورشة', 'Edit the workshop')}</h2>
      <WorkshopForm workshop={{
        id: w.id, title: w.title, description: w.description,
        date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`,
        duration_minutes: w.duration_minutes, capacity: w.capacity, live_url: w.live_url, recording_url: w.recording_url,
      }} />
    </>
  );
}
