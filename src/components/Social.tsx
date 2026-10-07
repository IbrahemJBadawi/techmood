'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { toggleFollow, toggleProjectLike } from '@/app/actions/social';
import { showSnack } from '@/components/Snackbar';

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

  // `offerUndo` is false for the undo itself, so undoing never offers to undo again.
  function run(next: boolean, offerUndo: boolean) {
    setError('');
    setOn(next);
    setCount((value) => value + (next ? 1 : -1));
    start(async () => {
      const result = await toggleFollow(profileId, path);
      if (result.error) {
        setOn(!next);
        setCount((value) => value + (next ? -1 : 1));
        setError(result.error);
        return;
      }
      if (result.on !== next) setOn(result.on);
      if (offerUndo) {
        showSnack({
          text: result.on
            ? t('تابعته — سترى تقدّمه في رئيستك', 'Following — you will see their progress on your home')
            : t('ألغيت المتابعة', 'Unfollowed'),
          onAction: () => run(!result.on, false),
        });
      }
    });
  }
  const toggle = () => run(!on, true);

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={`btn btn-sm ${on ? 'btn-ghost' : 'btn-primary'}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={on} aria-busy={pending}>
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

  const [burst, setBurst] = useState(0);
  const label = t(`${count} إعجاب`, `${count} ${count === 1 ? 'like' : 'likes'}`);
  const heart = (filled: boolean) => (
    <svg className="like-heart" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
         fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.4 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.6 3.4 4.3 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z" />
    </svg>
  );

  if (!canLike) {
    return <span className="like-btn is-static" title={label}>{heart(count > 0)}<span className="eng">{count}</span></span>;
  }

  if (!signedIn) {
    return (
      <Link className="like-btn" href={`/login?next=${encodeURIComponent(path)}`} aria-label={t('سجّل الدخول لتعجب بالمشروع', 'Sign in to like this project')}>
        {heart(false)}<span className="eng">{count}</span>
      </Link>
    );
  }

  function run(next: boolean, offerUndo: boolean) {
    setError('');
    setOn(next);
    if (next) setBurst((value) => value + 1);
    setCount((value) => value + (next ? 1 : -1));
    start(async () => {
      const result = await toggleProjectLike(projectId, path);
      if (result.error) {
        setOn(!next);
        setCount((value) => value + (next ? -1 : 1));
        setError(result.error);
        return;
      }
      if (result.on !== next) setOn(result.on);
      // A like needs no confirmation; taking one back is offered an undo.
      if (offerUndo && !result.on) {
        showSnack({ text: t('أزلت إعجابك', 'Like removed'), onAction: () => run(true, false) });
      }
    });
  }
  const toggle = () => run(!on, true);

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        className={`like-btn${on ? ' is-on' : ''}`}
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        aria-label={`${on ? t('إلغاء الإعجاب', 'Unlike') : t('أعجبني', 'Like')} — ${label}`} aria-busy={pending}>
        <span className="like-icon" key={burst}>{heart(on)}</span>
        <span className="eng">{count}</span>
        <span className="like-word">{on ? t('أعجبك', 'Liked') : t('أعجبني', 'Like')}</span>
      </button>
      {error && <span className="muted" style={{ fontSize: '0.76rem' }}>{error}</span>}
    </span>
  );
}
