import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import type { ConversationKind, MessageReaction } from '@/lib/database.types';
import { IS_MVP } from '@/lib/scope';

import { Composer } from './Composer';
import { Reactions } from './Reactions';
import { markRead } from './actions';

export const generateMetadata = localizedTitle('الرسائل — TechMood', 'Messages — TechMood');

const KIND_ICON: Record<ConversationKind, string> = {
  channel: '📣',
  admin: '🛡️',
  team: '👥',
  mentor_booking: '🎓',
  market: '🤝',
  learning_path: '📚',
};

/** Each kind of conversation has its own colour in the list, as Telegram gives each chat one. */
const KIND_COLOR: Record<ConversationKind, string> = {
  channel: '#006BE0',
  admin: '#0E9F6E',
  team: '#7C5CFF',
  mentor_booking: '#E8590C',
  market: '#C77700',
  learning_path: '#0B8FB3',
};

const KIND_LABEL: Record<ConversationKind, Text> = {
  channel:        { ar: 'قناة TechMood',  en: 'TechMood channel' },
  admin:          { ar: 'إدارة TechMood', en: 'TechMood team' },
  team:           { ar: 'فريق',           en: 'Team' },
  mentor_booking: { ar: 'منتور (مغلقة)',  en: 'Mentor (closed)' },
  market:         { ar: 'سوق (مغلقة)',    en: 'Market (closed)' },
  learning_path:  { ar: 'مسار تعلّم',     en: 'Learning path' },
};

/** "Today", "Yesterday", or the date — the separators between days in a thread. */
function dayLabel(iso: string, locale: 'ar' | 'en') {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(day, today)) return locale === 'ar' ? 'اليوم' : 'Today';
  if (same(day, yesterday)) return locale === 'ar' ? 'أمس' : 'Yesterday';
  return day.toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' });
}

function timeLabel(iso: string, locale: 'ar' | 'en') {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Channel posts are TechMood's own, so their links open; nobody else's do. */
function withLinks(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part)
      ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="eng">{part}</a>
      : part,
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const t = await getT();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // A conversation exists only because a relationship does; there is no way to
  // start one from here, by design.
  const { data: myParticipations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', user.id);

  const conversationIds = (myParticipations ?? []).map((row) => row.conversation_id);
  const placeholder = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: conversations }, { data: unread }, { data: isAdmin }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, kind, title_ar, team_id, booking_id, path_id, is_read_only, archived_at')
      .in('id', conversationIds.length ? conversationIds : placeholder),
    supabase
      .from('conversation_unread')
      .select('conversation_id, unread_count, last_message_at')
      .eq('profile_id', user.id),
    supabase.rpc('is_admin'),
  ]);

  const unreadById = new Map((unread ?? []).map((row) => [row.conversation_id, row]));

  // The channel stays on top, like a pinned chat; the rest by latest message.
  const ordered = [...(conversations ?? [])].sort((a, b) => {
    if ((a.kind === 'channel') !== (b.kind === 'channel')) return a.kind === 'channel' ? -1 : 1;
    const aTime = unreadById.get(a.id)?.last_message_at ?? '';
    const bTime = unreadById.get(b.id)?.last_message_at ?? '';
    return bTime.localeCompare(aTime);
  });

  const activeId = c && conversationIds.includes(c) ? c : ordered[0]?.id;
  const active = ordered.find((row) => row.id === activeId);

  // A booking conversation leads to the room that booking opened, not to a
  // link — the same door, reached from wherever the two of them are talking.
  const { data: bookingRoom } = active?.booking_id
    ? await supabase.from('video_sessions').select('id').eq('booking_id', active.booking_id).maybeSingle()
    : { data: null };
  const room = bookingRoom?.id ?? null;

  // Last line of each conversation, for the list.
  const { data: recent } = await supabase
    .from('messages')
    .select('conversation_id, body_ar, created_at')
    .in('conversation_id', conversationIds.length ? conversationIds : placeholder)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  const lastByConversation = new Map<string, { body_ar: string; created_at: string }>();
  for (const row of recent ?? []) {
    if (!lastByConversation.has(row.conversation_id)) {
      lastByConversation.set(row.conversation_id, { body_ar: row.body_ar, created_at: row.created_at });
    }
  }

  let messages: {
    id: string; sender_id: string | null; body_ar: string; is_system: boolean;
    reply_to_id: string | null; created_at: string;
  }[] = [];
  let reactions: { message_id: string; profile_id: string; reaction: MessageReaction }[] = [];
  let nameById = new Map<string, string>();

  if (active) {
    const { data: thread } = await supabase
      .from('messages')
      .select('id, sender_id, body_ar, is_system, reply_to_id, created_at')
      .eq('conversation_id', active.id)
      .is('deleted_at', null)
      .order('created_at');

    messages = thread ?? [];

    const messageIds = messages.map((row) => row.id);
    const senderIds = [...new Set(messages.map((row) => row.sender_id).filter(Boolean))] as string[];

    const [{ data: reactionRows }, { data: profiles }] = await Promise.all([
      supabase
        .from('message_reactions')
        .select('message_id, profile_id, reaction')
        .in('message_id', messageIds.length ? messageIds : placeholder),
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds.length ? senderIds : placeholder),
    ]);

    reactions = (reactionRows ?? []) as typeof reactions;
    nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));

    await markRead(active.id);
  }

  const bodyById = new Map(messages.map((row) => [row.id, row.body_ar]));
  const isChannel = active?.kind === 'channel';
  const readOnly = Boolean(active?.is_read_only || active?.archived_at || (isChannel && isAdmin !== true));
  const readOnlyNote = isChannel
    ? t('قناة TechMood للقراءة: أخبار المنصة والفعاليات والتنبيهات المهمة. للتواصل مع الإدارة استخدم محادثة «إدارة TechMood» أو الدعم.',
        'The TechMood channel is read-only: platform news, events and important notices. To reach the team, use the «TechMood team» thread or Support.')
    : active?.kind === 'mentor_booking' || active?.kind === 'market'
      ? t('أُغلقت: لا محادثات خاصة بين طرفين بينهما دفع. التفاصيل في صفحة الحجز أو المشروع، ولأي مشكلة افتح تذكرة دعم.',
          'Closed: no private chats between two parties money passes between. Details are on the booking or project page; for any problem, open a support ticket.')
      : undefined;

  return (
    <>
      <section className={`section-block chat-intro${c ? ' has-active' : ''}`}>
        <h2 style={{ fontSize: '1.2rem' }}>{t('الرسائل', 'Messages')}</h2>
        <p className="muted" style={{ fontSize: '0.84rem', marginTop: 4 }}>
          {t('قناة TechMood، والإدارة، وفرقك، ومساراتك. لا محادثات خاصة بين طرفين بينهما دفع.',
             'The TechMood channel, the team, your teams and your paths. No private chats between two parties money passes between.')}
        </p>
      </section>

      {ordered.length === 0 ? (
        <p className="notice">
          {t('لا محادثات بعد. تُفتح المحادثة تلقائياً عند انضمامك لفريق أو التحاقك بمسار.', 'No conversations yet. One opens by itself when you join a team or a path.')}
        </p>
      ) : (
        <div className={`chat-shell${c ? ' has-active' : ''}`}>
          <nav className="chat-list">
            {ordered.map((conversation) => {
              const last = lastByConversation.get(conversation.id);
              const count = unreadById.get(conversation.id)?.unread_count ?? 0;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages?c=${conversation.id}`}
                  className={`chat-item${conversation.id === activeId ? ' active' : ''}`}
                >
                  <span className="ci-avatar" style={{ background: KIND_COLOR[conversation.kind] }} aria-hidden="true">
                    {KIND_ICON[conversation.kind]}
                  </span>
                  <span className="ci-body">
                    <span className="ci-top">
                      <span className="ci-name">{conversation.title_ar ?? t(KIND_LABEL[conversation.kind])}</span>
                      {last && <time className="ci-time">{timeLabel(last.created_at, t.locale)}</time>}
                    </span>
                    <span className="ci-bottom">
                      <span className="ci-last">{last?.body_ar ?? t('لا رسائل بعد', 'No messages yet')}</span>
                      {count > 0 && conversation.id !== activeId && (
                        <span className="unread-dot eng">{count}</span>
                      )}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <section className="chat-main">
            {active && (
              <>
                <header className="chat-head">
                  <Link className="icon-button chat-back" href="/messages" aria-label={t('كل المحادثات', 'All conversations')}>
                    <Icon name="arrow" size={20} />
                  </Link>
                  <span className="ci-avatar" style={{ background: KIND_COLOR[active.kind] }} aria-hidden="true">
                    {KIND_ICON[active.kind]}
                  </span>
                  <span className="chat-head-text">
                    <strong>{active.title_ar ?? t(KIND_LABEL[active.kind])}</strong>
                    <span className="muted">{t(KIND_LABEL[active.kind])}</span>
                  </span>
                  <span className="chat-head-links">
                    {active.team_id && (
                      <Link className="btn btn-ghost btn-sm" href={`/teams/${active.team_id}`}>{t('مساحة الفريق', 'Team space')}</Link>
                    )}
                    {active.booking_id && (
                      <Link className="btn btn-ghost btn-sm" href={`/bookings/${active.booking_id}`}>{t('الجلسة', 'Session')}</Link>
                    )}
                    {!IS_MVP && room && (
                      <Link className="btn btn-ghost btn-sm" href={`/sessions/${room}`}>{t('الغرفة', 'Room')}</Link>
                    )}
                  </span>
                </header>

                <div className="chat-thread">
                  {messages.length === 0 && (
                    <p className="muted" style={{ fontSize: '0.86rem', margin: 'auto' }}>
                      {t('لا رسائل بعد — ابدأ الحديث.', 'No messages yet — start the conversation.')}
                    </p>
                  )}

                  {messages.map((message, index) => {
                    const day = dayLabel(message.created_at, t.locale);
                    const newDay = index === 0 || dayLabel(messages[index - 1].created_at, t.locale) !== day;
                    const separator = newDay ? <div className="chat-day" key={`d-${message.id}`}><span>{day}</span></div> : null;
                    if (message.is_system) {
                      return (
                        <div key={message.id} style={{ display: 'contents' }}>
                          {separator}
                          <div className="bubble system">{message.body_ar}</div>
                        </div>
                      );
                    }

                    const mine = message.sender_id === user.id;
                    const messageReactions = reactions.filter((row) => row.message_id === message.id);
                    const counts: Partial<Record<MessageReaction, number>> = {};
                    for (const row of messageReactions) {
                      counts[row.reaction] = (counts[row.reaction] ?? 0) + 1;
                    }
                    const myReaction =
                      messageReactions.find((row) => row.profile_id === user.id)?.reaction ?? null;

                    return (
                      <div key={message.id} style={{ display: 'contents' }}>
                      {separator}
                      <div className="bubble-row" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div className={`bubble ${mine ? 'me' : 'them'}`}>
                          {message.reply_to_id && bodyById.has(message.reply_to_id) && (
                            <span className="b-reply">{bodyById.get(message.reply_to_id)}</span>
                          )}
                          {!mine && (
                            <span className="b-author" style={{ color: `color-mix(in srgb, ${KIND_COLOR[active.kind]} 70%, var(--ink))` }}>
                              {isChannel ? 'TechMood' : nameById.get(message.sender_id ?? '') ?? t('عضو', 'A member')}
                            </span>
                          )}
                          {isChannel ? withLinks(message.body_ar) : message.body_ar}
                          <span className="b-meta">{timeLabel(message.created_at, t.locale)}</span>
                        </div>

                        <Reactions messageId={message.id} counts={counts} mine={myReaction} />
                      </div>
                      </div>
                    );
                  })}
                </div>

                <Composer conversationId={active.id} readOnly={readOnly} note={readOnlyNote} />
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
