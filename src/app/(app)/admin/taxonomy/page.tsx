import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import type { TaxonomyKind } from '@/lib/database.types';

import { reviewTerm } from './actions';

export const metadata = { title: 'Suggested terms — TechMood' };

const SECTIONS: {
  kind: TaxonomyKind; table: 'fields' | 'interests' | 'skills'; title: Text; note: Text;
}[] = [
  {
    kind: 'field',
    table: 'fields',
    title: { ar: 'المجالات', en: 'Fields' },
    note: {
      ar: 'المجال يقود المطابقة، والشخص يختار ثلاثة فقط — فقائمة مضخّمة تُضعف المطابقة لا تقوّيها.',
      en: 'Fields drive matching and each person picks only three — a bloated list weakens matching rather than improving it.',
    },
  },
  {
    kind: 'interest',
    table: 'interests',
    title: { ar: 'الاهتمامات', en: 'Interests' },
    note: { ar: 'الاهتمامات تقود التوصيات.', en: 'Interests drive recommendations.' },
  },
  {
    kind: 'skill',
    table: 'skills',
    title: { ar: 'المهارات', en: 'Skills' },
    note: {
      ar: 'المهارة قابلة للتوثيق بأعمال معتمدة، فاحرص على أن تكون محدّدة.',
      en: 'A skill can be verified by approved work, so keep it specific.',
    },
  },
];

export default async function TaxonomyReviewPage() {
  const t = await getT();
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
        <h1 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{t('المصطلحات المقترحة', 'Suggested terms')}</h1>
        <p className="muted" style={{ fontSize: '0.88rem', maxWidth: 660 }}>
          {t('كل مصطلح هنا اقترحه شخص أثناء إعداد حسابه. حتى تعتمده لا يراه غيره ولا يستطيع أحد اختياره.',
             'Every term here was suggested by somebody while setting up their account. Until you approve it, nobody else sees it and nobody can pick it.')}
        </p>
      </section>

      {total === 0 && <p className="panel muted">{t('لا مصطلحات تنتظر المراجعة.', 'No terms waiting for review.')}</p>}

      {SECTIONS.map((section, index) => {
        const rows = results[index].data ?? [];
        if (rows.length === 0) return null;

        return (
          <section className="section-block" key={section.kind}>
            <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>{t(section.title)}</h2>
            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 10 }}>{t(section.note)}</p>

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
                        {suggester && t(` — اقترحه ${suggester.display_name ?? suggester.full_name}`,
                                        ` — suggested by ${suggester.display_name ?? suggester.full_name}`)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <form action={reviewTerm}>
                        <input type="hidden" name="kind" value={section.kind} />
                        <input type="hidden" name="term_id" value={row.id} />
                        <input type="hidden" name="approve" value="yes" />
                        <button className="btn btn-primary btn-sm">{t('اعتماد', 'Approve')}</button>
                      </form>
                      <form action={reviewTerm}>
                        <input type="hidden" name="kind" value={section.kind} />
                        <input type="hidden" name="term_id" value={row.id} />
                        <input type="hidden" name="approve" value="no" />
                        <button className="btn btn-ghost btn-sm">{t('رفض', 'Reject')}</button>
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
