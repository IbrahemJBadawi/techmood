import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { ROLE_BY_VALUE, roleLabel } from '@/lib/roles';
import { getT } from '@/lib/i18n.server';
import type { Database, UserRole } from '@/lib/database.types';

type Tile = { value: number | string; label: string; href: string };

/**
 * The dashboard follows the role being browsed, and every number on it is a
 * real count from a real table — an empty workspace shows a zero and says what
 * to do about it, rather than a decorative figure.
 */
export async function RoleDashboard({ role, userId }: { role: UserRole; userId: string }) {
  const t = await getT();
  const supabase = await createClient();

  // head: true asks PostgREST for the count and no rows. RLS still applies, so
  // every number here is what this person is allowed to see, not a global total.
  const n = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const from = <T extends keyof Database['public']['Tables']>(table: T) =>
    supabase.from(table).select('*', { count: 'exact', head: true });

  let tiles: Tile[] = [];
  let lede = '';
  let cta: { href: string; label: string } | null = null;

  if (role === 'student') {
    const [inReview, changes, certificates, sessions] = await Promise.all([
      n(from('submissions').eq('profile_id', userId).in('status', ['submitted', 'under_review'])),
      n(from('submissions').eq('profile_id', userId).eq('status', 'changes_requested')),
      n(from('certificates').eq('profile_id', userId).eq('status', 'active')),
      n(from('bookings').eq('student_id', userId).eq('status', 'confirmed')),
    ]);
    lede = t('تتعلّم، تسلّم، ويُراجع عملك إنسان.', 'You learn, you hand work in, and a human reviews it.');
    tiles = [
      { value: inReview, label: t('أعمال قيد المراجعة', 'Work under review'), href: '/academy' },
      { value: changes, label: t('أعمال تنتظر تعديلك', 'Work waiting on your edits'), href: '/academy' },
      { value: certificates, label: t('شهادات موثّقة', 'Verified certificates'), href: '/certificates' },
      { value: sessions, label: t('جلسات إرشاد مؤكدة', 'Confirmed mentoring sessions'), href: '/bookings' },
    ];
    cta = { href: '/academy', label: t('تابع مسارك', 'Continue your path') };
  }

  if (role === 'freelancer') {
    const [open, mine, shortlisted, available] = await Promise.all([
      n(from('opportunities').eq('status', 'published')),
      n(from('opportunity_applications').eq('profile_id', userId)),
      n(from('opportunity_applications').eq('profile_id', userId).eq('stage', 'shortlisted')),
      n(from('wallet_entries').eq('profile_id', userId).eq('status', 'available')),
    ]);
    lede = t('تتقدّم على الفرص، وتنفّذ أعمالاً مدفوعة بسجلّ يثبت جودتها.', 'You apply for openings and do paid work, with a record that proves its quality.');
    tiles = [
      { value: open, label: t('فرص مفتوحة', 'Open postings'), href: '/marketplace' },
      { value: mine, label: t('طلبات تقدّمت بها', 'Applications you sent'), href: '/applications' },
      { value: shortlisted, label: t('في القائمة القصيرة', 'Shortlisted'), href: '/applications' },
      { value: available, label: t('حركات محفظة متاحة', 'Available wallet entries'), href: '/wallet' },
    ];
    cta = { href: '/marketplace', label: t('تصفّح الفرص', 'Browse openings') };
  }

  // The mentee's numbers are the journey, not the receipts: hours spent, the
  // mentors who spent them, and whether the goals behind them closed.
  if (role === 'mentee') {
    const { data } = await supabase.rpc('mentee_overview');
    const m = data?.[0];
    lede = t('الإرشاد ليس مكالمة تُحجز — هو هدف تتابعه عبر جلسات.',
             'Mentoring is not a call you book — it is a goal you follow across sessions.');
    tiles = [
      { value: m?.upcoming ?? 0, label: t('جلسات قادمة', 'Upcoming sessions'), href: '/bookings' },
      { value: m?.goals_active ?? 0, label: t('أهداف مفتوحة', 'Open goals'), href: '/mentorship' },
      { value: m?.sessions_attended ?? 0, label: t('جلسات حضرتها', 'Sessions attended'), href: '/sessions' },
      { value: m?.awaiting_rating ?? 0, label: t('جلسات تنتظر تقييمك', 'Sessions waiting on your rating'), href: '/sessions' },
    ];
    cta = { href: '/mentors', label: t('ابحث عن منتور', 'Find a mentor') };
  }

  // A client's dashboard counts people and money, not postings: the number
  // that matters is how many were actually hired and paid.
  if (role === 'client') {
    const { data } = await supabase.rpc('client_overview');
    const c = data?.[0];
    lede = t('عندك عمل تريد تنفيذه: انشر وصفه، قارن العروض، وتابع التنفيذ حتى التسليم.',
             'You have work you want done: publish the brief, compare the offers, follow it to delivery.');
    tiles = [
      { value: c?.active_projects ?? 0, label: t('مشاريع جارية', 'Active projects'), href: '/marketplace?tab=work' },
      { value: c?.new_proposals ?? 0, label: t('عروض جديدة', 'New proposals'), href: '/client' },
      { value: c?.hires ?? 0, label: t('أشخاص تعاقدت معهم', 'People you hired'), href: '/client' },
      { value: c?.awaiting_review ?? 0, label: t('أعمال تنتظر تقييمك', 'Work waiting on your review'), href: '/marketplace?tab=work' },
    ];
    cta = { href: '/marketplace/new', label: t('انشر مشروعاً', 'Post a project') };
  }

  if (role === 'mentor') {
    const [requests, toReview, upcoming, earnings] = await Promise.all([
      n(from('bookings').eq('mentor_id', userId).eq('status', 'mentor_pending')),
      n(from('submissions').in('status', ['submitted', 'under_review'])),
      n(from('bookings').eq('mentor_id', userId).eq('status', 'confirmed')),
      n(from('wallet_entries').eq('profile_id', userId).eq('kind', 'earning')),
    ]);
    lede = t('مراجعتك هي ما يجعل الشهادة في TechMood تعني شيئاً.', 'Your review is what makes a TechMood certificate mean something.');
    tiles = [
      { value: requests, label: t('طلبات جلسات تنتظرك', 'Session requests waiting on you'), href: '/mentor-requests' },
      { value: toReview, label: t('أعمال بانتظار المراجعة', 'Work waiting for review'), href: '/review' },
      { value: upcoming, label: t('جلسات مؤكدة', 'Confirmed sessions'), href: '/mentor-requests' },
      { value: earnings, label: t('أرباح مسجّلة', 'Recorded earnings'), href: '/wallet' },
    ];
    cta = { href: '/review', label: t('ابدأ المراجعة', 'Start reviewing') };
  }

  if (role === 'team_leader') {
    const [teams, tasks, applications] = await Promise.all([
      n(from('teams').eq('leader_id', userId)),
      n(from('team_tasks').eq('created_by', userId).neq('column_key', 'done')),
      n(from('opportunity_applications').eq('profile_id', userId)),
    ]);
    lede = t('الفريق مساحة عمل مغلقة: مهام وسبرنتات وتسليمات، لا صفحة أخبار.', 'A team is a closed workspace: tasks, sprints and deliverables — not a news feed.');
    tiles = [
      { value: teams, label: t('فرق أقودها', 'Teams you lead'), href: '/teams' },
      { value: tasks, label: t('مهام مفتوحة أنشأتها', 'Open tasks you created'), href: '/teams' },
      { value: applications, label: t('طلبات فريقي', 'My team applications'), href: '/applications' },
    ];
    cta = { href: '/teams', label: t('افتح مساحة الفريق', 'Open the team workspace') };
  }

  if (role === 'founder') {
    const [startups, incubated] = await Promise.all([
      n(from('startups').eq('founder_id', userId)),
      n(from('startups').eq('founder_id', userId).eq('is_in_incubator', true)),
    ]);
    lede = t('من الفكرة إلى نموذج عمل مكتوب — بمراحل واضحة ومراجعة حقيقية.', 'From an idea to a written business model — in clear stages, with real review.');
    tiles = [
      { value: startups, label: t('مشاريع ناشئة', 'Startups'), href: '/startups' },
      { value: incubated, label: t('داخل الحاضنة', 'In the incubator'), href: '/incubator' },
    ];
    cta = { href: '/startups', label: t('افتح مشروعك', 'Open your startup') };
  }

  if (role === 'company') {
    const [posted, open, applicants] = await Promise.all([
      n(from('opportunities').eq('posted_by', userId)),
      n(from('opportunities').eq('posted_by', userId).eq('status', 'published')),
      n(from('opportunity_applications').eq('stage', 'submitted')),
    ]);
    lede = t('تنشر فرصاً وتصل إلى من يملك سجلاً مهنياً يمكن التحقق منه.', 'You publish openings and reach people whose record can be verified.');
    tiles = [
      { value: posted, label: t('فرص نشرتها', 'Postings you published'), href: '/marketplace' },
      { value: open, label: t('ما زالت منشورة', 'Still published'), href: '/marketplace' },
      { value: applicants, label: t('طلبات جديدة', 'New applications'), href: '/applications' },
    ];
    cta = { href: '/marketplace/new', label: t('انشر فرصة', 'Publish an opening') };
  }

  if (role === 'admin') {
    const [roleRequests, terms, payments, payouts] = await Promise.all([
      n(from('profile_roles').in('status', ['pending_review', 'needs_more_info'])),
      n(from('fields').eq('status', 'pending_review')),
      n(from('payments').eq('status', 'under_review')),
      n(from('payout_requests').eq('status', 'requested')),
    ]);
    lede = t('كل قرار هنا يخصّ شخصاً ينتظر ردّاً.', 'Every decision here belongs to somebody waiting on an answer.');
    tiles = [
      { value: roleRequests, label: t('طلبات أدوار', 'Role requests'), href: '/admin/role-requests' },
      { value: terms, label: t('مجالات مقترحة', 'Suggested fields'), href: '/admin/taxonomy' },
      { value: payments, label: t('مدفوعات للتحقق', 'Payments to verify'), href: '/admin/payments' },
      { value: payouts, label: t('طلبات سحب', 'Payout requests'), href: '/admin/payouts' },
    ];
    cta = { href: '/admin/role-requests', label: t('ابدأ بالطلبات', 'Start with the requests') };
  }

  return (
    <section className="section-block">
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: '1.05rem' }}>
          {t(`لوحة ${t(roleLabel(role))}`, `${t(roleLabel(role))} dashboard`)}
        </h2>
        {cta && <Link className="btn btn-ghost btn-sm" href={cta.href}>{cta.label}</Link>}
      </div>
      <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 14 }}>
        {lede} {t(ROLE_BY_VALUE[role].blurb)}
      </p>

      <div className="stat-tiles">
        {tiles.map((tile) => (
          <Link className="stat-tile" href={tile.href} key={tile.label}>
            <div className="val eng">{tile.value}</div>
            <div className="lbl">{tile.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
