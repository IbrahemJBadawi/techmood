import type { T } from '@/lib/i18n';

/**
 * The database speaks Arabic.
 *
 * Every `raise exception` in the migrations is written in Arabic, because that
 * is the language the product is designed in and the message has to be right
 * for the person who usually reads it. When the interface is in English those
 * messages still arrive in Arabic, so this maps the ones a client can actually
 * trigger onto their English wording.
 *
 * It matches on a distinctive fragment rather than the whole string: the SQL
 * is free to reword the rest of a sentence without silently breaking this, and
 * a message that is not listed falls back to the original Arabic rather than to
 * a vague "something went wrong" — showing the real reason in the wrong
 * language is more useful than hiding it in the right one.
 */
const PHRASES: { match: string; en: string }[] = [
  // roles
  { match: 'دور الإدارة لا يُطلب',          en: 'The admin role is not requested — it is granted by another admin.' },
  { match: 'دور الطالب مفعّل تلقائياً',      en: 'The student role is active on every account automatically.' },
  { match: 'هذا الدور مفعّل لديك بالفعل',    en: 'You already hold this role.' },
  { match: 'هذا الدور موقوف',               en: 'This role is suspended — please contact the team.' },
  { match: 'طلبك قيد المراجعة بالفعل',       en: 'Your request is already under review.' },
  { match: 'هذا الطلب ليس لك',              en: 'That request is not yours.' },
  { match: 'هذا الطلب لا ينتظر معلومات',     en: 'That request is not waiting on more information.' },
  { match: 'اكتب ردّاً واضحاً',              en: 'Write a clear answer.' },
  { match: 'لا يمكن سحب دور معتمد',          en: 'An approved role cannot be withdrawn — contact the team.' },
  { match: 'الدور الأساسي يجب أن يكون',      en: 'Your primary role has to be one you actually hold.' },
  // taxonomy
  { match: 'لا يمكن اختيار مجال غير معتمد',  en: 'An unapproved field cannot be selected.' },
  { match: 'لا يمكن اختيار اهتمام غير معتمد',en: 'An unapproved interest cannot be selected.' },
  { match: 'لا يمكن اختيار مهارة غير معتمدة',en: 'An unapproved skill cannot be selected.' },
  { match: 'ثلاثة كحد أقصى',                en: 'Fields: three at most.' },
  { match: 'الاسم العربي والإنجليزي مطلوبان',en: 'Both the Arabic and the English name are required.' },
  { match: 'الاسم قصير جداً',               en: 'That name is too short.' },
  { match: 'تعذّر توليد معرّف',              en: 'An identifier could not be generated from the English name.' },
  // mentor application
  { match: 'اشرح دافعك للإرشاد',            en: 'Explain why you want to mentor, in at least 40 characters.' },
  { match: 'اشرح خبرتك العملية',            en: 'Describe your working experience, in at least 40 characters.' },
  { match: 'اختر مجال إرشاد واحداً',         en: 'Choose at least one field you can mentor in.' },
  // permissions
  { match: 'للإدارة فقط',                   en: 'This is for admins only.' },
  { match: 'يجب تسجيل الدخول',              en: 'You need to be signed in.' },
  // bookings
  { match: 'الحجز غير موجود',               en: 'That booking does not exist.' },
  { match: 'لا يمكن إلغاء حجز في هذه الحالة',en: 'A booking in this state cannot be cancelled.' },
  { match: 'رابط الجلسة يضعه المنتور',       en: 'The meeting link is set by the mentor.' },
  { match: 'لا يُضاف رابط إلا لجلسة مؤكدة',   en: 'A link can only be added to a confirmed session.' },
  { match: 'الرابط يجب أن يبدأ',            en: 'The link has to start with http or https.' },
];

/** Translates a database message when the interface is in English. */
export function dbError(t: T, message: string): string {
  if (t.locale === 'ar') return message;
  const hit = PHRASES.find((phrase) => message.includes(phrase.match));
  return hit ? hit.en : message;
}
