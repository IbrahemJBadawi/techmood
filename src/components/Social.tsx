'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { toggleFollow, toggleProjectLike } from '@/app/actions/social';

/**
 * Follow a member. Signed-out visitors see the count and a way in; the count
 * moves at once and settles on what the database answers.
 */
export function FollowButton({
  profileId,
  followers,
  following,
  signedIn,
  path,
}: {
  profileId: string;
  followers: number;
  following: boolean;
  signedIn: boolean;
  path: string;
}) {
  const t = useT();
  const [on, setOn] = useState(following);
  const [count, setCount] = useState(followers);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const label = t(`${count} متابِع`, `${count} ${count === 1 ? 'follower' : 'followers'}`);

  if (!signedIn) {
    return (
      <Link className="btn btn-ghost btn-sm" href={`/login?next=${encodeURIComponent(path)}`}>
        {t("تابِع", "Follow")} · <span>{label}</span>
      </Link>
    );
  }

  function toggle() {
    setError('');
    const next = !on;
    setOn(next);
    setCount((value) => value + (next ? 1 : -1));
    start(async () => {
      const result = await toggleFollow(profileId, path);
      if (result.error) {
        setOn(!next);
        setCount((value) => value + (next ? -1 : 1));
        setError(result.error);
      } else if (result.on !== next) {
        setOn(result.on);
      }
    });
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={`btn btn-sm ${on ? 'btn-ghost' : 'btn-primary'}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
      >
        {on ? t("تتابعه", "Following") : t("تابِع", "Follow")} · <span>{label}</span>
      </button>
      {error && <span className="muted" style={{ fontSize: '0.76rem' }}>{error}</span>}
    </span>
  );
}

/** Like somebody else's project. The owner and the team see the count, not a button. */
export function LikeButton({
  projectId,
  likes,
  liked,
  canLike,
  signedIn,
  path,
}: {
  projectId: string;
  likes: number;
  liked: boolean;
  canLike: boolean;
  signedIn: boolean;
  path: string;
}) {
  const t = useT();
  const [on, setOn] = useState(liked);
  const [count, setCount] = useState(likes);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const label = t(`${count} إعجاب`, `${count} ${count === 1 ? 'like' : 'likes'}`);

  if (!canLike) {
    return <span className="badge-pill">♥ <span>{label}</span></span>;
  }

  if (!signedIn) {
    return (
      <Link className="btn btn-ghost btn-sm" href={`/login?next=${encodeURIComponent(path)}`}>
        ♡ <span>{label}</span>
      </Link>
    );
  }

  function toggle() {
    setError('');
    const next = !on;
    setOn(next);
    setCount((value) => value + (next ? 1 : -1));
    start(async () => {
      const result = await toggleProjectLike(projectId, path);
      if (result.error) {
        setOn(!next);
        setCount((value) => value + (next ? -1 : 1));
        setError(result.error);
      } else if (result.on !== next) {
        setOn(result.on);
      }
    });
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={`btn btn-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? t('إلغاء الإعجاب', 'Unlike') : t('أعجبني', 'Like')}
      >
        {on ? "♥" : "♡"} <span>{label}</span>
      </button>
      {error && <span className="muted" style={{ fontSize: '0.76rem' }}>{error}</span>}
    </span>
  );
}
