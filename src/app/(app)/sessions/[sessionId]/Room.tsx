'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useT } from '@/lib/i18n.client';
import type { SessionRole } from '@/lib/database.types';
import type { Text } from '@/lib/i18n';

import { joinSession, leaveSession } from './actions';

export type RoomParticipant = {
  profile_id: string;
  full_name: string;
  role: SessionRole;
  is_present: boolean;
  minutes: number;
};

const ROLE_LABEL: Record<SessionRole, Text> = {
  mentor:  { ar: 'منتور',      en: 'Mentor' },
  student: { ar: 'متعلّم',     en: 'Learner' },
  member:  { ar: 'عضو',        en: 'Member' },
  leader:  { ar: 'قائد الفريق', en: 'Team lead' },
  client:  { ar: 'العميل',      en: 'Client' },
  contractor: { ar: 'المنفّذ',  en: 'Contractor' },
};

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The room.
 *
 * Three things here are real and come from the server: who may be in the room,
 * whether the door is open, and who actually turned up. The timer is anchored
 * to the server's clock — the browser's is only used to count forward from the
 * moment the page was rendered, so moving the machine's clock changes nothing.
 *
 * The camera and microphone are the browser's own: the preview below is this
 * person's real devices, and the toggles really turn the tracks off. What is
 * not connected is the media path *between* participants — there is no
 * signalling server and no SFU in this deployment yet — so the other tiles show
 * presence rather than video, and say so instead of pretending.
 */
export function Room({
  sessionId,
  sessionCode,
  startAt,
  endAt,
  serverNow,
  meId,
  participants,
}: {
  sessionId: string;
  sessionCode: string;
  startAt: string;
  endAt: string;
  serverNow: string;
  meId: string;
  participants: RoomParticipant[];
}) {
  const t = useT();
  const router = useRouter();

  // How far this browser's clock is from the server's, measured once. Every
  // time shown afterwards is the browser's clock minus this difference.
  const [skew] = useState(() => Date.now() - new Date(serverNow).getTime());
  const [now, setNow] = useState(() => Date.now());

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const joined = useRef(false);
  const closed = useRef(false);

  const serverTime = now - skew;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const live = serverTime >= start;

  // The join is written on the server, once, and the leave when this page goes
  // away — a reconnect is simply another pair of lines in the log.
  useEffect(() => {
    if (!joined.current) {
      joined.current = true;
      joinSession(sessionId).then((state) => {
        if (state?.error) setJoinError(state.error);
      });
    }
    return () => { void leaveSession(sessionId); };
  }, [sessionId]);

  // Camera and microphone, for real.
  useEffect(() => {
    let cancelled = false;
    let opened: MediaStream | null = null;

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((media) => {
        opened = media;
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        setStream(media);
      })
      .catch(() => {
        if (!cancelled) setMediaError('denied');
      });

    return () => {
      cancelled = true;
      opened?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // One second at a time: the countdown, and the moment the hour is up.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Presence is the server's answer, so ask it again now and then rather than
  // guessing from this browser.
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [router]);

  // When the session's own time runs out the page becomes the summary. The
  // server decides that too — this only asks it to re-render.
  useEffect(() => {
    if (serverTime < end || closed.current) return;
    closed.current = true;
    router.refresh();
  }, [serverTime, end, router]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = screen ?? stream;
  }, [screen, stream]);

  const toggleMic = () => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const shareScreen = async () => {
    if (screen) {
      screen.getTracks().forEach((track) => track.stop());
      setScreen(null);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      display.getVideoTracks()[0]?.addEventListener('ended', () => setScreen(null));
      setScreen(display);
    } catch {
      /* the person closed the picker; nothing to report */
    }
  };

  const leave = async () => {
    setLeaving(true);
    stream?.getTracks().forEach((track) => track.stop());
    screen?.getTracks().forEach((track) => track.stop());
    await leaveSession(sessionId);
    router.push('/sessions');
  };

  const others = participants.filter((person) => person.profile_id !== meId);

  return (
    <section className="call-room">
      <header className="call-head">
        <div>
          <p className="kicker">{sessionCode}</p>
          <h2 style={{ fontSize: '1.05rem', margin: '4px 0 0' }}>
            {live ? t('الجلسة جارية', 'The session is running') : t('غرفة الانتظار', 'Lobby')}
          </h2>
        </div>
        <div className="call-clock">
          <span className="status-pill status-ok">
            {live
              ? t('ينتهي بعد', 'Ends in') + ' ' + clock(end - serverTime)
              : t('يبدأ بعد', 'Starts in') + ' ' + clock(start - serverTime)}
          </span>
          <span className="muted" style={{ fontSize: '0.74rem' }}>
            {t('بتوقيت الخادم', 'On the server’s clock')}
          </span>
        </div>
      </header>

      {joinError && <p className="notice notice-danger">{joinError}</p>}

      <div className="call-grid">
        <figure className="call-tile call-tile-me">
          <video ref={videoRef} autoPlay playsInline muted />
          {!stream && (
            <figcaption className="call-tile-note">
              {mediaError
                ? t('لا يوجد إذن للكاميرا أو الميكروفون في هذا المتصفح.',
                     'This browser has not given access to the camera or microphone.')
                : t('جارٍ فتح الكاميرا…', 'Opening the camera…')}
            </figcaption>
          )}
          <figcaption className="call-tile-name">
            {t('أنت', 'You')}
            {screen && ' · ' + t('تشارك شاشتك', 'sharing your screen')}
            {!camOn && ' · ' + t('الكاميرا مغلقة', 'camera off')}
            {!micOn && ' · ' + t('الميكروفون مغلق', 'mic off')}
          </figcaption>
        </figure>

        {others.map((person) => (
          <figure className="call-tile" key={person.profile_id}>
            <div className="call-tile-avatar">{person.full_name.slice(0, 1)}</div>
            <figcaption className="call-tile-name">
              {person.full_name}
              {' · '}
              {t(ROLE_LABEL[person.role])}
              {' · '}
              {person.is_present
                ? t('في الغرفة', 'in the room')
                : t('لم ينضم بعد', 'not in yet')}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="call-controls">
        <button type="button" className={`call-btn ${micOn ? '' : 'call-btn-off'}`}
                onClick={toggleMic} disabled={!stream}
                aria-pressed={micOn} title={t('الميكروفون', 'Microphone')}>
          🎤
        </button>
        <button type="button" className={`call-btn ${camOn ? '' : 'call-btn-off'}`}
                onClick={toggleCam} disabled={!stream}
                aria-pressed={camOn} title={t('الكاميرا', 'Camera')}>
          📷
        </button>
        <button type="button" className={`call-btn ${screen ? 'call-btn-on' : ''}`}
                onClick={shareScreen} title={t('مشاركة الشاشة', 'Share screen')}>
          🖥️
        </button>
        <button type="button" className="call-btn call-btn-leave"
                onClick={leave} disabled={leaving} title={t('مغادرة', 'Leave')}>
          📞
        </button>
      </div>

      <p className="muted call-foot">
        {t('المغادرة لا تُلغي الحجز ولا تُنهي الجلسة — تستطيع العودة ما دامت جارية، والحضور يُحتسب من سجلّ الدخول والخروج.',
           'Leaving does not cancel the booking and does not end the session — you can come back while it runs, and attendance is counted from the log of entries and exits.')}
      </p>

      <p className="notice">
        {t('ملاحظة تقنية: صوتك وصورتك يعملان من متصفحك، لكن مسار الوسائط بين المشاركين (WebRTC/SFU) غير موصول في هذه النسخة — لذلك تظهر بطاقات الآخرين بحضورهم لا بفيديوهم.',
           'A technical note: your own camera and microphone are real, but the media path between participants (WebRTC/SFU) is not connected in this build — so the other tiles show presence rather than video.')}
      </p>
    </section>
  );
}
