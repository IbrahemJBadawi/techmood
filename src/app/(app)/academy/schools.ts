import type { IconName } from '@/lib/roles';

/**
 * How a school looks: one colour and one icon, so a card says which field it
 * belongs to before a word of it is read — the way DataCamp colours its tracks.
 * The colour is a hue, not a status: progress keeps its own green everywhere.
 */
const SCHOOL_LOOK: Record<string, { color: string; icon: IconName }> = {
  'software-engineering': { color: '#2F6BFF', icon: 'code' },
  'ai-data':              { color: '#7C5CFF', icon: 'assistant' },
  'cyber-infrastructure': { color: '#0E9F6E', icon: 'shield' },
  'design-creative':      { color: '#E8590C', icon: 'brush' },
  'business-management':  { color: '#C77700', icon: 'chart' },
  'career-human':         { color: '#D6336C', icon: 'team' },
  'digital-admin':        { color: '#0B8FB3', icon: 'layers' },
  foundations:            { color: '#5B6B7C', icon: 'academy' },
};

const FALLBACK = { color: '#007BFF', icon: 'academy' as IconName };

export function schoolLook(slug: string | null | undefined) {
  return (slug && SCHOOL_LOOK[slug]) || FALLBACK;
}
