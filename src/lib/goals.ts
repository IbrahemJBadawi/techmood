import type { Text } from '@/lib/i18n';

/**
 * «شو هدفك؟» — the goal a member names at onboarding (0156), and the paths
 * that lead to it, best first. The first of them that is published is the one
 * recommended; the list outlives any single path being renamed or withdrawn.
 */
export type LearningGoal =
  | 'web' | 'mobile' | 'data' | 'ai' | 'design' | 'security' | 'cloud' | 'freelance' | 'basics' | 'marketing';

export const LEARNING_GOALS: { key: LearningGoal; icon: string; label: Text; hint: Text; paths: string[] }[] = [
  { key: 'web', icon: '💻', label: { ar: 'أصبح مطوّر ويب', en: 'Become a web developer' },
    hint: { ar: 'مواقع وتطبيقات ويب من الواجهة إلى الخادم', en: 'Websites and web apps, front to back' }, paths: ['web', 'full-stack', 'js-ts', 'back-end'] },
  { key: 'mobile', icon: '📱', label: { ar: 'أبني تطبيقات للهاتف', en: 'Build mobile apps' },
    hint: { ar: 'تطبيقات Android و iOS', en: 'Android and iOS apps' }, paths: ['flutter', 'mobile'] },
  { key: 'data', icon: '📊', label: { ar: 'أحلّل البيانات', en: 'Analyse data' },
    hint: { ar: 'Excel و SQL ولوحات المؤشرات', en: 'Excel, SQL and dashboards' }, paths: ['data', 'data-science', 'databases'] },
  { key: 'ai', icon: '🤖', label: { ar: 'أدخل عالم الذكاء الاصطناعي', en: 'Get into AI' },
    hint: { ar: 'Python والذكاء الاصطناعي التوليدي', en: 'Python and generative AI' }, paths: ['genai', 'python', 'data-science'] },
  { key: 'design', icon: '🎨', label: { ar: 'أصمّم واجهات وتجارب', en: 'Design interfaces' },
    hint: { ar: 'UI/UX وتصميم المنتجات', en: 'UI/UX and product design' }, paths: ['ui-ux', 'product'] },
  { key: 'security', icon: '🛡️', label: { ar: 'أتخصّص في الأمن السيبراني', en: 'Specialise in security' },
    hint: { ar: 'الاختراق الأخلاقي وحماية الأنظمة', en: 'Ethical hacking and protecting systems' }, paths: ['ethical-hacking', 'sysadmin'] },
  { key: 'cloud', icon: '☁️', label: { ar: 'السحابة و DevOps', en: 'Cloud and DevOps' },
    hint: { ar: 'النشر والخوادم والأتمتة', en: 'Deployment, servers and automation' }, paths: ['cloud', 'devops', 'sysadmin'] },
  { key: 'freelance', icon: '💼', label: { ar: 'أعمل حراً أو أبدأ مشروعي', en: 'Freelance or start a business' },
    hint: { ar: 'العمل الحر وريادة الأعمال', en: 'Freelancing and entrepreneurship' }, paths: ['freelancing', 'business', 'personal-branding'] },
  { key: 'marketing', icon: '📣', label: { ar: 'التسويق الرقمي', en: 'Digital marketing' },
    hint: { ar: 'المحتوى والإعلانات وتحسين الظهور', en: 'Content, ads and SEO' }, paths: ['digital-marketing', 'personal-branding'] },
  { key: 'basics', icon: '🧭', label: { ar: 'أبدأ من الصفر', en: 'Start from zero' },
    hint: { ar: 'أساسيات الحاسوب والمهارات الرقمية', en: 'Computer basics and digital skills' }, paths: ['icdl', 'advanced-excel'] },
];

export function isLearningGoal(value: unknown): value is LearningGoal {
  return LEARNING_GOALS.some((goal) => goal.key === value);
}

/** The first path for this goal that is on offer, from the published paths given. */
export function recommendedPath<P extends { slug: string }>(goal: string | null | undefined, published: P[]): P | null {
  const entry = LEARNING_GOALS.find((item) => item.key === goal);
  if (!entry) return null;
  for (const slug of entry.paths) {
    const found = published.find((path) => path.slug === slug);
    if (found) return found;
  }
  return null;
}
