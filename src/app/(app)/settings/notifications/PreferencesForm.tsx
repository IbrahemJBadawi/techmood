'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { NOTIFICATION_KIND } from '@/lib/notifications';
import type { NotificationKind } from '@/lib/database.types';

import { saveNotificationPreferences, type PreferenceState } from './actions';

export type Category = {
  kind: NotificationKind;
  title_ar: string;
  detail_ar: string | null;
  is_mandatory: boolean;
  in_app: boolean;
  email: boolean;
};

/**
 * Two switches per category, and none at all for the three nobody may silence.
 *
 * A switch that pretends to turn off "your withdrawal was rejected" would be a
 * lie told in an interface, so those rows say plainly that they always arrive.
 */
export function PreferencesForm({ categories }: { categories: Category[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveNotificationPreferences, undefined as PreferenceState);

  const editable = categories.filter((row) => !row.is_mandatory);
  const mandatory = categories.filter((row) => row.is_mandatory);

  return (
    <form action={formAction}>
      <input type="hidden" name="kinds" value={editable.map((row) => row.kind).join(',')} />

      <table className="data booking-table">
        <thead>
          <tr>
            <th>{t('النوع', 'Category')}</th>
            <th>{t('داخل TechMood', 'In TechMood')}</th>
            <th>{t('البريد', 'Email')}</th>
          </tr>
        </thead>
        <tbody>
          {editable.map((row) => (
            <tr key={row.kind}>
              <td data-label={t('النوع', 'Category')}>
                <strong>{NOTIFICATION_KIND[row.kind].icon} {row.title_ar}</strong>
                {row.detail_ar && (
                  <p className="muted" style={{ fontSize: '0.78rem' }}>{row.detail_ar}</p>
                )}
              </td>
              <td data-label={t('داخل TechMood', 'In TechMood')}>
                <label className="switch-row">
                  <input type="checkbox" name={`in_app-${row.kind}`} defaultChecked={row.in_app} />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>{t('يظهر', 'Shown')}</span>
                </label>
              </td>
              <td data-label={t('البريد', 'Email')}>
                <label className="switch-row">
                  <input type="checkbox" name={`email-${row.kind}`} defaultChecked={row.email} />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>{t('يُرسل', 'Sent')}</span>
                </label>
              </td>
            </tr>
          ))}

          {mandatory.map((row) => (
            <tr key={row.kind}>
              <td data-label={t('النوع', 'Category')}>
                <strong>{NOTIFICATION_KIND[row.kind].icon} {row.title_ar}</strong>
                {row.detail_ar && (
                  <p className="muted" style={{ fontSize: '0.78rem' }}>{row.detail_ar}</p>
                )}
              </td>
              <td colSpan={2} className="muted" data-label={t('دائماً', 'Always')}>
                {t('يصلك دائماً، في المنصة وبالبريد — قرارات المال والأمان والحساب لا تُكتم.',
                   'Always reaches you, in the platform and by email — money, security and account decisions are not silenced.')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} disabled={pending}>
        {pending ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ', 'Save')}
      </button>
    </form>
  );
}
