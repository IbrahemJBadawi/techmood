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
  label: string;
  /** One line, in the second person, describing what the role opens. */
  blurb: string;
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
    label: 'طالب',
    blurb: 'تتعلّم، تسلّم أعمالاً حقيقية، وتبني جوازك المهني.',
    needsReview: false,
    home: '/home',
    icon: 'academy',
  },
  {
    value: 'freelancer',
    label: 'فريلانسر',
    blurb: 'تتقدّم على الفرص، تنفّذ أعمالاً مدفوعة، وتسحب أرباحك.',
    needsReview: true,
    home: '/marketplace',
    icon: 'work',
  },
  {
    value: 'mentor',
    label: 'منتور',
    blurb: 'تراجع أعمال المتعلّمين وتقدّم جلسات إرشاد محجوزة.',
    needsReview: true,
    home: '/mentor-requests',
    icon: 'mentor',
  },
  {
    value: 'team_leader',
    label: 'قائد فريق',
    blurb: 'تؤسّس فرقاً، توزّع المهام، وتقود مشاريع جماعية.',
    needsReview: true,
    home: '/teams',
    icon: 'team',
  },
  {
    value: 'founder',
    label: 'مؤسس',
    blurb: 'تبني شركة ناشئة داخل الحاضنة من الفكرة إلى نموذج العمل.',
    needsReview: true,
    home: '/startups',
    icon: 'startup',
  },
  {
    value: 'company',
    label: 'مؤسسة',
    blurb: 'تنشر فرص عمل وتستقطب فرقاً وكفاءات موثّقة.',
    needsReview: true,
    home: '/marketplace',
    icon: 'company',
  },
  {
    value: 'admin',
    label: 'إدارة',
    blurb: 'تراجع الطلبات والمدفوعات والمحتوى.',
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

export function roleLabel(role: UserRole): string {
  return ROLE_BY_VALUE[role]?.label ?? role;
}

/**
 * The words the product uses. The database says `approved` / `pending_review`;
 * the person reads "مفعّل" / "قيد المراجعة". Same state, different audience.
 */
export const ROLE_STATUS_LABEL: Record<RoleStatus, string> = {
  approved: 'مفعّل',
  pending_review: 'قيد المراجعة',
  needs_more_info: 'بانتظار معلومات منك',
  rejected: 'غير مقبول',
  suspended: 'موقوف',
};

export const ROLE_STATUS_TONE: Record<RoleStatus, 'ok' | 'wait' | 'ask' | 'no'> = {
  approved: 'ok',
  pending_review: 'wait',
  needs_more_info: 'ask',
  rejected: 'no',
  suspended: 'no',
};

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label: string; items: NavItem[] };

/** Shown to everyone, whichever role they are browsing as. */
const COMMON: NavGroup = {
  label: 'حسابي',
  items: [
    { href: '/home', label: 'الرئيسية', icon: 'home' },
    { href: '/passport', label: 'الجواز المهني', icon: 'passport' },
    { href: '/messages', label: 'الرسائل', icon: 'message' },
  ],
};

/**
 * The sidebar follows the role being browsed. Every destination below is a real
 * route; a role never sees a link into a workspace it cannot enter.
 */
const ROLE_NAV: Record<UserRole, NavGroup[]> = {
  student: [
    {
      label: 'التعلّم',
      items: [
        { href: '/academy', label: 'الأكاديمية', icon: 'academy' },
        { href: '/certificates', label: 'الشهادات', icon: 'certificate' },
        { href: '/exhibition', label: 'المعرض', icon: 'gallery' },
      ],
    },
    {
      label: 'الإرشاد والفرق',
      items: [
        { href: '/mentors', label: 'المنتورز', icon: 'mentor' },
        { href: '/bookings', label: 'حجوزاتي', icon: 'calendar' },
        { href: '/teams', label: 'الفرق', icon: 'team' },
      ],
    },
  ],
  freelancer: [
    {
      label: 'العمل',
      items: [
        { href: '/marketplace', label: 'سوق العمل', icon: 'work' },
        { href: '/applications', label: 'طلباتي', icon: 'application' },
        { href: '/wallet', label: 'المحفظة', icon: 'wallet' },
      ],
    },
    {
      label: 'سجلّي',
      items: [
        { href: '/exhibition', label: 'المعرض', icon: 'gallery' },
        { href: '/certificates', label: 'الشهادات', icon: 'certificate' },
      ],
    },
  ],
  mentor: [
    {
      label: 'الإرشاد',
      items: [
        { href: '/mentor-requests', label: 'طلبات الجلسات', icon: 'calendar' },
        { href: '/review', label: 'مراجعة الأعمال', icon: 'review' },
        { href: '/wallet', label: 'المحفظة', icon: 'wallet' },
      ],
    },
    {
      label: 'المنصة',
      items: [
        { href: '/mentors', label: 'صفحتي كمنتور', icon: 'mentor' },
        { href: '/academy', label: 'الأكاديمية', icon: 'academy' },
      ],
    },
  ],
  team_leader: [
    {
      label: 'الفرق',
      items: [
        { href: '/teams', label: 'فرقي', icon: 'team' },
        { href: '/exhibition', label: 'المعرض', icon: 'gallery' },
      ],
    },
    {
      label: 'العمل',
      items: [
        { href: '/marketplace', label: 'سوق العمل', icon: 'work' },
        { href: '/applications', label: 'طلبات فريقي', icon: 'application' },
      ],
    },
  ],
  founder: [
    {
      label: 'ريادة الأعمال',
      items: [
        { href: '/startups', label: 'مشاريعي الناشئة', icon: 'startup' },
        { href: '/incubator', label: 'الحاضنة', icon: 'incubator' },
      ],
    },
    {
      label: 'الفريق والفرص',
      items: [
        { href: '/teams', label: 'الفرق', icon: 'team' },
        { href: '/marketplace', label: 'سوق العمل', icon: 'work' },
      ],
    },
  ],
  company: [
    {
      label: 'التوظيف',
      items: [
        { href: '/marketplace', label: 'فرصي المنشورة', icon: 'work' },
        { href: '/applications', label: 'المتقدّمون', icon: 'application' },
      ],
    },
    {
      label: 'الاستكشاف',
      items: [
        { href: '/teams', label: 'الفرق', icon: 'team' },
        { href: '/exhibition', label: 'المعرض', icon: 'gallery' },
      ],
    },
  ],
  admin: [
    {
      label: 'المراجعة',
      items: [
        { href: '/admin', label: 'لوحة الإدارة', icon: 'shield' },
        { href: '/admin/role-requests', label: 'طلبات الأدوار', icon: 'application' },
        { href: '/admin/taxonomy', label: 'المصطلحات المقترحة', icon: 'settings' },
        { href: '/review', label: 'مراجعة الأعمال', icon: 'review' },
      ],
    },
    {
      label: 'المال والمحتوى',
      items: [
        { href: '/admin/payments', label: 'مراجعة المدفوعات', icon: 'wallet' },
        { href: '/admin/payouts', label: 'طلبات السحب', icon: 'wallet' },
        { href: '/admin/exhibition', label: 'مراجعة المعرض', icon: 'gallery' },
        { href: '/admin/incubator', label: 'طلبات الحاضنة', icon: 'incubator' },
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
