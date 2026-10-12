import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { BackLink } from '@/components/BackLink';
import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { saveBusinessPage } from '../actions';

export const generateMetadata = localizedTitle('صفحة الأعمال — TechMood Business', 'Business page — TechMood Business');

/** Create or edit a business page — your own, or your team's if you lead it (0165). */
export default async function EditBusinessPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/hub/edit');

  const { team } = await searchParams;
  const teamId = team && /^[0-9a-f-]{36}$/.test(team) ? team : null;
  const [{ data: accessRows }, { data: page }, { data: teamRow }, { data: led }] = await Promise.all([
    supabase.rpc('business_access'),
    teamId
      ? supabase.from('business_pages').select('*').eq('owner_id', user.id).eq('team_id', teamId).maybeSingle()
      : supabase.from('business_pages').select('*').eq('owner_id', user.id).is('team_id', null).maybeSingle(),
    teamId ? supabase.from('teams').select('id, title_ar, leader_id').eq('id', teamId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('teams').select('id, title_ar').eq('leader_id', user.id),
  ]);
  const access = accessRows?.[0];

  if (!access?.premium) {
    return (
      <>
        <BackLink href="/hub" label={t('رجوع إلى الأعمال', 'Back to Business')} />
        <section className="panel section-block business-gate" style={{ marginTop: 16 }}>
          <h3>✦ {t('صفحة الأعمال لمشتركي Premium', 'Business pages are for Premium members')}</h3>
          <p className="muted">{t('اعرض خدماتك أو خدمات فريقك ومشاريعكم وفرصكم في صفحة واحدة يراها أعضاء TechMood.',
                                  'Show your or your team’s services, projects and openings on one page TechMood members see.')}</p>
          <Link className="btn btn-primary" href="/premium">{t('اشترك في Premium', 'Get Premium')}</Link>
        </section>
      </>
    );
  }

  const suggested = (page?.slug ?? (teamRow?.title_ar ?? '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  return (
    <>
      <BackLink href={page ? `/hub/${page.slug}` : '/hub'} label={t('رجوع', 'Back')} />
      <section className="section-block" style={{ marginTop: 16, maxWidth: 680 }}>
        <h2 style={{ fontSize: '1.2rem' }}>
          {page ? t('عدّل صفحة الأعمال', 'Edit the business page') : t('أنشئ صفحة أعمال', 'Create a business page')}
          {teamRow && <> — {teamRow.title_ar}</>}
        </h2>
        {!teamId && (led ?? []).length > 0 && (
          <p className="muted" style={{ fontSize: '0.84rem', marginTop: 6 }}>
            {t('تقود فريقاً؟ أنشئ له صفحته: ', 'Lead a team? Make its page: ')}
            {(led ?? []).map((row, index) => (
              <span key={row.id}>{index > 0 && ' · '}<Link href={`/hub/edit?team=${row.id}`}>{row.title_ar}</Link></span>
            ))}
          </p>
        )}
      </section>

      <ActionForm action={saveBusinessPage} submitLabel={page ? t('احفظ', 'Save') : t('أنشئ الصفحة', 'Create the page')}
                  className="panel section-block biz-form">
        {teamId && <input type="hidden" name="team_id" value={teamId} />}
        <div className="field">
          <label htmlFor="name">{t('الاسم التجاري', 'Business name')}</label>
          <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={page?.name ?? teamRow?.title_ar ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="slug">{t('رابط الصفحة', 'Page address')}</label>
          <div className="input-prefix" dir="ltr"><span>/hub/</span>
            <input id="slug" name="slug" required pattern="[a-z0-9](-?[a-z0-9])*" minLength={3} maxLength={40} defaultValue={suggested} />
          </div>
          <small className="muted">{t('حروف إنجليزية صغيرة وأرقام وشرطات.', 'Lowercase letters, digits and dashes.')}</small>
        </div>
        <div className="field">
          <label htmlFor="tagline">{t('سطر يعرّف بك', 'A one-line pitch')}</label>
          <input id="tagline" name="tagline" maxLength={140} defaultValue={page?.tagline ?? ''} placeholder={t('نصمّم ونبني مواقع سريعة للشركات الصغيرة', 'We design and build fast sites for small businesses')} />
        </div>
        <div className="field">
          <label htmlFor="about">{t('عن العمل', 'About')}</label>
          <textarea id="about" name="about" rows={5} maxLength={3000} defaultValue={page?.about ?? ''} />
        </div>
        <div className="biz-form-row">
          <div className="field"><label htmlFor="sector">{t('المجال', 'Field')}</label>
            <input id="sector" name="sector" maxLength={60} defaultValue={page?.sector ?? ''} /></div>
          <div className="field"><label htmlFor="city">{t('المدينة', 'City')}</label>
            <input id="city" name="city" maxLength={60} defaultValue={page?.city ?? ''} /></div>
        </div>
        <div className="field">
          <label htmlFor="website">{t('الموقع (اختياري)', 'Website (optional)')}</label>
          <input id="website" name="website" type="url" dir="ltr" defaultValue={page?.website_url ?? ''} placeholder="https://" />
        </div>
        <div className="field">
          <label htmlFor="contact">{t('كيف يطلب الناس خدمتك؟', 'How do people request your service?')}</label>
          <input id="contact" name="contact" maxLength={300} defaultValue={page?.contact_note ?? ''}
                 placeholder={t('اطلب الخدمة من السوق، أو تواصل عبر رسائل TechMood', 'Order from the market, or message on TechMood')} />
        </div>
        <label className="radio-row">
          <input type="checkbox" name="published" value="on" defaultChecked={page?.is_published ?? true} />
          <span>{t('ظاهرة لأعضاء TechMood', 'Visible to TechMood members')}</span>
        </label>
      </ActionForm>
    </>
  );
}
