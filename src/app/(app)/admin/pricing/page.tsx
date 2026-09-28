import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { createClient } from '@/lib/supabase/server';
import { formatSlot, money } from '@/lib/booking';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';

import { refundBooking, saveLevel, saveSetting, saveTier, settleAttendance, switchMentor } from './actions';

export const metadata = { title: 'Pricing — TechMood admin' };

const TIER_KINDS: Record<string, Text> = {
  market_work:  { ar: 'العمل عبر السوق (عقود ومشاريع)', en: 'Market work (contracts and projects)' },
  project_sale: { ar: 'بيع مشروع جاهز',                en: 'Selling a finished project' },
};

const SETTINGS: { key: string; label: Text; unit: Text }[] = [
  { key: 'mentor_response_hours',       label: { ar: 'مهلة ردّ المنتور على طلب مدفوع', en: 'Mentor’s window to answer a paid request' }, unit: { ar: 'ساعة', en: 'hours' } },
  { key: 'mentor_unanswered_limit',     label: { ar: 'طلبات بلا ردّ قبل إيقاف المنتور تلقائياً', en: 'Unanswered requests before a mentor is paused' }, unit: { ar: 'طلبات', en: 'requests' } },
  { key: 'booking_min_notice_hours',    label: { ar: 'أقل مدة قبل موعد الجلسة للحجز', en: 'Minimum notice for a booking' }, unit: { ar: 'ساعة', en: 'hours' } },
  { key: 'booking_reservation_minutes', label: { ar: 'مدة حجز الموعد ريثما يدفع الطالب', en: 'How long a slot is held for payment' }, unit: { ar: 'دقيقة', en: 'minutes' } },
  { key: 'payout_minimum_usd',          label: { ar: 'أقل مبلغ للسحب', en: 'Minimum withdrawal' }, unit: { ar: 'دولار', en: 'USD' } },
];

const PAUSE_LABEL: Record<string, Text> = {
  manual:       { ar: 'أوقفه المنتور', en: 'Paused by the mentor' },
  vacation:     { ar: 'في إجازة',      en: 'On holiday' },
  unresponsive: { ar: 'أُوقف تلقائياً — طلبات بلا ردّ', en: 'Paused automatically — unanswered requests' },
};

/**
 * TechMood's prices and share, in one place.
 *
 * A mentor level is a band plus a percentage (0077); market work and project
 * sales are brackets (0054). Refunds owed are the paid sessions that will not
 * happen — declined by the mentor, or for them when they did not answer.
 */
export default async function AdminPricingPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const [{ data: levels }, { data: tiers }, { data: settings }, { data: refunds }, { data: mentors }, { data: disputes }] = await Promise.all([
    supabase.from('mentor_levels').select('*').order('sort_order'),
    supabase.from('commission_tiers').select('*').order('kind').order('min_amount_usd'),
    supabase.from('platform_settings').select('key, value'),
    supabase.rpc('refunds_owed'),
    supabase
      .from('mentor_profiles')
      .select('profile_id, level, is_accepting, pause_reason, paused_until, approved_at')
      .not('approved_at', 'is', null)
      .order('is_accepting'),
    supabase.rpc('admin_attendance_disputes'),
  ]);

  const mentorIds = (mentors ?? []).map((row) => row.profile_id);
  const { data: names } = await supabase
    .from('profiles')
    .select('id, full_name, techmood_id')
    .in('id', mentorIds.length ? mentorIds : ['00000000-0000-0000-0000-000000000000']);
  const nameOf = new Map((names ?? []).map((row) => [row.id, row]));
  const settingOf = new Map((settings ?? []).map((row) => [row.key, row.value]));

  return (
    <>
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('التسعير والعمولات', 'Pricing and commission')}</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '70ch' }}>
          {t('كل مستوى منتور له حدّ أدنى وأعلى لسعر الساعة ونسبة تكمود. المنتور يسعّر كل نوع جلسة داخل حدود مستواه، والجلسات الأقصر تُحسب بنسبة مدتها. عمل السوق وبيع المشاريع لهما شرائح عمولة حسب المبلغ.',
             'Each mentor level has a floor and ceiling for an hour and TechMood’s percentage. Mentors price each session type within their level’s range; shorter sessions are priced by their length. Market work and project sales have commission brackets by amount.')}
        </p>
      </section>

      {(disputes ?? []).length > 0 && (
        <section className="section-block">
          <h3 className="academy-heading">{t(`بلاغات غياب منتور (${disputes!.length})`, `Mentor absence reports (${disputes!.length})`)}</h3>
          <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 10 }}>
            {t('أبلغ الطالب أن المنتور لم يحضر. تحقّق من الطرفين ثم قرّر: غياب المنتور يُعيد المبلغ للطالب، وانعقاد الجلسة يكملها.',
               'The learner reported that the mentor did not come. Check with both sides, then decide: a mentor absence refunds the learner; a held session completes it.')}
          </p>
          <div className="stack">
            {disputes!.map((row) => (
              <article className="panel" key={row.booking_id}>
                <div className="row-between">
                  <div>
                    <Link className="eng" href={`/bookings/${row.booking_id}`}><strong>{row.booking_code}</strong></Link>{' · '}
                    {row.student_name ?? '—'}{t(' مع ', ' with ')}{row.mentor_name ?? '—'}
                    <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      {formatSlot(row.scheduled_start).date} · <span className="eng">{formatSlot(row.scheduled_start).time}</span>
                    </p>
                  </div>
                  <span className="badge-pill eng">{money(row.price_usd)}</span>
                </div>
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <ActionForm
                    action={settleAttendance}
                    className="admin-inline-form"
                    submitLabel={t('غاب المنتور — أرجع المبلغ', 'Mentor absent — refund')}
                    confirm={t('تسجيل غياب المنتور وإرجاع المبلغ للطالب؟', 'Record the mentor absent and refund the learner?')}
                  >
                    <input type="hidden" name="booking_id" value={row.booking_id} />
                    <input type="hidden" name="outcome" value="mentor_absent" />
                  </ActionForm>
                  <ActionForm
                    action={settleAttendance}
                    className="admin-inline-form"
                    submitLabel={t('انعقدت الجلسة', 'The session was held')}
                    confirm={t('تسجيل الجلسة منعقدة؟', 'Record the session as held?')}
                  >
                    <input type="hidden" name="booking_id" value={row.booking_id} />
                    <input type="hidden" name="outcome" value="held" />
                  </ActionForm>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section-block">
        <h3 className="academy-heading">{t(`مبالغ مستحقة الإرجاع (${refunds?.length ?? 0})`, `Refunds owed (${refunds?.length ?? 0})`)}</h3>
        {(refunds ?? []).length === 0 ? (
          <p className="muted" style={{ fontSize: '0.86rem' }}>{t('لا جلسات مدفوعة ملغاة تنتظر الإرجاع.', 'No paid, cancelled sessions waiting for a refund.')}</p>
        ) : (
          <div className="stack">
            {refunds!.map((row) => (
              <article className="panel" key={row.booking_id}>
                <div className="row-between">
                  <div>
                    <strong className="eng">{row.booking_code}</strong>{' · '}
                    {row.student_name ?? '—'}{t(' مع ', ' with ')}{row.mentor_name ?? '—'}
                    <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      {row.reason_ar ?? t('بلا سبب مكتوب', 'No reason written')}
                      {row.auto_declined && <> · {t('انتهت مهلة الردّ', 'Mentor did not answer')}</>}
                    </p>
                  </div>
                  <span className="badge-pill eng">{money(row.amount_usd)}</span>
                </div>
                <ActionForm
                  action={refundBooking}
                  className="admin-inline-form"
                  submitLabel={t('أرجع المبلغ لمحفظة الطالب', 'Refund to the learner’s wallet')}
                  confirm={t('إرجاع المبلغ إلى محفظة الطالب؟', 'Refund this amount to the learner’s wallet?')}
                >
                  <input type="hidden" name="booking_id" value={row.booking_id} />
                  <input name="reason" defaultValue={row.reason_ar ?? ''} placeholder={t('السبب', 'Reason')} />
                </ActionForm>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('مستويات المنتورز', 'Mentor levels')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
          {t('الأسعار لساعة كاملة. تخفيض السقف يُنزل أي سعر خاص أعلى منه إلى السقف فوراً.',
             'Prices are for a full hour. Lowering a ceiling brings any higher own price down to it at once.')}
        </p>
        <div className="stack">
          {(levels ?? []).map((level) => (
            <ActionForm action={saveLevel} className="admin-inline-form panel" key={level.level} submitLabel={t('احفظ', 'Save')}>
              <input type="hidden" name="level" value={level.level} />
              <strong className="eng" style={{ minWidth: 36 }}>{level.level}</strong>
              <label className="muted" style={{ fontSize: '0.78rem' }}>{t('أدنى', 'Floor')}
                <input name="min_usd" type="number" step="0.5" min={1} defaultValue={level.min_session_usd} style={{ width: 90 }} />
              </label>
              <label className="muted" style={{ fontSize: '0.78rem' }}>{t('افتراضي', 'Default')}
                <input name="default_usd" type="number" step="0.5" min={1} defaultValue={level.session_price_usd} style={{ width: 90 }} />
              </label>
              <label className="muted" style={{ fontSize: '0.78rem' }}>{t('أعلى', 'Ceiling')}
                <input name="max_usd" type="number" step="0.5" min={1} defaultValue={level.max_session_usd} style={{ width: 90 }} />
              </label>
              <label className="muted" style={{ fontSize: '0.78rem' }}>{t('نسبة تكمود %', 'TechMood %')}
                <input name="commission_pct" type="number" step="0.01" min={0} max={60} defaultValue={level.commission_pct} style={{ width: 80 }} />
              </label>
              <span className="muted" style={{ fontSize: '0.76rem' }}>
                {t(`يُرقّى إليه بعد ${level.min_sessions} جلسة وتقييم ${level.min_rating}+`, `Reached after ${level.min_sessions} sessions and a ${level.min_rating}+ rating`)}
              </span>
            </ActionForm>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('شرائح العمولة', 'Commission brackets')}</h3>
        {Object.entries(TIER_KINDS).map(([kind, label]) => (
          <div className="panel section-block" key={kind}>
            <h4 style={{ fontSize: '0.92rem' }}>{t(label)}</h4>
            {(tiers ?? []).filter((tier) => tier.kind === kind).map((tier) => (
              <div className="admin-inline-form" key={`${tier.kind}-${tier.min_amount_usd}`}>
                <ActionForm action={saveTier} className="admin-inline-form" submitLabel={t('احفظ', 'Save')}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="min_amount" value={tier.min_amount_usd} />
                  <span className="eng" style={{ minWidth: 90 }}>{t('من ', 'From ')}{money(tier.min_amount_usd)}</span>
                  <input name="rate" type="number" step="0.01" min={0} max={50} defaultValue={tier.rate_percent} style={{ width: 80 }} aria-label="%" />
                  <input name="note" defaultValue={tier.note_ar ?? ''} placeholder={t('ملاحظة', 'Note')} />
                </ActionForm>
                {Number(tier.min_amount_usd) > 0 && (
                  <ActionForm action={saveTier} variant="ghost" submitLabel={t('احذف', 'Remove')}>
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="min_amount" value={tier.min_amount_usd} />
                    <input type="hidden" name="rate" value={tier.rate_percent} />
                    <input type="hidden" name="remove" value="yes" />
                  </ActionForm>
                )}
              </div>
            ))}
            <ActionForm action={saveTier} className="admin-inline-form" variant="ghost" submitLabel={t('أضف شريحة', 'Add a bracket')}>
              <input type="hidden" name="kind" value={kind} />
              <input name="min_amount" type="number" step="1" min={1} required placeholder={t('من مبلغ ($)', 'From amount ($)')} />
              <input name="rate" type="number" step="0.01" min={0} max={50} required placeholder="%" style={{ width: 80 }} />
            </ActionForm>
          </div>
        ))}
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('إعدادات الحجز والسحب', 'Booking and withdrawal settings')}</h3>
        <div className="stack">
          {SETTINGS.map((setting) => (
            <ActionForm action={saveSetting} className="admin-inline-form panel" key={setting.key} submitLabel={t('احفظ', 'Save')}>
              <input type="hidden" name="key" value={setting.key} />
              <span style={{ minWidth: 260 }}>{t(setting.label)}</span>
              <input name="value" type="number" min={0} defaultValue={settingOf.get(setting.key) ?? ''} style={{ width: 100 }} />
              <span className="muted" style={{ fontSize: '0.8rem' }}>{t(setting.unit)}</span>
            </ActionForm>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('بيانات الفواتير', 'Invoice details')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
          {t('ما يظهر كجهة مُصدِرة على كل فاتورة. يُكتب هنا، لا في الكود.', 'What every invoice shows as its issuer. Written here, never in the code.')}
        </p>
        <div className="stack">
          {[
            { key: 'invoice_issuer_name', label: t('اسم الجهة المُصدِرة', 'Issuer name') },
            { key: 'invoice_issuer_details', label: t('سطر التفاصيل (عنوان، رقم تسجيل…)', 'Details line (address, registration…)') },
          ].map((setting) => (
            <ActionForm action={saveSetting} className="admin-inline-form panel" key={setting.key} submitLabel={t('احفظ', 'Save')}>
              <input type="hidden" name="key" value={setting.key} />
              <span style={{ minWidth: 220 }}>{setting.label}</span>
              <input name="value" maxLength={240} defaultValue={settingOf.get(setting.key) ?? ''} style={{ flex: 1 }} />
            </ActionForm>
          ))}
        </div>
      </section>

      <section className="section-block">
        <h3 className="academy-heading">{t('استقبال المنتورز للطلبات', 'Mentors taking requests')}</h3>
        <table className="data">
          <thead>
            <tr>
              <th>{t('المنتور', 'Mentor')}</th>
              <th>{t('المستوى', 'Level')}</th>
              <th>{t('الحالة', 'Status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(mentors ?? []).map((mentor) => (
              <tr key={mentor.profile_id}>
                <td>
                  {nameOf.get(mentor.profile_id)?.full_name ?? '—'}{' '}
                  <span className="id-chip">{nameOf.get(mentor.profile_id)?.techmood_id}</span>
                </td>
                <td className="eng">{mentor.level}</td>
                <td>
                  {mentor.is_accepting
                    ? <span className="status-pill status-ok">{t('يستقبل', 'Taking requests')}</span>
                    : <span className={`status-pill ${mentor.pause_reason === 'unresponsive' ? 'status-danger' : 'status-muted'}`}>
                        {t(PAUSE_LABEL[mentor.pause_reason ?? 'manual'])}
                        {mentor.paused_until ? ` → ${mentor.paused_until}` : ''}
                      </span>}
                </td>
                <td>
                  <ActionForm
                    action={switchMentor}
                    variant="ghost"
                    submitLabel={mentor.is_accepting ? t('أوقف', 'Pause') : t('فعّل', 'Resume')}
                  >
                    <input type="hidden" name="mentor_id" value={mentor.profile_id} />
                    <input type="hidden" name="accepting" value={mentor.is_accepting ? 'off' : 'on'} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
