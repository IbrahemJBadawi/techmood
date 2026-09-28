/**
 * How a mentor is drawn in lists and on their page: a stable colour for the
 * avatar (picked from the id, so it never changes between visits), and their
 * domains written for people rather than as slugs.
 */
const AVATAR_COLORS = ['#2F6BFF', '#7C5CFF', '#0E9F6E', '#E8590C', '#D6336C', '#0B8FB3', '#C77700', '#5B6B7C'];

export function avatarColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialOf(name: string | null | undefined) {
  return (name ?? '?').trim().charAt(0) || '?';
}

/** "frontend-development" → "Frontend development". */
export function domainLabel(slug: string) {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
