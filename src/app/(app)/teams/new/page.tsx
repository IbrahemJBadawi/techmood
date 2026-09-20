'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { createTeam, type TeamState } from '../actions';

export default function NewTeamPage() {
  const [state, formAction, pending] = useActionState(createTeam, undefined as TeamState);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/teams">→ رجوع للفرق</Link>

      <section className="section-block" style={{ marginTop: 16, maxWidth: 620 }}>
        <h2 style={{ fontSize: '1.2rem' }}>أنشئ فريقاً</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          الفريق مساحة عمل مغلقة: الأعضاء يدخلون بدعوة، والمهام والمحادثة والمستندات تبقى داخله.
        </p>
      </section>

      <form action={formAction} className="panel" style={{ maxWidth: 620 }}>
        <div className="field">
          <label htmlFor="title">اسم الفريق</label>
          <input id="title" name="title" required minLength={3} />
        </div>

        <div className="field">
          <label htmlFor="kind">نوع الفريق</label>
          <select id="kind" name="kind" defaultValue="project">
            <option value="learning">فريق تعلّم</option>
            <option value="project">فريق مشروع</option>
            <option value="freelance">فريق عمل حر</option>
            <option value="startup">فريق شركة ناشئة</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="description">وصف مختصر</label>
          <textarea id="description" name="description" rows={3} />
        </div>

        <div className="field">
          <label htmlFor="focus">مجال العمل</label>
          <input id="focus" name="focus" placeholder="مثال: تطوير الويب، تحليل بيانات" />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="join_policy">الانضمام</label>
            <select id="join_policy" name="join_policy" defaultValue="invite_only">
              <option value="invite_only">بالدعوة فقط</option>
              <option value="request_allowed">يسمح بطلبات الانضمام</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="visibility">الظهور</label>
            <select id="visibility" name="visibility" defaultValue="private">
              <option value="private">خاص تماماً</option>
              <option value="listed">ملف مهني عام</option>
            </select>
          </div>
        </div>

        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
          «ملف مهني عام» ينشر اسم الفريق وأعضاءه ومشاريعه المكتملة فقط — ولا يكشف المهام ولا
          المحادثة ولا المستندات أبداً.
        </p>

        {state?.error && <p className="notice notice-danger" style={{ marginBottom: 12 }}>{state.error}</p>}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
          {pending ? 'جارٍ الإنشاء…' : 'أنشئ الفريق'}
        </button>
      </form>
    </>
  );
}
