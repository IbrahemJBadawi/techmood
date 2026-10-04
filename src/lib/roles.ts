import { IS_MVP, pathInScope, roleInScope } from '@/lib/scope';
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
  | 'assistant' | 'menu' | 'close' | 'more' | 'check' | 'arrow' | 'globe' | 'play' | 'star'
  | 'code' | 'chart' | 'brush' | 'search' | 'clock' | 'layers' | 'lock' | 'bell' | 'user';

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
    // Shown as "Mentee" in both languages — the founder's word for the role.
    label: { ar: 'Mentee', en: 'Mentee' },
    blurb: {
      ar: 'ملف مهني بخبراتك ومهاراتك وأعمالك، تطلب به جلسات إرشاد وتحوّلها إلى أهداف تتابعها.',
      en: 'A professional profile — your experience, skills and work — with which you book mentoring sessions and turn them into goals you follow.',
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
    // The founder's rule: after home, a mentor's first page is their time.
    home: '/bookings',
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

/**
 * Roles a person may ask for. Admin is granted by another admin, never
 * requested; in the MVP only mentor and mentee are offered next to student
 * (src/lib/scope.ts).
 */
export const SELECTABLE_ROLES = ROLES.filter((role) => role.value !== 'admin' && roleInScope(role.value));

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
    { href: '/notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: 'bell' },
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
        { href: '/gallery', label: { ar: 'المعرض', en: 'Gallery' }, icon: 'gallery' },
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
        { href: '/gallery', label: { ar: 'المعرض', en: 'Gallery' }, icon: 'gallery' },
        { href: '/certificates', label: { ar: 'الشهادات', en: 'Certificates' }, icon: 'certificate' },
      ],
    },
  ],
  mentor: [
    {
      label: { ar: 'الإرشاد', en: 'Mentoring' },
      items: [
        { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
        { href: '/mentor-requests', label: { ar: 'طلبات الجلسات', en: 'Session requests' }, icon: 'calendar' },
        { href: '/mentor-requests/level', label: { ar: 'مستواي', en: 'My level' }, icon: 'certificate' },
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
        { href: '/studio', label: { ar: 'استوديو المحتوى', en: 'Content studio' }, icon: 'academy' },
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
        { href: '/gallery', label: { ar: 'المعرض', en: 'Gallery' }, icon: 'gallery' },
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
        { href: '/gallery', label: { ar: 'المعرض', en: 'Gallery' }, icon: 'gallery' },
      ],
    },
  ],
  admin: [
    {
      label: { ar: 'مركز التحكم', en: 'Control center' },
      items: [
        { href: '/admin', label: { ar: 'نظرة عامة', en: 'Overview' }, icon: 'home' },
        { href: '/admin/users', label: { ar: 'المستخدمون', en: 'Users' }, icon: 'team' },
        { href: '/admin/analytics', label: { ar: 'التحليلات', en: 'Analytics' }, icon: 'review' },
      ],
    },
    {
      label: { ar: 'الدعم والإشراف', en: 'Support & moderation' },
      items: [
        { href: '/admin/support', label: { ar: 'الدعم والبلاغات', en: 'Support & reports' }, icon: 'message' },
        { href: '/admin/cases', label: { ar: 'القضايا', en: 'Cases' }, icon: 'shield' },
        { href: '/admin/knowledge', label: { ar: 'قاعدة المعرفة', en: 'Knowledge base' }, icon: 'academy' },
        { href: '/admin/ai', label: { ar: 'الذكاء الاصطناعي', en: 'AI' }, icon: 'assistant' },
        { href: '/admin/external', label: { ar: 'مشاركات خارجية', en: 'External claims' }, icon: 'application' },
        { href: '/admin/taxonomy', label: { ar: 'المصطلحات المقترحة', en: 'Suggested terms' }, icon: 'settings' },
      ],
    },
    {
      label: { ar: 'الأكاديمية والمنتورز', en: 'Academy & mentors' },
      items: [
        { href: '/admin/academy', label: { ar: 'المسارات والدورات', en: 'Paths & courses' }, icon: 'academy' },
        { href: '/admin/studio', label: { ar: 'محتوى المنتورز', en: 'Mentor content' }, icon: 'academy' },
        { href: '/admin/cohorts', label: { ar: 'الدفعات', en: 'Cohorts' }, icon: 'team' },
        { href: '/admin/role-requests', label: { ar: 'طلبات الأدوار', en: 'Role requests' }, icon: 'application' },
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
        { href: '/review/credentials', label: { ar: 'توثيق الشهادات', en: 'Verify credentials' }, icon: 'certificate' },
        { href: '/review/exhibition', label: { ar: 'تقييم المشاريع', en: 'Judge projects' }, icon: 'gallery' },
        { href: '/admin/exhibition', label: { ar: 'مراجعة المعرض', en: 'Review exhibition' }, icon: 'gallery' },
        { href: '/admin/market', label: { ar: 'مراجعة السوق', en: 'Market review' }, icon: 'work' },
        { href: '/admin/levels', label: { ar: 'ترقيات المنتورز', en: 'Mentor upgrades' }, icon: 'mentor' },
      ],
    },
    {
      label: { ar: 'المال', en: 'Money' },
      items: [
        { href: '/admin/finance', label: { ar: 'الصورة المالية', en: 'Finance' }, icon: 'wallet' },
        { href: '/admin/payments', label: { ar: 'مراجعة المدفوعات', en: 'Review payments' }, icon: 'wallet' },
        { href: '/admin/payouts', label: { ar: 'طلبات السحب', en: 'Payout requests' }, icon: 'wallet' },
        { href: '/admin/escrows', label: { ar: 'الأموال المحتجزة', en: 'Escrow' }, icon: 'wallet' },
        { href: '/admin/pricing', label: { ar: 'التسعير والعمولات والإرجاع', en: 'Pricing, commission & refunds' }, icon: 'wallet' },
      ],
    },
    {
      label: { ar: 'العمل والإعدادات', en: 'Work & settings' },
      items: [
        { href: '/admin/incubator', label: { ar: 'طلبات الحاضنة', en: 'Incubator applications' }, icon: 'incubator' },
        { href: '/admin/notifications', label: { ar: 'الإعلانات', en: 'Announcements' }, icon: 'message' },
        { href: '/admin/permissions', label: { ar: 'الإدارة والصلاحيات', en: 'Admins & permissions' }, icon: 'shield' },
      ],
    },
  ],
};

/**
 * The MVP's sidebar: the platform first, then time and money, then the
 * account — the same for everybody — with each role's own work on top.
 */
const MVP_MAIN: NavGroup[] = [
  {
    label: { ar: 'المنصة', en: 'Platform' },
    items: [
      { href: '/home', label: { ar: 'الرئيسية', en: 'Home' }, icon: 'home' },
      { href: '/academy', label: { ar: 'الأكاديمية', en: 'Academy' }, icon: 'academy' },
      { href: '/teams', label: { ar: 'الفرق', en: 'Teams' }, icon: 'team' },
      { href: '/gallery', label: { ar: 'المعرض', en: 'Gallery' }, icon: 'gallery' },
      { href: '/marketplace', label: { ar: 'السوق', en: 'Market' }, icon: 'work' },
      // Every member's own projects, headed for the exhibition or the market.
      { href: '/projects', label: { ar: 'مشاريعي', en: 'My projects' }, icon: 'gallery' },
    ],
  },
  {
    label: { ar: 'الإرشاد والوقت', en: 'Mentoring & time' },
    items: [
      { href: '/mentors', label: { ar: 'المنتورز', en: 'Mentors' }, icon: 'mentor' },
      { href: '/bookings', label: { ar: 'الحجوزات والتقويم', en: 'Bookings & calendar' }, icon: 'calendar' },
      { href: '/wallet', label: { ar: 'المحفظة', en: 'Wallet' }, icon: 'wallet' },
      { href: '/ai', label: { ar: 'المساعد الذكي', en: 'AI assistant' }, icon: 'assistant' },
    ],
  },
];

const MVP_ACCOUNT: NavGroup = {
  label: { ar: 'حسابي', en: 'My account' },
  items: [
    { href: '/passport', label: { ar: 'ملفي المهني', en: 'My profile' }, icon: 'passport' },
    { href: '/certificates', label: { ar: 'الشهادات', en: 'Certificates' }, icon: 'certificate' },
    { href: '/messages', label: { ar: 'الرسائل', en: 'Messages' }, icon: 'message' },
    { href: '/notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: 'bell' },
    { href: '/support', label: { ar: 'المساعدة والبلاغات', en: 'Help & reports' }, icon: 'review' },
    { href: '/settings', label: { ar: 'الإعدادات', en: 'Settings' }, icon: 'settings' },
  ],
};

const MVP_ROLE_NAV: Partial<Record<UserRole, NavGroup[]>> = {
  // A mentor's day, in order: the calendar, who is asking, what waits for a
  // verdict, then the money and the settings of the practice.
  mentor: [
    {
      label: { ar: 'عملي كمنتور', en: 'My mentoring' },
      items: [
        { href: '/bookings', label: { ar: 'جلساتي والتقويم', en: 'Sessions & calendar' }, icon: 'calendar' },
        { href: '/mentor-requests', label: { ar: 'طلبات الجلسات', en: 'Session requests' }, icon: 'application' },
        { href: '/review', label: { ar: 'مراجعة الأعمال', en: 'Review work' }, icon: 'review' },
        { href: '/review/exhibition', label: { ar: 'تقييم المشاريع', en: 'Judge projects' }, icon: 'gallery' },
        { href: '/review/credentials', label: { ar: 'توثيق الشهادات', en: 'Verify credentials' }, icon: 'certificate' },
        { href: '/studio', label: { ar: 'دوراتي ومساراتي', en: 'My courses & paths' }, icon: 'academy' },
        { href: '/wallet', label: { ar: 'أرباحي', en: 'My earnings' }, icon: 'wallet' },
        { href: '/mentor-requests/pricing', label: { ar: 'أسعاري', en: 'My prices' }, icon: 'chart' },
        { href: '/mentor-requests/level', label: { ar: 'مستواي', en: 'My level' }, icon: 'star' },
      ],
    },
  ],
  // A mentee comes for guidance: the goals, the people, the booked time.
  mentee: [
    {
      label: { ar: 'رحلتي', en: 'My journey' },
      items: [
        { href: '/mentorship', label: { ar: 'أهدافي مع المنتورز', en: 'My mentoring goals' }, icon: 'passport' },
        { href: '/mentors', label: { ar: 'اختر منتوراً', en: 'Find a mentor' }, icon: 'mentor' },
        { href: '/bookings', label: { ar: 'جلساتي', en: 'My sessions' }, icon: 'calendar' },
      ],
    },
  ],
  admin: ROLE_NAV.admin
    .map((group) => ({ ...group, items: group.items.filter((item) => pathInScope(item.href)) }))
    .filter((group) => group.items.length > 0),
};

export function navFor(role: UserRole): NavGroup[] {
  if (IS_MVP) {
    // The role's own group comes first; a place it already lists is not
    // repeated further down, so every link appears once.
    const own = MVP_ROLE_NAV[role] ?? [];
    const taken = new Set(own.flatMap((group) => group.items.map((item) => item.href)));
    const rest = [...MVP_MAIN, MVP_ACCOUNT]
      .map((group) => ({ ...group, items: group.items.filter((item) => !taken.has(item.href)) }))
      .filter((group) => group.items.length > 0);
    return [...own, ...rest];
  }
  return [COMMON, ...(ROLE_NAV[role] ?? [])];
}

/**
 * The four tabs a phone keeps at the bottom of the screen, by role — the
 * places a person in that role goes to most. Everything else is one tap away
 * under "More", which holds the whole of navFor().
 */
export function mobileTabsFor(role: UserRole): NavItem[] {
  const messages: NavItem = { href: '/messages', label: { ar: 'الرسائل', en: 'Messages' }, icon: 'message' };
  switch (role) {
    case 'admin':
      return [
        { href: '/admin', label: { ar: 'الإدارة', en: 'Admin' }, icon: 'shield' },
        { href: '/admin/payments', label: { ar: 'المدفوعات', en: 'Payments' }, icon: 'wallet' },
        { href: '/admin/support', label: { ar: 'الدعم', en: 'Support' }, icon: 'review' },
        messages,
      ];
    case 'mentor':
      return [
        { href: '/home', label: { ar: 'الرئيسية', en: 'Home' }, icon: 'home' },
        { href: '/bookings', label: { ar: 'جلساتي', en: 'Sessions' }, icon: 'calendar' },
        { href: '/mentor-requests', label: { ar: 'الطلبات', en: 'Requests' }, icon: 'review' },
        messages,
      ];
    case 'mentee':
      return [
        { href: '/home', label: { ar: 'الرئيسية', en: 'Home' }, icon: 'home' },
        { href: '/mentorship', label: { ar: 'أهدافي', en: 'Goals' }, icon: 'passport' },
        { href: '/mentors', label: { ar: 'المنتورز', en: 'Mentors' }, icon: 'mentor' },
        messages,
      ];
    default:
      return [
        { href: '/home', label: { ar: 'الرئيسية', en: 'Home' }, icon: 'home' },
        { href: '/academy', label: { ar: 'تعلّم', en: 'Learn' }, icon: 'academy' },
        { href: '/mentors', label: { ar: 'المنتورز', en: 'Mentors' }, icon: 'mentor' },
        messages,
      ];
  }
}

/**
 * The role the shell opens on: the primary role when it is still approved,
 * otherwise the first approved role, otherwise student — which every account
 * holds, so this never returns a role the person cannot enter.
 */
export function defaultRole(approved: UserRole[], primary: UserRole | null): UserRole {
  const usable = approved.filter(roleInScope);
  if (primary && usable.includes(primary)) return primary;
  return usable[0] ?? 'student';
}
