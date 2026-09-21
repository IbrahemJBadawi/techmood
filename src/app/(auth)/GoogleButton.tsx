'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';

import { signInWithGoogle, type AuthState } from './actions';

/**
 * Continue with Google.
 *
 * Google is asked for one thing only — that this is the same person each time.
 * The professional identity, the TechMood ID and everything hanging off it are
 * TechMood's own, and nothing is read from or written to a Google account.
 */
export function GoogleButton({ next, label }: { next?: string; label: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(signInWithGoogle, undefined as AuthState);

  return (
    <>
      <form action={formAction}>
        {next && <input type="hidden" name="next" value={next} />}
        <button className="btn btn-google" disabled={pending} type="submit">
          <GoogleMark />
          {pending ? t('جارٍ التحويل…', 'Redirecting…') : label}
        </button>
      </form>
      {state?.error && <p className="notice notice-danger" style={{ marginTop: 10 }}>{state.error}</p>}
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.7 7l7.6 5.9c4.4-4.1 6.8-10.2 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
