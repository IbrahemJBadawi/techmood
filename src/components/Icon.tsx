import type { IconName } from '@/lib/roles';

/**
 * One small stroke icon set, inline so the compact sidebar on a phone needs no
 * font, no sprite and no network request. Every path is drawn on a 24x24 grid.
 */
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  assistant: 'M12 3.5 13.6 8 18 9.5 13.6 11 12 15.5 10.4 11 6 9.5 10.4 8zM18 15.5l.7 1.9 1.8.7-1.8.7-.7 1.9-.7-1.9-1.8-.7 1.8-.7zM5.5 14l.5 1.4 1.4.5-1.4.5L5.5 18 5 16.4l-1.4-.5 1.4-.5z',
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
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  more: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  // points forward in the reading direction; the stylesheet mirrors it in RTL
  arrow: 'M5 12h14M13 6l6 6-6 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  play: 'M8 5.5v13l10.5-6.5z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  code: 'M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  brush: 'M14.5 4.5l5 5L10 19H5v-5zM12.5 6.5l5 5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  layers: 'M12 3 2.5 8 12 13l9.5-5zM2.5 12.5 12 17.5l9.5-5M2.5 16.5 12 21.5l9.5-5',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
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
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
