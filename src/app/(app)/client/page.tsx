import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { money } from '@/lib/booking';
import type { ProjectStatus } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';

export const metadata = { title: 'Client — TechMood' };

const PROJECT_STATUS: Record<ProjectStatus, Text> = {
  planning:    { ar: 'تخطيط',        en: 'Planning' },
  in_progress: { ar: 'قيد التنفيذ',  en: 'In progress' },
  in_review:   { ar: 'قيد المراجعة', en: 'In review' },
  completed:   { ar: 'مكتمل',        en: 'Completed' },
  sold:        { ar: 'مُباع',        en: 'Sold' },
  archived:    { ar: 'مؤرشف',        en: 'Archived' },
};

/**
 * The client's own workspace.
 *
 * Almost nothing here is new machinery: the briefs are opportunities, the
 * proposals are applications, the work is projects, the money is escrow. What
 * this page adds is the one view none of those pages could give — everything a
 * person who is *paying* needs to see at once, counted in people and money
 * rather than in postings.
 */
export default async function ClientPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: overview }, { data: briefs }, { data: projects }, { data: escrows }] =
    await Promise.all([
      supabase.rpc('client_overview'),
      supabase
        .from('opportunities')
        .select('id, title_ar, kind, status, visibility, amount_min, amount_max, closes_on, created_at')
        .eq('posted_by', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, title_ar, status, agreed_amount_usd, owner_id, updated_at')
        .eq('client_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('escrows')
        .select('id, escrow_code, amount_usd, status, payee_id, project_id')
        .eq('payer_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

  const c = overview?.[0];
  const briefIds = (briefs ?? []).map((row) => row.id);

  // One round trip for every proposal on every brief, counted here rather than
  // asked for per row.
  const { data: proposals } = briefIds.length
    ? await supabase
        .from('opportunity_applications')
        .select('id, opportunity_id, stage')
        .in('opportunity_id', briefIds)
    : { data: [] };

  const countFor = new Map<string, { total: number; fresh: number }>();
  for (const row of proposals ?? []) {
    const current = countFor.get(row.opportunity_id) ?? { total: 0, fresh: 0 };
    current.total += 1;
    if (row.stage === 'submitted') current.fresh += 1;
    countFor.set(row.opportunity_id, current);
  }

  const tiles = [
    { value: c?.active_projects ?? 0, label: t('مشاريع جارية', 'Active projects') },
    { value: c?.new_proposals ?? 0, label: t('عروض جديدة', 'New proposals') },
    { value: c?.hires ?? 0, label: t('أشخاص تعاقدت معهم', 'People you hired') },
    { value: money(Number(c?.released_usd ?? 0)), label: t('أُفرج عنه', 'Released') },
  ];

  return (
    <>
      <AiSurface surface="market" />

      <section className="section-block">
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{t('لوحة العميل', 'Client dashboard')}</h2>
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '66ch' }}>
              {t('عندك عمل تريد تنفيذه. تنشر وصفه، تقارن العروض بأدلّة لا بوعود، وتتابع التنفيذ داخل TechMood حتى التسليم والتقييم.',
                 'You have work you want done. Publish the brief, compare the offers on evidence rather than promises, and follow the work inside TechMood through to delivery and review.')}
            </p>
          </div>
          <div className="row-actions">
            <AskAI prompt="ساعدني أكتب وصف مشروع واضحاً: ما الذي أحتاجه، والمخرجات، والمدّة، والميزانية المعقولة." />
            <Link className="btn btn-primary btn-sm" href="/marketplace/new">
              {t('+ انشر مشروعاً', '+ Post a project')}
            </Link>
          </div>
        </div>

        <div className="stat-tiles" style={{ marginTop: 16 }}>
          {tiles.map((tile) => (
            <div className="stat-tile" key={tile.label}>
              <div className="val eng">{tile.value}</div>
              <div className="lbl">{tile.label}</div>
            </div>
          ))}
        </div>

        {(c?.in_escrow_usd ?? 0) > 0 && (
          <p className="notice" style={{ marginTop: 14 }}>
            {t('محجوز في الضمان الآن: ', 'Held in escrow right now: ')}
            <span className="eng">{money(Number(c?.in_escrow_usd ?? 0))}</span>
            {t('. لا يصل المنفّذ قبل أن تفرج عنه.', '. It does not reach whoever is doing the work until you release it.')}
          </p>
        )}
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1.05rem' }}>{t('مشاريعي المنشورة', 'My briefs')}</h3>

        {(briefs ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
            {t('لم تنشر مشروعاً بعد. ابدأ بوصف ما تحتاجه — الوصف الواضح يجلب عروضاً أفضل من الميزانية الكبيرة.',
               'No brief yet. Start by describing what you need — a clear brief brings better offers than a big budget.')}
          </p>
        ) : (
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>{t('المشروع', 'Brief')}</th>
                <th>{t('الميزانية', 'Budget')}</th>
                <th>{t('العروض', 'Proposals')}</th>
                <th>{t('يُغلق', 'Closes')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(briefs ?? []).map((brief) => {
                const counts = countFor.get(brief.id) ?? { total: 0, fresh: 0 };
                return (
                  <tr key={brief.id}>
                    <td>
                      <Link href={`/marketplace/${brief.id}`}>{brief.title_ar}</Link>
                      {brief.visibility === 'invite_only' && (
                        <span className="tag" style={{ marginInlineStart: 8 }}>
                          {t('بدعوة فقط', 'Invite only')}
                        </span>
                      )}
                    </td>
                    <td className="eng">
                      {brief.amount_min || brief.amount_max
                        ? `${money(Number(brief.amount_min ?? 0))} — ${money(Number(brief.amount_max ?? 0))}`
                        : '—'}
                    </td>
                    <td className="eng">
                      {counts.total}
                      {counts.fresh > 0 && (
                        <span className="status-pill status-pending" style={{ marginInlineStart: 6 }}>
                          {t(`${counts.fresh} جديد`, `${counts.fresh} new`)}
                        </span>
                      )}
                    </td>
                    <td className="eng">{brief.closes_on ? formatDate(locale, brief.closes_on) : '—'}</td>
                    <td>
                      {counts.total > 1 && (
                        <Link className="btn btn-ghost btn-sm" href={`/marketplace/${brief.id}/compare`}>
                          {t('قارن', 'Compare')}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1.05rem' }}>{t('التنفيذ', 'Under way')}</h3>

        {(projects ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
            {t('لا تنفيذ جارياً. حين تقبل عرضاً يصبح مشروعاً بمهام ومراحل ومال محجوز.',
               'Nothing under way. Accepting an offer turns it into a project with tasks, milestones and money held in escrow.')}
          </p>
        ) : (
          <ul className="plain-list" style={{ marginTop: 10 }}>
            {(projects ?? []).map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>{project.title_ar}</Link>
                <span className="muted">
                  {' — '}{t(PROJECT_STATUS[project.status])}
                  {project.agreed_amount_usd && (
                    <span className="eng"> · {money(Number(project.agreed_amount_usd))}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(escrows ?? []).length > 0 && (
        <section className="section-block">
          <h3 style={{ fontSize: '1.05rem' }}>{t('المال', 'The money')}</h3>
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>{t('الرمز', 'Code')}</th>
                <th>{t('المبلغ', 'Amount')}</th>
                <th>{t('الحالة', 'State')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(escrows ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="eng">{row.escrow_code}</td>
                  <td className="eng">{money(Number(row.amount_usd))}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.project_id && (
                      <Link className="btn btn-ghost btn-sm" href={`/projects/${row.project_id}`}>
                        {t('افتح', 'Open')}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
