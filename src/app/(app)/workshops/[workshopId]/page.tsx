import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AiText } from '@/components/AiText';
import { BackLink } from '@/components/BackLink';
import { ConfirmSubmit } from '@/components/ConfirmDialog';
import { Countdown } from '@/components/Countdown';
import { MemberAvatar } from '@/components/MemberAvatar';
import { ShareButton } from '@/components/ShareButton';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import { videoEmbed } from '@/lib/showcase';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { cancelWorkshop, toggleRegistration } from '../actions';

export const generateMetadata = localizedTitle('ورشة — TechMood', 'Workshop — TechMood');

/**
 * One workshop. Before it: the time left and a seat to take. While it runs:
 * the stream, inside the page when it is YouTube. After it: the recording.
 */
export default async function WorkshopPage({ params }: { params: Promise<{ workshopId: string }> }) {
  const t = await getT();
  const { workshopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.rpc('workshop_detail', { p_id: workshopId });
  const w = data?.[0];
  if (!w) notFound();

  const starts = new Date(w.starts_at);
  const ends = new Date(starts.getTime() + w.duration_minutes * 60_000);
  const now = new Date();
  const over = ends < now;
  const notYet = starts > now && !w.is_live;
  const full = w.capacity !== null && w.registered >= w.capacity && !w.is_registered;
  const embed = videoEmbed(w.live_url);
  const recording = videoEmbed(w.recording_url);
  const when = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, dateStyle: 'full', timeStyle: 'short' });

  return (
    <>
      <BackLink href="/workshops" label={t('ورش العمل', 'Workshops')} />

      <section className="section-block ws-detail">
        {w.is_live && <span className="ws-live">● {t('مباشر الآن', 'Live now')}</span>}
        {w.status === 'cancelled' && <p className="notice notice-danger">{t('أُلغيت هذه الورشة.', 'This workshop was cancelled.')}</p>}
        <h2 style={{ fontSize: '1.35rem' }}>{w.title}</h2>
        <p className="muted">{when.format(starts)} · {t(`${w.duration_minutes} دقيقة`, `${w.duration_minutes} min`)}</p>
        <p className="ws-host">
          <MemberAvatar id={w.host_id} name={w.host_name} url={w.host_avatar} size={28} />
          {t('يقدّمها ', 'Hosted by ')}<strong>{w.host_name}</strong>
        </p>

        {/* the stage: live, or the recording, or what is coming */}
        {w.status === 'scheduled' && w.is_live && w.live_url && (
          embed
            ? <div className="lp-stage ws-stage"><iframe src={`${embed}?autoplay=1`} title={w.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            : <a className="btn btn-primary ws-join" href={w.live_url} target="_blank" rel="noopener noreferrer">🔴 {t('ادخل البث المباشر', 'Join the live stream')}</a>
        )}
        {w.status === 'scheduled' && w.is_live && !w.live_url && !w.is_registered && (
          <p className="notice">{t('البث للمسجّلين — سجّل لتشاهده الآن.', 'The stream is for registered people — register to watch now.')}</p>
        )}
        {over && w.recording_url && (
          recording
            ? <div className="lp-stage ws-stage"><iframe src={recording} title={w.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            : <a className="btn btn-ghost" href={w.recording_url} target="_blank" rel="noopener noreferrer">▶ {t('شاهد التسجيل', 'Watch the recording')}</a>
        )}
        {w.status === 'scheduled' && notYet && <div className="ws-countdown"><Countdown endsAt={w.starts_at} label={t('تبدأ الورشة بعد', 'Starts in')} overLabel={t('بدأت الورشة — حدّث الصفحة', 'It has started — refresh the page')} /></div>}

        <div className="row-actions">
          {w.status === 'scheduled' && !over && (
            <form action={toggleRegistration}>
              <input type="hidden" name="id" value={w.id} />
              <input type="hidden" name="register" value={w.is_registered ? '0' : '1'} />
              <button className={`btn ${w.is_registered ? 'btn-ghost' : 'btn-primary'}`} disabled={full}>
                {w.is_registered ? t('ألغِ تسجيلي', 'Cancel my seat') : full ? t('اكتملت المقاعد', 'No seats left') : t('سجّل في الورشة', 'Register')}
              </button>
            </form>
          )}
          <span className="muted" style={{ fontSize: '0.84rem' }}>
            {w.capacity !== null ? t(`${w.registered} من ${w.capacity} مقعد`, `${w.registered} of ${w.capacity} seats`) : t(`${w.registered} مسجّل`, `${w.registered} registered`)}
          </span>
          <ShareButton path={`/workshops/${w.id}`} title={w.title} />
        </div>
        {w.is_registered && notYet && (
          <p className="muted" style={{ fontSize: '0.82rem' }}>{t('✓ أنت مسجّل. يصلك تذكير قبل البدء بنصف ساعة، ويظهر البث هنا حين يبدأ.', '✓ You are in. A reminder comes half an hour before, and the stream shows here when it starts.')}</p>
        )}
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem', marginBottom: 8 }}>{t('عن الورشة', 'About the workshop')}</h3>
        <AiText text={w.description} />
      </section>

      {w.can_edit && w.status === 'scheduled' && (
        <section className="section-block row-actions">
          <Link className="btn btn-ghost btn-sm" href={`/workshops/${w.id}/edit`}>{t('عدّل الورشة', 'Edit')}</Link>
          <form action={cancelWorkshop}>
            <input type="hidden" name="id" value={w.id} />
            <ConfirmSubmit className="btn btn-ghost btn-sm" message={t('إلغاء الورشة؟ يُبلَّغ كل المسجّلين.', 'Cancel the workshop? Everyone registered is told.')} confirmLabel={t('ألغِ الورشة', 'Cancel it')}>
              {t('ألغِ الورشة', 'Cancel the workshop')}
            </ConfirmSubmit>
          </form>
        </section>
      )}
    </>
  );
}
