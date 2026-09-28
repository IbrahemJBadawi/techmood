import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FeedbackSummary } from '@/components/FeedbackSummary';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/booking';
import { CASE_STATUS, FEATURE } from '@/lib/cases';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { ROLE_BY_VALUE } from '@/lib/roles';
import { TICKET_CATEGORY, TICKET_STATUS } from '@/lib/support';
import type { Text } from '@/lib/i18n';

export const generateMetadata = localizedTitle('مستخدم — إدارة TechMood', 'User — TechMood admin');

const TABS: { key: string; label: Text }[] = [
  { key: 'overview',   label: { ar: 'نظرة عامة', en: 'Overview' } },
  { key: 'roles',      label: { ar: 'الأدوار', en: 'Roles' } },
  { key: 'academy',    label: { ar: 'الأكاديمية', en: 'Academy' } },
  { key: 'mentorship', label: { ar: 'الإرشاد', en: 'Mentorship' } },
  { key: 'teams',      label: { ar: 'الفرق', en: 'Teams' } },
  { key: 'work',       label: { ar: 'العمل', en: 'Work' } },
  { key: 'wallet',     label: { ar: 'المحفظة', en: 'Wallet' } },
  { key: 'reviews',    label: { ar: 'التقييمات', en: 'Reviews' } },
  { key: 'reports',    label: { ar: 'البلاغات عنه', en: 'Reports' } },
  { key: 'support',    label: { ar: 'الدعم', en: 'Support' } },
  { key: 'activity',   label: { ar: 'النشاط', en: 'Activity' } },
  { key: 'reputation', label: { ar: 'السمعة', en: 'Reputation' } },
];

const AREA: Record<string, Text> = {
  support: { ar: 'الدعم', en: 'Support' }, reports: { ar: 'بلاغات', en: 'Reports' },
  mentorship: { ar: 'الإرشاد', en: 'Mentorship' }, wallet: { ar: 'المال', en: 'Money' },
  academy: { ar: 'الأكاديمية', en: 'Academy' }, teams: { ar: 'الفرق', en: 'Teams' },
  roles: { ar: 'الأدوار', en: 'Roles' }, moderation: { ar: 'الإشراف', en: 'Moderation' },
  reviews: { ar: 'التقييمات', en: 'Reviews' },
};

const NONE = ['00000000-0000-0000-0000-000000000000'];

/**
 * The unified user profile: one person across the whole platform, tied to
 * their TechMood ID — so the administration reads the whole story instead of
 * walking ten pages. Every tab is a read of rows that already exist.
 */
export default async function AdminUserPage({
  params, searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profileId } = await params;
  const { tab: raw } = await searchParams;
  const tab = TABS.some((item) => item.key === raw) ? raw! : 'overview';
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const [{ data: person }, { data: summary }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id, username, headline, created_at').eq('id', profileId).maybeSingle(),
    supabase.rpc('admin_user_summary', { p_profile: profileId }),
  ]);
  if (!person || !summary) notFound();

  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium' });
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'short', timeStyle: 'short' });
  const approvedRoles = summary.roles.filter((row) => row.status === 'approved');

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/admin/users">{t('→ المستخدمون', '← Users')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{person.full_name}</h2>
            <p style={{ marginTop: 6 }}>
              <span className="id-chip">TechMood ID: {person.techmood_id}</span>
              {person.username && <span className="muted eng" style={{ marginInlineStart: 8 }}>@{person.username}</span>}
            </p>
            <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
              {approvedRoles.map((row) => t(ROLE_BY_VALUE[row.role].label)).join(' · ')}
            </p>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <Link className="btn btn-ghost btn-sm" href={`/u/${person.techmood_id}`}>{t('الملف العام', 'Public profile')}</Link>
            {summary.active_restrictions.length > 0 && <span className="status-pill status-danger">{t('مقيّد', 'Restricted')}</span>}
          </div>
        </div>
      </section>

      <nav className="user-tabs">
        {TABS.map((item) => (
          <Link key={item.key} className={`chip${item.key === tab ? ' is-active' : ''}`} href={`/admin/users/${profileId}?tab=${item.key}`}>
            {t(item.label)}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="stat-tiles cols-3 section-block">
            <div className="stat-tile"><div className="val eng">{summary.xp}</div><div className="lbl">XP</div></div>
            <div className="stat-tile"><div className="val eng">{summary.stars != null ? Number(summary.stars).toFixed(1) : '—'}★</div><div className="lbl">{t('النجوم', 'Stars')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.certificates}</div><div className="lbl">{t('شهادات', 'Certificates')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.bookings}</div><div className="lbl">{t('حجوزات', 'Bookings')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.sessions_as_mentor}</div><div className="lbl">{t('جلسات أدارها', 'Sessions mentored')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.teams}</div><div className="lbl">{t('فرق', 'Teams')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.projects}</div><div className="lbl">{t('مشاريع', 'Projects')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.reports_about}</div><div className="lbl">{t('بلاغات عنه', 'Reports about')}</div></div>
            <div className="stat-tile"><div className="val eng">{summary.warnings}</div><div className="lbl">{t('تنبيهات', 'Warnings')}</div></div>
          </div>

          {summary.active_restrictions.length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('قيود سارية', 'Restrictions in force')}</h3>
              <ul className="admin-mini-list" style={{ marginTop: 8 }}>
                {summary.active_restrictions.map((row) => (
                  <li key={row.id}>
                    <span className="status-pill status-danger">{row.feature === 'everything' ? t('الحساب كله', 'Whole account') : t(FEATURE[row.feature])}</span>
                    <span>{row.reason}</span>
                    <span className="muted">{row.ends_at ? date.format(new Date(row.ends_at)) : t('حتى يُرفع', 'until lifted')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {summary.cases.length > 0 && (
            <section className="panel section-block">
              <h3 style={{ fontSize: '0.98rem' }}>{t('القضايا', 'Cases')}</h3>
              <ul className="admin-mini-list" style={{ marginTop: 8 }}>
                {summary.cases.map((row) => (
                  <li key={row.id}>
                    <Link href={`/admin/cases/${row.id}`}><span className="eng">#{row.code}</span> {row.title}</Link>
                    <span className={`status-pill ${CASE_STATUS[row.status].className}`}>{t(CASE_STATUS[row.status].label)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'roles' && (
        <section className="panel section-block">
          <ul className="admin-mini-list">
            {summary.roles.map((row) => (
              <li key={row.role}><strong>{t(ROLE_BY_VALUE[row.role].label)}</strong><span className="tag">{row.status}</span></li>
            ))}
          </ul>
          <Link className="btn btn-ghost btn-sm" href="/admin/role-requests" style={{ marginTop: 10 }}>{t('طلبات الأدوار', 'Role requests')}</Link>
        </section>
      )}

      {tab === 'academy' && <AcademyTab profileId={profileId} />}
      {tab === 'mentorship' && <MentorshipTab profileId={profileId} />}
      {tab === 'teams' && <TeamsTab profileId={profileId} />}
      {tab === 'work' && <WorkTab profileId={profileId} />}
      {tab === 'wallet' && <WalletTab profileId={profileId} available={summary.wallet_available} pending={summary.wallet_pending} />}
      {tab === 'reviews' && <FeedbackSummary profileId={profileId} isMentor={approvedRoles.some((row) => row.role === 'mentor')} />}
      {(tab === 'reports' || tab === 'support') && <TicketsTab profileId={profileId} about={tab === 'reports'} />}
      {tab === 'reputation' && <ReputationTab profileId={profileId} />}

      {tab === 'activity' && (
        <ActivityTab profileId={profileId} format={(value) => time.format(new Date(value))} />
      )}
    </>
  );

  async function AcademyTab({ profileId: id }: { profileId: string }) {
    const [{ data: enrolments }, { data: certificates }] = await Promise.all([
      supabase.from('enrollments').select('id, enrolled_at, completed_at, learning_paths(title_ar), courses(title_ar)').eq('profile_id', id),
      supabase.from('certificates').select('id, certificate_code, kind, issued_at, status').eq('profile_id', id).order('issued_at', { ascending: false }),
    ]);
    return (
      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('المسارات والدورات', 'Paths and courses')}</h3>
        <ul className="admin-mini-list" style={{ marginTop: 8 }}>
          {(enrolments ?? []).map((row) => {
            const path = row.learning_paths as unknown as { title_ar: string } | null;
            const course = row.courses as unknown as { title_ar: string } | null;
            return (
              <li key={row.id}>
                <span>{path?.title_ar ?? course?.title_ar}</span>
                <span className="muted">{date.format(new Date(row.enrolled_at))}</span>
                {row.completed_at && <span className="status-pill status-ok">{t('مكتمل', 'Completed')}</span>}
              </li>
            );
          })}
        </ul>
        <h3 style={{ fontSize: '0.98rem', marginTop: 14 }}>{t('الشهادات', 'Certificates')}</h3>
        <ul className="admin-mini-list" style={{ marginTop: 8 }}>
          {(certificates ?? []).map((row) => (
            <li key={row.id}><span className="eng">{row.certificate_code}</span><span className="tag">{row.kind}</span><span className="muted">{date.format(new Date(row.issued_at))}</span><span className="tag">{row.status}</span></li>
          ))}
        </ul>
      </section>
    );
  }

  async function MentorshipTab({ profileId: id }: { profileId: string }) {
    const { data: bookings } = await supabase.from('bookings')
      .select('id, booking_code, status, scheduled_start, price_usd, student_id, mentor_id')
      .or(`student_id.eq.${id},mentor_id.eq.${id}`).order('scheduled_start', { ascending: false }).limit(50);
    return (
      <section className="panel section-block">
        <table className="data">
          <thead><tr><th>{t('الحجز', 'Booking')}</th><th>{t('الدور', 'As')}</th><th>{t('الموعد', 'When')}</th><th>{t('المبلغ', 'Amount')}</th><th>{t('الحالة', 'Status')}</th></tr></thead>
          <tbody>
            {(bookings ?? []).map((row) => (
              <tr key={row.id}>
                <td className="eng">{row.booking_code}</td>
                <td>{row.mentor_id === id ? t('منتور', 'Mentor') : t('متعلّم', 'Learner')}</td>
                <td className="muted">{date.format(new Date(row.scheduled_start))}</td>
                <td className="eng">{money(row.price_usd)}</td>
                <td><span className="tag">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  async function TeamsTab({ profileId: id }: { profileId: string }) {
    const { data: memberships } = await supabase.from('team_members').select('team_id, role, joined_at, is_active').eq('profile_id', id);
    const ids = (memberships ?? []).map((row) => row.team_id);
    const { data: teams } = await supabase.from('teams').select('id, title_ar, team_code').in('id', ids.length ? ids : NONE);
    const titleOf = new Map((teams ?? []).map((row) => [row.id, `${row.title_ar} (${row.team_code})`]));
    return (
      <section className="panel section-block">
        <ul className="admin-mini-list">
          {(memberships ?? []).map((row) => (
            <li key={row.team_id}>
              <Link href={`/teams/${row.team_id}`}>{titleOf.get(row.team_id)}</Link>
              <span className="tag">{row.role}</span>
              <span className="muted">{date.format(new Date(row.joined_at))}</span>
              {!row.is_active && <span className="tag">{t('غادر', 'Left')}</span>}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  async function WorkTab({ profileId: id }: { profileId: string }) {
    const [{ data: projects }, { data: escrows }] = await Promise.all([
      supabase.from('projects').select('id, code, title_ar, status, owner_id, client_id')
        .or(`owner_id.eq.${id},client_id.eq.${id}`).order('updated_at', { ascending: false }).limit(50),
      supabase.from('escrows').select('id, escrow_code, status, amount_usd, payer_id')
        .or(`payer_id.eq.${id},payee_id.eq.${id}`).order('created_at', { ascending: false }).limit(50),
    ]);
    return (
      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('المشاريع', 'Projects')}</h3>
        <ul className="admin-mini-list" style={{ marginTop: 8 }}>
          {(projects ?? []).map((row) => (
            <li key={row.id}>
              <Link href={`/projects/${row.id}`}><span className="eng">{row.code}</span> {row.title_ar}</Link>
              <span className="tag">{row.client_id === id ? t('عميل', 'Client') : t('منفّذ', 'Doing the work')}</span>
              <span className="tag">{row.status}</span>
            </li>
          ))}
        </ul>
        <h3 style={{ fontSize: '0.98rem', marginTop: 14 }}>{t('المبالغ المحتجزة', 'Escrow')}</h3>
        <ul className="admin-mini-list" style={{ marginTop: 8 }}>
          {(escrows ?? []).map((row) => (
            <li key={row.id}>
              <span className="eng">{row.escrow_code}</span>
              <span className="eng">{money(row.amount_usd)}</span>
              <span className="tag">{row.payer_id === id ? t('دافع', 'Payer') : t('مستفيد', 'Payee')}</span>
              <span className="tag">{row.status}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  async function WalletTab({ profileId: id, available, pending }: { profileId: string; available: number | null; pending: number | null }) {
    const { data: entries } = await supabase.from('wallet_entries')
      .select('id, kind, amount_usd, status, description_ar, created_at').eq('profile_id', id)
      .order('created_at', { ascending: false }).limit(50);
    return (
      <section className="panel section-block">
        <div className="stat-tiles">
          <div className="stat-tile"><div className="val eng">{money(available ?? 0)}</div><div className="lbl">{t('متاح', 'Available')}</div></div>
          <div className="stat-tile"><div className="val eng">{money(pending ?? 0)}</div><div className="lbl">{t('معلّق', 'Pending')}</div></div>
        </div>
        <ul className="admin-mini-list" style={{ marginTop: 12 }}>
          {(entries ?? []).map((row) => (
            <li key={row.id}>
              <span className="tag">{row.kind}</span>
              <span className="eng">{money(row.amount_usd)}</span>
              <span>{row.description_ar}</span>
              <span className="tag">{row.status}</span>
              <span className="muted">{date.format(new Date(row.created_at))}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  async function TicketsTab({ profileId: id, about }: { profileId: string; about: boolean }) {
    const [{ data: tickets }, { data: warnings }] = await Promise.all([
      supabase.from('support_tickets').select('id, code, category, subject_ar, status, created_at')
        .eq(about ? 'reported_profile_id' : 'reporter_id', id).order('created_at', { ascending: false }),
      about
        ? supabase.from('user_warnings').select('id, reason_ar, created_at').eq('profile_id', id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as { id: string; reason_ar: string; created_at: string }[] }),
    ]);
    return (
      <section className="panel section-block">
        <ul className="admin-mini-list">
          {(tickets ?? []).map((row) => (
            <li key={row.id}>
              <Link href={`/admin/support/${row.id}`}><span className="eng">#{row.code}</span> {row.subject_ar}</Link>
              <span className="tag">{t(TICKET_CATEGORY[row.category])}</span>
              <span className={`status-pill ${TICKET_STATUS[row.status].className}`}>{t(TICKET_STATUS[row.status].label)}</span>
            </li>
          ))}
        </ul>
        {(warnings ?? []).length > 0 && (
          <>
            <h3 style={{ fontSize: '0.98rem', marginTop: 14 }}>{t('التنبيهات', 'Warnings')}</h3>
            <ul className="admin-mini-list" style={{ marginTop: 8 }}>
              {(warnings ?? []).map((row) => (
                <li key={row.id}><span>{row.reason_ar}</span><span className="muted">{date.format(new Date(row.created_at))}</span></li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  async function ReputationTab({ profileId: id }: { profileId: string }) {
    const [{ data: scores }, { data: dimensions }] = await Promise.all([
      supabase.from('reputation_scores').select('dimension, value, updated_at').eq('profile_id', id),
      supabase.from('reputation_dimensions').select('slug, name_ar'),
    ]);
    const nameOf = new Map((dimensions ?? []).map((row) => [row.slug, row.name_ar]));
    return (
      <section className="panel section-block">
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          {t('السمعة طويلة المدى، محسوبة من تقييمات حقيقية؛ البعد الذي لا دليل عليه لا يظهر.', 'Long-term reputation, computed from real ratings; a dimension without evidence is not shown.')}
        </p>
        <ul className="admin-mini-list" style={{ marginTop: 8 }}>
          {(scores ?? []).map((row) => (
            <li key={row.dimension}><span>{nameOf.get(row.dimension) ?? row.dimension}</span><span className="eng">{Math.round(row.value)}/100</span></li>
          ))}
        </ul>
      </section>
    );
  }

  async function ActivityTab({ profileId: id, format }: { profileId: string; format: (value: string) => string }) {
    const { data: activity } = await supabase.rpc('admin_user_activity', { p_profile: id, p_limit: 200 });
    return (
      <section className="panel section-block">
        <ul className="finance-timeline">
          {(activity ?? []).map((row, index) => (
            <li key={index}>
              <span className="finance-dot">•</span>
              <div>
                <strong style={{ fontSize: '0.84rem' }}>
                  {row.link ? <Link href={row.link}>{row.title_ar}</Link> : row.title_ar}
                </strong>
                <div className="muted" style={{ fontSize: '0.74rem' }}>{format(row.at)} · {AREA[row.area] ? t(AREA[row.area]) : row.area}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
}
