/** One seat a team is looking for, as the creation form holds it (0170). */
export type OpeningDraft = { role: string; seats: number; skills: string };

/** The JSON field back into rows a database accepts. */
export function parseOpenings(raw: unknown) {
  try {
    const rows = JSON.parse(String(raw ?? '[]')) as OpeningDraft[];
    return (Array.isArray(rows) ? rows : []).slice(0, 6)
      .map((row) => ({
        role_ar: String(row.role ?? '').trim().slice(0, 60),
        seats: Math.min(10, Math.max(1, Math.round(Number(row.seats) || 1))),
        skills: String(row.skills ?? '').split(/[,،]/).map((skill) => skill.trim()).filter(Boolean).slice(0, 8),
      }))
      .filter((row) => row.role_ar.length >= 2);
  } catch {
    return [];
  }
}
