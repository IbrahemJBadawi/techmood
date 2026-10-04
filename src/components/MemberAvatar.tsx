import { avatarColor, initialOf } from '@/lib/mentor-look';

/**
 * A member's photo wherever a member is shown; their initial on their own
 * colour when they have not added one. Works in server and client components.
 */
export function MemberAvatar({
  id, name, url, size = 40, className = '',
}: { id: string; name: string | null | undefined; url: string | null | undefined; size?: number; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`member-avatar ${className}`} src={url} alt="" width={size} height={size} loading="lazy"
           style={{ width: size, height: size }} />
    );
  }
  return (
    <span className={`member-avatar is-initial ${className}`} aria-hidden="true"
          style={{ width: size, height: size, fontSize: size / 2.4, background: avatarColor(id) }}>
      {initialOf(name ?? '')}
    </span>
  );
}
