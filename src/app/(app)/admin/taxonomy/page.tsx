import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import type { TaxonomyKind } from '@/lib/database.types';

import { reviewTerm } from './actions';

export const metadata = { title: 'المصطلحات المقترحة — TechMood' };

const SECTIONS: { kind: TaxonomyKind; table: 'fields' | 'interests' | 'skills'; title: string; note: string }[] = [
  {
    kind: 'field',
    table: 'fields',
    title: 'المجالات',
    note: 'المجال يقود المطابقة، والشخص يختار ثلاثة فقط — فقائمة مضخّمة تُضعف المطابقة لا تقوّيها.',
  },
  { kind: 'interest', table: 'interests', title: 'الاهتمامات', note: 'الاهتمامات تقود التوصيات.' },
  { kind: 'skill', table: 'skills', title: 'المهارات', note: 'المهارة قابلة للتوثيق بأعمال معتمدة، فاحرص على أن تكون محدّدة.' },
];

export default async function TaxonomyReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('can_enter_role', { p_role: 'admin' });
  if (!isAdmin) redirect('/home');

  const results = await Promise.all(
    SECTIONS.map((section) =>
      supabase
        .from(section.table)
        .select('id, slug, name_ar, name_en, suggested_by, created_at')
        .eq('status', 'pending_review')
        .order('created_at'),
    ),
  );

  const suggesterIds = [
    ...new Set(results.flatMap(({ data }) => (data ?? []).map((row) => row.suggested_by).filter(Boolean))),
  ] as string[];

  const { data: suggesters } = suggesterIds.length
    ? await supabase.from('profiles').select('id, display_name, full_name, techmood_id').in('id', suggesterIds)
    : { data: [] };

  const byId = new Map((suggesters ?? []).map((row) => [row.id, row]));
  const total = results.reduce((sum, { data }) => sum + (data?.length ?? 0), 0);

  return (
    <>
      <section className="section-block">
        <h1 style={{ fontSize: '1.2rem', marginBottom: 4 }}>المصطلحات المقترحة</h1>
        <p className="muted" style={{ fontSize: '0.88rem', maxWidth: 660 }}>
          كل مصطلح هنا اقترحه شخص أثناء إعداد حسابه. حتى تعتمده لا يراه غيره ولا
          يستطيع أحد اختياره.
        </p>
      </section>

      {total === 0 && <p className="panel muted">لا مصطلحات تنتظر المراجعة.</p>}

      {SECTIONS.map((section, index) => {
        const rows = results[index].data ?? [];
        if (rows.length === 0) return null;

        return (
          <section className="section-block" key={section.kind}>
            <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{section.title}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 10 }}>{section.note}</p>

            <div className="stack">
              {rows.map((row) => {
                const suggester = row.suggested_by ? byId.get(row.suggested_by) : undefined;
                return (
                  <article className="panel row-between" key={row.id}>
                    <div>
                      <strong>{row.name_ar}</strong>
                      <span className="muted" dir="ltr" style={{ marginInlineStart: 8 }}>{row.name_en}</span>
                      <p className="muted" style={{ fontSize: '0.8rem' }}>
                        <code dir="ltr">{row.slug}</code>
                        {suggester && ` — اقترحه ${suggester.display_name ?? suggester.full_name}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <form action={reviewTerm}>
                        <input type="hidden" name="kind" value={section.kind} />
                        <input type="hidden" name="term_id" value={row.id} />
                        <input type="hidden" name="approve" value="yes" />
                        <button className="btn btn-primary btn-sm">اعتماد</button>
                      </form>
                      <form action={reviewTerm}>
                        <input type="hidden" name="kind" value={section.kind} />
                        <input type="hidden" name="term_id" value={row.id} />
                        <input type="hidden" name="approve" value="no" />
                        <button className="btn btn-ghost btn-sm">رفض</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
