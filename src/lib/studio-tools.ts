import type { Text } from '@/lib/i18n';

/**
 * The Startup Studio's six tools (design lab 5, 0166), in the order a founder
 * usually meets them: who the market is, who else is in it, who exactly the
 * users are, whether the numbers work, then the plan and the model that put
 * it all together. Two of them (the plan and the model) are older than the
 * other four and keep their own addresses.
 */
export type StudioToolKey = 'market' | 'competitors' | 'users' | 'feasibility' | 'plan' | 'model';

export const STUDIO_TOOLS: { key: StudioToolKey; href: string; icon: string; label: Text; hint: Text }[] = [
  { key: 'market', href: '/market', icon: '🌍',
    label: { ar: 'السوق', en: 'Market' },
    hint: { ar: 'حجم السوق الكلي والمخدوم والممكن الوصول إليه، والاتجاهات.', en: 'Total, served and obtainable market, and the trends.' } },
  { key: 'competitors', href: '/competitors', icon: '⚔️',
    label: { ar: 'المنافسون', en: 'Competitors' },
    hint: { ar: 'من يحلّ المشكلة غيرك، وبأي سعر، وأين تتفوّق عليه.', en: 'Who else solves it, at what price, and where you win.' } },
  { key: 'users', href: '/users', icon: '👤',
    label: { ar: 'المستخدمون', en: 'Users' },
    hint: { ar: 'شخصيات المستخدمين: أهدافهم وآلامهم وأين تجدهم وكم يدفعون.', en: 'Personas: goals, pains, where to reach them, what they pay.' } },
  { key: 'feasibility', href: '/feasibility', icon: '🧮',
    label: { ar: 'الجدوى', en: 'Feasibility' },
    hint: { ar: 'السعر والتكاليف والنمو ← نقطة التعادل وشهر استرداد رأس المال.', en: 'Price, costs and growth → break-even and the payback month.' } },
  { key: 'plan', href: '/plan', icon: '📄',
    label: { ar: 'خطة العمل', en: 'Business plan' },
    hint: { ar: 'عشرة أقسام تجمع كل ما سبق في وثيقة واحدة.', en: 'Ten sections that bring it all into one document.' } },
  { key: 'model', href: '/canvases', icon: '🧩',
    label: { ar: 'نموذج العمل', en: 'Business model' },
    hint: { ar: 'لوحة نموذج العمل بخاناتها التسع، ولوحات أخرى.', en: 'The nine-block business model canvas, and other canvases.' } },
];

/** Big numbers the way a founder says them: 4.2M$, 850K$. */
export function shortUsd(value: number | null | undefined) {
  if (value == null) return '—';
  const n = Number(value);
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B$`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M$`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}K$`;
  return `${n.toFixed(n % 1 ? 2 : 0)}$`;
}
