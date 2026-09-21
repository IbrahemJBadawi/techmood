import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { PrimaryFieldPicker } from './PrimaryFieldPicker';

export const metadata = { title: 'My fields — TechMood' };

export default async function FieldsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: mine }, { data: interests }, { data: skills }] = await Promise.all([
    supabase.from('profile_fields').select('field_id, is_primary, fields(id, name_ar, name_en)').eq('profile_id', user.id),
    supabase.from('profile_interests').select('interest_id, interests(name_ar)').eq('profile_id', user.id),
    supabase.from('profile_skills').select('skill_id, is_verified, skills(name_ar)').eq('profile_id', user.id),
  ]);

  const fields = (mine ?? []).map((row) => {
    const field = row.fields as unknown as { id: string; name_ar: string; name_en: string } | null;
    return { id: row.field_id, isPrimary: row.is_primary, name: field?.name_ar ?? '', nameEn: field?.name_en ?? '' };
  });

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>{t('مجالاتي واهتماماتي ومهاراتي', 'Fields, interests and skills')}</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 660 }}>
          {t('ثلاثة محاور منفصلة عن قصد: ', 'Three separate axes, on purpose: a ')}
          <strong>{t('المجال', 'field')}</strong>
          {t(' أين تعمل وتقرؤه المطابقة، ', ' is where you work and drives matching, an ')}
          <strong>{t('الاهتمام', 'interest')}</strong>
          {t(' ما يهمّك وتقرؤه التوصيات، و', ' is what you care about and drives recommendations, and a ')}
          <strong>{t('المهارة', 'skill')}</strong>
          {t(' ما تستطيع فعله ويمكن لعمل معتمد أن يوثّقها.',
             ' is what you can do — and approved work can verify it.')}
        </p>
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('المجالات', 'Fields')}</h2>
        <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
          {t('ثلاثة كحد أقصى، وواحد منها هو مجالك الرئيسي.', 'Three at most, and one of them is your primary field.')}
        </p>

        {fields.length === 0 ? (
          <p className="panel muted">{t('لم تختر مجالاً بعد.', 'You have not chosen a field yet.')}</p>
        ) : (
          <PrimaryFieldPicker fields={fields} />
        )}
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('الاهتمامات', 'Interests')}</h2>
        <div className="panel tags-row">
          {(interests ?? []).length === 0
            ? <span className="muted">{t('لا اهتمامات محفوظة.', 'No interests saved.')}</span>
            : (interests ?? []).map((row) => {
                const interest = row.interests as unknown as { name_ar: string } | null;
                return <span className="tag" key={row.interest_id}>{interest?.name_ar}</span>;
              })}
        </div>
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>{t('المهارات', 'Skills')}</h2>
        <div className="panel tags-row">
          {(skills ?? []).length === 0
            ? <span className="muted">{t('لا مهارات محفوظة.', 'No skills saved.')}</span>
            : (skills ?? []).map((row) => {
                const skill = row.skills as unknown as { name_ar: string } | null;
                return (
                  <span className={`tag${row.is_verified ? ' is-on' : ''}`} key={row.skill_id}>
                    {skill?.name_ar}{row.is_verified ? ' ✓' : ''}
                  </span>
                );
              })}
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>
          {t('المهارة المعلّمة بـ ✓ وثّقها عمل اعتمده منتور — لا يمكنك تعليمها بنفسك.', 'A skill marked ✓ was verified by work a mentor approved — you cannot tick it yourself.')}
        </p>
      </section>

      <p className="muted" style={{ fontSize: '0.84rem' }}>
        {t('لتغيير الاختيارات نفسها، ابدأ من ', 'To change the selections themselves, start from ')}
        <Link href="/passport">{t('جوازك المهني', 'your passport')}</Link>.
      </p>
    </>
  );
}
