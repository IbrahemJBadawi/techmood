'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { CredentialStatus } from '@/lib/database.types';

import { submitCredential, type CredentialState } from './actions';

export type CredentialLesson = {
  provider_name: string;
  credential_name: string | null;
  credential_url: string | null;
  requires_application: boolean;
  applied: boolean;
  submitted: boolean;
  credential_status: CredentialStatus | null;
  review_note: string | null;
  verified: boolean;
  completed: boolean;
};

/**
 * A lesson earned with somebody else's credential.
 *
 * The ladder is read off the records — the approved task, the handed-in link,
 * the reviewer's verdict, the completed lesson — never ticked by hand. And the
 * credential is always labelled as the provider's: TechMood checks it, it does
 * not issue it.
 */
export function CredentialPanel({
  lessonId, state, revalidate,
}: {
  lessonId: string;
  state: CredentialLesson;
  revalidate: string;
}) {
  const t = useT();
  const [result, formAction, pending] = useActionState<CredentialState, FormData>(
    submitCredential, undefined,
  );

  const steps = [
    { done: true, label: t('التعلّم', 'Learn') },
    ...(state.requires_application
      ? [{ done: state.applied, label: t('التطبيق العملي', 'Practical application') }]
      : []),
    { done: state.submitted, label: t('تسليم الشهادة', 'Credential submitted') },
    { done: state.verified, label: t('التوثيق', 'Verified') },
    { done: state.completed, label: t('اكتمل الدرس', 'Completed') },
  ];

  const canSubmit = Boolean(state.credential_name) && !state.verified;

  return (
    <section className="panel section-block credential-panel">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p className="kicker">{t('شهادة خارجية', 'External credential')}</p>
          <h3 style={{ fontSize: '1rem', marginTop: 4 }}>
            {state.credential_name ?? t('لم تُحدَّد الشهادة بعد', 'Credential not chosen yet')}
          </h3>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
            {t('المُصدِر: ', 'Issued by ')}<strong>{state.provider_name}</strong>
            {t(' — وليست شهادة من TechMood.', ' — not by TechMood.')}
          </p>
        </div>
        {state.credential_url && (
          <a className="btn btn-ghost btn-sm" href={state.credential_url}
             target="_blank" rel="noreferrer noopener">
            {t('احصل عليها من المُصدِر ↗', 'Earn it at the provider ↗')}
          </a>
        )}
      </div>

      <ol className="credential-ladder">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'is-done' : ''}>
            <span aria-hidden>{step.done ? '✓' : '○'}</span> {step.label}
          </li>
        ))}
      </ol>

      <p className="muted" style={{ fontSize: '0.8rem' }}>
        {state.requires_application
          ? t('لا يكتمل الدرس إلا بالتطبيق العملي معتمداً والشهادة موثّقة — جمع الروابط وحده لا يُنهي دورة.',
              'The lesson completes only with the practical task approved and the credential verified — collecting links alone does not finish a course.')
          : t('لا يكتمل الدرس إلا بالشهادة موثّقة.', 'The lesson completes only once the credential is verified.')}
      </p>

      {state.credential_status === 'rejected' && state.review_note && (
        <p className="notice notice-danger">
          {t('لم تُوثَّق: ', 'Not verified: ')}{state.review_note}
        </p>
      )}

      {state.credential_status === 'submitted' && (
        <p className="notice">{t('بانتظار التوثيق.', 'Waiting to be verified.')}</p>
      )}

      {canSubmit && state.credential_status !== 'submitted' && (
        <form action={formAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="revalidate" value={revalidate} />

          <div className="field">
            <label htmlFor="cred-url">{t('رابط الشهادة', 'Credential URL')}</label>
            <input id="cred-url" name="url" type="url" required dir="ltr"
                   placeholder="https://" />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="cred-code">{t('رقم الشهادة إن وُجد', 'Credential ID, if any')}</label>
              <input id="cred-code" name="code" dir="ltr" />
            </div>
            <div className="field">
              <label htmlFor="cred-issued">{t('تاريخ الإصدار', 'Issue date')}</label>
              <input id="cred-issued" name="issued_on" type="date" />
            </div>
          </div>

          {result?.error && <p className="notice notice-danger">{result.error}</p>}
          {result?.ok && <p className="notice notice-ok">{result.ok}</p>}

          <button className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? t('جارٍ…', 'Sending…') : t('سلّم للتوثيق', 'Submit for verification')}
          </button>
        </form>
      )}
    </section>
  );
}
