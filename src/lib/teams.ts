import type { SprintStatus, TaskColumn, TaskPriority, TeamKind, TeamStatus } from '@/lib/database.types';

export const TEAM_KIND: Record<TeamKind, string> = {
  learning: 'فريق تعلّم',
  project: 'فريق مشروع',
  freelance: 'فريق عمل حر',
  startup: 'فريق شركة ناشئة',
};

export const TEAM_STATUS: Record<TeamStatus, { text: string; className: string }> = {
  active: { text: 'نشط', className: 'status-ok' },
  completed: { text: 'مكتمل', className: 'status-muted' },
  archived: { text: 'مؤرشف', className: 'status-muted' },
};

/**
 * The board columns, in the order work actually moves. `blocked` is a real
 * column rather than a flag: a task nobody can move is neither in progress nor
 * waiting to start, and naming it is what lets a leader see where to step in.
 */
export const TASK_COLUMNS: { key: TaskColumn; label: string }[] = [
  { key: 'todo', label: 'قائمة المهام' },
  { key: 'doing', label: 'قيد التنفيذ' },
  { key: 'blocked', label: 'متوقفة' },
  { key: 'review', label: 'قيد المراجعة' },
  { key: 'done', label: 'مكتملة' },
];

export const TASK_PRIORITY: Record<TaskPriority, { text: string; className: string }> = {
  low: { text: 'منخفضة', className: 'status-muted' },
  normal: { text: 'عادية', className: 'status-muted' },
  high: { text: 'مرتفعة', className: 'status-pending' },
  urgent: { text: 'عاجلة', className: 'status-danger' },
};

export const SPRINT_STATUS: Record<SprintStatus, { text: string; className: string }> = {
  planned: { text: 'مخطط', className: 'status-muted' },
  active: { text: 'جارٍ', className: 'status-ok' },
  review: { text: 'مراجعة', className: 'status-pending' },
  closed: { text: 'مغلق', className: 'status-muted' },
};

export const ACTIVITY_VERBS: Record<string, string> = {
  task_completed: 'أنجز مهمة',
  member_joined: 'انضم إلى الفريق',
};

export function isOverdue(dueOn: string | null, column: TaskColumn) {
  if (!dueOn || column === 'done') return false;
  return new Date(dueOn) < new Date(new Date().toDateString());
}

export const DOCUMENT_KINDS: { key: string; label: string; group: string }[] = [
  { key: 'requirements',   label: 'المتطلبات',        group: 'توثيق المشروع' },
  { key: 'specification',  label: 'المواصفات',        group: 'توثيق المشروع' },
  { key: 'meeting_notes',  label: 'محاضر الاجتماعات', group: 'توثيق المشروع' },
  { key: 'decision',       label: 'القرارات',         group: 'توثيق المشروع' },
  { key: 'guideline',      label: 'إرشادات العمل',    group: 'توثيق المشروع' },
  { key: 'design',         label: 'التصاميم',         group: 'مخرجات وأدلة' },
  { key: 'report',         label: 'التقارير',         group: 'مخرجات وأدلة' },
  { key: 'deliverable',    label: 'المخرجات',         group: 'مخرجات وأدلة' },
  { key: 'integration',    label: 'روابط وتكاملات',   group: 'مخرجات وأدلة' },
];

export const CALENDAR_ENTRY: Record<string, { label: string; icon: string }> = {
  task:           { label: 'موعد مهمة',      icon: '📌' },
  sprint_start:   { label: 'بداية سبرنت',    icon: '🚀' },
  sprint_end:     { label: 'نهاية سبرنت',    icon: '🏁' },
  milestone:      { label: 'معلم مشروع',     icon: '🎯' },
  mentor_session: { label: 'جلسة منتور',     icon: '🎓' },
};
