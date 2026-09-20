import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { RoleReviewForm } from './RoleReviewForm';

const ITEM_LABELS: Record<string, string> = {
  role_application: 'طلب دور',
  submission: 'تسليم بانتظار التقييم',
  payment: 'دفعة بانتظار التحقق',
  incubator_application: 'طلب حاضنة',
  exhibition_entry: 'مشروع للمعرض',
  reevaluation_request: 'طلب إعادة تقييم',
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return (
      <p className="notice notice-danger">
        هذه الصفحة للمشرفين فقط. الصلاحية تُفحص في قاعدة البيانات، لا في الواجهة.
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
        <h2 style={{ fontSize: '1.2rem' }}>لوحة الإدارة</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          كل ما ينتظر قراراً بشرياً في مكان واحد. كل إجراء هنا يُسجَّل في سجل التدقيق.
        </p>
      </section>

      <section className="section-block">
        <div className="stat-tiles">
          {Object.entries(ITEM_LABELS).map(([kind, label]) => (
            <div className="stat-tile" key={kind}>
              <div className="val eng">{byKind(kind).length}</div>
              <div className="lbl">{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          {byKind('payment').length > 0 && (
            <Link className="btn btn-primary btn-sm" href="/admin/payments">
              راجع المدفوعات ({byKind('payment').length})
            </Link>
          )}
          {byKind('exhibition_entry').length > 0 && (
            <Link className="btn btn-sky btn-sm" href="/admin/exhibition">
              راجع المعرض ({byKind('exhibition_entry').length})
            </Link>
          )}
        </div>
      </section>

      <section className="section-block">
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>طلبات الأدوار</h3>
        {(pendingRoles?.length ?? 0) === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>لا طلبات أدوار بانتظار المراجعة 🎉</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>المتقدّم</th><th>الدور</th><th>الإثبات</th><th>القرار</th></tr>
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
                          رابط
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
        <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>بقية قائمة المراجعة</h3>
        {(queue ?? []).filter((item) => item.item_kind !== 'role_application').length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>لا عناصر أخرى بانتظار المراجعة.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>النوع</th><th>الموضوع</th><th>التفصيل</th><th>التاريخ</th></tr>
            </thead>
            <tbody>
              {(queue ?? [])
                .filter((item) => item.item_kind !== 'role_application')
                .map((item) => (
                  <tr key={`${item.item_kind}-${item.item_id}`}>
                    <td>{ITEM_LABELS[item.item_kind] ?? item.item_kind}</td>
                    <td>{item.subject ?? '—'}</td>
                    <td>{item.detail ?? '—'}</td>
                    <td className="eng">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('ar-EG') : '—'}
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
