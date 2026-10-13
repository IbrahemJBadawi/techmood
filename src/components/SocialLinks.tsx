import { SOCIAL_HANDLE, SOCIAL_LINKS, type SocialKey } from '@/lib/contact';

/** Each network's mark, drawn small and in one colour (currentColor). */
const GLYPH: Record<SocialKey, React.ReactNode> = {
  facebook: <path d="M14 8h3V4.5h-3c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V21h3.6v-6.5h2.9l.5-3.5h-3.4V8.7c0-.4.3-.7.7-.7z" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.2" />
    </>
  ),
  tiktok: <path d="M15.5 3c.4 2.3 1.9 3.9 4.2 4.1v3.3c-1.5 0-2.9-.4-4.1-1.2v6.2c0 3.4-2.6 5.6-5.6 5.6-3 0-5.4-2.4-5.4-5.4 0-3.3 2.9-5.8 6.3-5.3v3.4c-1.5-.4-3 .6-3 2 0 1.1.9 2 2.1 2 1.3 0 2.2-.9 2.2-2.4V3h3.3z" />,
  telegram: <path d="M20.7 4.3 3.4 11c-1.2.5-1.1 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.5.7 1 .3l2.5-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.4-1.7-1.2-1.3zM8.6 13.6l8.5-5.4c.4-.3.8-.1.5.2l-7 6.4-.3 3-1.7-4.2z" />,
};

/**
 * TechMood on Facebook, Instagram, TikTok and Telegram — one handle,
 * @techmoodtech. The links leave the site, so they open in a new tab.
 */
export function SocialLinks({ label, showHandle = true, className = '' }: { label: string; showHandle?: boolean; className?: string }) {
  return (
    <div className={`social-links ${className}`}>
      <ul aria-label={label}>
        {SOCIAL_LINKS.map((link) => (
          <li key={link.key}>
            <a className={`social-link is-${link.key}`} href={link.href} target="_blank" rel="noopener noreferrer"
               aria-label={`${link.label} ${SOCIAL_HANDLE}`} title={`${link.label} — ${SOCIAL_HANDLE}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{GLYPH[link.key]}</svg>
            </a>
          </li>
        ))}
      </ul>
      {showHandle && <span className="social-handle eng" dir="ltr">{SOCIAL_HANDLE}</span>}
    </div>
  );
}
