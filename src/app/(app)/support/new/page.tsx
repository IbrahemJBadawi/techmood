import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SupportComposer } from '@/components/SupportComposer';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_CATEGORY, TICKET_RELATED } from '@/lib/support';
import type { TicketCategory, TicketRelated } from '@/lib/database.types';

import { openTicket } from '../actions';

export const metadata = { title: 'Report a problem — TechMood' };

const PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

/**
 * Reporting a problem. The operation list is the person's own operations only
 * (the database checks it again); a page elsewhere can link here with
 * ?type=…&id=… so the operation is already chosen.
 */
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string; category?: string }>;
}) {
  const params = await searchParams;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: bookings }, { data: escrows }, { data: payouts }, { data: projects }] = await Promise.all([
    supabase.from('bookings').select('id, booking_code, status, scheduled_start')
      .or(`student_id.eq.${user.id},mentor_id.eq.${user.id}`).order('scheduled_start', { ascending: false }).limit(20),
    supabase.from('escrows').select('id, escrow_code, status')
      .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(20),
    supabase.from('payout_requests').select('id, request_code, status').eq('profile_id', user.id)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('projects').select('id, code, title_ar')
      .or(`owner_id.eq.${user.id},client_id.eq.${user.id}`).order('updated_at', { ascending: false }).limit(20),
  ]);
  const bookingIds = (bookings ?? []).map((row) => row.id);
  const { data: payments } = await supabase.from('payments').select('id, payment_code, status, booking_id')
    .in('booking_id', bookingIds.length ? bookingIds : [PLACEHOLDER]);

  const options: { value: string; label: string }[] = [
    ...(bookings ?? []).map((row) => ({ value: `booking:${row.id}`, label: `${t(TICKET_RELATED.booking)} ${row.booking_code}` })),
    ...(payments ?? []).map((row) => ({ value: `payment:${row.id}`, label: `${t(TICKET_RELATED.payment)} ${row.payment_code ?? ''}` })),
    ...(escrows ?? []).map((row) => ({ value: `escrow:${row.id}`, label: `${t(TICKET_RELATED.escrow)} ${row.escrow_code}` })),
    ...(payouts ?? []).map((row) => ({ value: `payout:${row.id}`, label: `${t(TICKET_RELATED.payout)} ${row.request_code}` })),
    ...(projects ?? []).map((row) => ({ value: `project:${row.id}`, label: `${t(TICKET_RELATED.project)} ${row.code} — ${row.title_ar}` })),
  ];

  // A link from a profile, message, course or opportunity brings its own target.
  const preset = params.type && params.id && params.type in TICKET_RELATED ? `${params.type}:${params.id}` : '';
  if (preset && !options.some((option) => option.value === preset)) {
    options.unshift({ value: preset, label: t(TICKET_RELATED[params.type as TicketRelated]) });
  }
  const category = params.category && params.category in TICKET_CATEGORY ? params.category as TicketCategory : '';

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/support">{t('→ بلاغاتي', '← My tickets')}</Link>
      <section className="panel section-block" style={{ marginTop: 16, maxWidth: 720 }}>
        <h2 style={{ fontSize: '1.15rem' }}>{t('إنشاء بلاغ', 'New report')}</h2>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
          {t('الأولوية يحددها النظام. ما تكتبه هنا يراه فريق الدعم فقط، ولا يراه من تبلّغ عنه.',
             'The system sets the priority. What you write is seen by the support team only — never by the person you report.')}
        </p>
        <div style={{ marginTop: 14 }}>
          <SupportComposer action={openTicket} userId={user.id} submitLabel={t('أرسل البلاغ', 'Send the report')}>
            <div className="field">
              <label htmlFor="category">{t('نوع المشكلة', 'What is it about?')}</label>
              <select id="category" name="category" required defaultValue={category}>
                <option value="" disabled>—</option>
                {(Object.keys(TICKET_CATEGORY) as TicketCategory[]).map((key) => (
                  <option key={key} value={key}>{t(TICKET_CATEGORY[key])}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="related">{t('العملية المرتبطة (اختياري)', 'The related operation (optional)')}</label>
              <select id="related" name="related" defaultValue={preset}>
                <option value="">{t('— لا شيء محدد —', '— Nothing specific —')}</option>
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subject">{t('عنوان قصير', 'A short title')}</label>
              <input id="subject" name="subject" required minLength={3} maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="description">{t('ما المشكلة؟', 'What happened?')}</label>
              <textarea id="description" name="description" rows={5} required minLength={10} maxLength={5000}
                placeholder={t('مثال: دفعت قيمة الجلسة ولكن لم يتم تأكيد الحجز.', 'e.g. I paid for the session but the booking was not confirmed.')} />
            </div>
          </SupportComposer>
        </div>
      </section>
    </>
  );
}
