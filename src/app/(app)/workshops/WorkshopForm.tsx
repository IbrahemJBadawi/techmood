'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { DateField } from '@/components/DateField';
import { NumberStepper } from '@/components/NumberStepper';
import { TimeField } from '@/components/TimeField';

import { saveWorkshop, type WorkshopState } from './actions';

export type EditableWorkshop = {
  id: string; title: string; description: string; date: string; time: string; duration_minutes: number;
  capacity: number | null; live_url: string | null; recording_url: string | null;
} | null;

/** Announcing a workshop: what, when, how long, how many seats, and where it streams. */
export function WorkshopForm({ workshop }: { workshop: EditableWorkshop }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveWorkshop, undefined as WorkshopState);

  return (
    <form action={action} className="panel section-block ws-form">
      {workshop && <input type="hidden" name="id" value={workshop.id} />}
      <div className="field">
        <label htmlFor="ws-title">{t('عنوان الورشة', 'Title')}</label>
        <input id="ws-title" name="title" required minLength={3} maxLength={140} defaultValue={workshop?.title ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="ws-description">{t('ماذا سيتعلم الحضور؟', 'What will people learn?')}</label>
        <textarea id="ws-description" name="description" rows={5} required minLength={10} maxLength={4000} defaultValue={workshop?.description ?? ''} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ws-date">{t('اليوم', 'Day')}</label>
          <DateField id="ws-date" name="date" required defaultValue={workshop?.date ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="ws-time">{t('الساعة (بتوقيت فلسطين)', 'Time (Palestine)')}</label>
          <TimeField id="ws-time" name="time" required defaultValue={workshop?.time ?? ''} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ws-duration">{t('المدة بالدقائق', 'Length in minutes')}</label>
          <NumberStepper id="ws-duration" name="duration" min={15} max={480} step={15} defaultValue={workshop?.duration_minutes ?? 60} />
        </div>
        <div className="field">
          <label htmlFor="ws-capacity">{t('عدد المقاعد (0 = بلا حد)', 'Seats (0 = no limit)')}</label>
          <NumberStepper id="ws-capacity" name="capacity" min={0} max={5000} step={5} defaultValue={workshop?.capacity ?? 0} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ws-live">{t('رابط البث المباشر (YouTube Live أو Zoom أو Meet)', 'Live stream link (YouTube Live, Zoom or Meet)')}</label>
        <input id="ws-live" name="live_url" type="url" dir="ltr" placeholder="https://" defaultValue={workshop?.live_url ?? ''} />
        <small className="muted">{t('يظهر للمسجّلين فقط. رابط YouTube يُعرض داخل الصفحة.', 'Shown to registered people only. A YouTube link plays inside the page.')}</small>
      </div>
      {workshop && (
        <div className="field">
          <label htmlFor="ws-recording">{t('رابط التسجيل بعد الورشة (اختياري)', 'Recording link after it (optional)')}</label>
          <input id="ws-recording" name="recording_url" type="url" dir="ltr" placeholder="https://" defaultValue={workshop.recording_url ?? ''} />
        </div>
      )}
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      <div className="row-actions">
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? t('جارٍ الحفظ…', 'Saving…') : workshop ? t('احفظ', 'Save') : t('أعلن الورشة', 'Announce the workshop')}
        </button>
      </div>
    </form>
  );
}
