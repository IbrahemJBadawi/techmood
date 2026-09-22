import type { Text } from '@/lib/i18n';
import type { RoleStatus, UserRole } from '@/lib/database.types';

/**
 * Roles are access, not rank.
 *
 * Nothing here orders roles above one another, and no screen should. A role
 * decides which workspaces open, and a person may hold several at once — the
 * reputation, the XP and the certificates belong to the TechMood ID, never to
 * a role.
 *
 * This module is plain data on purpose: it is imported by server components,
 * client components and server actions alike, and a 'use server' file may only
 * export async functions.
 */
/**
 * Where the "browse as" choice is remembered. It lives here, not in the server
 * actions file, because a 'use server' module may only export async functions.
 */
export const ACTIVE_ROLE_COOKIE = 'tm_active_role';

export type RoleDefinition = {
  value: UserRole;
  label: Text;
  /** One line, in the second person, describing what the role opens. */
  blurb: Text;
  /**
   * How the role opens.
   *
   *   automatic  — every account has it (student).
   *   self_serve — you choose it and it opens at once, because it claims
   *                nothing about you that anybody could verify (mentee, client).
   *   review     — a person reads it, because it does make a claim.
   */
  grant: 'automatic' | 'self_serve' | 'review';
  /** Where the shell lands when this is the role being browsed. */
  home: string;
  icon: IconName;
};

export type IconName =
  | 'home' | 'passport' | 'academy' | 'certificate' | 'gallery' | 'team'
  | 'message' | 'mentor' | 'calendar' | 'wallet' | 'work' | 'application'
  | 'startup' | 'incubator' | 'review' | 'shield' | 'settings' | 'company'
  | 'assistant';

export const ROLES: RoleDefinition[] = [
  {
    value: 'student',
    label: { ar: 'طالب', en: 'Student' },
    blurb: { ar: 'تتعلّم، تسلّم أعمالاً حقيقية، وتبني جوازك المهني.', en: 'You learn, submit real work, and build your professional passport.' },
    grant: 'automatic',
    home: '/home',
    icon: 'academy',
  },
  {
    value: 'mentee',
    label: { ar: 'متدرّب', en: 'Mentee' },
    blurb: {
      ar: 'تبحث عن إرشاد: تختار منتوراً، تحجز جلسة، وتحوّلها إلى هدف تتابعه.',
      en: 'You are here for guidance: pick a mentor, book a session, and turn it into a goal you follow.',
    },
    grant: 'self_serve',
    home: '/mentorship',
    icon: 'mentor',
  },
  {
    value: 'freelancer',
    label: { ar: 'فريلانسر', en: 'Freelancer' },
    blurb: { ar: 'تتقدّم على الفرص، تنفّذ أعمالاً مدفوعة، وتسحب أرباحك.', en: 'You apply for openings, do paid work, and withdraw what you earn.' },
    grant: 'review',
    home: '/marketplace',
    icon: 'work',
  },
  {
    value: 'client',
    label: { ar: 'عميل', en: 'Client' },
    blurb: {
      ar: 'عندك عمل تريد تنفيذه: تنشر وصفه، تقارن العروض، وتتابع التنفيذ حتى التسليم.',
      en: 'You have work you want done: publish the brief, compare the offers, and follow it through to delivery.',
    },
    grant: 'self_serve',
    home: '/client',
    icon: 'application',
  },
  {
    value: 'mentor',
    label: { ar: 'منتور', en: 'Mentor' },
    blurb: { ar: 'تراجع أعمال المتعلّمين وتقدّم جلسات إرشاد محجوزة.', en: 'You review learners\u2019 work and hold booked mentoring sessions.' },
    grant: 'review',
    home: '/mentor-requests',
    icon: 'mentor',
  },
  {
    value: 'team_leader',
    label: { ar: 'قائد فريق', en: 'Team lead' },
    blurb: { ar: 'تؤسّس فرقاً، توزّع المهام، وتقود مشاريع جماعية.', en: 'You start teams, assign the work, and lead group projects.' },
    grant: 'review',
    home: '/teams',
    icon: 'team',
  },
  {
    value: 'founder',
    label: { ar: 'مؤسس', en: 'Founder' },
    blurb: { ar: 'تبني شركة ناشئة داخل الحاضنة من الفكرة إلى نموذج العمل.', en: 'You build a startup inside the incubator, from idea to business model.' },
    grant: 'review',
    home: '/startups',
    icon: 'startup',
  },
  {
    value: 'company',
    label: { ar: 'مؤسسة', en: 'Organisation' },
    blurb: { ar: 'تنشر فرص عمل وتستقطب فرقاً وكفاءات موثّقة.', en: 'You post openings and reach teams and people with a verified record.' },
    grant: 'review',
    home: '/marketplace',
    icon: 'company',
  },
  {
    value: 'admin',
    label: { ar: 'إدارة', en: 'Admin' },
    blurb: { ar: 'تراجع الطلبات والمدفوعات والمحتوى.', en: 'You review requests, payments and content.' },
    grant: 'review',
    home: '/admin',
    icon: 'shield',
  },
];

/** Roles a person may ask for. Admin is granted by another admin, never requested. */
export const SELECTABLE_ROLES = ROLES.filter((role) => role.value !== 'admin');

export const ROLE_BY_VALUE: Record<UserRole, RoleDefinition> = Object.fromEntries(
  ROLES.map((role) => [role.value, role]),
) as Record<UserRole, RoleDefinition>;

export function roleLabel(role: UserRole): Text {
  return ROLE_BY_VALUE[role]?.label ?? { ar: role, en: role };
}

/**
 * The words the product uses. The database says `approved` / `pending_review`;
 * the person reads "مفعّل" / "قيد المراجعة". Same state, different audience.
 */
export const ROLE_STATUS_LABEL: Record<RoleStatus, Text> = {
  approved:        { ar: 'مفعّل',                  en: 'Active' },
  pending_review:  { ar: 'قيد المراجعة',           en: 'Pending review' },
  needs_more_info: { ar: 'بانتظار معلومات منك',    en: 'More information needed' },
  rejected:        { ar: 'غير مقبول',              en: 'Not accepted' },
  suspended:       { ar: 'موقوف',                  en: 'Suspended' },
};

export const ROLE_STATUS_TONE: Record<RoleStatus, 'ok' | 'wait' | 'ask' | 'no'> = {
  approved: 'ok',
  pending_review: 'wait',
  needs_more_info: 'ask',
  rejected: 'no',
  suspended: 'no',
};

export type NavItem = { href: string; label: Text; icon: IconName };
export type NavGroup = { label: Text; items: NavItem[] };

/** Shown to everyone, whichever role they are browsing as. */
const COMMON: NavGroup = {
  label: { ar: 'حسابي', en: 'My account' },
  items: [
    { href: '/home', label: { ar: 'الرئيسية', en: 'Home' }, icon: 'home' },
    { href: '/passport', label: { ar: 'الجواز المهني', en: 'Passport' }, icon: 'passport' },
    { href: '/messages', label: { ar: 'الرسائل', en: 'Messages' }, icon: 'message' },
    { href: '/notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: 'shield' },
    { href: '/ai', label: { ar: 'المساعد', en: 'Assistant' }, icon: 'assistant' },
  ],
};

/**
 * The sidebar follows the role being browsed. Every destination below is a real
 * route; a role never sees a link into a workspace it cannot enter.
 */
const ROLE_NAV: Record<UserRole, NavGroup[]> = {
  student: [
    {
      label: { ar: 'التعلّم', en: 'Learning' },
      items: [
        { href: '/academy', label: { ar: 'الأكاديمية', en: 'Academy' }, icon: 'academy' },
        { href: '/certificates', label: { ar: 'الشهادات', en: 'Certificates' }, icon: 'certificate' },
        { href: '/exhibition', label: { ar: 'المعرض', en: 'Exhibition' }, icon: 'gallery' },
      ],
    },
    {
      label: { ar: 'الإرشاد والفرق', en: 'Mentoring & teams' },
      items: [
        { href: '/mentors', label: { ar: 'المنتورز', en: 'Mentors' }, icon: 'mentor' },
        { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
        { href: '/teams', label: { ar: 'الفرق', en: 'Teams' }, icon: 'team' },
      ],
    },
  ],
  mentee: [
    {
      label: { ar: 'الإرشاد', en: 'Mentoring' },
      items: [
        { href: '/mentorship', label: { ar: 'رحلتي', en: 'My journey' }, icon: 'mentor' },
        { href: '/mentors', label: { ar: 'ابحث عن منتور', en: 'Find a mentor' }, icon: 'mentor' },
        { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
        { href: '/sessions', label: { ar: 'جلساتي', en: 'My sessions' }, icon: 'calendar' },
      ],
    },
    {
      label: { ar: 'سجلّي', en: 'My record' },
      items: [
        { href: '/certificates', label: { ar: 'الشهادات', en: 'Certificates' }, icon: 'certificate' },
        { href: '/wallet', label: { ar: 'المحفظة', en: 'Wallet' }, icon: 'wallet' },
      ],
    },
  ],
  client: [
    {
      label: { ar: 'مشاريعي', en: 'My work' },
      items: [
        { href: '/client', label: { ar: 'لوحة العميل', en: 'Client dashboard' }, icon: 'application' },
        { href: '/marketplace/new', label: { ar: 'انشر مشروعاً', en: 'Post a project' }, icon: 'work' },
        { href: '/marketplace?tab=talent', label: { ar: 'ابحث عن منفّذ', en: 'Find a freelancer' }, icon: 'work' },
        { href: '/marketplace?tab=teams', label: { ar: 'ابحث عن فريق', en: 'Find a team' }, icon: 'team' },
      ],
    },
    {
      label: { ar: 'التنفيذ والمال', en: 'Delivery & money' },
      items: [
        { href: '/marketplace?tab=work', label: { ar: 'العقود والتنفيذ', en: 'Contracts & delivery' }, icon: 'application' },
        { href: '/marketplace?tab=money', label: { ar: 'المدفوعات والضمان', en: 'Payments & escrow' }, icon: 'wallet' },
        { href: '/mentors', label: { ar: 'استشر منتوراً', en: 'Ask a mentor' }, icon: 'mentor' },
      ],
    },
  ],
  freelancer: [
    {
      label: { ar: 'العمل', en: 'Work' },
      items: [
        { href: '/marketplace', label: { ar: 'السوق', en: 'Market' }, icon: 'work' },
        { href: '/marketplace?tab=work', label: { ar: 'عملي', en: 'My work' }, icon: 'application' },
        { href: '/settings/freelancer', label: { ar: 'إدراجي في السوق', en: 'My listing' }, icon: 'settings' },
        { href: '/wallet', label: { ar: 'المحفظة', en: 'Wallet' }, icon: 'wallet' },
      ],
    },
    {
      label: { ar: 'سجلّي', en: 'My record' },
      items: [
        { href: '/exhibition', label: { ar: 'المعرض', en: 'Exhibition' }, icon: 'gallery' },
        { href: '/certificates', label: { ar: 'الشهادات', en: 'Certificates' }, icon: 'certificate' },
      ],
    },
  ],
  mentor: [
    {
      label: { ar: 'الإرشاد', en: 'Mentoring' },
      items: [
        { href: '/mentor-requests', label: { ar: 'طلبات الجلسات', en: 'Session requests' }, icon: 'calendar' },
        { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
        { href: '/review/exhibition', label: { ar: 'تقييم المشاريع', en: 'Judge projects' }, icon: 'gallery' },
        { href: '/review/credentials', label: { ar: 'توثيق الشهادات', en: 'Verify credentials' }, icon: 'certificate' },
        { href: '/mentor-companies', label: { ar: 'شركات أُرشدها', en: 'Companies I advise' }, icon: 'startup' },
        { href: '/wallet', label: { ar: 'المحفظة', en: 'Wallet' }, icon: 'wallet' },
      ],
    },
    {
      label: { ar: 'المنصة', en: 'Platform' },
      items: [
        { href: '/mentors', label: { ar: 'صفحتي كمنتور', en: 'My mentor page' }, icon: 'mentor' },
        { href: '/academy', label: { ar: 'الأكاديمية', en: 'Academy' }, icon: 'academy' },
      ],
    },
  ],
  team_leader: [
    {
      label: { ar: 'الفرق', en: 'Teams' },
      items: [
        { href: '/teams', label: { ar: 'فرقي', en: 'My teams' }, icon: 'team' },
        { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
        { href: '/exhibition', label: { ar: 'المعرض', en: 'Exhibition' }, icon: 'gallery' },
      ],
    },
    {
      label: { ar: 'العمل', en: 'Work' },
      items: [
        { href: '/marketplace', label: { ar: 'السوق', en: 'Market' }, icon: 'work' },
        { href: '/applications', label: { ar: 'طلبات فريقي', en: 'Team applications' }, icon: 'application' },
      ],
    },
  ],
  founder: [
    {
      label: { ar: 'ريادة الأعمال', en: 'Entrepreneurship' },
      items: [
        { href: '/startups', label: { ar: 'مشاريعي الناشئة', en: 'My startups' }, icon: 'startup' },
        { href: '/incubator', label: { ar: 'الحاضنة', en: 'Incubator' }, icon: 'incubator' },
      ],
    },
    {
      label: { ar: 'الفريق والفرص', en: 'Team & openings' },
      items: [
        { href: '/teams', label: { ar: 'الفرق', en: 'Teams' }, icon: 'team' },
        { href: '/marketplace', label: { ar: 'السوق', en: 'Market' }, icon: 'work' },
      ],
    },
  ],
  company: [
    {
      label: { ar: 'التوظيف', en: 'Hiring' },
      items: [
        { href: '/marketplace', label: { ar: 'السوق', en: 'Market' }, icon: 'work' },
        { href: '/marketplace?tab=talent', label: { ar: 'ابحث عن كفاءات', en: 'Find talent' }, icon: 'passport' },
        { href: '/applications', label: { ar: 'المتقدّمون', en: 'Applicants' }, icon: 'application' },
      ],
    },
    {
      label: { ar: 'الاستكشاف', en: 'Discover' },
      items: [
        { href: '/teams', label: { ar: 'الفرق', en: 'Teams' }, icon: 'team' },
        { href: '/exhibition', label: { ar: 'المعرض', en: 'Exhibition' }, icon: 'gallery' },
      ],
    },
  ],
  admin: [
    {
      label: { ar: 'المراجعة', en: 'Review' },
      items: [
        { href: '/admin', label: { ar: 'لوحة الإدارة', en: 'Admin panel' }, icon: 'shield' },
        { href: '/admin/role-requests', label: { ar: 'طلبات الأدوار', en: 'Role requests' }, icon: 'application' },
        { href: '/admin/taxonomy', label: { ar: 'المصطلحات المقترحة', en: 'Suggested terms' }, icon: 'settings' },
        { href: '/admin/notifications', label: { ar: 'الإعلانات', en: 'Announcements' }, icon: 'message' },
        { href: '/admin/external', label: { ar: 'مشاركات خارجية', en: 'External claims' }, icon: 'application' },
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
        { href: '/review/exhibition', label: { ar: 'تقييم المشاريع', en: 'Judge projects' }, icon: 'gallery' },
      ],
    },
    {
      label: { ar: 'المال والمحتوى', en: 'Money & content' },
      items: [
        { href: '/admin/payments', label: { ar: 'مراجعة المدفوعات', en: 'Review payments' }, icon: 'wallet' },
        { href: '/review/credentials', label: { ar: 'توثيق الشهادات', en: 'Verify credentials' }, icon: 'certificate' },
        { href: '/admin/payouts', label: { ar: 'طلبات السحب', en: 'Payout requests' }, icon: 'wallet' },
        { href: '/admin/escrows', label: { ar: 'الأموال المحتجزة', en: 'Escrow' }, icon: 'wallet' },
        { href: '/admin/academy', label: { ar: 'محتوى الأكاديمية', en: 'Academy content' }, icon: 'academy' },
        { href: '/admin/exhibition', label: { ar: 'مراجعة المعرض', en: 'Review exhibition' }, icon: 'gallery' },
        { href: '/admin/incubator', label: { ar: 'طلبات الحاضنة', en: 'Incubator applications' }, icon: 'incubator' },
      ],
    },
  ],
};

export function navFor(role: UserRole): NavGroup[] {
  return [COMMON, ...(ROLE_NAV[role] ?? [])];
}

/**
 * The role the shell opens on: the primary role when it is still approved,
 * otherwise the first approved role, otherwise student — which every account
 * holds, so this never returns a role the person cannot enter.
 */
export function defaultRole(approved: UserRole[], primary: UserRole | null): UserRole {
  if (primary && approved.includes(primary)) return primary;
  return approved[0] ?? 'student';
}
