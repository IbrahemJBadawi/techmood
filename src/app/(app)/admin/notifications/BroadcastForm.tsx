'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { NOTIFICATION_KIND, NOTIFICATION_ORDER, PRIORITY } from '@/lib/notifications';
import { SELECTABLE_ROLES } from '@/lib/roles';
import type { NotifyPriority } from '@/lib/database.types';

import { draftBroadcast, type BroadcastState } from './actions';

export function BroadcastForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(draftBroadcast, undefined as BroadcastState);

  return (
    <form action={formAction} className="panel section-block">
      <h3 style={{ fontSize: '1rem' }}>{t('إعلان جديد', 'A new announcement')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6, maxWidth: '62ch' }}>
        {t('الإعلان يمرّ بنفس محرّك الإشعارات: يحترم تفضيلات كل شخص، ويصل إلى نفس صندوقه — لا قناة جانبية.',
           'An announcement goes through the same engine as everything else: it respects each person’s choices and lands in the same inbox — not a side channel.')}
      </p>

      <div className="rules-grid" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="kind">{t('النوع', 'Category')}</label>
          <select id="kind" name="kind" defaultValue="system">
            {NOTIFICATION_ORDER.map((kind) => (
              <option key={kind} value={kind}>{t(NOTIFICATION_KIND[kind].label)}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="priority">{t('الأهمية', 'Priority')}</label>
          <select id="priority" name="priority" defaultValue="info">
            {(Object.keys(PRIORITY) as NotifyPriority[]).map((priority) => (
              <option key={priority} value={priority}>{t(PRIORITY[priority].label)}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="audience_role">{t('لمن؟', 'To whom?')}</label>
          <select id="audience_role" name="audience_role" defaultValue="">
            <option value="">{t('كل المستخدمين', 'Everybody')}</option>
            {SELECTABLE_ROLES.map((role) => (
              <option key={role.value} value={role.value}>{t(role.label)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="title">{t('العنوان', 'Title')}</label>
        <input id="title" name="title" required minLength={4} />
      </div>

      <div className="field">
        <label htmlFor="body">{t('النص', 'The message')}</label>
        <textarea id="body" name="body" rows={3} />
      </div>

      <div className="field">
        <label htmlFor="link">{t('يفتح على', 'Opens')}</label>
        <input id="link" name="link" dir="ltr" placeholder="/academy" />
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}

      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t('جارٍ…', 'Saving…') : t('احفظ كمسودّة', 'Save as a draft')}
      </button>
    </form>
  );
}
