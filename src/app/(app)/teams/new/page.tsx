'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { createTeam, type TeamState } from '../actions';
import { useT } from '@/lib/i18n.client';

export default function NewTeamPage() {
  const t = useT();
  const [state, formAction, pending] = useActionState(createTeam, undefined as TeamState);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/teams">{t('→ رجوع للفرق', '← Back to teams')}</Link>

      <section className="section-block" style={{ marginTop: 16, maxWidth: 620 }}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('أنشئ فريقاً', 'Start a team')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('الفريق مساحة عمل مغلقة: الأعضاء يدخلون بدعوة، والمهام والمحادثة والمستندات تبقى داخله.', 'A team is a closed workspace: people join by invitation, and the tasks, the conversation and the documents stay inside it.')}
        </p>
      </section>

      <form action={formAction} className="panel" style={{ maxWidth: 620 }}>
        <div className="field">
          <label htmlFor="title">{t('اسم الفريق', 'Team name')}</label>
          <input id="title" name="title" required minLength={3} />
        </div>

        <div className="field">
          <label htmlFor="kind">{t('نوع الفريق', 'Team kind')}</label>
          <select id="kind" name="kind" defaultValue="project">
            <option value="learning">{t('فريق تعلّم', 'Learning team')}</option>
            <option value="project">{t('فريق مشروع', 'Project team')}</option>
            <option value="freelance">{t('فريق عمل حر', 'Freelance team')}</option>
            <option value="startup">{t('فريق شركة ناشئة', 'Startup team')}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="description">{t('وصف مختصر', 'Short description')}</label>
          <textarea id="description" name="description" rows={3} />
        </div>

        <div className="field">
          <label htmlFor="focus">{t('مجال العمل', 'Focus')}</label>
          <input id="focus" name="focus" placeholder={t('مثال: تطوير الويب، تحليل بيانات', 'For example: web development, data analysis')} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="join_policy">{t('الانضمام', 'Joining')}</label>
            <select id="join_policy" name="join_policy" defaultValue="invite_only">
              <option value="invite_only">{t('بالدعوة فقط', 'By invitation only')}</option>
              <option value="request_allowed">{t('يسمح بطلبات الانضمام', 'Requests to join allowed')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="visibility">{t('الظهور', 'Visibility')}</label>
            <select id="visibility" name="visibility" defaultValue="private">
              <option value="private">{t('خاص تماماً', 'Fully private')}</option>
              <option value="listed">{t('ملف مهني عام', 'Public professional profile')}</option>
            </select>
          </div>
        </div>

        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
          {t('«ملف مهني عام» ينشر اسم الفريق وأعضاءه ومشاريعه المكتملة فقط — ولا يكشف المهام ولا المحادثة ولا المستندات أبداً.',
             'A public professional profile publishes only the team\u2019s name, its members and its finished projects — never the tasks, the conversation or the documents.')}
        </p>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? t('جارٍ الإنشاء…', 'Creating…') : t('أنشئ الفريق', 'Create the team')}
        </button>
      </form>
    </>
  );
}
