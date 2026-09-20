'use client';

import { savePermissions } from './actions';

const PERMISSIONS: { key: string; label: string; hint: string; fallback: boolean }[] = [
  { key: 'members_create_tasks', label: 'إنشاء المهام',       hint: 'إضافة مهام جديدة على اللوحة.',       fallback: true },
  { key: 'members_assign_tasks', label: 'إسناد المهام',       hint: 'تحديد مسؤول عن مهمة.',               fallback: false },
  { key: 'members_invite',       label: 'دعوة أعضاء',         hint: 'إرسال دعوات بـ TechMood ID.',        fallback: false },
  { key: 'members_manage_docs',  label: 'إدارة المستندات',    hint: 'إضافة وحذف مستندات الفريق.',         fallback: true },
  { key: 'members_book_mentor',  label: 'حجز جلسات المنتور',  hint: 'حجز جلسة للفريق مع منتور.',          fallback: false },
  { key: 'members_edit_project', label: 'تعديل المشاريع',     hint: 'إنشاء المشاريع وتغيير حالتها.',      fallback: false },
];

/** `team_id` rides along on the row, so the lookup is typed loosely on purpose. */
type PermissionRow = { team_id: string } & Record<string, boolean | string>;

export function PermissionsForm({
  teamId,
  permissions,
}: {
  teamId: string;
  permissions: PermissionRow | null;
}) {
  return (
    <form action={savePermissions} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>صلاحيات الأعضاء</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 14 }}>
        ما يستطيع العضو العادي فعله. قائد الفريق يملك كل الصلاحيات دائماً، بغضّ النظر عن هذه
        الإعدادات.
      </p>

      <input type="hidden" name="team_id" value={teamId} />

      {PERMISSIONS.map((permission) => (
        <label
          key={permission.key}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            name={permission.key}
            defaultChecked={(permissions?.[permission.key] as boolean | undefined) ?? permission.fallback}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong style={{ fontSize: '0.88rem' }}>{permission.label}</strong>
            <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>{permission.hint}</span>
          </span>
        </label>
      ))}

      <button className="btn btn-primary btn-sm">احفظ الصلاحيات</button>
    </form>
  );
}
