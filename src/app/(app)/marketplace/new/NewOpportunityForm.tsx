'use client';

import { useActionState, useState } from 'react';

import { COMPENSATION_KIND, OPPORTUNITY_KIND } from '@/lib/marketplace';
import type { OpportunityKind } from '@/lib/database.types';

import { postOpportunity, type MarketState } from '../actions';

export function NewOpportunityForm({
  canPostGeneral,
  teams,
  paths,
}: {
  canPostGeneral: boolean;
  teams: { id: string; title_ar: string }[];
  paths: { id: string; title_ar: string }[];
}) {
  const [state, formAction, pending] = useActionState(postOpportunity, undefined as MarketState);
  const [kind, setKind] = useState<OpportunityKind>(canPostGeneral ? 'freelance' : 'team_seat');

  const kinds = (Object.keys(OPPORTUNITY_KIND) as OpportunityKind[]).filter(
    (value) => canPostGeneral || value === 'team_seat',
  );

  return (
    <form action={formAction} className="panel" style={{ maxWidth: 680 }}>
      <div className="field">
        <label htmlFor="kind">نوع الفرصة</label>
        <select id="kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as OpportunityKind)}>
          {kinds.map((value) => (
            <option key={value} value={value}>{OPPORTUNITY_KIND[value].label}</option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: '0.78rem' }}>{OPPORTUNITY_KIND[kind].hint}</span>
      </div>

      {kind === 'team_seat' && (
        <div className="field">
          <label htmlFor="team_id">الفريق</label>
          <select id="team_id" name="team_id" required defaultValue={teams[0]?.id}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.title_ar}</option>)}
          </select>
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            طلبات هذا المقعد تصل إلى قائمة طلبات الفريق، وتُقرَّر هناك.
          </span>
        </div>
      )}

      <div className="field">
        <label htmlFor="title">العنوان</label>
        <input id="title" name="title" required minLength={4} />
      </div>

      <div className="field">
        <label htmlFor="organization">الجهة</label>
        <input id="organization" name="organization" placeholder="اسم الشركة أو المشروع" />
      </div>

      <div className="field">
        <label htmlFor="description">الوصف والمطلوب</label>
        <textarea id="description" name="description" rows={5} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="compensation_kind">شكل الأجر</label>
          <select id="compensation_kind" name="compensation_kind" defaultValue="">
            <option value="">غير محدد</option>
            {Object.entries(COMPENSATION_KIND).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="currency">العملة</label>
          <input id="currency" name="currency" defaultValue="USD" dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="amount_min">من</label>
          <input id="amount_min" name="amount_min" type="number" step="0.01" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="amount_max">إلى</label>
          <input id="amount_max" name="amount_max" type="number" step="0.01" dir="ltr" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="location">المكان</label>
          <input id="location" name="location" placeholder="غزة، رام الله…" />
        </div>
        <div className="field">
          <label htmlFor="seats">عدد المقاعد</label>
          <input id="seats" name="seats" type="number" min={1} max={50} defaultValue={1} dir="ltr" />
        </div>
      </div>

      <label className="badge-pill" style={{ cursor: 'pointer', gap: 8, marginBottom: 14 }}>
        <input type="checkbox" name="is_remote" />
        عن بُعد
      </label>

      <div className="field">
        <label htmlFor="closes_on">آخر موعد للتقديم</label>
        <input id="closes_on" name="closes_on" type="date" />
      </div>

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          المتطلبات — إرشادية، تُعرض للمتقدّم ولا تمنعه.
        </p>

        <div className="field">
          <label htmlFor="required_skills">المهارات المطلوبة (مفصولة بفاصلة)</label>
          <input id="required_skills" name="required_skills" dir="ltr" placeholder="React, Node.js" />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="min_stars">أقل تقييم بالنجوم</label>
            <input id="min_stars" name="min_stars" type="number" min={0} max={5} step="0.5" dir="ltr" />
          </div>
          <div className="field">
            <label htmlFor="required_path_id">شهادة مسار مطلوبة</label>
            <select id="required_path_id" name="required_path_id" defaultValue="">
              <option value="">بلا اشتراط</option>
              {paths.map((path) => <option key={path.id} value={path.id}>{path.title_ar}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="tags">وسوم</label>
          <input id="tags" name="tags" placeholder="Frontend, Design" />
        </div>
      </div>

      {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'جارٍ النشر…' : 'انشر الفرصة'}
      </button>
    </form>
  );
}
