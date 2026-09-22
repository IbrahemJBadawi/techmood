'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { AiScope, AiSurface } from '@/lib/database.types';
import { SCOPES_FOR } from '@/lib/ai';

/**
 * Where the assistant thinks it is.
 *
 * A page says this out loud with `<AiSurface …/>` rather than the panel
 * guessing from the URL: a route is a routing detail, and an assistant that
 * infers "you are on a lesson" from a path segment starts lying the first time
 * somebody renames a folder.
 */
export type Where = {
  surface: AiSurface;
  scope: AiScope;
  entityType: string | null;
  entityId: string | null;
  label: string | null;
};

const DEFAULT: Where = {
  surface: 'general', scope: 'page', entityType: null, entityId: null, label: null,
};

type Assistant = {
  where: Where;
  isOpen: boolean;
  /** The composer's text lives here, so an «اسأل الذكاء» button can fill it. */
  draft: string;
  setDraft: (text: string) => void;
  open: (prompt?: string) => void;
  close: () => void;
  setScope: (scope: AiScope) => void;
  register: (where: Partial<Where> & { surface: AiSurface }) => void;
  forget: (surface: AiSurface) => void;
};

const AssistantContext = createContext<Assistant | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [where, setWhere] = useState<Where>(DEFAULT);
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const register = useCallback((next: Partial<Where> & { surface: AiSurface }) => {
    setWhere({
      surface: next.surface,
      // The page's own surface decides which context chips make sense; 'page'
      // is always among them.
      scope: next.scope && SCOPES_FOR[next.surface].includes(next.scope) ? next.scope : 'page',
      entityType: next.entityType ?? null,
      entityId: next.entityId ?? null,
      label: next.label ?? null,
    });
  }, []);

  const forget = useCallback((surface: AiSurface) => {
    setWhere((current) => (current.surface === surface ? DEFAULT : current));
  }, []);

  const value = useMemo<Assistant>(() => ({
    where,
    isOpen,
    draft,
    setDraft,
    open: (prompt?: string) => { if (prompt) setDraft(prompt); setOpen(true); },
    close: () => setOpen(false),
    setScope: (scope) => setWhere((current) => ({ ...current, scope })),
    register,
    forget,
  }), [where, isOpen, draft, register, forget]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

/** Null outside the app shell — the marketing pages have no assistant. */
export function useAssistant(): Assistant | null {
  return useContext(AssistantContext);
}
