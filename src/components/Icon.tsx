import type { IconName } from '@/lib/roles';

/**
 * One small stroke icon set, inline so the compact sidebar on a phone needs no
 * font, no sprite and no network request. Every path is drawn on a 24x24 grid.
 */
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  passport: 'M5 3h14v18H5zM9 7h6M9 11h6M9 15h3',
  academy: 'M12 4 2.5 9 12 14l9.5-5zM6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5',
  certificate: 'M6 3h12v13H6zM9 7h6M9 10h6M10 16l-1 5 3-1.6L15 21l-1-5',
  gallery: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M17 8.5a2.5 2.5 0 1 0 0-5M18 14.5c2.1.6 3.5 2.2 3.5 4.5',
  message: 'M4 5h16v11H9l-5 4z',
  mentor: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c0-3.6 3.1-6 7-6s7 2.4 7 6M17.5 3.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  wallet: 'M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V6a2 2 0 0 1 2-2h11M17 13.5h.01',
  work: 'M3 8h18v12H3zM8 8V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V8M3 13h18',
  application: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  startup: 'M12 3c3.5 2.5 5 6 5 9l2.5 2.5-3 1-1.5 3-3-2.5-3 2.5L7.5 15.5l-3-1L7 12c0-3 1.5-6.5 5-9zM12 10.5h.01',
  incubator: 'M12 3c4 2.5 6 6 6 9.5A6 6 0 0 1 6 12.5C6 9 8 5.5 12 3zM9.5 13.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5M9 21h6',
  review: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6zM9 12l2 2 4-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.5 12a7.5 7.5 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.8-1.6L13.8 2h-3.6l-.4 2.9a7.5 7.5 0 0 0-2.8 1.6l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.8 1.6l.4 2.9h3.6l.4-2.9a7.5 7.5 0 0 0 2.8-1.6l2.3 1 2-3.4-2-1.5c.13-.52.2-1.06.2-1.6z',
  company: 'M4 21V6l7-3v18M11 21V9l9 3v9M4 21h17M7.5 9v.01M7.5 13v.01M7.5 17v.01M15 14v.01M15 17.5v.01',
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
