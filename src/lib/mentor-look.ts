/**
 * How a mentor is drawn in lists and on their page: a stable colour for the
 * avatar (picked from the id, so it never changes between visits), and their
 * domains written for people rather than as slugs.
 */
// Each one carries white letters at 4.5:1 or better, so a small initial stays readable.
const AVATAR_COLORS = ['#006BE0', '#6D4AE8', '#0B7A75', '#C2560F', '#0A7A99', '#0E7A4F', '#C2255C', '#5B6B7C'];

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
