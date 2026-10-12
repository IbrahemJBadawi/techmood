import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { STUDIO_TOOLS, type StudioToolKey } from '@/lib/studio-tools';

import { StartupNav } from './StartupNav';

/** What every studio tool page starts from: who is asking, which startup, may they write. */
export async function loadStudio(startupId: string) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: startup }, { data: canEdit }, { data: inRoom }] = await Promise.all([
    supabase.from('startups').select('id, name_ar').eq('id', startupId).maybeSingle(),
    supabase.rpc('can_edit_startup', { p_startup: startupId }),
    supabase.rpc('can_view_startup_workspace', { p_startup: startupId }),
  ]);
  // a listed startup is public, its workspace never is
  if (!startup || inRoom !== true) notFound();
  return { t, supabase, user, startup, editable: canEdit === true };
}

/** The top of a studio tool: its name, what it is for, the assistant, the room's navigation. */
export async function ToolHeader({
  startupId, name, tool, ask, intro,
}: {
  startupId: string;
  name: string;
  tool: StudioToolKey;
  ask: string;
  intro: string;
}) {
  const t = await getT();
  const meta = STUDIO_TOOLS.find((entry) => entry.key === tool)!;
  const index = STUDIO_TOOLS.indexOf(meta);
  const next = STUDIO_TOOLS[index + 1];

  return (
    <>
      <AiSurface surface="startup" scope="startup" entityType="startup" entityId={startupId} label={name} />
      <section className="section-block studio-tool-head">
        <p className="studio-step">{t(`الأداة ${index + 1} من 6`, `Tool ${index + 1} of 6`)}</p>
        <div className="row-between studio-tool-title">
          <h2><span aria-hidden>{meta.icon}</span> {t(meta.label)} <span className="muted">— {name}</span></h2>
          <div className="studio-tool-actions">
            <AskAI prompt={ask} />
            {next && (
              <Link className="btn btn-ghost btn-sm" href={`/startups/${startupId}${next.href}`}>
                {t('التالي: ', 'Next: ')}{t(next.label)} {t('←', '→')}
              </Link>
            )}
          </div>
        </div>
        <p className="muted studio-tool-intro">{intro}</p>
      </section>
      <StartupNav startupId={startupId} />
    </>
  );
}
