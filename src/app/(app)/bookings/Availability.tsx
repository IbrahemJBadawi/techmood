'use client';

import { useActionState } from 'react';

import { useT } from '@/lib/i18n.client';
import { WEEKDAYS } from '@/lib/calendar';
import type { Text } from '@/lib/i18n';

import { saveAvailability, saveSchedulingRules, type HubState } from './actions';

export type Window = { day_of_week: number; start_time: string; end_time: string };

/** postgres counts days from Sunday; the week here is read from Saturday. */
const ORDER = [6, 0, 1, 2, 3, 4, 5];

const HINT: Text = {
  ar: 'خمس ساعات في اليوم كحد أقصى — قاعدة المنصة، وقاعدة البيانات هي من يطبّقها.',
  en: 'Five hours a day at most — the platform’s rule, and the database is what enforces it.',
};

/**
 * The mentor's own week: when they work, how many sessions a day they will
 * hold, and how much room they keep between two of them. None of it is a
 * preference the interface remembers — each one is a rule the booking has to
 * pass before it exists.
 */
export function Availability({
  windows,
  dailyLimit,
  bufferMinutes,
}: {
  windows: Window[];
  dailyLimit: number;
  bufferMinutes: number;
}) {
  const t = useT();
  const [hours, saveHours, savingHours] = useActionState(saveAvailability, undefined as HubState);
  const [rules, saveRules, savingRules] = useActionState(saveSchedulingRules, undefined as HubState);

  const byDay = new Map(windows.map((row) => [row.day_of_week, row]));

  return (
    <>
      <form action={saveHours} className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('أوقات العمل الأسبوعية', 'Weekly working hours')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>{t(HINT)}</p>

        <div className="availability-grid">
          {ORDER.map((day) => {
            const window = byDay.get(day);
            return (
              <div className="availability-row" key={day}>
                <span className="availability-day">{t(WEEKDAYS[(day + 1) % 7])}</span>
                <input type="time" name={`from-${day}`} defaultValue={window?.start_time.slice(0, 5) ?? ''}
                       aria-label={t('من', 'From')} />
                <span className="muted">—</span>
                <input type="time" name={`to-${day}`} defaultValue={window?.end_time.slice(0, 5) ?? ''}
                       aria-label={t('إلى', 'To')} />
              </div>
            );
          })}
        </div>

        {hours?.error && <p className="notice notice-danger">{hours.error}</p>}
        {hours?.ok && <p className="notice notice-ok">{hours.ok}</p>}

        <button className="btn btn-primary btn-sm" disabled={savingHours}>
          {savingHours ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ أوقاتي', 'Save my hours')}
        </button>
        <p className="muted" style={{ fontSize: '0.76rem', marginTop: 10 }}>
          {t('يوم بلا ساعات هو يوم مغلق. الساعات المحجوزة فعلاً لا تتأثر بما تكتبه هنا.',
             'A day with no hours is a closed day. Hours already booked are not touched by what you write here.')}
        </p>
      </form>

      <form action={saveRules} className="panel section-block">
        <h3 style={{ fontSize: '1rem' }}>{t('قواعد يومك', 'How your day runs')}</h3>

        <div className="rules-grid">
          <div className="field">
            <label htmlFor="limit">{t('أقصى عدد جلسات في اليوم', 'Sessions a day, at most')}</label>
            <select id="limit" name="limit" defaultValue={String(dailyLimit)}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="buffer">{t('فاصل بين الجلسات', 'Gap between sessions')}</label>
            <select id="buffer" name="buffer" defaultValue={String(bufferMinutes)}>
              {[0, 10, 15, 30, 45, 60].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? t('بلا فاصل', 'None') : `${value} ${t('دقيقة', 'min')}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rules?.error && <p className="notice notice-danger">{rules.error}</p>}
        {rules?.ok && <p className="notice notice-ok">{rules.ok}</p>}

        <button className="btn btn-primary btn-sm" disabled={savingRules}>
          {savingRules ? t('جارٍ الحفظ…', 'Saving…') : t('احفظ القواعد', 'Save the rules')}
        </button>
      </form>
    </>
  );
}
