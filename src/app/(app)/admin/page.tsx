import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import type { Text } from '@/lib/i18n';
import { IS_MVP } from '@/lib/scope';

import { RoleReviewForm } from './RoleReviewForm';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

export const generateMetadata = localizedTitle('لوحة الإدارة — TechMood', 'Admin — TechMood');

const ALL_ITEM_LABELS: Record<string, Text> = {
  role_application:     { ar: 'طلب دور',                  en: 'Role request' },
  submission:           { ar: 'تسليم بانتظار التقييم',    en: 'Submission awaiting evaluation' },
  payment:              { ar: 'دفعة بانتظار التحقق',      en: 'Payment awaiting verification' },
  incubator_application:{ ar: 'طلب حاضنة',                en: 'Incubator application' },
  exhibition_entry:     { ar: 'مشروع للمعرض',             en: 'Exhibition entry' },
  payout_request:       { ar: 'طلب سحب',                  en: 'Payout request' },
  reevaluation_request: { ar: 'طلب إعادة تقييم',          en: 'Re-evaluation request' },
};

// The incubator is outside the MVP (src/lib/scope.ts).
const ITEM_LABELS = Object.fromEntries(
  Object.entries(ALL_ITEM_LABELS).filter(([kind]) => !IS_MVP || kind !== 'incubator_application'),
);

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

  const [{ data: queue }, { data: overviewRows }, { data: feed }, { data: me }, { data: disputes }, { data: listings }] = await Promise.all([
    supabase.from('admin_review_queue').select('*').order('created_at', { ascending: true }),
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_event_feed', { p_limit: 30 }),
    supabase.from('profiles').select('display_name, full_name').eq('id', user.id).single(),
    supabase.rpc('admin_attendance_disputes'),
    supabase.rpc('admin_pending_listings'),
  ]);
  const overview = overviewRows?.[0];
  const hour = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: PLATFORM_TIME_ZONE }).format(new Date()));
  const greeting = hour < 12 ? t('صباح الخير', 'Good morning') : hour < 18 ? t('مساء الخير', 'Good afternoon') : t('مساء الخير', 'Good evening');
  const firstName = (me?.display_name ?? me?.full_name ?? '').split(' ')[0];
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' });
  const attention = overview ? [
    { tone: 'red', value: overview.high_priority_reports, label: t('بلاغات عالية الأولوية', 'High-priority reports'), href: '/admin/support?filter=escalated' },
    { tone: 'orange', value: overview.pending_payments, label: t('مدفوعات بانتظار المراجعة', 'Payments to review'), href: '/admin/payments' },
    { tone: 'yellow', value: overview.mentor_applications, label: t('طلبات منتورز', 'Mentor applications'), href: '/admin/role-requests' },
    { tone: 'blue', value: overview.escalations, label: t('تصعيدات تحتاج شخصاً', 'Escalations needing a person'), href: '/admin/support?filter=escalated' },
    { tone: 'purple', value: overview.pending_withdrawals, label: t('طلبات سحب', 'Withdrawals'), href: '/admin/payouts' },
    { tone: 'red', value: overview.refunds_owed, label: t('مبالغ مستحقة الإرجاع', 'Refunds owed'), href: '/admin/pricing' },
    { tone: 'orange', value: overview.open_cases, label: t('قضايا مفتوحة', 'Open cases'), href: '/admin/cases' },
    { tone: 'red', value: disputes?.length ?? 0, label: t('بلاغات غياب منتور', 'Mentor absence reports'), href: '/admin/pricing' },
    { tone: 'yellow', value: listings?.length ?? 0, label: t('مشاريع للبيع بانتظار المراجعة', 'Listings to review'), href: '/admin/market' },
  ].filter((card) => card.value > 0) : [];

  const { data: pendingRoles } = await supabase
    .from('profile_roles')
    .select('id, role, status, application_note, evidence_url, profiles(full_name, techmood_id)')
    .eq('status', 'pending_review');

  const byKind = (kind: string) => (queue ?? []).filter((item) => item.item_kind === kind);

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{greeting}{firstName ? `${t('، ', ', ')}${firstName}` : ''}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6 }}>
          {t('مركز تحكم تكمود: ما يحتاج انتباهك أولاً، ثم كل ما يحدث على المنصة. كل إجراء هنا يُسجَّل في سجل التدقيق.',
             'TechMood Control Center: what needs your attention first, then everything happening on the platform. Every action here is written to the audit log.')}
        </p>
      </section>

      {overview && (
        <section className="section-block">
          <h3 className="academy-heading">{t('نظرة على المنصة', 'Platform overview')}</h3>
          <div className="stat-tiles cols-4">
            <div className="stat-tile"><div className="val eng">{overview.users}</div><div className="lbl">{t('المستخدمون', 'Users')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.active_today}</div><div className="lbl">{t('نشطون اليوم', 'Active today')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.mentors}</div><div className="lbl">{t('المنتورز', 'Mentors')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.open_tickets}</div><div className="lbl">{t('بلاغات مفتوحة', 'Open tickets')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.pending_payments}</div><div className="lbl">{t('مدفوعات معلّقة', 'Pending payments')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.pending_withdrawals}</div><div className="lbl">{t('سحوبات معلّقة', 'Pending withdrawals')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.open_reports}</div><div className="lbl">{t('بلاغات عن أشخاص', 'Reports about people')}</div></div>
            <div className="stat-tile"><div className="val eng">{overview.escalations}</div><div className="lbl">{t('تصعيدات', 'Escalations')}</div></div>
          </div>
        </section>
      )}

      <section className="section-block">
        <h3 className="academy-heading">⚠️ {t('يحتاج انتباهك', 'Requires attention')}</h3>
        {attention.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>{t('لا شيء ينتظرك الآن.', 'Nothing is waiting on you right now.')}</p>
        ) : (
          <div className="attention-grid">
            {attention.map((card) => (
              <Link key={card.label} className={`attention-card tone-${card.tone}`} href={card.href}>
                <span className="val eng">{card.value}</span>
                <span>{card.label}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('ما يحدث على تكمود', 'What is happening on TechMood')}</h3>
        {(feed ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.88rem' }}>{t('لا نشاط بعد.', 'No activity yet.')}</p>
        ) : (
          <ul className="event-feed">
            {(feed ?? []).map((event, index) => (
              <li key={index}>
                <span className={`ev-dot dot-${event.tone}`} aria-hidden />
                <span className="ev-title">
                  {event.link ? <Link href={event.link}>{event.title_ar}</Link> : event.title_ar}
                </span>
                <span className="ev-meta">
                  {event.profile_id && (
                    <Link href={`/admin/users/${event.profile_id}`}>{t('الشخص', 'Person')}</Link>
                  )}
                  <time>{time.format(new Date(event.at))}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('قائمة المراجعة', 'Review queue')}</h3>
        <div className="stat-tiles cols-3">
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
          {!IS_MVP && byKind('incubator_application').length > 0 && (
            <Link className="btn btn-sky btn-sm" href="/admin/incubator">
              {t('راجع طلبات الحاضنة', 'Review incubator')} ({byKind('incubator_application').length})
            </Link>
          )}
          {/* Not a queue: the catalogue is always open for writing. */}
          <Link className="btn btn-ghost btn-sm" href="/admin/academy">
            {t('اكتب محتوى الأكاديمية', 'Write academy content')}
          </Link>
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('طلبات الأدوار', 'Role requests')}</h3>
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
        <h3 className="academy-heading">{t('بقية قائمة المراجعة', 'The rest of the queue')}</h3>
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
                    <td style={{ whiteSpace: 'nowrap' }}>
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
