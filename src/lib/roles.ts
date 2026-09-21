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
  /** Student is the one role every account starts with, already approved. */
  needsReview: boolean;
  /** Where the shell lands when this is the role being browsed. */
  home: string;
  icon: IconName;
};

export type IconName =
  | 'home' | 'passport' | 'academy' | 'certificate' | 'gallery' | 'team'
  | 'message' | 'mentor' | 'calendar' | 'wallet' | 'work' | 'application'
  | 'startup' | 'incubator' | 'review' | 'shield' | 'settings' | 'company';

export const ROLES: RoleDefinition[] = [
  {
    value: 'student',
    label: { ar: 'طالب', en: 'Student' },
    blurb: { ar: 'تتعلّم، تسلّم أعمالاً حقيقية، وتبني جوازك المهني.', en: 'You learn, submit real work, and build your professional passport.' },
    needsReview: false,
    home: '/home',
    icon: 'academy',
  },
  {
    value: 'freelancer',
    label: { ar: 'فريلانسر', en: 'Freelancer' },
    blurb: { ar: 'تتقدّم على الفرص، تنفّذ أعمالاً مدفوعة، وتسحب أرباحك.', en: 'You apply for openings, do paid work, and withdraw what you earn.' },
    needsReview: true,
    home: '/marketplace',
    icon: 'work',
  },
  {
    value: 'mentor',
    label: { ar: 'منتور', en: 'Mentor' },
    blurb: { ar: 'تراجع أعمال المتعلّمين وتقدّم جلسات إرشاد محجوزة.', en: 'You review learners\u2019 work and hold booked mentoring sessions.' },
    needsReview: true,
    home: '/mentor-requests',
    icon: 'mentor',
  },
  {
    value: 'team_leader',
    label: { ar: 'قائد فريق', en: 'Team lead' },
    blurb: { ar: 'تؤسّس فرقاً، توزّع المهام، وتقود مشاريع جماعية.', en: 'You start teams, assign the work, and lead group projects.' },
    needsReview: true,
    home: '/teams',
    icon: 'team',
  },
  {
    value: 'founder',
    label: { ar: 'مؤسس', en: 'Founder' },
    blurb: { ar: 'تبني شركة ناشئة داخل الحاضنة من الفكرة إلى نموذج العمل.', en: 'You build a startup inside the incubator, from idea to business model.' },
    needsReview: true,
    home: '/startups',
    icon: 'startup',
  },
  {
    value: 'company',
    label: { ar: 'مؤسسة', en: 'Organisation' },
    blurb: { ar: 'تنشر فرص عمل وتستقطب فرقاً وكفاءات موثّقة.', en: 'You post openings and reach teams and people with a verified record.' },
    needsReview: true,
    home: '/marketplace',
    icon: 'company',
  },
  {
    value: 'admin',
    label: { ar: 'إدارة', en: 'Admin' },
    blurb: { ar: 'تراجع الطلبات والمدفوعات والمحتوى.', en: 'You review requests, payments and content.' },
    needsReview: true,
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
        { href: '/bookings', label: { ar: 'حجوزاتي', en: 'My bookings' }, icon: 'calendar' },
        { href: '/teams', label: { ar: 'الفرق', en: 'Teams' }, icon: 'team' },
      ],
    },
  ],
  freelancer: [
    {
      label: { ar: 'العمل', en: 'Work' },
      items: [
        { href: '/marketplace', label: { ar: 'سوق العمل', en: 'Marketplace' }, icon: 'work' },
        { href: '/applications', label: { ar: 'طلباتي', en: 'My applications' }, icon: 'application' },
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
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
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
        { href: '/exhibition', label: { ar: 'المعرض', en: 'Exhibition' }, icon: 'gallery' },
      ],
    },
    {
      label: { ar: 'العمل', en: 'Work' },
      items: [
        { href: '/marketplace', label: { ar: 'سوق العمل', en: 'Marketplace' }, icon: 'work' },
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
        { href: '/marketplace', label: { ar: 'سوق العمل', en: 'Marketplace' }, icon: 'work' },
      ],
    },
  ],
  company: [
    {
      label: { ar: 'التوظيف', en: 'Hiring' },
      items: [
        { href: '/marketplace', label: { ar: 'فرصي المنشورة', en: 'My postings' }, icon: 'work' },
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
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
      ],
    },
    {
      label: { ar: 'المال والمحتوى', en: 'Money & content' },
      items: [
        { href: '/admin/payments', label: { ar: 'مراجعة المدفوعات', en: 'Review payments' }, icon: 'wallet' },
        { href: '/admin/payouts', label: { ar: 'طلبات السحب', en: 'Payout requests' }, icon: 'wallet' },
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
