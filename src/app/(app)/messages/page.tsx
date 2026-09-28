import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import type { ConversationKind, MessageReaction } from '@/lib/database.types';

import { Composer } from './Composer';
import { Reactions } from './Reactions';
import { markRead } from './actions';

const KIND_ICON: Record<ConversationKind, string> = {
  channel: '📣',
  admin: '🛡️',
  team: '👥',
  mentor_booking: '🎓',
  market: '🤝',
  learning_path: '📚',
};

const KIND_LABEL: Record<ConversationKind, Text> = {
  channel:        { ar: 'قناة TechMood',  en: 'TechMood channel' },
  admin:          { ar: 'إدارة TechMood', en: 'TechMood team' },
  team:           { ar: 'فريق',           en: 'Team' },
  mentor_booking: { ar: 'منتور (مغلقة)',  en: 'Mentor (closed)' },
  market:         { ar: 'سوق (مغلقة)',    en: 'Market (closed)' },
  learning_path:  { ar: 'مسار تعلّم',     en: 'Learning path' },
};

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
      <section className="section-block">
        <h2 style={{ fontSize: '1.2rem' }}>{t('الرسائل', 'Messages')}</h2>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          {t('قناة TechMood، ومحادثتك مع الإدارة، وفرقك، والمسارات التي التحقت بها. لا محادثات خاصة بين طرفين بينهما دفع — الجلسات والأعمال لها صفحاتها وسجلها. بلا روابط ولا ملفات.',
             'The TechMood channel, your thread with the team, your teams and the paths you joined. No private chats between two parties money passes between — sessions and work have their own pages and record. No links, no files.')}
        </p>
      </section>

      {ordered.length === 0 ? (
        <p className="notice">
          {t('لا محادثات بعد. تُفتح المحادثة تلقائياً عند انضمامك لفريق أو التحاقك بمسار.', 'No conversations yet. One opens by itself when you join a team or a path.')}
        </p>
      ) : (
        <div className="chat-shell">
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
                  <div className="ci-top">
                    <span className="ci-name">
                      {KIND_ICON[conversation.kind]} {conversation.title_ar ?? t(KIND_LABEL[conversation.kind])}
                    </span>
                    {count > 0 && conversation.id !== activeId && (
                      <span className="unread-dot eng">{count}</span>
                    )}
                  </div>
                  <span className="ci-last">{last?.body_ar ?? t('لا رسائل بعد', 'No messages yet')}</span>
                </Link>
              );
            })}
          </nav>

          <section className="chat-main">
            {active && (
              <>
                <header className="chat-head">
                  <div className="row-between">
                    <strong style={{ fontSize: '0.95rem' }}>
                      {KIND_ICON[active.kind]} {active.title_ar ?? t(KIND_LABEL[active.kind])}
                    </strong>
                    <span className="badge-pill">{t(KIND_LABEL[active.kind])}</span>
                  </div>
                  {active.team_id && (
                    <Link
                      className="muted"
                      style={{ fontSize: '0.78rem' }}
                      href={`/teams/${active.team_id}`}
                    >
                      {t('افتح مساحة عمل الفريق ↗', 'Open the team workspace ↗')}
                    </Link>
                  )}
                  {active.booking_id && (
                    <Link
                      className="muted"
                      style={{ fontSize: '0.78rem' }}
                      href={`/bookings/${active.booking_id}`}
                    >
                      {t('تفاصيل الجلسة ↗', 'Session details ↗')}
                    </Link>
                  )}
                  {room && (
                    <Link
                      className="muted"
                      style={{ fontSize: '0.78rem' }}
                      href={`/sessions/${room}`}
                    >
                      {t('غرفة الجلسة ↗', 'The session room ↗')}
                    </Link>
                  )}
                </header>

                <div className="chat-thread">
                  {messages.length === 0 && (
                    <p className="muted" style={{ fontSize: '0.86rem', margin: 'auto' }}>
                      {t('لا رسائل بعد — ابدأ الحديث.', 'No messages yet — start the conversation.')}
                    </p>
                  )}

                  {messages.map((message) => {
                    if (message.is_system) {
                      return (
                        <div className="bubble system" key={message.id}>
                          {message.body_ar}
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
                      <div className="bubble-row" key={message.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div className={`bubble ${mine ? 'me' : 'them'}`}>
                          {message.reply_to_id && bodyById.has(message.reply_to_id) && (
                            <span className="b-reply">{bodyById.get(message.reply_to_id)}</span>
                          )}
                          {!mine && (
                            <span className="b-meta" style={{ marginTop: 0, marginBottom: 4 }}>
                              {isChannel ? 'TechMood' : nameById.get(message.sender_id ?? '') ?? t('عضو', 'A member')}
                            </span>
                          )}
                          {isChannel ? withLinks(message.body_ar) : message.body_ar}
                          <span className="b-meta eng">
                            {new Date(message.created_at).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <Reactions messageId={message.id} counts={counts} mine={myReaction} />
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
