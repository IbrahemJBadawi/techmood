'use client';

import { savePermissions } from './actions';
import { useT } from '@/lib/i18n.client';
import type { Text } from '@/lib/i18n';

const PERMISSIONS: { key: string; label: Text; hint: Text; fallback: boolean }[] = [
  { key: 'members_create_tasks', label: { ar: 'إنشاء المهام',      en: 'Create tasks' },          hint: { ar: 'إضافة مهام جديدة على اللوحة.', en: 'Add new tasks to the board.' },          fallback: true },
  { key: 'members_assign_tasks', label: { ar: 'إسناد المهام',      en: 'Assign tasks' },          hint: { ar: 'تحديد مسؤول عن مهمة.',         en: 'Give a task an owner.' },                fallback: false },
  { key: 'members_invite',       label: { ar: 'دعوة أعضاء',        en: 'Invite members' },        hint: { ar: 'إرسال دعوات بـ TechMood ID.',   en: 'Send invitations by TechMood ID.' },     fallback: false },
  { key: 'members_manage_docs',  label: { ar: 'إدارة المستندات',   en: 'Manage documents' },      hint: { ar: 'إضافة وحذف مستندات الفريق.',    en: 'Add and remove the team\u2019s documents.' }, fallback: true },
  { key: 'members_book_mentor',  label: { ar: 'حجز جلسات المنتور', en: 'Book mentor sessions' },  hint: { ar: 'حجز جلسة للفريق مع منتور.',     en: 'Book a session for the team.' },         fallback: false },
  { key: 'members_edit_project', label: { ar: 'تعديل المشاريع',    en: 'Edit projects' },         hint: { ar: 'إنشاء المشاريع وتغيير حالتها.', en: 'Create projects and change their state.' }, fallback: false },
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
  const t = useT();
  return (
    <form action={savePermissions} className="panel section-block">
      <h3 style={{ fontSize: '0.98rem', marginBottom: 6 }}>{t('صلاحيات الأعضاء', 'Member permissions')}</h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 14 }}>
        {t('ما يستطيع العضو العادي فعله. قائد الفريق يملك كل الصلاحيات دائماً، بغضّ النظر عن هذه الإعدادات.',
           'What an ordinary member may do. The team lead always holds every permission, whatever these settings say.')}
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
            <strong style={{ fontSize: '0.88rem' }}>{t(permission.label)}</strong>
            <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>{t(permission.hint)}</span>
          </span>
        </label>
      ))}

      <button className="btn btn-primary btn-sm">{t('احفظ الصلاحيات', 'Save permissions')}</button>
    </form>
  );
}
