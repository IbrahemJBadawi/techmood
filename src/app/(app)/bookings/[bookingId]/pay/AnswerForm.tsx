'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { answerPaymentQuestion, type PaymentState } from '../../actions';

/**
 * The admin asked a question instead of rejecting the receipt. The receipt is
 * kept; the payer answers in words, and may add a reference if that was what
 * was missing.
 */
export function AnswerForm({ paymentId, bookingId, question }: {
  paymentId: string;
  bookingId: string;
  question: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(answerPaymentQuestion, undefined as PaymentState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem' }}>{t('سؤال من TechMood عن دفعتك', 'A question from TechMood about your payment')}</h3>
      <p className="notice" style={{ marginTop: 10 }}>{question}</p>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        {t('إيصالك محفوظ، والموعد ما زال محجوزاً لك. أجب هنا وتعود الدفعة للمراجعة.',
           'Your receipt is kept and the slot is still yours. Answer here and the payment goes back for review.')}
      </p>

      <input type="hidden" name="payment_id" value={paymentId} />
      <input type="hidden" name="booking_id" value={bookingId} />

      <div className="field">
        <label htmlFor="note">{t('جوابك', 'Your answer')}</label>
        <textarea id="note" name="note" rows={3} required />
      </div>
      <div className="field">
        <label htmlFor="reference">{t('رقم العملية، إن كان هو المطلوب', 'Transaction reference, if that was what was missing')}</label>
        <input id="reference" name="reference" dir="ltr" />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Sending…') : t('أرسل الجواب', 'Send the answer')}
      </button>
    </form>
  );
}
