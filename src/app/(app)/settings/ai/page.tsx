import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { PERMISSION } from '@/lib/ai';
import { AiSurface } from '@/components/AiSurface';

import { MemoryList } from './MemoryList';
import { PreferencesForm } from './PreferencesForm';

export const metadata = { title: 'AI settings — TechMood' };

/**
 * What the assistant is allowed to know, and allowed to do.
 *
 * Three things are shown together on purpose: the switches, the memory itself,
 * and the list of what is refused whatever the switches say. A permission page
 * that shows only the switches implies everything else is negotiable.
 */
export default async function AiSettingsPage() {
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: settings }, { data: memory }, { data: surfaces }, { data: restrictions }] =
    await Promise.all([
      supabase.rpc('ai_settings'),
      supabase.rpc('my_ai_memory'),
      supabase.from('ai_surface_permissions').select('*').order('sort_order'),
      supabase.rpc('ai_restrictions'),
    ]);

  const prefs = settings?.[0] ?? { memory_enabled: true, actions_enabled: true };

  return (
    <>
      <AiSurface surface="general" />

      <div className="page-head">
        <h1>{t('المساعد: الذاكرة والصلاحيات', 'The assistant: memory and permissions')}</h1>
        <p className="page-sub">
          {t(
            'المساعد يقرأ بصلاحياتك أنت، لا أكثر. ما تراه هنا هو كل ما يعرفه عنك.',
            'The assistant reads with your permissions and no more. What you see here is everything it knows about you.',
          )}
        </p>
      </div>

      <section className="card">
        <h2>{t('الإعدادات', 'Switches')}</h2>
        <PreferencesForm memory={prefs.memory_enabled} actions={prefs.actions_enabled} />
      </section>

      <section className="card">
        <h2>{t('ما يتذكّره', 'What it remembers')}</h2>
        <MemoryList rows={memory ?? []} />
      </section>

      <section className="card">
        <h2>{t('ما يفعله في كل مكان', 'What it may do, screen by screen')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('المكان', 'Where')}</th>
              <th>{t('الصلاحية', 'Permission')}</th>
              <th>{t('التفصيل', 'Detail')}</th>
            </tr>
          </thead>
          <tbody>
            {(surfaces ?? []).map((row) => (
              <tr key={row.surface}>
                <td>{row.title_ar}</td>
                <td>
                  <span className={`status-pill ${PERMISSION[row.permission].className}`}>
                    {PERMISSION[row.permission].icon} {t(PERMISSION[row.permission].label)}
                  </span>
                </td>
                <td className="muted">{row.note_ar}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>🔒 {t('ما لا يفعله أبداً', 'What it never does')}</h2>
        <p className="muted">
          {t(
            'ليست إعدادات: لا يوجد في قاعدة البيانات مسار ينفّذ أياً منها، حتى بتأكيدك.',
            'Not settings: the database has no path that runs any of these, confirmed or not.',
          )}
        </p>
        <ul className="ai-restrictions">
          {(restrictions ?? []).map((row) => (
            <li key={row.kind}>
              <span className="status-pill status-danger">🔒</span>
              <div>
                <strong>{row.title_ar}</strong>
                <p>{row.refusal_ar}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
