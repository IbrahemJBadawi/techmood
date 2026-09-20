import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import { ROLE_BY_VALUE, roleLabel } from '@/lib/roles';
import type { Database, UserRole } from '@/lib/database.types';

type Tile = { value: number | string; label: string; href: string };

/**
 * The dashboard follows the role being browsed, and every number on it is a
 * real count from a real table — an empty workspace shows a zero and says what
 * to do about it, rather than a decorative figure.
 */
export async function RoleDashboard({ role, userId }: { role: UserRole; userId: string }) {
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
    lede = 'تتعلّم، تسلّم، ويُراجع عملك إنسان.';
    tiles = [
      { value: inReview, label: 'أعمال قيد المراجعة', href: '/academy' },
      { value: changes, label: 'أعمال تنتظر تعديلك', href: '/academy' },
      { value: certificates, label: 'شهادات موثّقة', href: '/certificates' },
      { value: sessions, label: 'جلسات إرشاد مؤكدة', href: '/bookings' },
    ];
    cta = { href: '/academy', label: 'تابع مسارك' };
  }

  if (role === 'freelancer') {
    const [open, mine, shortlisted, available] = await Promise.all([
      n(from('opportunities').eq('status', 'published')),
      n(from('opportunity_applications').eq('profile_id', userId)),
      n(from('opportunity_applications').eq('profile_id', userId).eq('stage', 'shortlisted')),
      n(from('wallet_entries').eq('profile_id', userId).eq('status', 'available')),
    ]);
    lede = 'تتقدّم على الفرص، وتنفّذ أعمالاً مدفوعة بسجلّ يثبت جودتها.';
    tiles = [
      { value: open, label: 'فرص مفتوحة', href: '/marketplace' },
      { value: mine, label: 'طلبات تقدّمت بها', href: '/applications' },
      { value: shortlisted, label: 'في القائمة القصيرة', href: '/applications' },
      { value: available, label: 'حركات محفظة متاحة', href: '/wallet' },
    ];
    cta = { href: '/marketplace', label: 'تصفّح الفرص' };
  }

  if (role === 'mentor') {
    const [requests, toReview, upcoming, earnings] = await Promise.all([
      n(from('bookings').eq('mentor_id', userId).eq('status', 'mentor_pending')),
      n(from('submissions').in('status', ['submitted', 'under_review'])),
      n(from('bookings').eq('mentor_id', userId).eq('status', 'confirmed')),
      n(from('wallet_entries').eq('profile_id', userId).eq('kind', 'earning')),
    ]);
    lede = 'مراجعتك هي ما يجعل الشهادة في TechMood تعني شيئاً.';
    tiles = [
      { value: requests, label: 'طلبات جلسات تنتظرك', href: '/mentor-requests' },
      { value: toReview, label: 'أعمال بانتظار المراجعة', href: '/review' },
      { value: upcoming, label: 'جلسات مؤكدة', href: '/mentor-requests' },
      { value: earnings, label: 'أرباح مسجّلة', href: '/wallet' },
    ];
    cta = { href: '/review', label: 'ابدأ المراجعة' };
  }

  if (role === 'team_leader') {
    const [teams, tasks, applications] = await Promise.all([
      n(from('teams').eq('leader_id', userId)),
      n(from('team_tasks').eq('created_by', userId).neq('column_key', 'done')),
      n(from('opportunity_applications').eq('profile_id', userId)),
    ]);
    lede = 'الفريق مساحة عمل مغلقة: مهام وسبرنتات وتسليمات، لا صفحة أخبار.';
    tiles = [
      { value: teams, label: 'فرق أقودها', href: '/teams' },
      { value: tasks, label: 'مهام مفتوحة أنشأتها', href: '/teams' },
      { value: applications, label: 'طلبات فريقي', href: '/applications' },
    ];
    cta = { href: '/teams', label: 'افتح مساحة الفريق' };
  }

  if (role === 'founder') {
    const [startups, incubated] = await Promise.all([
      n(from('startups').eq('founder_id', userId)),
      n(from('startups').eq('founder_id', userId).eq('is_in_incubator', true)),
    ]);
    lede = 'من الفكرة إلى نموذج عمل مكتوب — بمراحل واضحة ومراجعة حقيقية.';
    tiles = [
      { value: startups, label: 'مشاريع ناشئة', href: '/startups' },
      { value: incubated, label: 'داخل الحاضنة', href: '/incubator' },
    ];
    cta = { href: '/startups', label: 'افتح مشروعك' };
  }

  if (role === 'company') {
    const [posted, open, applicants] = await Promise.all([
      n(from('opportunities').eq('posted_by', userId)),
      n(from('opportunities').eq('posted_by', userId).eq('status', 'published')),
      n(from('opportunity_applications').eq('stage', 'submitted')),
    ]);
    lede = 'تنشر فرصاً وتصل إلى من يملك سجلاً مهنياً يمكن التحقق منه.';
    tiles = [
      { value: posted, label: 'فرص نشرتها', href: '/marketplace' },
      { value: open, label: 'ما زالت منشورة', href: '/marketplace' },
      { value: applicants, label: 'طلبات جديدة', href: '/applications' },
    ];
    cta = { href: '/marketplace/new', label: 'انشر فرصة' };
  }

  if (role === 'admin') {
    const [roleRequests, terms, payments, payouts] = await Promise.all([
      n(from('profile_roles').in('status', ['pending_review', 'needs_more_info'])),
      n(from('fields').eq('status', 'pending_review')),
      n(from('payments').eq('status', 'under_review')),
      n(from('payout_requests').eq('status', 'requested')),
    ]);
    lede = 'كل قرار هنا يخصّ شخصاً ينتظر ردّاً.';
    tiles = [
      { value: roleRequests, label: 'طلبات أدوار', href: '/admin/role-requests' },
      { value: terms, label: 'مجالات مقترحة', href: '/admin/taxonomy' },
      { value: payments, label: 'مدفوعات للتحقق', href: '/admin/payments' },
      { value: payouts, label: 'طلبات سحب', href: '/admin/payouts' },
    ];
    cta = { href: '/admin/role-requests', label: 'ابدأ بالطلبات' };
  }

  return (
    <section className="section-block">
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: '1.05rem' }}>لوحة {roleLabel(role)}</h2>
        {cta && <Link className="btn btn-ghost btn-sm" href={cta.href}>{cta.label}</Link>}
      </div>
      <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 14 }}>
        {lede} {ROLE_BY_VALUE[role].blurb}
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
