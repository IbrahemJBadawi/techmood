'use client';

import { useActionState, useMemo, useState } from 'react';

import { formatSlot, money, SLOT_STATE } from '@/lib/booking';
import type { PaymentMethod, SessionType, SlotState } from '@/lib/database.types';

import { createBooking, type BookingState } from '../../actions';

type Slot = { slot_start: string; slot_end: string; state: SlotState };
type ReviewCandidate = { kind: string; id: string | null; label: string };

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
}: {
  mentorId: string;
  mentorName: string;
  mentorLevel: string;
  price: number;
  sessionTypes: SessionType[];
  slots: Slot[];
  paymentMethods: PaymentMethod[];
  student: { full_name: string; techmood_id: string; email: string; phone: string | null };
  reviewCandidates: ReviewCandidate[];
}) {
  const [state, formAction, pending] = useActionState(createBooking, undefined as BookingState);

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

  const selectedType = sessionTypes.find((type) => type.id === sessionTypeId);
  const selectedMethod = paymentMethods.find((method) => method.key === methodKey);
  const selected = slotStart ? formatSlot(slotStart) : null;

  const local = paymentMethods.filter((method) => method.category === 'local');
  const international = paymentMethods.filter((method) => method.category === 'international');

  if (byDay.length === 0) {
    return (
      <p className="notice">
        لا توجد مواعيد متاحة لدى هذا المنتور خلال الفترة القادمة. تذكّر أن الحجز يحتاج 72 ساعة
        مسبقاً على الأقل.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="mentor_id" value={mentorId} />
      <input type="hidden" name="session_type_id" value={sessionTypeId} />
      <input type="hidden" name="starts_at" value={slotStart} />
      <input type="hidden" name="method_key" value={methodKey} />

      <div className="detail-grid">
        <div>
          {/* 1 — session type */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <h3>نوع الجلسة</h3>
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
                    {type.description_ar} · {type.duration_minutes} دقيقة
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* 2 — slot */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">2</span>
              <h3>الموعد</h3>
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
                    <span className="dt-count">{free} متاح</span>
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
                    title={info.label}
                    onClick={() => setSlotStart(slot.slot_start)}
                  >
                    {formatSlot(slot.slot_start).time}
                  </button>
                );
              })}
            </div>

            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
              المواعيد المشطوبة محجوزة أو خارج مهلة الـ72 ساعة.
            </p>
          </section>

          {/* 3 — goal */}
          <section className="step">
            <div className="step-head">
              <span className="step-num">3</span>
              <h3>هدف الجلسة</h3>
            </div>
            <div className="field">
              <label htmlFor="goal">ما الذي تحتاج المساعدة فيه؟</label>
              <textarea
                id="goal"
                name="goal"
                rows={4}
                required
                placeholder="مثال: أريد مراجعة مشروعي وتحديد الخطوات التالية لبناء الـBackend."
              />
            </div>

            {reviewCandidates.length > 0 && (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="muted" style={{ fontSize: '0.84rem', marginBottom: 8 }}>
                  ما الذي تريد من المنتور مراجعته؟ (من أعمالك على المنصة)
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
              <h3>طريقة الدفع</h3>
            </div>

            {[
              { title: 'محلي', methods: local },
              { title: 'دولي', methods: international },
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
                          {method.supports_automatic_payment ? 'دفع مباشر' : 'تحويل يدوي مع إثبات'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ),
            )}

            <p className="muted" style={{ fontSize: '0.78rem' }}>
              تُنشئ هذه الخطوة طلب الحجز وتحجز لك الموعد مؤقتاً. تعليمات الدفع ورفع الإيصال
              تأتي في الخطوة التالية.
            </p>
          </section>
        </div>

        {/* summary */}
        <aside>
          <div className="panel" style={{ position: 'sticky', top: 90 }}>
            <h3 style={{ fontSize: '0.98rem', marginBottom: 14 }}>ملخص الحجز</h3>

            <div className="summary-rows">
              <div className="summary-row"><span className="muted">المنتور</span><span>{mentorName}</span></div>
              <div className="summary-row"><span className="muted">المستوى</span><span className="eng">{mentorLevel}</span></div>
              <div className="summary-row">
                <span className="muted">الجلسة</span>
                <span>{selectedType?.name_ar ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">المدة</span>
                <span className="eng">{selectedType ? `${selectedType.duration_minutes} min` : '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">التاريخ</span>
                <span>{selected?.date ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">الوقت</span>
                <span className="eng">{selected?.time ?? '—'}</span>
              </div>
              <div className="summary-row">
                <span className="muted">طريقة الدفع</span>
                <span>{selectedMethod?.name_ar ?? '—'}</span>
              </div>
              <div className="summary-row"><span className="muted">سعر الجلسة</span><span className="eng">{money(price)}</span></div>
              <div className="summary-row"><span className="muted">الخصم</span><span className="eng">{money(0)}</span></div>
              <div className="summary-row total"><span>الإجمالي</span><span className="eng">{money(price)}</span></div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>بياناتك</p>
              <div className="summary-rows">
                <div className="summary-row"><span className="muted">الاسم</span><span>{student.full_name}</span></div>
                <div className="summary-row"><span className="muted">TechMood ID</span><span className="eng">{student.techmood_id}</span></div>
                <div className="summary-row"><span className="muted">البريد</span><span className="eng">{student.email}</span></div>
                <div className="summary-row">
                  <span className="muted">الهاتف</span>
                  <span className="eng">{student.phone ?? '—'}</span>
                </div>
              </div>
            </div>

            {state?.error && <p className="notice notice-danger" style={{ marginTop: 14 }}>{state.error}</p>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              disabled={pending || !slotStart || !methodKey || !sessionTypeId}
            >
              {pending ? 'جارٍ الإرسال…' : 'إرسال طلب الحجز'}
            </button>

            <p className="muted" style={{ fontSize: '0.74rem', marginTop: 10 }}>
              لا يصبح الحجز مؤكداً إلا بعد التحقق من الدفع وموافقة المنتور.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
