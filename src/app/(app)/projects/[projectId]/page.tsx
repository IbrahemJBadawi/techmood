import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate, type Text } from '@/lib/i18n';
import type { ProjectStatus } from '@/lib/database.types';

import { Stars } from '@/components/Stars';
import { money } from '@/lib/booking';

import { recordProjectFile, setProjectStatus } from './actions';
import { Meetings } from './Meetings';
import { TeamSplit, type SplitRow } from './TeamSplit';
import { escrowPayTo, type EscrowPayTo } from '@/lib/escrow-instructions';
import { WorkFileUpload } from '@/components/WorkFileUpload';
import { DeliverableForm, MilestoneForm } from './WorkForms';
import {
  ClientReviewForm, EscrowControls, EscrowProofForm, ESCROW_STATUS,
  OpenEscrowForm, SellForm, WithdrawListing, WorkerReviewForm,
} from './Money';
import type { PaymentMethodPublic } from '@/lib/database.types';
import { AiSurface } from '@/components/AiSurface';
import { AskAI } from '@/components/AskAI';
import { PUBLIC_METHOD_COLUMNS } from '@/lib/database.types';

const STATUS: Record<ProjectStatus, { text: Text; className: string }> = {
  planning:    { text: { ar: 'تخطيط',  en: 'Planning' },    className: 'status-muted' },
  in_progress: { text: { ar: 'جارٍ',    en: 'In progress' }, className: 'status-pending' },
  in_review:   { text: { ar: 'مراجعة', en: 'In review' },   className: 'status-pending' },
  completed:   { text: { ar: 'مكتمل',  en: 'Completed' },   className: 'status-ok' },
  sold:        { text: { ar: 'مُباع',   en: 'Sold' },        className: 'status-ok' },
  archived:    { text: { ar: 'مؤرشف',  en: 'Archived' },    className: 'status-muted' },
};

/**
 * The work a market opening turned into.
 *
 * This page exists because "accepted" used to be where the record stopped. The
 * work is what a mentor can evaluate, what the exhibition can show and what
 * reputation is built from — so it has dates, deliverables and a state, and
 * both sides can see it: the person doing it, and the person paying for it.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, code, title_ar, description_ar, owner_id, client_id, opportunity_id, team_id, status, kind, agreed_amount_usd, created_at')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) notFound();

  const isOwner = project.owner_id === user.id;
  const isClient = project.client_id === user.id;

  const [{ data: people }, { data: milestones }, { data: evidence }, { data: entry }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id')
      .in('id', [project.owner_id, project.client_id].filter(Boolean) as string[]),
    supabase.from('project_milestones').select('id, title_ar, due_on, is_done')
      .eq('project_id', projectId).order('due_on', { nullsFirst: false }),
    supabase.from('project_evidence').select('id, kind, url, label, is_upload').eq('project_id', projectId),
    supabase.from('exhibition_entries').select('id, status').eq('project_id', projectId).maybeSingle(),
  ]);

  // The money, the judgement and the shelf — all of it for this one project.
  const [{ data: escrows }, { data: methods }, { data: listing }, { data: review },
         { data: workerReview }] = await Promise.all([
    supabase.from('escrows')
      .select('id, escrow_code, amount_usd, commission_usd, net_usd, status, payer_id, payee_id, dispute_reason_ar')
      .eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('payment_methods').select(PUBLIC_METHOD_COLUMNS).eq('is_enabled', true).order('sort_order'),
    supabase.from('project_listings')
      .select('id, price_usd, licence, summary_ar, includes, status')
      .eq('project_id', projectId).maybeSingle(),
    supabase.from('client_reviews')
      .select('id, stars, comment_ar, client_id').eq('project_id', projectId).maybeSingle(),
    supabase.from('worker_reviews')
      .select('id, stars, comment_ar, worker_id').eq('project_id', projectId).maybeSingle(),
  ]);

  const holds = escrows ?? [];
  const openHold = holds.find((row) => row.status === 'awaiting_payment');
  const suggested = project.agreed_amount_usd;

  const { data: commission } = suggested
    ? await supabase.rpc('compute_commission', { p_kind: 'market_work', p_amount: suggested })
    : { data: null };

  const { data: exhibited } = await supabase
    .from('exhibition_entries')
    .select('status').eq('project_id', projectId).maybeSingle();

  const canSell = isOwner
    && project.client_id === null
    && (project.status === 'completed' || project.status === 'sold')
    && exhibited?.status === 'exhibited';

  const released = holds.some((row) => row.status === 'released');

  // Where the client sends the money for a hold they opened — shown only to
  // the payer of that payment (see escrowPayTo).
  const instructionsFor = new Map<string, EscrowPayTo>();
  for (const hold of holds.filter((row) => row.status === 'awaiting_payment' && row.payer_id === user.id)) {
    const payTo = await escrowPayTo(supabase, hold.id);
    if (payTo) instructionsFor.set(hold.id, payTo);
  }

  // The room and the files are between the parties to the work. A public
  // project page shows finished work; it does not open the drafts or the calls.
  const { data: isParty } = await supabase.rpc('is_project_party', { p_project: projectId });

  const { data: meetings } = isParty && project.client_id
    ? await supabase.rpc('project_meetings', { p_project: projectId })
    : { data: [] };

  // An uploaded file is an object path, not a link: a short-lived signed url is
  // minted for it here, per render, and never stored. Storage refuses to mint
  // one for anybody its policy would refuse to serve.
  const uploads = (evidence ?? []).filter((item) => item.is_upload);
  const { data: signed } = isParty && uploads.length
    ? await supabase.storage.from('project-files').createSignedUrls(uploads.map((item) => item.url), 300)
    : { data: [] };
  const signedFor = new Map((signed ?? []).map((row) => [row.path, row.signedUrl]));

  // A team's share: the suggestion from the board, and what was agreed.
  let splitRows: SplitRow[] = [];
  let canEditSplit = false;
  if (isParty && project.team_id) {
    const [{ data: suggested }, { data: agreed }, { data: team }] = await Promise.all([
      supabase.rpc('suggested_project_split', { p_project: projectId }),
      supabase.from('project_splits').select('profile_id, percent').eq('project_id', projectId),
      supabase.from('teams').select('leader_id').eq('id', project.team_id).maybeSingle(),
    ]);
    const agreedFor = new Map((agreed ?? []).map((row) => [row.profile_id, Number(row.percent)]));
    splitRows = (suggested ?? []).map((row) => ({
      profile_id: row.profile_id, full_name: row.full_name, tasks_done: row.tasks_done,
      suggested: Number(row.percent), agreed: agreedFor.get(row.profile_id) ?? null,
    }));
    canEditSplit = project.owner_id === user.id || team?.leader_id === user.id;
  }



  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const status = STATUS[project.status];

  return (
    <>
      <AiSurface surface="project" entityType="project" entityId={project.id} label={project.title_ar} />

      <Link className="btn btn-ghost btn-sm" href="/marketplace?tab=work">
        {t('→ رجوع لعملي', '← Back to my work')}
      </Link>
      <AskAI prompt={`قسّم مشروع «${project.title_ar}» إلى مهام صغيرة مرتّبة مع تقدير زمني لكل مهمة.`} />

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <span className="id-chip">{project.code}</span>
            <h2 style={{ fontSize: '1.2rem', marginTop: 8 }}>{project.title_ar}</h2>
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
              {t('ينفّذه ', 'Built by ')}{nameOf.get(project.owner_id) ?? '—'}
              {project.client_id && ` · ${t('لصالح ', 'for ')}${nameOf.get(project.client_id) ?? '—'}`}
            </p>
          </div>
          <div style={{ textAlign: 'start' }}>
            <span className={`status-pill ${status.className}`}>{t(status.text)}</span>
            {project.agreed_amount_usd !== null && (
              <p className="eng" style={{ fontWeight: 700, color: 'var(--royal-dark)', marginTop: 8 }}>
                ${project.agreed_amount_usd}
              </p>
            )}
          </div>
        </div>

        {project.description_ar && (
          <p style={{ fontSize: '0.9rem', marginTop: 14, whiteSpace: 'pre-wrap' }}>{project.description_ar}</p>
        )}

        {isOwner && project.status !== 'completed' && (
          <form action={setProjectStatus} className="row-actions" style={{ marginTop: 16 }}>
            <input type="hidden" name="project_id" value={projectId} />
            <button className="btn btn-ghost btn-sm" name="status" value="in_progress">
              {t('بدأت العمل', 'Started')}
            </button>
            <button className="btn btn-ghost btn-sm" name="status" value="in_review">
              {t('جاهز للمراجعة', 'Ready for review')}
            </button>
            <button className="btn btn-primary btn-sm" name="status" value="completed">
              {t('أنهيت العمل', 'Finished')}
            </button>
          </form>
        )}

        {project.opportunity_id && (
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 12 }}>
            {t('هذا العمل جاء من فرصة في السوق. ', 'This work came from an opening in the market. ')}
            <Link href={`/marketplace/${project.opportunity_id}`}>{t('افتح الفرصة', 'Open it')}</Link>
          </p>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('المواعيد', 'Milestones')}</h3>
            {(milestones ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
                {t('لا مواعيد بعد.', 'No dates yet.')}
              </p>
            ) : (
              <ul className="plain-list" style={{ marginTop: 12 }}>
                {(milestones ?? []).map((milestone) => (
                  <li className="row-between" key={milestone.id} style={{ fontSize: '0.88rem' }}>
                    <span>{milestone.is_done ? '✓ ' : '○ '}{milestone.title_ar}</span>
                    <span className="muted">
                      {milestone.due_on ? formatDate(locale, milestone.due_on) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && <div style={{ marginTop: 14 }}><MilestoneForm projectId={projectId} /></div>}
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('التسليمات', 'Deliverables')}</h3>
            {(evidence ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: '0.86rem', marginTop: 8 }}>
                {t('لم يُرفق شيء بعد.', 'Nothing attached yet.')}
              </p>
            ) : (
              <ul className="plain-list" style={{ marginTop: 12 }}>
                {(evidence ?? [])
                  .filter((item) => !item.is_upload || signedFor.get(item.url))
                  .map((item) => (
                  <li key={item.id} style={{ fontSize: '0.88rem' }}>
                    <a href={item.is_upload ? signedFor.get(item.url) ?? '#' : item.url}
                       target="_blank" rel="noreferrer noopener">
                      {item.label ?? item.url}
                    </a>
                    <span className="muted eng">
                      {' · '}{item.is_upload ? t('ملف مرفوع', 'uploaded file') : item.kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && <div style={{ marginTop: 14 }}><DeliverableForm projectId={projectId} /></div>}
            {isParty && (
              <div style={{ marginTop: 10 }}>
                <WorkFileUpload
                  bucket="project-files"
                  folder={projectId}
                  record={recordProjectFile.bind(null, projectId)}
                />
              </div>
            )}
          </div>

          {isParty && project.client_id && (
            <Meetings projectId={projectId} meetings={meetings ?? []} />
          )}

          {splitRows.length > 0 && (
            <TeamSplit projectId={projectId} rows={splitRows} canEdit={canEditSplit} locked={released} />
          )}

          {holds.length > 0 && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('المال', 'The money')}</h3>
              <div className="stack" style={{ marginTop: 12 }}>
                {holds.map((hold) => (
                  <article key={hold.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                    <div className="row-between">
                      <span className="id-chip">{hold.escrow_code}</span>
                      <span className={`status-pill ${ESCROW_STATUS[hold.status].className}`}>
                        {t(ESCROW_STATUS[hold.status].text)}
                      </span>
                    </div>
                    <p className="eng" style={{ fontWeight: 600, marginTop: 8 }}>
                      {money(hold.amount_usd)}
                      <span className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
                        {' '}({t('عمولة', 'commission')} {money(hold.commission_usd)} · {t('صافي', 'net')} {money(hold.net_usd)})
                      </span>
                    </p>
                    {hold.dispute_reason_ar && (
                      <p className="notice notice-danger" style={{ marginTop: 8 }}>{hold.dispute_reason_ar}</p>
                    )}

                    {hold.status === 'awaiting_payment' && hold.payer_id === user.id && (
                      <div style={{ marginTop: 10 }}>
                        <EscrowProofForm escrowId={hold.id} revalidate={`/projects/${projectId}`}
                                         userId={user.id} payment={instructionsFor.get(hold.id) ?? null} />
                      </div>
                    )}

                    <EscrowControls
                      escrowId={hold.id}
                      isPayer={hold.payer_id === user.id}
                      status={hold.status}
                      revalidate={`/projects/${projectId}`}
                    />
                  </article>
                ))}
              </div>

              <p className="muted" style={{ fontSize: '0.76rem', marginTop: 12 }}>
                {t('المبلغ المحتجز يظهر في محفظة المنفّذ ولا يُصرف إلا بعد إفراج العميل.',
                   'Held money shows in the freelancer’s wallet and is not spendable until the client releases it.')}
              </p>
            </div>
          )}

          {isClient && !openHold && (
            <OpenEscrowForm
              projectId={projectId}
              payeeId={project.owner_id}
              payeeName={nameOf.get(project.owner_id) ?? ''}
              methods={(methods ?? []) as PaymentMethodPublic[]}
              suggested={suggested}
              commissionOf={commission ?? null}
            />
          )}

          {isClient && released && !review && <ClientReviewForm projectId={projectId} />}

          {isOwner && project.client_id && released && !workerReview && (
            <WorkerReviewForm projectId={projectId} />
          )}

          {workerReview && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('تقييم المنفّذ للعميل', 'What the freelancer said about the client')}</h3>
              <p style={{ marginTop: 8 }}><Stars value={workerReview.stars} /></p>
              {workerReview.comment_ar && (
                <p className="muted" style={{ fontSize: '0.86rem' }}>{workerReview.comment_ar}</p>
              )}
            </div>
          )}

          {review && (
            <div className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('تقييم العميل', 'The client’s review')}</h3>
              <p style={{ marginTop: 8 }}><Stars value={review.stars} /></p>
              {review.comment_ar && (
                <p className="muted" style={{ fontSize: '0.86rem' }}>{review.comment_ar}</p>
              )}
            </div>
          )}

          {canSell && <SellForm projectId={projectId} listing={listing ?? null} />}

          {isOwner && listing && listing.status === 'listed' && (
            <div className="panel section-block">
              <div className="row-between">
                <span className="muted" style={{ fontSize: '0.86rem' }}>
                  {t('معروض للبيع بـ ', 'On sale for ')}<span className="eng">{money(listing.price_usd)}</span>
                </span>
                <WithdrawListing listingId={listing.id} revalidate={`/projects/${projectId}`} />
              </div>
            </div>
          )}
        </section>

        <aside className="panel">
          <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('ماذا بعد؟', 'What comes next')}</h3>

          <ul className="plain-list" style={{ fontSize: '0.86rem' }}>
            <li>
              {t('واجهت مشكلة؟ ', 'Stuck on something? ')}
              <Link href="/mentors">{t('احجز جلسة مع منتور', 'Book a mentor')}</Link>
            </li>
            {isOwner && project.status === 'completed' && !entry && (
              <li>
                {t('انتهى العمل — ', 'The work is done — ')}
                <Link href="/exhibition">{t('اعرضه في المعرض بعد تقييمه', 'submit it to the exhibition')}</Link>
              </li>
            )}
            {entry && (
              <li>
                {t('هذا العمل في المعرض. ', 'This work is in the exhibition. ')}
                <Link href="/exhibition">{t('افتحه', 'Open it')}</Link>
              </li>
            )}
            {isClient && (
              <li className="muted">
                {t('أنت ترى هذا العمل كصاحب الفرصة — التعديل لمن ينفّذه.',
                   'You see this as the client — changing it belongs to whoever is doing it.')}
              </li>
            )}
          </ul>

          <p className="muted" style={{ fontSize: '0.76rem', marginTop: 14 }}>
            {t('العمل المنجز هنا هو ما يُقيَّم ويُعرض ويُبنى عليه سجلّك — لا مجرد سطر في سيرة ذاتية.',
               'Work finished here is what gets evaluated, exhibited and built into your record — not a line on a CV.')}
          </p>
        </aside>
      </div>
    </>
  );
}
