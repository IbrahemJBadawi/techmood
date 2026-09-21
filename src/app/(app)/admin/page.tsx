import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { Text } from '@/lib/i18n';

import { RoleReviewForm } from './RoleReviewForm';

const ITEM_LABELS: Record<string, Text> = {
  role_application:     { ar: 'طلب دور',                  en: 'Role request' },
  submission:           { ar: 'تسليم بانتظار التقييم',    en: 'Submission awaiting evaluation' },
  payment:              { ar: 'دفعة بانتظار التحقق',      en: 'Payment awaiting verification' },
  incubator_application:{ ar: 'طلب حاضنة',                en: 'Incubator application' },
  exhibition_entry:     { ar: 'مشروع للمعرض',             en: 'Exhibition entry' },
  payout_request:       { ar: 'طلب سحب',                  en: 'Payout request' },
  reevaluation_request: { ar: 'طلب إعادة تقييم',          en: 'Re-evaluation request' },
};

export default async function AdminPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return (
      <p className="notice notice-danger">
        {t('هذه الصفحة للمشرفين فقط. الصلاحية تُفحص في قاعدة البيانات، لا في الواجهة.', 'This page is for admins only. The permission is checked in the database, not in the interface.')}
      </p>
    );
  }

  const { data: queue } = await supabase
    .from('admin_review_queue')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: pendingRoles } = await supabase
    .from('profile_roles')
    .select('id, role, status, application_note, evidence_url, profiles(full_name, techmood_id)')
    .eq('status', 'pending_review');

  const byKind = (kind: string) => (queue ?? []).filter((item) => item.item_kind === kind);

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('لوحة الإدارة', 'Admin panel')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('كل ما ينتظر قراراً بشرياً في مكان واحد. كل إجراء هنا يُسجَّل في سجل التدقيق.', 'Everything waiting on a human decision, in one place. Every action here is written to the audit log.')}
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          {Object.entries(ITEM_LABELS).map(([kind, label]) => (
            <div className="stat-tile" key={kind}>
              <div className="val eng">{byKind(kind).length}</div>
              <div className="lbl">{t(label)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {byKind('payment').length > 0 && (
            <Link className="btn btn-primary btn-sm" href="/admin/payments">
              {t('راجع المدفوعات', 'Review payments')} ({byKind('payment').length})
            </Link>
          )}
          {byKind('exhibition_entry').length > 0 && (
            <Link className="btn btn-sky btn-sm" href="/admin/exhibition">
              {t('راجع المعرض', 'Review exhibition')} ({byKind('exhibition_entry').length})
            </Link>
          )}
          {byKind('payout_request').length > 0 && (
            <Link className="btn btn-sky btn-sm" href="/admin/payouts">
              {t('راجع طلبات السحب', 'Review payouts')} ({byKind('payout_request').length})
            </Link>
          )}
          {byKind('incubator_application').length > 0 && (
            <Link className="btn btn-sky btn-sm" href="/admin/incubator">
              {t('راجع طلبات الحاضنة', 'Review incubator')} ({byKind('incubator_application').length})
            </Link>
          )}
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('طلبات الأدوار', 'Role requests')}</h3>
        {(pendingRoles?.length ?? 0) === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>{t('لا طلبات أدوار بانتظار المراجعة 🎉', 'No role requests waiting 🎉')}</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>{t('المتقدّم', 'Applicant')}</th><th>{t('الدور', 'Role')}</th><th>{t('الإثبات', 'Evidence')}</th><th>{t('القرار', 'Decision')}</th></tr>
            </thead>
            <tbody>
              {pendingRoles!.map((request) => {
                const applicant = request.profiles as unknown as { full_name: string; techmood_id: string } | null;
                return (
                  <tr key={request.id}>
                    <td>
                      {applicant?.full_name}
                      <br />
                      <span className="id-chip">{applicant?.techmood_id}</span>
                    </td>
                    <td>{request.role}</td>
                    <td>
                      {request.evidence_url ? (
                        <a className="eng" href={request.evidence_url} target="_blank" rel="noreferrer noopener">
                          {t('رابط', 'Link')}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                      {request.application_note && (
                        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                          {request.application_note}
                        </p>
                      )}
                    </td>
                    <td><RoleReviewForm roleId={request.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('بقية قائمة المراجعة', 'The rest of the queue')}</h3>
        {(queue ?? []).filter((item) => item.item_kind !== 'role_application').length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>{t('لا عناصر أخرى بانتظار المراجعة.', 'Nothing else waiting.')}</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>{t('النوع', 'Kind')}</th><th>{t('الموضوع', 'Subject')}</th><th>{t('التفصيل', 'Detail')}</th><th>{t('التاريخ', 'Date')}</th></tr>
            </thead>
            <tbody>
              {(queue ?? [])
                .filter((item) => item.item_kind !== 'role_application')
                .map((item) => (
                  <tr key={`${item.item_kind}-${item.item_id}`}>
                    <td>{ITEM_LABELS[item.item_kind] ? t(ITEM_LABELS[item.item_kind]) : item.item_kind}</td>
                    <td>{item.subject ?? '—'}</td>
                    <td>{item.detail ?? '—'}</td>
                    <td className="eng">
                      {item.created_at ? formatDate(t.locale, item.created_at) : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
