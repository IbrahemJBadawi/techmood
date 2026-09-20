'use client';

import { SELECTABLE_ROLES } from '@/lib/roles';

import { requestRole } from '../../(auth)/actions';

export function RoleRequestForm({ heldRoles }: { heldRoles: string[] }) {
  const available = SELECTABLE_ROLES.filter(
    (role) => role.needsReview && !heldRoles.includes(role.value),
  );

  if (available.length === 0) return null;

  return (
    <div className="panel">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>اطلب دوراً إضافياً</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
        يدخل الطلب قائمة مراجعة الإدارة مع ما ترفقه من إثبات.
      </p>

      <form action={requestRole}>
        <div className="field">
          <label htmlFor="role">الدور</label>
          <select id="role" name="role" required defaultValue="">
            <option value="" disabled>اختر دوراً</option>
            {available.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="evidence_url">رابط إثبات (GitHub أو معرض أعمال)</label>
          <input id="evidence_url" name="evidence_url" type="url" dir="ltr" placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor="note">لماذا تطلب هذا الدور؟</label>
          <textarea id="note" name="note" rows={3} />
        </div>
        <button className="btn btn-primary btn-sm" type="submit">إرسال الطلب</button>
      </form>
    </div>
  );
}
