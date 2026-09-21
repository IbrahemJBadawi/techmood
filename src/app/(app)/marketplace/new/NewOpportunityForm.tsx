'use client';

import { useActionState, useState } from 'react';

import { COMPENSATION_KIND, OPPORTUNITY_KIND } from '@/lib/marketplace';
import type { OpportunityKind } from '@/lib/database.types';

import { postOpportunity, type MarketState } from '../actions';
import { useT } from '@/lib/i18n.client';

export function NewOpportunityForm({
  canPostGeneral,
  teams,
  paths,
}: {
  canPostGeneral: boolean;
  teams: { id: string; title_ar: string }[];
  paths: { id: string; title_ar: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(postOpportunity, undefined as MarketState);
  const [kind, setKind] = useState<OpportunityKind>(canPostGeneral ? 'freelance' : 'team_seat');

  const kinds = (Object.keys(OPPORTUNITY_KIND) as OpportunityKind[]).filter(
    (value) => canPostGeneral || value === 'team_seat',
  );

  return (
    <form action={formAction} className="panel" style={{ maxWidth: 680 }}>
      <div className="field">
        <label htmlFor="kind">{t('نوع الفرصة', 'Kind of opening')}</label>
        <select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as OpportunityKind)}>
          {kinds.map((value) => (
            <option key={value} value={value}>{t(OPPORTUNITY_KIND[value].label)}</option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: '0.78rem' }}>{t(OPPORTUNITY_KIND[kind].hint)}</span>
      </div>

      {kind === 'team_seat' && (
        <div className="field">
          <label htmlFor="team_id">{t('الفريق', 'Team')}</label>
          <select id="team_id" name="team_id" required defaultValue={teams[0]?.id}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.title_ar}</option>)}
          </select>
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            {t('طلبات هذا المقعد تصل إلى قائمة طلبات الفريق، وتُقرَّر هناك.', 'Applications for this seat land in the team’s list and are decided there.')}
          </span>
        </div>
      )}

      <div className="field">
        <label htmlFor="title">{t('العنوان', 'Title')}</label>
        <input id="title" name="title" required minLength={4} />
      </div>

      <div className="field">
        <label htmlFor="organization">{t('الجهة', 'Organisation')}</label>
        <input id="organization" name="organization" placeholder={t('اسم الشركة أو المشروع', 'Company or project name')} />
      </div>

      <div className="field">
        <label htmlFor="description">{t('الوصف والمطلوب', 'Description and what is needed')}</label>
        <textarea id="description" name="description" rows={5} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="compensation_kind">{t('شكل الأجر', 'Pay type')}</label>
          <select id="compensation_kind" name="compensation_kind" defaultValue="">
            <option value="">{t('غير محدد', 'Not specified')}</option>
            {Object.entries(COMPENSATION_KIND).map(([value, label]) => (
              <option key={value} value={value}>{t(label)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="currency">{t('العملة', 'Currency')}</label>
          <input id="currency" name="currency" defaultValue="USD" dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="amount_min">{t('من', 'From')}</label>
          <input id="amount_min" name="amount_min" type="number" step="0.01" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="amount_max">{t('إلى', 'To')}</label>
          <input id="amount_max" name="amount_max" type="number" step="0.01" dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="location">{t('المكان', 'Location')}</label>
          <input id="location" name="location" placeholder={t('غزة، رام الله…', 'Gaza, Ramallah…')} />
        </div>
        <div className="field">
          <label htmlFor="seats">{t('عدد المقاعد', 'Seats')}</label>
          <input id="seats" name="seats" type="number" min={1} max={50} defaultValue={1} dir="ltr" />
        </div>
      </div>

      <label className="badge-pill" style={{ cursor: 'pointer', gap: 8, marginBottom: 14 }}>
        <input type="checkbox" name="is_remote" />
        {t('عن بُعد', 'Remote')}
      </label>

      <div className="field">
        <label htmlFor="closes_on">{t('آخر موعد للتقديم', 'Application deadline')}</label>
        <input id="closes_on" name="closes_on" type="date" />
      </div>

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          {t('المتطلبات — إرشادية، تُعرض للمتقدّم ولا تمنعه.', 'Requirements — advisory. An applicant sees them; they never block anyone.')}
        </p>

        <div className="field">
          <label htmlFor="required_skills">{t('المهارات المطلوبة (مفصولة بفاصلة)', 'Skills required (comma separated)')}</label>
          <input id="required_skills" name="required_skills" dir="ltr" placeholder="React, Node.js" />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="min_stars">{t('أقل تقييم بالنجوم', 'Minimum star rating')}</label>
            <input id="min_stars" name="min_stars" type="number" min={0} max={5} step="0.5" dir="ltr" />
          </div>
          <div className="field">
            <label htmlFor="required_path_id">{t('شهادة مسار مطلوبة', 'Path certificate required')}</label>
            <select id="required_path_id" name="required_path_id" defaultValue="">
              <option value="">{t('بلا اشتراط', 'No requirement')}</option>
              {paths.map((path) => <option key={path.id} value={path.id}>{path.title_ar}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="tags">{t('وسوم', 'Tags')}</label>
          <input id="tags" name="tags" placeholder="Frontend, Design" />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? t('جارٍ النشر…', 'Publishing…') : t('انشر الفرصة', 'Publish the opening')}
      </button>
    </form>
  );
}
