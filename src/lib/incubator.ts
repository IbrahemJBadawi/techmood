import type { Text } from '@/lib/i18n';
import type { CanvasBlock, CardColour, GoalStatus, PlanSection, StartupStage, SwotQuadrant } from '@/lib/database.types';

/** The stage ladder, in the order a startup climbs it. */
export const STARTUP_STAGES: { key: StartupStage; label: Text; hint: Text }[] = [
  { key: 'idea',           label: { ar: 'الفكرة', en: 'Idea' },       hint: { ar: 'ما المشكلة، ولمن؟', en: 'What problem, and for whom?' } },
  { key: 'validation',     label: { ar: 'التحقق', en: 'Validation' },       hint: { ar: 'اختبار الفكرة مع مستخدمين حقيقيين قبل البناء.', en: 'Testing the idea with real users before building it.' } },
  { key: 'mvp',            label: { ar: 'MVP', en: 'MVP' },          hint: { ar: 'أبسط نسخة قابلة للاستخدام.', en: 'The simplest version someone can actually use.' } },
  { key: 'users',          label: { ar: 'مستخدمون', en: 'Users' },     hint: { ar: 'أول مستخدمين حقيقيين وملاحظاتهم.', en: 'The first real users, and what they said.' } },
  { key: 'business_model', label: { ar: 'نموذج عمل', en: 'Business model' },    hint: { ar: 'مصادر دخل واضحة وتكاليف معروفة.', en: 'Clear revenue and known costs.' } },
  { key: 'startup',        label: { ar: 'شركة ناشئة', en: 'Startup' },   hint: { ar: 'جاهزة للنمو والاستثمار.', en: 'Ready to grow and to raise.' } },
];

/**
 * The nine blocks, laid out as the canvas is actually drawn. `area` maps each
 * block onto the CSS grid so the picture matches the model people know.
 */
export const CANVAS_BLOCKS: { key: CanvasBlock; label: Text; hint: Text; area: string }[] = [
  { key: 'key_partners',          label: { ar: 'الشركاء الرئيسيون', en: 'Key partners' }, hint: { ar: 'من يساعدك ولا تستطيع العمل بدونه؟', en: 'Who helps you, and who could you not work without?' }, area: 'partners' },
  { key: 'key_activities',        label: { ar: 'الأنشطة الرئيسية', en: 'Key activities' },  hint: { ar: 'ما الذي يجب أن تفعله كل يوم؟', en: 'What has to happen every day?' },      area: 'activities' },
  { key: 'key_resources',         label: { ar: 'الموارد الرئيسية', en: 'Key resources' },  hint: { ar: 'ما الذي تحتاجه لتشتغل؟', en: 'What do you need in order to run?' },            area: 'resources' },
  { key: 'value_propositions',    label: { ar: 'القيمة المقترحة', en: 'Value proposition' },   hint: { ar: 'ما المشكلة التي تحلّها؟', en: 'What problem are you solving?' },           area: 'value' },
  { key: 'customer_relationships',label: { ar: 'علاقات العملاء', en: 'Customer relationships' },    hint: { ar: 'كيف تكسب العميل وتحتفظ به؟', en: 'How do you win a customer, and keep them?' },        area: 'relationships' },
  { key: 'channels',              label: { ar: 'القنوات', en: 'Channels' },           hint: { ar: 'كيف تصل إليه؟', en: 'How do you reach them?' },                     area: 'channels' },
  { key: 'customer_segments',     label: { ar: 'شرائح العملاء', en: 'Customer segments' },     hint: { ar: 'من هو عميلك بالضبط؟', en: 'Who exactly is your customer?' },               area: 'segments' },
  { key: 'cost_structure',        label: { ar: 'هيكل التكاليف', en: 'Cost structure' },     hint: { ar: 'أين يذهب المال؟', en: 'Where does the money go?' },                   area: 'cost' },
  { key: 'revenue_streams',       label: { ar: 'مصادر الإيرادات', en: 'Revenue streams' },   hint: { ar: 'من أين يأتي المال؟', en: 'Where does the money come from?' },                area: 'revenue' },
];

export const CARD_COLOURS: CardColour[] = [
  'default', 'royal', 'sky', 'green', 'amber', 'rose', 'violet', 'slate',
];

/** The ten sections, in the order a reader expects them. */
export const PLAN_SECTIONS: { key: PlanSection; label: Text; hint: Text }[] = [
  { key: 'executive_summary',    label: { ar: '1. الملخص التنفيذي', en: '1. Executive summary' },      hint: { ar: 'صفحة واحدة تشرح المشروع لمن لا وقت لديه.', en: 'One page for a reader who has no time.' } },
  { key: 'company_description',  label: { ar: '2. وصف المشروع', en: '2. Company description' },          hint: { ar: 'ما هو، متى بدأ، أين يعمل، وما شكله القانوني.', en: 'What it is, when it started, where it operates, how it is registered.' } },
  { key: 'market_analysis',      label: { ar: '3. تحليل السوق', en: '3. Market analysis' },          hint: { ar: 'حجم السوق، شرائحه، واتجاهاته — بأرقام لا انطباعات.', en: 'Size, segments and trends — in numbers, not impressions.' } },
  { key: 'competitive_analysis', label: { ar: '4. تحليل المنافسين', en: '4. Competitive analysis' },      hint: { ar: 'من ينافسك، وبم تختلف عنه فعلاً.', en: 'Who you are up against, and how you actually differ.' } },
  { key: 'product_and_service',  label: { ar: '5. المنتج والخدمة', en: '5. Product and service' },       hint: { ar: 'ما الذي تقدّمه، وما مراحل تطويره.', en: 'What you offer, and how it will develop.' } },
  { key: 'marketing_and_sales',  label: { ar: '6. خطة التسويق والمبيعات', en: '6. Marketing and sales' }, hint: { ar: 'كيف يعرفك العميل، وكيف يشتري.', en: 'How a customer hears of you, and how they buy.' } },
  { key: 'operations',           label: { ar: '7. الخطة التشغيلية', en: '7. Operations plan' },      hint: { ar: 'كيف يُنجَز العمل يومياً: الموردون، العمليات، الأدوات.', en: 'How the work gets done day to day: suppliers, processes, tools.' } },
  { key: 'team_and_management',  label: { ar: '8. الفريق والإدارة', en: '8. Team and management' },      hint: { ar: 'من في الفريق، ولماذا هو الفريق المناسب.', en: 'Who is on the team, and why they are the right team.' } },
  { key: 'financial_plan',       label: { ar: '9. الخطة المالية', en: '9. Financial plan' },        hint: { ar: 'التكاليف، الإيرادات المتوقعة، ونقطة التعادل.', en: 'Costs, expected revenue, and the break-even point.' } },
  { key: 'risks_and_mitigation', label: { ar: '10. المخاطر والبدائل', en: '10. Risks and mitigation' },    hint: { ar: 'ما الذي قد يفشل، وماذا ستفعل حينها.', en: 'What could fail, and what you would do then.' } },
];

export const SWOT_QUADRANTS: { key: SwotQuadrant; label: Text; hint: Text; className: string }[] = [
  { key: 'strength',    label: { ar: 'نقاط القوة', en: 'Strengths' },   hint: { ar: 'داخلي — ما الذي تجيده؟', en: 'Internal — what are you good at?' },        className: 'swot-strength' },
  { key: 'weakness',    label: { ar: 'نقاط الضعف', en: 'Weaknesses' },   hint: { ar: 'داخلي — أين تنقصك القدرة؟', en: 'Internal — where are you short?' },     className: 'swot-weakness' },
  { key: 'opportunity', label: { ar: 'الفرص', en: 'Opportunities' },        hint: { ar: 'خارجي — ما الذي يعمل لصالحك؟', en: 'External — what is working in your favour?' },  className: 'swot-opportunity' },
  { key: 'threat',      label: { ar: 'التهديدات', en: 'Threats' },    hint: { ar: 'خارجي — ما الذي يعمل ضدك؟', en: 'External — what is working against you?' },     className: 'swot-threat' },
];

export const GOAL_STATUS: Record<GoalStatus, { text: Text; className: string }> = {
  planned:  { text: { ar: 'مخطط', en: 'Planned' },       className: 'status-muted' },
  on_track: { text: { ar: 'على المسار', en: 'On track' }, className: 'status-ok' },
  at_risk:  { text: { ar: 'متعثّر', en: 'At risk' },      className: 'status-pending' },
  achieved: { text: { ar: 'تحقّق', en: 'Achieved' },       className: 'status-ok' },
  missed:   { text: { ar: 'لم يتحقق', en: 'Missed' },   className: 'status-danger' },
};
