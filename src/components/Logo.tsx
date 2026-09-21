import Image from 'next/image';

/**
 * The TechMood mark.
 *
 * It is the artwork itself with its navy background lifted off, not a redraw:
 * the low-poly faces are what the mark is, and a traced silhouette loses them.
 * The file is the mark alone on transparency, so it sits on the light theme and
 * the dark one without a plate behind it, and it prints.
 *
 * Served at 192px and drawn at 22–48px in the chrome, which covers a 2× screen
 * without asking the browser for a second file. /logo.png is the 512px square
 * for a link preview or anywhere a large flat image is wanted.
 */
export function LogoMark({
  size = 26,
  className,
  alt = '',
}: {
  size?: number;
  className?: string;
  /** Empty by default: the mark almost always sits beside the word TechMood. */
  alt?: string;
}) {
  return (
    <Image
      className={className ? `logo-mark ${className}` : 'logo-mark'}
      src="/logo-mark.png"
      width={size}
      height={size}
      alt={alt}
      priority
    />
  );
}

/** The mark with the name beside it, as the navs and the auth pages use it. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <>
      <LogoMark size={size} />
      TechMood
    </>
  );
}
