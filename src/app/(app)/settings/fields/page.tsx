import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { PrimaryFieldPicker } from './PrimaryFieldPicker';

export const metadata = { title: 'مجالاتي — TechMood' };

export default async function FieldsPage() {
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
        <h1 style={{ fontSize: '1.2rem', marginBottom: 6 }}>مجالاتي واهتماماتي ومهاراتي</h1>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: 660 }}>
          ثلاثة محاور منفصلة عن قصد: <strong>المجال</strong> أين تعمل وتقرؤه
          المطابقة، <strong>الاهتمام</strong> ما يهمّك وتقرؤه التوصيات،
          و<strong>المهارة</strong> ما تستطيع فعله ويمكن لعمل معتمد أن يوثّقها.
        </p>
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>المجالات</h2>
        <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 12 }}>
          ثلاثة كحد أقصى، وواحد منها هو مجالك الرئيسي.
        </p>

        {fields.length === 0 ? (
          <p className="panel muted">لم تختر مجالاً بعد.</p>
        ) : (
          <PrimaryFieldPicker fields={fields} />
        )}
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>الاهتمامات</h2>
        <div className="panel tags-row">
          {(interests ?? []).length === 0
            ? <span className="muted">لا اهتمامات محفوظة.</span>
            : (interests ?? []).map((row) => {
                const interest = row.interests as unknown as { name_ar: string } | null;
                return <span className="tag" key={row.interest_id}>{interest?.name_ar}</span>;
              })}
        </div>
      </section>

      <section className="section-block">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>المهارات</h2>
        <div className="panel tags-row">
          {(skills ?? []).length === 0
            ? <span className="muted">لا مهارات محفوظة.</span>
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
          المهارة المعلّمة بـ ✓ وثّقها عمل اعتمده منتور — لا يمكنك تعليمها بنفسك.
        </p>
      </section>

      <p className="muted" style={{ fontSize: '0.84rem' }}>
        لتغيير الاختيارات نفسها، ابدأ من <Link href="/passport">جوازك المهني</Link>.
      </p>
    </>
  );
}
