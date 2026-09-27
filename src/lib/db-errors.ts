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
  // video sessions
  { match: 'أعضاء الفريق فقط من يحجزون',     en: 'Only a team\u2019s own members book its meetings.' },
  { match: 'وقت النهاية يجب أن يكون بعد البداية', en: 'The end time has to come after the start.' },
  { match: 'حدّ اجتماعين داخليين في الأسبوع', en: 'Your team has reached its two internal meetings for this week.' },
  { match: 'لست من المشاركين في هذه الجلسة',  en: 'You are not one of this session\u2019s participants.' },
  { match: 'الباب يفتح قبل الموعد بخمس دقائق', en: 'The door opens five minutes before the session.' },
  { match: 'انتهت هذه الجلسة',               en: 'This session is over.' },
  // escrow, negotiation, sales
  { match: 'لا يمكنك أن تدفع لنفسك',        en: 'You cannot pay yourself.' },
  { match: 'الدافع فقط من يرفع الإيصال',     en: 'Only whoever is paying attaches the receipt.' },
  { match: 'لا يوجد دفع مفتوح',             en: 'There is no open payment for this hold.' },
  { match: 'الدافع فقط من يفرج',            en: 'Only the side that paid can release the money.' },
  { match: 'الحجز في نزاع',                 en: 'This hold is disputed — an admin decides it now.' },
  { match: 'طرفا الحجز فقط',                en: 'Only the two sides of a hold can dispute it.' },
  { match: 'النزاع يُفتح على مبلغ محتجز فقط', en: 'A dispute is opened on money that is being held.' },
  { match: 'اكتب سبب النزاع',               en: 'Say what the disagreement is.' },
  { match: 'لا يمكن الإفراج عن حجز',         en: 'A hold in this state cannot be released.' },
  { match: 'لا يمكن استرداد حجز',            en: 'A hold in this state cannot be refunded.' },
  { match: 'طرفا الاتفاق فقط',              en: 'Only the two sides of an application negotiate it.' },
  { match: 'الطرف الآخر هو من يقبل عرضك',    en: 'The other side is the one who accepts your offer.' },
  { match: 'هذا العرض لم يعد قائماً',        en: 'That offer is no longer on the table.' },
  { match: 'انتهى التفاوض على هذا الطلب',    en: 'The negotiation on this application is over.' },
  { match: 'صاحب العمل فقط من يقيّمه',       en: 'Only whoever paid for the work reviews it.' },
  { match: 'التقييم بعد اكتمال العمل فقط',   en: 'Work is reviewed once it is finished.' },
  { match: 'التقييم بعد الإفراج عن المستحقات', en: 'A review follows the money: release it first.' },
  { match: 'قيّمت هذا العمل بالفعل',         en: 'You have already reviewed this work.' },
  { match: 'صاحب المشروع أو قائد الفريق',    en: 'Only whoever made it, or their team lead, may sell it.' },
  { match: 'يُعرض المشروع للبيع بعد اكتماله', en: 'A project goes on sale once it is finished.' },
  { match: 'مرّ بالتقييم وعُرض في المعرض',    en: 'Only work that was judged and exhibited can be sold.' },
  { match: 'نُفّذ لعميل، ولا يُعاد بيعه',      en: 'Work built for a client is not the builder\u2019s to resell.' },
  { match: 'اكتب وصفاً واضحاً',             en: 'Describe clearly what the buyer gets.' },
  { match: 'هذا العرض غير متاح للشراء',      en: 'That listing is not available.' },
  { match: 'شراء مشروعك',                   en: 'You cannot buy your own project.' },
  { match: 'هناك شراء جارٍ',                en: 'Somebody is buying this right now.' },
  // the market
  { match: 'دور فريلانسر معتمد',            en: 'Listing yourself for paid work needs an approved freelancer role.' },
  { match: 'صاحب الفرصة فقط',              en: 'Only whoever posted the opening may invite to it.' },
  { match: 'غير مدرج للعمل حالياً',          en: 'That person is not listed for work right now.' },
  { match: 'لا يعرض خدماته حالياً',          en: 'That team is not offering its services right now.' },
  { match: 'الدعوة مرسلة بالفعل',            en: 'That invitation has already been sent.' },
  { match: 'تمّ الردّ على هذه الدعوة',        en: 'That invitation has already been answered.' },
  { match: 'الدعوة ليست لك',                en: 'That invitation is not yours.' },
  { match: 'الدعوة لشخص أو لفريق',          en: 'An invitation goes to a person or to a team, not to both.' },
  // team bookings
  { match: 'قائد الفريق فقط',                en: 'Only the team\u2019s leader books the team\u2019s sessions.' },
  { match: 'المقاعد لأعضاء الفريق فقط',      en: 'Seats are for members of the team only.' },
  { match: 'اختر عضواً واحداً على الأقل',     en: 'Choose at least one member.' },
  { match: 'عشرون مقعداً كحد أقصى',          en: 'Twenty seats at most.' },
  { match: 'هذا المنتور لا يستقبل حجوزات',   en: 'This mentor is not taking bookings.' },
  { match: 'هذا المنتور لا يقدّم هذا النوع',  en: 'This mentor does not offer that session type.' },
  { match: 'طريقة الدفع غير متاحة',          en: 'That payment method is not available.' },
  // rating a session
  { match: 'التقييم بعد اكتمال الجلسة فقط',   en: 'A session is rated once it has been completed.' },
  { match: 'طرفا الجلسة فقط من يقيّمانها',    en: 'Only the two sides of a session rate it.' },
  { match: 'لا يمكن تقييم نفسك',             en: 'You cannot rate yourself.' },
  { match: 'قيّمت هذه الجلسة بالفعل',         en: 'You have already rated this session.' },
  { match: 'التقييم يحتاج درجة واحدة على الأقل', en: 'A rating needs at least one score.' },
  // pricing and availability (0077)
  { match: 'السعر خارج حدود مستواك',         en: 'That price is outside your level\u2019s range for this session.' },
  { match: 'التسعير للمنتورز فقط',           en: 'Only mentors set session prices.' },
  { match: 'التسعير للإدارة فقط',            en: 'Only an admin changes the price bands.' },
  { match: 'الإعدادات للإدارة فقط',          en: 'Only an admin changes platform settings.' },
  { match: 'إعداد غير معروف',               en: 'Unknown setting.' },
  { match: 'الشريحة الأولى (من صفر) لا تُحذف', en: 'The first bracket (from zero) cannot be removed — every amount needs a rate.' },
  { match: 'المنتور وحده من يغيّر استقباله',  en: 'Only the mentor (or an admin) switches their requests on or off.' },
  { match: 'تاريخ العودة يجب أن يكون',       en: 'The return date has to be today or later.' },
  { match: 'mentor_levels_band_ordered',     en: 'The band must run floor ≤ default ≤ ceiling, all above zero.' },
  { match: 'mentor_levels_commission_sane',  en: 'The commission must be between 0% and 60%.' },
  // the catalogue (0078)
  { match: 'لا يُفتح مسار ليس فيه دورة',      en: 'A path cannot open without at least one ready course.' },
  { match: 'هذا الدرس غير متاح حالياً',       en: 'This lesson is not available right now.' },
  { match: 'هذا المشروع غير متاح للتسليم',    en: 'This project is not taking submissions right now.' },
  { match: 'إدارة المسارات للإدارة فقط',      en: 'Only an admin manages paths.' },
  { match: 'لا يمكن نشر دورة بلا دروس',       en: 'A course without lessons cannot be published — write its lessons first.' },
  { match: 'لا يُحجز اجتماع في وقت مضى',      en: 'A meeting cannot be booked in the past.' },
  // ratings (0081)
  { match: 'التقييم ليس لك',                  en: 'That rating is not yours.' },
  { match: 'أُضيفت تفاصيل هذا التقييم',        en: 'The details of this rating were already added.' },
  { match: 'تُضاف التفاصيل مع التقييم نفسه',  en: 'Details are added with the rating itself, not days later.' },
  { match: 'تُقيَّم الدورة بعد إكمالها',        en: 'A course is rated once you have finished it.' },
  { match: 'قيّمت هذه الدورة بالفعل',         en: 'You have already rated this course.' },
  // help & reports (0083)
  { match: 'اشرح المشكلة في عشرة أحرف',       en: 'Describe the problem in at least ten characters.' },
  { match: 'لا يمكنك الإبلاغ عن عملية لست طرفاً', en: 'You can only report an operation you are part of.' },
  { match: 'لا يمكنك الإبلاغ عن نفسك',        en: 'You cannot report yourself.' },
  { match: 'الشخص المُبلَّغ عنه ليس طرفاً',     en: 'That person is not part of this operation.' },
  { match: 'المرفق يجب أن يكون من ملفاتك',    en: 'The attachment has to be one of your own files.' },
  { match: 'أُغلق هذا البلاغ',                 en: 'This ticket is closed — open a new one if the problem continues.' },
  { match: 'اكتب لصاحب البلاغ',              en: 'Write the reporter what happened or what you need from them.' },
  { match: 'إدارة البلاغات للإدارة فقط',       en: 'Only admins manage tickets.' },
  // admin sections (0087)
  { match: 'قراءة محادثة خاصة تحتاج قضية مفتوحة', en: 'Reading a private conversation needs an open case.' },
  { match: 'اكتب سبب الاطلاع',              en: 'Write why you need to read it (ten characters at least).' },
  { match: 'منح صلاحية الإدارة أو سحبها يحتاج سبباً', en: 'Granting or removing admin needs a written reason.' },
  { match: 'لا تسحب صلاحية الإدارة من نفسك',  en: 'You cannot remove your own admin role.' },
  { match: 'هذا الحساب ليس مديراً',          en: 'That account is not an admin.' },
];

/** Translates a database message when the interface is in English. */
export function dbError(t: T, message: string): string {
  if (t.locale === 'ar') return message;
  const hit = PHRASES.find((phrase) => message.includes(phrase.match));
  return hit ? hit.en : message;
}
