import Link from 'next/link';
import { redirect } from 'next/navigation';

import { aiConfigured } from '@/lib/ai-provider';
import { ACTION_STATUS, SURFACE } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import type { AiSurface } from '@/lib/database.types';

import { ReadThread } from './ReadThread';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

export const generateMetadata = localizedTitle('مراقبة الذكاء الاصطناعي — إدارة TechMood', 'AI oversight — TechMood admin');

const TABS = [
  { key: 'threads', label: { ar: 'المحادثات', en: 'Conversations' } },
  { key: 'actions', label: { ar: 'إجراءات المساعد', en: 'AI actions' } },
  { key: 'log',     label: { ar: 'سجل النموذج', en: 'Model log' } },
] as const;

/**
 * How the assistant is used — never what anybody said to it. Words are read
 * only for an open case, with a reason the owner is told (0087). Escalations
 * from the support assistant live in Support & reports.
 */
export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ tab?: string; errors?: string }> }) {
  const params = await searchParams;
  const tab = TABS.some((item) => item.key === params.tab) ? params.tab! : 'threads';
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: overviewRows }, { data: threads }, { data: actions }, { data: log }, { data: openCases }] = await Promise.all([
    supabase.rpc('admin_ai_overview', { p_days: 30 }),
    tab === 'threads' ? supabase.rpc('admin_ai_threads', { p_limit: 100 }) : Promise.resolve({ data: [] }),
    tab === 'actions' ? supabase.rpc('admin_ai_actions', { p_limit: 200 }) : Promise.resolve({ data: [] }),
    tab === 'log' ? supabase.rpc('admin_ai_log', { p_errors_only: params.errors === '1', p_limit: 300 }) : Promise.resolve({ data: [] }),
    supabase.rpc('admin_cases', { p_filter: 'open' }),
  ]);
  const overview = overviewRows?.[0];
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' });
  const surface = (value: string) => (SURFACE[value as AiSurface] ? t(SURFACE[value as AiSurface].label) : value);
  const cases = (openCases ?? []).map((item) => ({ id: item.id, label: `#${item.code} — ${item.title_ar}` }));

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('الذكاء الاصطناعي', 'AI')}</h2>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6, maxWidth: '72ch' }}>
          {t('كيف يُستخدم المساعد، لا ما قاله الناس له. محتوى المحادثة الخاصة لا يُقرأ إلا ضمن قضية مفتوحة وبسبب مكتوب، ويُسجَّل ذلك ويُبلَّغ صاحبها.',
             'How the assistant is used — not what people told it. A private conversation’s words are read only within an open case with a written reason; the access is recorded and its owner is told.')}
        </p>
        {!(await aiConfigured(supabase)) && (
          <p className="notice" style={{ marginTop: 10 }}>
            {t('لا يوجد مزوّد نموذج موصول في هذه البيئة (لا مفتاح Gemini ولا ANTHROPIC_API_KEY): المحادثات تُحفظ لكن لا أحد يجيب عليها.',
               'No model provider is connected here (no Gemini key and no ANTHROPIC_API_KEY): conversations are saved but nobody answers them.')}
          </p>
        )}
      </section>

      {overview && (
        <div className="stat-tiles section-block">
          <div className="stat-tile"><div className="val eng">{overview.people}</div><div className="lbl">{t('أشخاص استخدموه (30 يوماً)', 'People who used it (30 days)')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.threads}</div><div className="lbl">{t('محادثات جديدة', 'New conversations')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.messages}</div><div className="lbl">{t('رسائل', 'Messages')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.model_errors}</div><div className="lbl">{t('أخطاء النموذج', 'Model errors')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.proposals}</div><div className="lbl">{t('إجراءات مقترحة', 'Actions proposed')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.confirmed}</div><div className="lbl">{t('أكّدها أصحابها', 'Confirmed by their owner')}</div></div>
          <div className="stat-tile"><div className="val eng">{overview.declined}</div><div className="lbl">{t('رُفضت', 'Declined')}</div></div>
          <Link className="stat-tile" href="/admin/support?filter=escalated"><div className="val eng">{overview.escalations}</div><div className="lbl">{t('تصعيدات من مساعد الدعم', 'Support-assistant escalations')}</div></Link>
        </div>
      )}

      <div className="tags-row section-block">
        {TABS.map((item) => (
          <Link key={item.key} className={`chip${item.key === tab ? ' is-active' : ''}`} href={`/admin/ai?tab=${item.key}`}>{t(item.label)}</Link>
        ))}
      </div>

      {tab === 'threads' && (
        <table className="data">
          <thead><tr><th>{t('الشخص', 'Person')}</th><th>{t('أين', 'Where')}</th><th>{t('رسائل', 'Messages')}</th><th>{t('آخر نشاط', 'Last active')}</th><th>{t('المحتوى', 'Words')}</th></tr></thead>
          <tbody>
            {(threads ?? []).map((row) => (
              <tr key={row.id}>
                <td><Link href={`/admin/users/${row.profile_id}`}>{row.full_name}</Link> <span className="id-chip">{row.techmood_id}</span></td>
                <td>{surface(row.surface)}</td>
                <td className="eng">{row.messages}{row.errors > 0 && <span className="status-pill status-danger" style={{ marginInlineStart: 6 }}>{row.errors} ⚠</span>}</td>
                <td className="muted">{row.last_message_at ? time.format(new Date(row.last_message_at)) : '—'}</td>
                <td><ReadThread threadId={row.id} cases={cases} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'actions' && (
        <table className="data">
          <thead><tr><th>{t('الشخص', 'Person')}</th><th>{t('الإجراء', 'Action')}</th><th>{t('الحالة', 'Status')}</th><th>{t('اقتُرح', 'Proposed')}</th></tr></thead>
          <tbody>
            {(actions ?? []).map((row) => (
              <tr key={row.id}>
                <td><Link href={`/admin/users/${row.profile_id}`}>{row.full_name}</Link></td>
                <td><span className="tag eng">{row.kind}</span> <span style={{ fontSize: '0.82rem' }}>{row.summary_ar}</span>
                  {row.error_ar && <div className="muted" style={{ fontSize: '0.76rem' }}>{row.error_ar}</div>}</td>
                <td><span className={`status-pill ${ACTION_STATUS[row.status]?.className ?? 'status-muted'}`}>{ACTION_STATUS[row.status] ? t(ACTION_STATUS[row.status].label) : row.status}</span></td>
                <td className="muted">{time.format(new Date(row.proposed_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'log' && (
        <>
          <p className="section-block">
            <Link className={`chip${params.errors === '1' ? ' is-active' : ''}`} href={params.errors === '1' ? '/admin/ai?tab=log' : '/admin/ai?tab=log&errors=1'}>
              {t('الأخطاء فقط', 'Errors only')}
            </Link>
          </p>
          <table className="data">
            <thead><tr><th>{t('الوقت', 'When')}</th><th>{t('أين', 'Where')}</th><th>{t('النموذج', 'Model')}</th><th>{t('النتيجة', 'Result')}</th></tr></thead>
            <tbody>
              {(log ?? []).map((row, index) => (
                <tr key={index}>
                  <td className="muted">{time.format(new Date(row.at))}</td>
                  <td>{surface(row.surface)}</td>
                  <td className="eng">{row.model ?? '—'}</td>
                  <td>{row.error_ar ? <span className="status-pill status-danger">{row.error_ar}</span> : <span className="status-pill status-ok">{t('أجاب', 'Answered')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
