import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { levelInfo } from '@/lib/xp';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: xp }, { data: stars }, { data: paths }, { data: certificates }, { data: pendingRoles }] =
    await Promise.all([
      supabase.from('profiles').select('full_name, techmood_id').eq('id', user.id).single(),
      supabase.from('profile_xp').select('total_xp').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profile_stars').select('stars_avg, rated_count').eq('profile_id', user.id).maybeSingle(),
      supabase.from('learning_paths').select('id, slug, title_ar, description_ar, tags').eq('status', 'published').order('sort_order'),
      supabase.from('certificates').select('id').eq('profile_id', user.id).eq('status', 'active'),
      supabase.from('profile_roles').select('role, status').eq('profile_id', user.id).eq('status', 'pending_review'),
    ]);

  const totalXp = xp?.total_xp ?? 0;
  const level = levelInfo(totalXp);

  return (
    <>
      <section className="section-block panel">
        <p className="kicker">One identity · many journeys</p>
        <h2 style={{ fontSize: '1.35rem', margin: '8px 0 6px' }}>
          أهلاً {profile?.full_name?.split(' ')[0] ?? ''} 👋
        </h2>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          حساب واحد، سمعة واحدة، وسجل مهني واحد يرافقك من التعلّم إلى العمل.
        </p>

        <div className="tags-row" style={{ marginTop: 14, alignItems: 'center' }}>
          <Stars value={stars?.stars_avg ?? 0} />
          <span className="xp-badge eng">{totalXp} XP</span>
          <span className="badge-pill">{level.current.title}</span>
        </div>

        {level.next && (
          <div style={{ marginTop: 12, maxWidth: 380 }}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${level.percent}%` }} />
            </div>
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: 5 }}>
              {level.percent}% نحو رتبة «{level.next.title}»
            </p>
          </div>
        )}
      </section>

      {(pendingRoles?.length ?? 0) > 0 && (
        <p className="notice section-block">
          لديك {pendingRoles!.length} طلب دور قيد المراجعة. حسابك يعمل كطالب في هذه الأثناء.
        </p>
      )}

      <section className="section-block">
        <h2 style={{ fontSize: '1.05rem', marginBottom: 14 }}>نظرة سريعة</h2>
        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="val eng">{totalXp}</div>
            <div className="lbl">إجمالي XP</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{stars?.stars_avg ?? '—'}</div>
            <div className="lbl">متوسط النجوم</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{certificates?.length ?? 0}</div>
            <div className="lbl">شهادات موثّقة</div>
          </div>
          <div className="stat-tile">
            <div className="val eng">{stars?.rated_count ?? 0}</div>
            <div className="lbl">أعمال مُقيَّمة</div>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: '1.05rem' }}>مسارات التعلّم</h2>
          <Link className="btn btn-ghost btn-sm" href="/academy">كل المسارات</Link>
        </div>
        <div className="card-grid">
          {(paths ?? []).slice(0, 3).map((path) => (
            <article className="card" key={path.id}>
              <div className="tags-row">
                {path.tags?.map((tag) => <span className="tag eng" key={tag}>{tag}</span>)}
              </div>
              <h3>{path.title_ar}</h3>
              <p>{path.description_ar}</p>
              <Link className="btn btn-ghost btn-sm" href={`/academy/${path.slug}`}>افتح المسار</Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
