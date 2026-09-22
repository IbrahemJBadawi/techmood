import type { Text } from '@/lib/i18n';
import type {
  CanvasBlock, CanvasKind, CardColour, CompanyDocumentKind, GoalStatus, OrgKind,
  PlanSection, StartupMemberRole, StartupStage, SwotQuadrant,
} from '@/lib/database.types';

/** The stage ladder, in the order a startup climbs it. */
export const STARTUP_STAGES: { key: StartupStage; label: Text; hint: Text }[] = [
  { key: 'idea',            label: { ar: 'الفكرة',        en: 'Idea' },            hint: { ar: 'ما المشكلة، ولمن؟', en: 'What problem, and for whom?' } },
  { key: 'validation',      label: { ar: 'التحقق',        en: 'Validation' },      hint: { ar: 'اختبار الفكرة مع أناس حقيقيين قبل البناء.', en: 'Testing the idea with real people before building.' } },
  { key: 'business_model',  label: { ar: 'نموذج العمل',    en: 'Business model' },  hint: { ar: 'من أين يأتي المال، وأين يذهب.', en: 'Where the money comes from, and where it goes.' } },
  { key: 'mvp',             label: { ar: 'أبسط نسخة',      en: 'MVP' },             hint: { ar: 'أصغر شيء يمكن لأحد استخدامه فعلاً.', en: 'The smallest thing somebody can actually use.' } },
  { key: 'market_test',     label: { ar: 'اختبار السوق',   en: 'Market test' },     hint: { ar: 'وضع النسخة أمام السوق ومعرفة ما حدث.', en: 'Putting it in front of the market and seeing what happens.' } },
  { key: 'first_customers', label: { ar: 'أول العملاء',    en: 'First customers' }, hint: { ar: 'أول من استخدم وبقي — لا أول من سجّل.', en: 'The first who used it and stayed — not the first who signed up.' } },
  { key: 'revenue',         label: { ar: 'الإيراد',        en: 'Revenue' },         hint: { ar: 'أول دخل حقيقي، ولو صغيراً.', en: 'The first real income, however small.' } },
  { key: 'growth',          label: { ar: 'النمو',          en: 'Growth' },          hint: { ar: 'ما الذي يتكرر، وكيف يكبر دون أن ينكسر.', en: 'What repeats, and how it grows without breaking.' } },
];

/** What kind of room this is. Same workspace, used differently. */
export const ORG_KIND: Record<OrgKind, Text> = {
  startup: { ar: 'شركة ناشئة', en: 'Startup' },
  company: { ar: 'شركة',       en: 'Company' },
};

/** The walls a company can think on. */
export const CANVAS_KIND: Record<CanvasKind, { label: Text; hint: Text }> = {
  business_model:   { label: { ar: 'نموذج العمل',        en: 'Business model' },     hint: { ar: 'الصورة الكاملة في تسع خانات.', en: 'The whole picture in nine blocks.' } },
  lean:             { label: { ar: 'Lean Canvas',        en: 'Lean canvas' },        hint: { ar: 'للفكرة المبكرة: مشكلة، حل، مؤشر.', en: 'For an early idea: problem, solution, metric.' } },
  value_proposition:{ label: { ar: 'القيمة المقترحة',     en: 'Value proposition' },  hint: { ar: 'ما يحتاجه العميل مقابل ما تقدّمه.', en: 'What the customer needs against what you offer.' } },
  market:           { label: { ar: 'تحليل السوق',        en: 'Market' },             hint: { ar: 'الحجم، الشرائح، الاتجاهات، العوائق.', en: 'Size, segments, trends, barriers.' } },
  competitors:      { label: { ar: 'المنافسون',          en: 'Competitors' },        hint: { ar: 'من ينافسك، وأين الفجوة.', en: 'Who you are against, and where the gap is.' } },
  persona:          { label: { ar: 'شخصية العميل',       en: 'Customer persona' },   hint: { ar: 'شخص واحد، بالتفصيل.', en: 'One person, in detail.' } },
  customer_journey: { label: { ar: 'رحلة العميل',        en: 'Customer journey' },   hint: { ar: 'من أول معرفة إلى العودة.', en: 'From first hearing of you to coming back.' } },
  financial:        { label: { ar: 'النموذج المالي',      en: 'Financial' },          hint: { ar: 'الدخل، التكاليف، التسعير، التعادل.', en: 'Income, costs, pricing, break-even.' } },
  funding:          { label: { ar: 'خطة التمويل',        en: 'Funding' },            hint: { ar: 'كم، لماذا، من أين، وبأي شروط.', en: 'How much, why, from where, on what terms.' } },
  mvp:              { label: { ar: 'نطاق أول نسخة',      en: 'MVP scope' },          hint: { ar: 'ما يُبنى الآن وما يُؤجَّل.', en: 'What gets built now and what waits.' } },
  validation:       { label: { ar: 'اختبار الافتراضات',   en: 'Validation' },         hint: { ar: 'افتراض، اختبار، نتيجة، قرار.', en: 'Assumption, test, result, decision.' } },
  pitch:            { label: { ar: 'العرض التقديمي',      en: 'Pitch' },              hint: { ar: 'سبع خانات تكفي لإقناع أحد.', en: 'Seven blocks are enough to convince somebody.' } },
  custom:           { label: { ar: 'لوحة خاصة',          en: 'Custom canvas' },      hint: { ar: 'خاناتك أنت.', en: 'Your own blocks.' } },
};

/** Who is in the room, and what they may do in it. */
export const MEMBER_ROLE: Record<StartupMemberRole, { label: Text; can: Text }> = {
  founder:    { label: { ar: 'مؤسس',        en: 'Founder' },     can: { ar: 'كل شيء',              en: 'Everything' } },
  cofounder:  { label: { ar: 'شريك مؤسس',   en: 'Co-founder' },  can: { ar: 'كل شيء',              en: 'Everything' } },
  manager:    { label: { ar: 'مدير',        en: 'Manager' },     can: { ar: 'الإدارة والتوظيف',     en: 'Runs and hires' } },
  member:     { label: { ar: 'عضو',         en: 'Member' },      can: { ar: 'العمل على المحتوى',    en: 'Works on the content' } },
  employee:   { label: { ar: 'موظف',        en: 'Employee' },    can: { ar: 'العمل على المحتوى',    en: 'Works on the content' } },
  freelancer: { label: { ar: 'مستقل',       en: 'Freelancer' },  can: { ar: 'قراءة ومشاريعه',      en: 'Reads, and their own projects' } },
  advisor:    { label: { ar: 'مستشار',      en: 'Advisor' },     can: { ar: 'قراءة',               en: 'Reads' } },
  viewer:     { label: { ar: 'مطّلع',        en: 'Viewer' },      can: { ar: 'قراءة',               en: 'Reads' } },
};

/** The papers a company keeps. */
export const DOCUMENT_KIND: Record<CompanyDocumentKind, Text> = {
  business_plan:   { ar: 'خطة عمل',           en: 'Business plan' },
  feasibility:     { ar: 'دراسة جدوى',        en: 'Feasibility study' },
  pitch_deck:      { ar: 'عرض تقديمي',        en: 'Pitch deck' },
  financial:       { ar: 'خطة مالية',         en: 'Financial plan' },
  strategy:        { ar: 'استراتيجية',        en: 'Strategy' },
  market_research: { ar: 'بحث سوق',           en: 'Market research' },
  report:          { ar: 'تقرير',             en: 'Report' },
  legal:           { ar: 'مستند قانوني',      en: 'Legal document' },
  certificate:     { ar: 'شهادة',             en: 'Certificate' },
  other:           { ar: 'أخرى',              en: 'Other' },
};

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
