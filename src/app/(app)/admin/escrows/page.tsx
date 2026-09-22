import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDateTime } from '@/lib/i18n';
import { money } from '@/lib/booking';

import { ESCROW_STATUS } from '../../projects/[projectId]/Money';
import { settleEscrow } from './actions';

export const metadata = { title: 'Escrow — TechMood' };

/**
 * The money TechMood is holding, and the arguments about it.
 *
 * An admin does not touch a hold the two sides agree about — the payer releases
 * that one themselves. What lands here is a disagreement, and it is settled one
 * way or the other with a reason both sides are told.
 */
export default async function AdminEscrowsPage() {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return <p className="notice notice-danger">{t('هذه الصفحة للمشرفين فقط.', 'This page is for admins only.')}</p>;
  }

  const { data: escrows } = await supabase
    .from('escrows')
    .select('id, escrow_code, kind, project_id, payer_id, payee_id, amount_usd, commission_usd, net_usd, status, dispute_reason_ar, created_at')
    .order('created_at', { ascending: false });

  const rows = escrows ?? [];
  const ids = [...new Set(rows.flatMap((row) => [row.payer_id, row.payee_id]))];

  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const nameOf = new Map((people ?? []).map((row) => [row.id, row.full_name]));
  const disputed = rows.filter((row) => row.status === 'disputed');
  const held = rows.filter((row) => row.status === 'funded');
  const settled = rows.filter((row) => !['disputed', 'funded'].includes(row.status));

  const card = (row: typeof rows[number], withDecision: boolean) => (
    <article className="panel section-block" key={row.id}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="id-chip">{row.escrow_code}</span>
          <h3 style={{ fontSize: '0.98rem', marginTop: 8 }}>
            {nameOf.get(row.payer_id) ?? '—'} → {nameOf.get(row.payee_id) ?? '—'}
          </h3>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            {row.kind === 'project_sale' ? t('شراء مشروع', 'A project sale') : t('عمل عبر السوق', 'Market work')}
            {' · '}{formatDateTime(locale, row.created_at)}
          </p>
        </div>
        <div style={{ textAlign: 'start' }}>
          <span className={`status-pill ${ESCROW_STATUS[row.status].className}`}>
            {t(ESCROW_STATUS[row.status].text)}
          </span>
          <p className="eng" style={{ fontWeight: 700, marginTop: 8 }}>{money(row.amount_usd)}</p>
          <p className="muted eng" style={{ fontSize: '0.76rem' }}>
            {t('عمولة', 'commission')} {money(row.commission_usd)}
          </p>
        </div>
      </div>

      {row.dispute_reason_ar && (
        <p className="notice notice-danger" style={{ marginTop: 12 }}>{row.dispute_reason_ar}</p>
      )}

      {row.project_id && (
        <Link className="btn btn-ghost btn-sm" href={`/projects/${row.project_id}`} style={{ marginTop: 12 }}>
          {t('اطّلع على العمل', 'Look at the work')}
        </Link>
      )}

      {withDecision && (
        <form action={settleEscrow} className="row-actions" style={{ marginTop: 14 }}>
          <input type="hidden" name="escrow_id" value={row.id} />
          <input
            name="reason"
            className="invite-message"
            placeholder={t('سبب القرار — يصل الطرفين', 'Why — both sides are told')}
            aria-label={t('سبب القرار', 'Reason')}
          />
          <button className="btn btn-primary btn-sm" name="decision" value="release">
            {t('أفرج للمنفّذ', 'Release to the worker')}
          </button>
          <button className="btn btn-ghost btn-sm" name="decision" value="refund">
            {t('أعِد للعميل', 'Refund the client')}
          </button>
        </form>
      )}
    </article>
  );

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('الأموال المحتجزة', 'Money being held')}</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin">{t('لوحة الإدارة', 'Admin panel')}</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('الحجز الذي يتفق عليه الطرفان يفرج عنه الدافع بنفسه — لا دور للإدارة فيه. ما يصل هنا هو الخلاف، ويُحسم بقرار واحد يعرف الطرفان سببه.',
             'A hold the two sides agree about is released by the payer — the platform has no part in it. What arrives here is a disagreement, settled one way with a reason both sides can read.')}
        </p>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('نزاعات', 'Disputes')} ({disputed.length})</h3>
        {disputed.length === 0
          ? <p className="notice">{t('لا نزاعات مفتوحة.', 'No open disputes.')}</p>
          : disputed.map((row) => card(row, true))}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('محتجز الآن', 'Held right now')} ({held.length})</h3>
        {held.length === 0
          ? <p className="notice">{t('لا مبالغ محتجزة.', 'Nothing held.')}</p>
          : held.map((row) => card(row, false))}
      </section>

      {settled.length > 0 && (
        <section className="section-block">
          <h3 className="academy-heading">{t('انتهت', 'Settled')}</h3>
          {settled.slice(0, 20).map((row) => card(row, false))}
        </section>
      )}
    </>
  );
}
