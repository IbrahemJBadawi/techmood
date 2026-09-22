'use client';

import { useEffect } from 'react';

import { useAssistant } from '@/app/(app)/shell/AssistantProvider';
import type { AiScope, AiSurface } from '@/lib/database.types';

/**
 * A page telling the assistant what it is looking at. Renders nothing.
 *
 * It passes an id, never data: the panel asks `ai_context()` for the content,
 * and that function reads as the person. A page cannot hand the assistant
 * anything the person could not have read themselves.
 */
export function AiSurface({ surface, scope, entityType, entityId, label }: {
  surface: AiSurface;
  scope?: AiScope;
  entityType?: string;
  entityId?: string;
  label?: string;
}) {
  const assistant = useAssistant();
  const register = assistant?.register;
  const forget = assistant?.forget;

  useEffect(() => {
    if (!register || !forget) return;
    register({ surface, scope, entityType, entityId, label });
    return () => forget(surface);
  }, [register, forget, surface, scope, entityType, entityId, label]);

  return null;
}
