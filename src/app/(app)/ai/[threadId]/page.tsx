import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { SCOPE, SURFACE } from '@/lib/ai';
import { AiSurface } from '@/components/AiSurface';

import { openPanel, type PanelWhere } from '../actions';
import { Conversation } from './Conversation';

export const metadata = { title: 'AI thread — TechMood' };

export default async function AiThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const t = await getT();
  const { threadId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: thread } = await supabase
    .from('ai_threads')
    .select('id, title_ar, surface, scope, entity_type, entity_id')
    .eq('id', threadId)
    .maybeSingle();

  if (!thread) notFound();

  const where: PanelWhere = {
    surface: thread.surface,
    scope: thread.scope,
    entityType: thread.entity_type,
    entityId: thread.entity_id,
  };

  const state = await openPanel(where, thread.id);

  return (
    <>
      <AiSurface surface={thread.surface} scope={thread.scope}
                 entityType={thread.entity_type ?? undefined}
                 entityId={thread.entity_id ?? undefined} />

      <div className="page-head">
        <h1>{SURFACE[thread.surface].icon} {thread.title_ar}</h1>
        <p className="page-sub">
          {t('السياق', 'Context')}: {t(SCOPE[thread.scope].label)}
        </p>
        <Link className="ghost-button" href="/ai">{t('كل المحادثات', 'All threads')}</Link>
      </div>

      <Conversation initial={state} where={where} />
    </>
  );
}
