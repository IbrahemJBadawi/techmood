import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { ACTION_STATUS, PERMISSION, SCOPE, SURFACE } from '@/lib/ai';
import { AiSurface } from '@/components/AiSurface';

export const metadata = { title: 'AI — TechMood' };

/**
 * Every journey the assistant has been part of.
 *
 * The threads are separated on purpose: «تعلّم Python» and «فكرة شركة» are not
 * the same conversation, and merging them would make the advice worse, not the
 * interface simpler.
 */
export default async function AiPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: threads }, { data: actions }, { data: restrictions }] = await Promise.all([
    supabase.rpc('my_ai_threads', { p_include_archived: false }),
    supabase.rpc('ai_thread_actions', { p_thread: null }),
    supabase.rpc('ai_restrictions'),
  ]);

  const pending = (actions ?? []).filter((row) => row.status === 'proposed');

  return (
    <>
      <AiSurface surface="general" />

      <div className="page-head">
        <h1>✦ {t('مساعد TechMood', 'TechMood AI')}</h1>
        <p className="page-sub">
          {t(
            'طبقة فوق المنصّة كلها: يقرأ ما تراه أنت، يقترح، ولا ينفّذ شيئاً قبل أن تؤكّده.',
            'A layer over the whole platform: it reads what you can read, suggests, and changes nothing until you confirm.',
          )}
        </p>
        <Link className="ghost-button" href="/settings/ai">
          {t('الذاكرة والصلاحيات', 'Memory and permissions')}
        </Link>
      </div>

      {pending.length > 0 && (
        <section className="card">
          <h2>{t('بانتظار تأكيدك', 'Waiting on you')}</h2>
          <ul className="plain-list">
            {pending.map((action) => (
              <li key={action.id}>
                <strong>{action.title_ar}</strong>
                <span> — {action.summary_ar}</span>
              </li>
            ))}
          </ul>
          <p className="muted">
            {t('افتح المحادثة التي اقتُرح فيها لتأكيده أو رفضه.',
               'Open the thread it was proposed in to confirm or refuse it.')}
          </p>
        </section>
      )}

      <section className="card">
        <h2>{t('المحادثات', 'Threads')}</h2>

        {(threads ?? []).length === 0 ? (
          <p className="muted">
            {t('لا محادثات بعد. افتح ✦ من أي صفحة وابدأ من سياقها.',
               'No threads yet. Open ✦ from any page and start from where you are.')}
          </p>
        ) : (
          <ul className="ai-thread-list">
            {(threads ?? []).map((thread) => (
              <li key={thread.id}>
                <Link href={`/ai/${thread.id}`}>
                  <span className="ai-thread-title">
                    {SURFACE[thread.surface].icon} {thread.title_ar}
                  </span>
                  <span className="muted">
                    {t(SCOPE[thread.scope].label)} · {thread.messages} ·{' '}
                    {formatDateTime(locale, thread.last_message_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t('ما لا يفعله المساعد', 'What the assistant never does')}</h2>
        <p className="muted">
          {t(
            'هذه ليست إعدادات يمكن تشغيلها: لا يوجد لها تنفيذ في قاعدة البيانات أصلاً.',
            'These are not settings that can be switched on: the database has no branch that runs them.',
          )}
        </p>
        <ul className="ai-restrictions">
          {(restrictions ?? []).map((row) => (
            <li key={row.kind}>
              <span className="status-pill status-danger">{PERMISSION.restricted.icon}</span>
              <div>
                <strong>{row.title_ar}</strong>
                <p>{row.refusal_ar}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(actions ?? []).some((row) => row.status !== 'proposed') && (
        <section className="card">
          <h2>{t('سجلّ الإجراءات', 'Action log')}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t('الإجراء', 'Action')}</th>
                <th>{t('الحالة', 'State')}</th>
                <th>{t('متى', 'When')}</th>
              </tr>
            </thead>
            <tbody>
              {(actions ?? []).filter((row) => row.status !== 'proposed').map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title_ar}</strong>
                    <div className="muted">{row.summary_ar}</div>
                    {row.error_ar && <div className="ai-error">{row.error_ar}</div>}
                  </td>
                  <td>
                    <span className={`status-pill ${ACTION_STATUS[row.status]?.className ?? ''}`}>
                      {t(ACTION_STATUS[row.status]?.label ?? { ar: row.status, en: row.status })}
                    </span>
                  </td>
                  <td>{formatDateTime(locale, row.proposed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
