'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';

import type { OpeningDraft } from '@/lib/team-openings';

/**
 * «الأعضاء المطلوبون» — the seats a team still needs (0170): a role, how many
 * and the skills that fit. They travel with the form as one JSON field; the
 * server action writes them after the team exists.
 */
export function OpeningsEditor({ name = 'openings' }: { name?: string }) {
  const t = useT();
  const [rows, setRows] = useState<OpeningDraft[]>([]);

  const update = (index: number, patch: Partial<OpeningDraft>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const ready = rows.filter((row) => row.role.trim().length >= 2);

  return (
    <fieldset className="openings-editor">
      <legend>{t('الأعضاء المطلوبون (اختياري)', 'Members you are looking for (optional)')}</legend>
      <p className="muted openings-hint">
        {t('حدّد الأدوار التي ينقص فريقك، فيظهر في «فرق تطلب أعضاء» ويستقبل طلبات الانضمام لكل دور.',
           'Name the roles your team still needs: it then appears under «teams looking for members» and takes requests for each role.')}
      </p>

      {rows.map((row, index) => (
        <div className="opening-row" key={index}>
          <div className="field">
            <label htmlFor={`op-role-${index}`}>{t('الدور', 'Role')}</label>
            <input id={`op-role-${index}`} value={row.role} maxLength={60} required
                   placeholder={t('مثال: مطوّر واجهات', 'e.g. Front-end developer')}
                   onChange={(event) => update(index, { role: event.target.value })} />
          </div>
          <div className="field opening-seats">
            <label htmlFor={`op-seats-${index}`}>{t('العدد', 'How many')}</label>
            <select id={`op-seats-${index}`} value={row.seats} onChange={(event) => update(index, { seats: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field opening-skills">
            <label htmlFor={`op-skills-${index}`}>{t('مهارات مناسبة', 'Skills that fit')}</label>
            <input id={`op-skills-${index}`} value={row.skills} dir="auto"
                   placeholder={t('React، Figma', 'React, Figma')}
                   onChange={(event) => update(index, { skills: event.target.value })} />
          </div>
          <button type="button" className="opening-remove" aria-label={t('احذف هذا الدور', 'Remove this role')}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>×</button>
        </div>
      ))}

      {rows.length < 6 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((current) => [...current, { role: '', seats: 1, skills: '' }])}>
          {t('+ أضف دوراً مطلوباً', '+ Add a role you need')}
        </button>
      )}

      <input type="hidden" name={name} value={JSON.stringify(ready)} />
    </fieldset>
  );
}
