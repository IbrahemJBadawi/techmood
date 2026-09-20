import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { CanvasCard } from '@/lib/database.types';

import { StartupNav } from '../StartupNav';
import { CanvasBoard } from './CanvasBoard';

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ startupId: string }>;
}) {
  const { startupId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: startup } = await supabase
    .from('startups')
    .select('id, name_ar')
    .eq('id', startupId)
    .maybeSingle();

  if (!startup) notFound();

  const [{ data: cards }, { data: canEdit }] = await Promise.all([
    supabase.from('canvas_cards').select('*').eq('startup_id', startupId).order('sort_order'),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
  ]);

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{startup.name_ar} — نموذج العمل</h2>
          <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}`}>نظرة عامة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          تسع خانات تصف كيف يعمل مشروعك على صفحة واحدة. اضغط أي بطاقة لتحريرها أو تلوينها،
          واسحبها إلى خانة أخرى — أو انقلها من القائمة داخل البطاقة.
        </p>
      </section>

      <StartupNav startupId={startupId} />

      <CanvasBoard
        startupId={startupId}
        initialCards={(cards ?? []) as CanvasCard[]}
        canEdit={canEdit === true}
      />
    </>
  );
}
