import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { PaymentMethod, SessionType, SlotState } from '@/lib/database.types';

import { BookingWizard } from './BookingWizard';

/** How far ahead the picker looks. The 72-hour floor is applied by the database. */
const HORIZON_DAYS = 21;

export default async function BookSessionPage({
  params,
}: {
  params: Promise<{ mentorId: string }>;
}) {
  const { mentorId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: mentor } = await supabase
    .from('mentor_profiles')
    .select('profile_id, level, is_accepting')
    .eq('profile_id', mentorId)
    .maybeSingle();

  if (!mentor || !mentor.is_accepting) notFound();

  const today = new Date();
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const asDate = (value: Date) => value.toISOString().slice(0, 10);

  const [
    { data: mentorProfile },
    { data: level },
    { data: offered },
    { data: slots },
    { data: methods },
    { data: student },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', mentorId).single(),
    supabase.from('mentor_levels').select('session_price_usd').eq('level', mentor.level).single(),
    supabase
      .from('mentor_session_types')
      .select('session_types(id, slug, name_ar, name_en, description_ar, duration_minutes, sort_order, is_active)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true),
    supabase.rpc('mentor_available_slots', {
      p_mentor: mentorId,
      p_from: asDate(today),
      p_to: asDate(horizon),
    }),
    supabase.from('payment_methods').select('*').eq('is_enabled', true).order('sort_order'),
    supabase.from('profiles').select('full_name, techmood_id, phone').eq('id', user.id).single(),
  ]);

  const sessionTypes = (offered ?? [])
    .map((row) => row.session_types as unknown as SessionType)
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (sessionTypes.length === 0) {
    return (
      <>
        <Link className="btn btn-ghost btn-sm" href={`/mentors/${mentorId}`}>→ رجوع</Link>
        <p className="notice" style={{ marginTop: 16 }}>
          لم يحدد هذا المنتور أنواع جلساته بعد، فلا يمكن الحجز حالياً.
        </p>
      </>
    );
  }

  // What the student can ask the mentor to look at — their own work, already on
  // the platform. Nothing is re-uploaded for the sake of a session.
  const [{ data: projects }, { data: enrolments }, { data: approved }] = await Promise.all([
    supabase.from('projects').select('id, title_ar').eq('owner_id', user.id).limit(6),
    supabase
      .from('enrollments')
      .select('path_id, learning_paths(title_ar)')
      .eq('profile_id', user.id)
      .not('path_id', 'is', null)
      .limit(6),
    supabase
      .from('submissions')
      .select('id, assignments(title_ar)')
      .eq('profile_id', user.id)
      .eq('status', 'approved')
      .limit(6),
  ]);

  const reviewCandidates = [
    ...(projects ?? []).map((row) => ({ kind: 'project', id: row.id, label: row.title_ar })),
    ...(enrolments ?? []).map((row) => ({
      kind: 'learning_path',
      id: row.path_id,
      label: (row.learning_paths as unknown as { title_ar: string } | null)?.title_ar ?? 'مسار',
    })),
    ...(approved ?? []).map((row) => ({
      kind: 'submission',
      id: row.id,
      label: (row.assignments as unknown as { title_ar: string } | null)?.title_ar ?? 'تسليم',
    })),
  ].filter((item) => Boolean(item.label));

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href={`/mentors/${mentorId}`}>→ رجوع لملف المنتور</Link>

      <section className="section-block" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem' }}>حجز جلسة مع {mentorProfile?.full_name}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          اختر نوع الجلسة والموعد، واكتب ما تحتاجه منها. سنحجز لك الموعد مؤقتاً ريثما تكمل الدفع.
        </p>
      </section>

      <BookingWizard
        mentorId={mentorId}
        mentorName={mentorProfile?.full_name ?? ''}
        mentorLevel={mentor.level}
        price={level?.session_price_usd ?? 0}
        sessionTypes={sessionTypes}
        slots={(slots ?? []) as { slot_start: string; slot_end: string; state: SlotState }[]}
        paymentMethods={(methods ?? []) as PaymentMethod[]}
        student={{
          full_name: student?.full_name ?? '',
          techmood_id: student?.techmood_id ?? '',
          email: user.email ?? '',
          phone: student?.phone ?? null,
        }}
        reviewCandidates={reviewCandidates}
      />
    </>
  );
}
