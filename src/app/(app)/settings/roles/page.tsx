import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import { ROLE_STATUS_LABEL, ROLE_STATUS_TONE, SELECTABLE_ROLES, roleLabel } from '@/lib/roles';
import type { RoleStatus, UserRole } from '@/lib/database.types';

import { MyRoles } from './MyRoles';

export const metadata = { title: 'My roles — TechMood' };

const EVENT_LABEL: Record<string, Text> = {
  submitted:           { ar: 'أُرسل الطلب',             en: 'Request sent' },
  more_info_requested: { ar: 'طُلبت معلومات إضافية',    en: 'More information requested' },
  more_info_provided:  { ar: 'أرسلتَ المعلومات',        en: 'You sent the information' },
  approved:            { ar: 'اعتُمد',                   en: 'Approved' },
  rejected:            { ar: 'لم يُقبل',                 en: 'Not accepted' },
  suspended:           { ar: 'أُوقف',                    en: 'Suspended' },
  reinstated:          { ar: 'أُعيد تفعيله',             en: 'Reinstated' },
  withdrawn:           { ar: 'سُحب',                     en: 'Withdrawn' },
};

export default async function MyRolesPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('primary_role').eq('id', user.id).single(),
    supabase
      .from('profile_roles')
      .select('id, role, status, application_note, review_note, reviewed_at, created_at')
      .eq('profile_id', user.id)
      .order('created_at'),
  ]);

  const held = roles ?? [];
  const requestIds = held.map((row) => row.id);
  const { data: events } = requestIds.length
    ? await supabase
        .from('role_request_events')
        .select('id, role_request_id, event, note, created_at')
        .in('role_request_id', requestIds)
        .order('created_at')
    : { data: [] };

  const available = SELECTABLE_ROLES.filter(
    (role) => role.grant !== 'automatic' && !held.some((row) => row.role === role.value),
  );

  const approved = held
    .filter((row) => row.status === 'approved')
    .map((row) => row.role as UserRole);

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>{t('أدواري', 'My roles')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 640 }}>
          {t('الأدوار ليست ترتيباً اجتماعياً. كل دور يفتح مساحة عمل، ولا دور منها «أعلى» من آخر. كل ما تبنيه — XP والنجوم والشهادات والمشاريع — يعود إلى معرّفك في TechMood، لا إلى الدور.',
             'Roles are not a social ranking. Each opens a workspace, and none of them sits above another. Everything you build — XP, stars, certificates, projects — belongs to your TechMood ID, not to a role.')}
        </p>
      </section>

      <MyRoles
        roles={held.map((row) => ({
          id: row.id,
          role: row.role as UserRole,
          status: row.status as RoleStatus,
          statusLabel: t(ROLE_STATUS_LABEL[row.status as RoleStatus]),
          tone: ROLE_STATUS_TONE[row.status as RoleStatus],
          label: t(roleLabel(row.role as UserRole)),
          applicationNote: row.application_note,
          reviewNote: row.review_note,
          events: (events ?? [])
            .filter((event) => event.role_request_id === row.id)
            .map((event) => ({
              id: event.id,
              label: EVENT_LABEL[event.event] ? t(EVENT_LABEL[event.event]) : event.event,
              note: event.note,
              at: event.created_at,
            })),
        }))}
        available={available}
        approved={approved}
        primary={(profile?.primary_role ?? null) as UserRole | null}
      />
    </>
  );
}
