'use client';

import { useActionState, useMemo, useState } from 'react';

import { formatSlot, money, SLOT_STATE } from '@/lib/booking';
import type { PaymentMethodPublic, SessionType, SlotState } from '@/lib/database.types';

import { useT } from '@/lib/i18n.client';

import { createBooking, type BookingState } from '../../actions';

type Slot = { slot_start: string; slot_end: string; state: SlotState };
type ReviewCandidate = { kind: string; id: string | null; label: string };
export type LedTeam = { id: string; title_ar: string; members: { id: string; name: string }[] };
export type LedCompany = { id: string; name_ar: string; members: { id: string; name: string }[] };

export function BookingWizard({
  mentorId,
  mentorName,
  mentorLevel,
  price,
  sessionTypes,
  slots,
  paymentMethods,
  student,
  reviewCandidates,
  teams,
  companies,
}: {
  mentorId: string;
  mentorName: string;
  mentorLevel: string;
  price: number;
  sessionTypes: SessionType[];
  slots: Slot[];
  paymentMethods: PaymentMethodPublic[];
  student: { full_name: string; techmood_id: string; email: string; phone: string | null };
  reviewCandidates: ReviewCandidate[];
  /** The teams this person leads. A team session is the leader's to book. */
  teams: LedTeam[];
  /** The companies they run. A company session is priced per seat too. */
  companies: LedCompany[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createBooking, undefined as BookingState);

  const [teamId, setTeamId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [seats, setSeats] = useState<string[]>([]);
  const [sessionTypeId, setSessionTypeId] = useState(sessionTypes[0]?.id ?? '');
  const [slotStart, setSlotStart] = useState('');
  const [methodKey, setMethodKey] = useState('');

  // Slots arrive flat; the picker is a day at a time.
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = slot.slot_start.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), slot]);
    }
    return [...map.entries()].filter(([, daySlots]) =>
      daySlots.some((slot) => slot.state === 'available'),
    );
  }, [slots]);

  const [activeDay, setActiveDay] = useState(byDay[0]?.[0] ?? '');
  const daySlots = byDay.find(([day]) => day === activeDay)?.[1] ?? [];

  const activeTeam = teams.find((team) => team.id === teamId);
  const activeCompany = companies.find((company) => company.id === companyId);
  const activeGroup = activeTeam
    ? { members: activeTeam.members }
    : activeCompany
      ? { members: activeCompany.members }
      : null;
  const seatCount = activeGroup ? seats.length : 1;
  const total = price * Math.max(seatCount, activeGroup ? 0 : 1);
  const selectedType = sessionTypes.find((type) => type.id === sessionTypeId);
  const selectedMethod = paymentMethods.find((method) => method.key === methodKey);
  const selected = slotStart ? formatSlot(slotStart) : null;

  const local = paymentMethods.filter((method) => method.category === 'local');
  const international = paymentMethods.filter((method) => method.category === 'international');

  if (byDay.length === 0) {
    return (
      <p className="notice">
        {t('لا توجد مواعيد متاحة لدى هذا المنتور خلال الفترة القادمة. تذكّر أن الحجز يحتاج 72 ساعة مسبقاً على الأقل.',
           'This mentor has no free slots in the coming weeks. Remember a booking needs at least 72 hours\u2019 notice.')}
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="mentor_id" value={mentorId} />
      <input type="hidden" name="session_type_id" value={sessionTypeId} />
      <input type="hidden" name="starts_at" value={slotStart} />
      <input type="hidden" name="method_key" value={methodKey} />
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="startup_id" value={companyId} />
      {seats.map((seat) => <input type="hidden" name="seat" value={seat} key={seat} />)}

      <div className="detail-grid">
        <div>
          {(teams.length > 0 || companies.length > 0) && (
            <section className="step">
              <div className="step-head">
                <span className="step-num">0</span>
                <h3>{t('لمن هذه الجلسة؟', 'Who is this session for?')}</h3>
              </div>

              <div className="choice-grid">
                <label className={`choice${teamId === '' && companyId === '' ? ' selected' : ''}`}>
                  <input type="radio" name="for_pick" value="" checked={teamId === '' && companyId === ''}
                         onChange={() => { setTeamId(''); setCompanyId(''); setSeats([]); }} />
                  <span className="choice-title">{t('لي', 'For me')}</span>
                  <span className="choice-sub">{t('جلسة فردية بسعر الجلسة الواحدة.', 'A one-to-one session, at the single-session price.')}</span>
                </label>

                {teams.map((team) => (
                  <label className={`choice${teamId === team.id ? ' selected' : ''}`} key={team.id}>
                    <input type="radio" name="for_pick" value={team.id} checked={teamId === team.id}
                           onChange={() => {
                             setTeamId(team.id); setCompanyId('');
                             setSeats(team.members.map((member) => member.id));
                           }} />
                    <span className="choice-title">{team.title_ar}</span>
                    <span className="choice-sub">
                      {t('جلسة فريق — السعر لكل عضو حاضر.', 'A team session — priced per attending member.')}
                    </span>
                  </label>
                ))}

                {companies.map((company) => (
                  <label className={`choice${companyId === company.id ? ' selected' : ''}`} key={company.id}>
                    <input type="radio" name="for_pick" value={company.id} checked={companyId === company.id}
                           onChange={() => {
                             setCompanyId(company.id); setTeamId('');
                             setSeats(company.members.map((member) => member.id).slice(0, 1));
                           }} />
                    <span className="choice-title">{company.name_ar}</span>
                    <span className="choice-sub">
                      {t('جلسة شركة — السعر لكل حاضر، ويُفتح للمنتور ما فتحتموه له.',
                         'A company session — priced per attendee, and the mentor sees what you opened to mentors.')}
                    </span>
                  </label>
                ))}
              </div>

              {activeGroup && (
                <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
                  <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>
                    {t('من سيحضر؟ المقاعد المدفوعة هي من يدخل الغرفة.',
                       'Who is coming? The seats that are paid for are who enters the room.')}
                  </legend>
                  <div className="tags-row">
                    {activeGroup.members.map((member) => (
                      <label className="badge-pill" key={member.id} style={{ cursor: 'pointer', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={seats.includes(member.id)}
                          onChange={(event) => setSeats((current) =>
                            event.target.checked
                              ? [...current, member.id]
                              : current.filter((id) => id !== member.id))}
                        />
                        {member.name}
                      </label>
                    ))}
                  </div>

                  {activeCompany && (
                    <label className="switch-row" style={{ marginTop: 12 }}>
                      <input type="checkbox" name="grant_mentor" defaultChecked />
                      <span>
                        {t('افتح للمنتور اللوحات المخصصة للمنتورين',
                           'Let this mentor see the canvases opened to mentors')}
                      </span>
                    </label>
                  )}
                </fieldset>
              )}
            </section>
          )}

          {/* 1 — session type */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <h3>{t('نوع الجلسة', 'Session type')}</h3>
            </div>
            <div className="choice-grid">
              {sessionTypes.map((type) => (
                <label
                  key={type.id}
                  className={`choice${type.id === sessionTypeId ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="session_type_pick"
                    value={type.id}
                    checked={type.id === sessionTypeId}
                    onChange={() => setSessionTypeId(type.id)}
                  />
                  <span className="choice-title">{type.name_ar}</span>
                  <span className="choice-sub">
                    {type.description_ar} · {t(`${type.duration_minutes} دقيقة`, `${type.duration_minutes} min`)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* 2 — slot */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">2</span>
              <h3>{t('الموعد', 'Time')}</h3>
            </div>

            <div className="date-tabs">
              {byDay.map(([day, items]) => {
                const label = new Date(`${day}T12:00:00`).toLocaleDateString('ar-EG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });
                const free = items.filter((slot) => slot.state === 'available').length;
                return (
                  <button
                    type="button"
                    key={day}
                    className={`date-tab${day === activeDay ? ' selected' : ''}`}
                    onClick={() => setActiveDay(day)}
                  >
                    <span className="dt-day">{label}</span>
                    <span className="dt-count">{t(`${free} متاح`, `${free} free`)}</span>
                  </button>
                );
              })}
            </div>

            <div className="slot-grid">
              {daySlots.map((slot) => {
                const info = SLOT_STATE[slot.state];
                return (
                  <button
                    type="button"
                    key={slot.slot_start}
                    className={`slot${slot.slot_start === slotStart ? ' selected' : ''}`}
                    disabled={!info.selectable}
                    title={t(info.label)}
                    onClick={() => setSlotStart(slot.slot_start)}
                  >
                    {formatSlot(slot.slot_start).time}
                  </button>
                );
              })}
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              {t('المواعيد المشطوبة محجوزة أو خارج مهلة الـ72 ساعة.', 'Struck-through slots are taken, or inside the 72-hour window.')}
            </p>
          </section>

          {/* 3 — goal */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">3</span>
              <h3>{t('هدف الجلسة', 'Session goal')}</h3>
            </div>
            <div className="field">
              <label htmlFor="goal">{t('ما الذي تحتاج المساعدة فيه؟', 'What do you need help with?')}</label>
              <textarea
                id="goal"
                name="goal"
                rows={4}
                required
                placeholder={t('مثال: أريد مراجعة مشروعي وتحديد الخطوات التالية لبناء الـBackend.', 'For example: I want my project reviewed and the next steps for building the backend.')}
              />
            </div>

            {reviewCandidates.length > 0 && (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>
                  {t('ما الذي تريد من المنتور مراجعته؟ (من أعمالك على المنصة)', 'What would you like the mentor to review? (from your work on the platform)')}
                </legend>
                <div className="tags-row">
                  {reviewCandidates.map((item) => (
                    <label key={`${item.kind}-${item.id}-${item.label}`} className="badge-pill" style={{ cursor: 'pointer', gap: 6 }}>
                      <input
                        type="checkbox"
                        name="review_items"
                        value={`${item.kind}|${item.id ?? ''}|${item.label}`}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </section>

          {/* 4 — payment method */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">4</span>
              <h3>{t('طريقة الدفع', 'Payment method')}</h3>
            </div>

            {[
              { title: t('محلي', 'Local'), methods: local },
              { title: t('دولي', 'International'), methods: international },
            ].map((group) =>
              group.methods.length === 0 ? null : (
                <div key={group.title} style={{ marginBottom: 14 }}>
                  <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>{group.title}</p>
                  <div className="choice-grid">
                    {group.methods.map((method) => (
                      <label
                        key={method.key}
                        className={`choice${method.key === methodKey ? ' selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="method_pick"
                          value={method.key}
                          checked={method.key === methodKey}
                          onChange={() => setMethodKey(method.key)}
                        />
                        <span className="choice-title">{method.icon} {method.name_ar}</span>
                        <span className="choice-sub">
                          {method.supports_automatic_payment
                            ? t('دفع مباشر', 'Direct payment')
                            : t('تحويل يدوي مع إثبات', 'Manual transfer with proof')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ),
            )}

            <p className="muted" style={{ fontSize: '0.78rem' }}>
              {t('تُنشئ هذه الخطوة طلب الحجز وتحجز لك الموعد مؤقتاً. تعليمات الدفع ورفع الإيصال تأتي في الخطوة التالية.',
                 'This step creates the request and holds the slot for you. Payment instructions and the receipt upload come next.')}
            </p>
          </section>
        </div>

        {/* summary */}
        <aside>
          <div className="panel" style={{ position: 'sticky', top: 90 }}>
            <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>{t('ملخص الحجز', 'Booking summary')}</h3>

            <div className="summary-rows">
              <div className="summary-row"><span className="muted">{t('المنتور', 'Mentor')}</span><span>{mentorName}</span></div>
              <div className="summary-row"><span className="muted">{t('المستوى', 'Level')}</span><span className="eng">{mentorLevel}</span></div>
              <div className="summary-row">
                <span className="muted">{t('الجلسة', 'Session')}</span>
                <span>{selectedType?.name_ar ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">{t('المدة', 'Duration')}</span>
                <span className="eng">{selectedType ? `${selectedType.duration_minutes} min` : '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">{t('التاريخ', 'Date')}</span>
                <span>{selected?.date ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">{t('الوقت', 'Time')}</span>
                <span className="eng">{selected?.time ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">{t('طريقة الدفع', 'Payment method')}</span>
                <span>{selectedMethod?.name_ar ?? '—'}</span>
              </div>
              <div className="summary-row"><span className="muted">{t('سعر الجلسة', 'Session price')}</span><span className="eng">{money(price)}</span></div>
              {activeGroup && (
                <div className="summary-row">
                  <span className="muted">{t('المقاعد', 'Seats')}</span>
                  <span className="eng">{seatCount} × {money(price)}</span>
                </div>
              )}
              <div className="summary-row"><span className="muted">{t('الخصم', 'Discount')}</span><span className="eng">{money(0)}</span></div>
              <div className="summary-row total"><span>{t('الإجمالي', 'Total')}</span><span className="eng">{money(total)}</span></div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>{t('بياناتك', 'Your details')}</p>
              <div className="summary-rows">
                <div className="summary-row"><span className="muted">{t('الاسم', 'Name')}</span><span>{student.full_name}</span></div>
                <div className="summary-row"><span className="muted">TechMood ID</span><span className="eng">{student.techmood_id}</span></div>
                <div className="summary-row"><span className="muted">{t('البريد', 'Email')}</span><span className="eng">{student.email}</span></div>
                <div className="summary-row">
                  <span className="muted">{t('الهاتف', 'Phone')}</span>
                  <span className="eng">{student.phone ?? '—'}</span>
                </div>
              </div>
            </div>

            {state?.error && <p className="notice notice-danger" style={{ marginTop: 14 }}>{state.error}</p>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              disabled={pending || !slotStart || !methodKey || !sessionTypeId || (Boolean(activeGroup) && seats.length === 0)}
            >
              {pending ? t('جارٍ الإرسال…', 'Sending…') : t('إرسال طلب الحجز', 'Send the booking request')}
            </button>

            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              {t('لا يصبح الحجز مؤكداً إلا بعد التحقق من الدفع وموافقة المنتور.', 'A booking is only confirmed once the payment is verified and the mentor has accepted.')}
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
