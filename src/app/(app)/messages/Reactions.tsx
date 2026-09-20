'use client';

import { useState } from 'react';

import type { MessageReaction } from '@/lib/database.types';

import { toggleReaction } from './actions';

const EMOJI: Record<MessageReaction, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  thanks: '🙏',
  celebrate: '🎉',
};

export function Reactions({
  messageId,
  counts,
  mine,
}: {
  messageId: string;
  counts: Partial<Record<MessageReaction, number>>;
  mine: MessageReaction | null;
}) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(counts) as [MessageReaction, number][];

  return (
    <div className="reaction-row">
      {entries.map(([reaction, count]) => (
        <form action={toggleReaction} key={reaction}>
          <input type="hidden" name="message_id" value={messageId} />
          <input type="hidden" name="reaction" value={reaction} />
          <input type="hidden" name="existing" value={mine ?? ''} />
          <button className={`reaction-chip${mine === reaction ? ' mine' : ''}`} title={reaction}>
            {EMOJI[reaction]} {count}
          </button>
        </form>
      ))}

      {open ? (
        (Object.keys(EMOJI) as MessageReaction[]).map((reaction) => (
          <form action={toggleReaction} key={reaction}>
            <input type="hidden" name="message_id" value={messageId} />
            <input type="hidden" name="reaction" value={reaction} />
            <input type="hidden" name="existing" value={mine ?? ''} />
            <button className="reaction-chip" onClick={() => setOpen(false)}>{EMOJI[reaction]}</button>
          </form>
        ))
      ) : (
        <button type="button" className="reaction-chip" onClick={() => setOpen(true)} aria-label="أضف تفاعلاً">
          ＋
        </button>
      )}
    </div>
  );
}
