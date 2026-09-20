import type { CanvasBlock, CardColour, GoalStatus, PlanSection, StartupStage, SwotQuadrant } from '@/lib/database.types';

/** The stage ladder, in the order a startup climbs it. */
export const STARTUP_STAGES: { key: StartupStage; label: string; hint: string }[] = [
  { key: 'idea',           label: 'الفكرة',       hint: 'ما المشكلة، ولمن؟' },
  { key: 'validation',     label: 'التحقق',       hint: 'اختبار الفكرة مع مستخدمين حقيقيين قبل البناء.' },
  { key: 'mvp',            label: 'MVP',          hint: 'أبسط نسخة قابلة للاستخدام.' },
  { key: 'users',          label: 'مستخدمون',     hint: 'أول مستخدمين حقيقيين وملاحظاتهم.' },
  { key: 'business_model', label: 'نموذج عمل',    hint: 'مصادر دخل واضحة وتكاليف معروفة.' },
  { key: 'startup',        label: 'شركة ناشئة',   hint: 'جاهزة للنمو والاستثمار.' },
];

/**
 * The nine blocks, laid out as the canvas is actually drawn. `area` maps each
 * block onto the CSS grid so the picture matches the model people know.
 */
export const CANVAS_BLOCKS: { key: CanvasBlock; label: string; hint: string; area: string }[] = [
  { key: 'key_partners',          label: 'الشركاء الرئيسيون', hint: 'من يساعدك ولا تستطيع العمل بدونه؟', area: 'partners' },
  { key: 'key_activities',        label: 'الأنشطة الرئيسية',  hint: 'ما الذي يجب أن تفعله كل يوم؟',      area: 'activities' },
  { key: 'key_resources',         label: 'الموارد الرئيسية',  hint: 'ما الذي تحتاجه لتشتغل؟',            area: 'resources' },
  { key: 'value_propositions',    label: 'القيمة المقترحة',   hint: 'ما المشكلة التي تحلّها؟',           area: 'value' },
  { key: 'customer_relationships',label: 'علاقات العملاء',    hint: 'كيف تكسب العميل وتحتفظ به؟',        area: 'relationships' },
  { key: 'channels',              label: 'القنوات',           hint: 'كيف تصل إليه؟',                     area: 'channels' },
  { key: 'customer_segments',     label: 'شرائح العملاء',     hint: 'من هو عميلك بالضبط؟',               area: 'segments' },
  { key: 'cost_structure',        label: 'هيكل التكاليف',     hint: 'أين يذهب المال؟',                   area: 'cost' },
  { key: 'revenue_streams',       label: 'مصادر الإيرادات',   hint: 'من أين يأتي المال؟',                area: 'revenue' },
];

export const CARD_COLOURS: CardColour[] = [
  'default', 'royal', 'sky', 'green', 'amber', 'rose', 'violet', 'slate',
];

/** The ten sections, in the order a reader expects them. */
export const PLAN_SECTIONS: { key: PlanSection; label: string; hint: string }[] = [
  { key: 'executive_summary',    label: '1. الملخص التنفيذي',      hint: 'صفحة واحدة تشرح المشروع لمن لا وقت لديه.' },
  { key: 'company_description',  label: '2. وصف المشروع',          hint: 'ما هو، متى بدأ، أين يعمل، وما شكله القانوني.' },
  { key: 'market_analysis',      label: '3. تحليل السوق',          hint: 'حجم السوق، شرائحه، واتجاهاته — بأرقام لا انطباعات.' },
  { key: 'competitive_analysis', label: '4. تحليل المنافسين',      hint: 'من ينافسك، وبم تختلف عنه فعلاً.' },
  { key: 'product_and_service',  label: '5. المنتج والخدمة',       hint: 'ما الذي تقدّمه، وما مراحل تطويره.' },
  { key: 'marketing_and_sales',  label: '6. خطة التسويق والمبيعات', hint: 'كيف يعرفك العميل، وكيف يشتري.' },
  { key: 'operations',           label: '7. الخطة التشغيلية',      hint: 'كيف يُنجَز العمل يومياً: الموردون، العمليات، الأدوات.' },
  { key: 'team_and_management',  label: '8. الفريق والإدارة',      hint: 'من في الفريق، ولماذا هو الفريق المناسب.' },
  { key: 'financial_plan',       label: '9. الخطة المالية',        hint: 'التكاليف، الإيرادات المتوقعة، ونقطة التعادل.' },
  { key: 'risks_and_mitigation', label: '10. المخاطر والبدائل',    hint: 'ما الذي قد يفشل، وماذا ستفعل حينها.' },
];

export const SWOT_QUADRANTS: { key: SwotQuadrant; label: string; hint: string; className: string }[] = [
  { key: 'strength',    label: 'نقاط القوة',   hint: 'داخلي — ما الذي تجيده؟',        className: 'swot-strength' },
  { key: 'weakness',    label: 'نقاط الضعف',   hint: 'داخلي — أين تنقصك القدرة؟',     className: 'swot-weakness' },
  { key: 'opportunity', label: 'الفرص',        hint: 'خارجي — ما الذي يعمل لصالحك؟',  className: 'swot-opportunity' },
  { key: 'threat',      label: 'التهديدات',    hint: 'خارجي — ما الذي يعمل ضدك؟',     className: 'swot-threat' },
];

export const GOAL_STATUS: Record<GoalStatus, { text: string; className: string }> = {
  planned:  { text: 'مخطط',       className: 'status-muted' },
  on_track: { text: 'على المسار', className: 'status-ok' },
  at_risk:  { text: 'متعثّر',      className: 'status-pending' },
  achieved: { text: 'تحقّق',       className: 'status-ok' },
  missed:   { text: 'لم يتحقق',   className: 'status-danger' },
};
