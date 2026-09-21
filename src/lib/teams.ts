import type { Text } from '@/lib/i18n';
import type { SprintStatus, TaskColumn, TaskPriority, TeamKind, TeamStatus } from '@/lib/database.types';

export const TEAM_KIND: Record<TeamKind, Text> = {
  learning:  { ar: 'فريق تعلّم',        en: 'Learning team' },
  project:   { ar: 'فريق مشروع',        en: 'Project team' },
  freelance: { ar: 'فريق عمل حر',       en: 'Freelance team' },
  startup:   { ar: 'فريق شركة ناشئة',   en: 'Startup team' },
};

export const TEAM_STATUS: Record<TeamStatus, { text: Text; className: string }> = {
  active:    { text: { ar: 'نشط',     en: 'Active' },    className: 'status-ok' },
  completed: { text: { ar: 'مكتمل',   en: 'Completed' }, className: 'status-muted' },
  archived:  { text: { ar: 'مؤرشف',   en: 'Archived' },  className: 'status-muted' },
};

/**
 * The board columns, in the order work actually moves. `blocked` is a real
 * column rather than a flag: a task nobody can move is neither in progress nor
 * waiting to start, and naming it is what lets a leader see where to step in.
 */
export const TASK_COLUMNS: { key: TaskColumn; label: Text }[] = [
  { key: 'todo',    label: { ar: 'قائمة المهام', en: 'To do' } },
  { key: 'doing',   label: { ar: 'قيد التنفيذ',  en: 'In progress' } },
  { key: 'blocked', label: { ar: 'متوقفة',       en: 'Blocked' } },
  { key: 'review',  label: { ar: 'قيد المراجعة', en: 'In review' } },
  { key: 'done',    label: { ar: 'مكتملة',       en: 'Done' } },
];

export const TASK_PRIORITY: Record<TaskPriority, { text: Text; className: string }> = {
  low:    { text: { ar: 'منخفضة', en: 'Low' },    className: 'status-muted' },
  normal: { text: { ar: 'عادية',  en: 'Normal' }, className: 'status-muted' },
  high:   { text: { ar: 'مرتفعة', en: 'High' },   className: 'status-pending' },
  urgent: { text: { ar: 'عاجلة',  en: 'Urgent' }, className: 'status-danger' },
};

export const SPRINT_STATUS: Record<SprintStatus, { text: Text; className: string }> = {
  planned: { text: { ar: 'مخطط',   en: 'Planned' },  className: 'status-muted' },
  active:  { text: { ar: 'جارٍ',    en: 'Running' },  className: 'status-ok' },
  review:  { text: { ar: 'مراجعة', en: 'In review' },className: 'status-pending' },
  closed:  { text: { ar: 'مغلق',   en: 'Closed' },   className: 'status-muted' },
};

export const ACTIVITY_VERBS: Record<string, Text> = {
  task_completed:          { ar: 'أنجز مهمة',          en: 'completed a task' },
  member_joined:           { ar: 'انضم إلى الفريق',    en: 'joined the team' },
  leadership_transferred:  { ar: 'سلّم قيادة الفريق',  en: 'handed over the team' },
};

export function isOverdue(dueOn: string | null, column: TaskColumn) {
  if (!dueOn || column === 'done') return false;
  return new Date(dueOn) < new Date(new Date().toDateString());
}

export const DOCUMENT_KINDS: { key: string; label: Text; group: Text }[] = [
  { key: 'requirements',  label: { ar: 'المتطلبات',        en: 'Requirements' },     group: { ar: 'توثيق المشروع', en: 'Project documentation' } },
  { key: 'specification', label: { ar: 'المواصفات',        en: 'Specifications' },   group: { ar: 'توثيق المشروع', en: 'Project documentation' } },
  { key: 'meeting_notes', label: { ar: 'محاضر الاجتماعات', en: 'Meeting notes' },    group: { ar: 'توثيق المشروع', en: 'Project documentation' } },
  { key: 'decision',      label: { ar: 'القرارات',         en: 'Decisions' },        group: { ar: 'توثيق المشروع', en: 'Project documentation' } },
  { key: 'guideline',     label: { ar: 'إرشادات العمل',    en: 'Working guidelines' },group:{ ar: 'توثيق المشروع', en: 'Project documentation' } },
  { key: 'design',        label: { ar: 'التصاميم',         en: 'Designs' },          group: { ar: 'مخرجات وأدلة',  en: 'Outputs & evidence' } },
  { key: 'report',        label: { ar: 'التقارير',         en: 'Reports' },          group: { ar: 'مخرجات وأدلة',  en: 'Outputs & evidence' } },
  { key: 'deliverable',   label: { ar: 'المخرجات',         en: 'Deliverables' },     group: { ar: 'مخرجات وأدلة',  en: 'Outputs & evidence' } },
  { key: 'integration',   label: { ar: 'روابط وتكاملات',   en: 'Links & integrations' }, group: { ar: 'مخرجات وأدلة', en: 'Outputs & evidence' } },
];

export const CALENDAR_ENTRY: Record<string, { label: Text; icon: string }> = {
  task:           { label: { ar: 'موعد مهمة',    en: 'Task due' },        icon: '📌' },
  sprint_start:   { label: { ar: 'بداية سبرنت',  en: 'Sprint starts' },   icon: '🚀' },
  sprint_end:     { label: { ar: 'نهاية سبرنت',  en: 'Sprint ends' },     icon: '🏁' },
  milestone:      { label: { ar: 'معلم مشروع',   en: 'Milestone' },       icon: '🎯' },
  mentor_session: { label: { ar: 'جلسة منتور',   en: 'Mentor session' },  icon: '🎓' },
};
