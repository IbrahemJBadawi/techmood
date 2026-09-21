'use client';

import type { LearningStatus } from '@/lib/database.types';
import { useT } from '@/lib/i18n.client';

import { STATUS_LABEL } from './types';

const TONE: Record<LearningStatus, string> = {
  not_started: 'status-muted',
  in_progress: 'status-pending',
  completed:   'status-ok',
};

/** A shape as well as a colour, so status never rests on hue alone. */
const MARK: Record<LearningStatus, string> = {
  not_started: '○',
  in_progress: '◔',
  completed:   '✓',
};

/**
 * The one vocabulary the academy uses for "how far am I": not started, in
 * progress, completed. A path, a course and a lesson all say it the same way.
 */
export function StatusBadge({ status }: { status: LearningStatus }) {
  const t = useT();
  return (
    <span className={`status-pill ${TONE[status]}`}>
      <span aria-hidden>{MARK[status]}</span> {STATUS_LABEL[status][t.locale]}
    </span>
  );
}
