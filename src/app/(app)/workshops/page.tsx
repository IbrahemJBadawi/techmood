import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MemberAvatar } from '@/components/MemberAvatar';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';
import type { WorkshopRow } from '@/lib/database.types';
import { PLATFORM_TIME_ZONE } from '@/lib/zoned';

import { toggleRegistration } from './actions';

export const generateMetadata = localizedTitle('ورش العمل — TechMood', 'Workshops — TechMood');

/**
 * Workshops (design lab 4: «مع بث مباشر»): what is live now on top, then what
 * is coming with a seat to take, and past ones with their recordings.
 */
export default async function WorkshopsPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const t = await getT();
  const past = (await searchParams).past === '1';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: rows }, { data: canHost }] = await Promise.all([
    supabase.rpc('workshop_list', { p_past: past }),
    supabase.rpc('can_host_workshop'),
  ]);
  const workshops = (rows ?? []) as WorkshopRow[];
  const live = workshops.filter((row) => row.is_live);
  const rest = workshops.filter((row) => !row.is_live);
  const when = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { timeZone: PLATFORM_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  const day = new Intl.DateTimeFormat('en', { timeZone: PLATFORM_TIME_ZONE, day: 'numeric' });
  const month = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar' : 'en', { timeZone: PLATFORM_TIME_ZONE, month: 'short' });

  const card = (row: WorkshopRow) => {
    const full = row.capacity !== null && row.registered >= row.capacity && !row.is_registered;
    return (
      <li key={row.id} className={`ws-card${row.is_live ? ' is-live' : ''}${row.status === 'cancelled' ? ' is-cancelled' : ''}`}>
        <span className="ws-date" aria-hidden>
          <b className="eng">{day.format(new Date(row.starts_at))}</b>
          <span>{month.format(new Date(row.starts_at))}</span>
        </span>
        <Link className="ws-body" href={`/workshops/${row.id}`}>
          {row.is_live && <span className="ws-live">● {t('مباشر الآن', 'Live now')}</span>}
          {row.status === 'cancelled' && <span className="status-pill status-danger">{t('أُلغيت', 'Cancelled')}</span>}
          <strong>{row.title}</strong>
          <span className="muted ws-when">{when.format(new Date(row.starts_at))} · {t(`${row.duration_minutes} دقيقة`, `${row.duration_minutes} min`)}</span>
          <span className="ws-host">
            <MemberAvatar id={row.host_id} name={row.host_name} url={row.host_avatar} size={22} />
            {row.host_name}
            <span className="muted">· {row.capacity !== null
              ? t(`${row.registered} من ${row.capacity} مقعد`, `${row.registered} of ${row.capacity} seats`)
              : t(`${row.registered} مسجّل`, `${row.registered} registered`)}</span>
          </span>
        </Link>
        {!past && row.status === 'scheduled' && (
          row.is_live && row.is_registered
            ? <Link className="btn btn-primary btn-sm" href={`/workshops/${row.id}`}>{t('شاهد البث', 'Watch')}</Link>
            : (
              <form action={toggleRegistration}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="register" value={row.is_registered ? '0' : '1'} />
                <button className={`btn btn-sm ${row.is_registered ? 'btn-ghost' : 'btn-primary'}`} disabled={full}>
                  {row.is_registered ? t('مسجّل ✓', 'Registered ✓') : full ? t('اكتملت', 'Full') : t('سجّل', 'Register')}
                </button>
              </form>
            )
        )}
        {past && row.has_recording && <Link className="btn btn-ghost btn-sm" href={`/workshops/${row.id}`}>▶ {t('التسجيل', 'Recording')}</Link>}
      </li>
    );
  };

  return (
    <>
      <section className="section-block row-between">
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{t('ورش العمل', 'Workshops')}</h2>
          <p className="muted" style={{ fontSize: '0.86rem', marginTop: 4 }}>
            {t('ورش مباشرة مع منتورز TechMood: سجّل، يصلك تذكير قبلها بنصف ساعة، وشاهد البث هنا.', 'Live workshops with TechMood mentors: register, get a reminder half an hour before, and watch the stream here.')}
          </p>
        </div>
        {canHost && <Link className="btn btn-primary btn-sm" href="/workshops/new">＋ {t('أعلن ورشة', 'Announce one')}</Link>}
      </section>

      <div className="tabs" role="tablist">
        <Link role="tab" aria-selected={!past} className={`tab${!past ? ' is-on' : ''}`} href="/workshops">{t('القادمة', 'Upcoming')}</Link>
        <Link role="tab" aria-selected={past} className={`tab${past ? ' is-on' : ''}`} href="/workshops?past=1">{t('السابقة', 'Past')}</Link>
      </div>

      {workshops.length === 0 ? (
        <div className="panel empty-state">
          <h3 style={{ fontSize: '1rem' }}>{past ? t('لا ورش سابقة بعد', 'No past workshops yet') : t('لا ورش قادمة الآن', 'No workshops coming up')}</h3>
          <p className="muted">{t('حين تُعلن ورشة جديدة تجدها هنا.', 'When a new one is announced you will find it here.')}</p>
        </div>
      ) : (
        <>
          {live.length > 0 && <ul className="ws-list section-block">{live.map(card)}</ul>}
          {rest.length > 0 && <ul className="ws-list section-block">{rest.map(card)}</ul>}
        </>
      )}
    </>
  );
}
