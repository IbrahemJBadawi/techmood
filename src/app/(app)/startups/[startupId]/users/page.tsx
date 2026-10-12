import { ActionForm } from '@/components/ActionForm';
import type { Database } from '@/lib/database.types';
import type { T } from '@/lib/i18n';

import { deletePersona, savePersona } from '../../studio-actions';
import { ToolHeader, loadStudio } from '../ToolHeader';

type Persona = Database['public']['Tables']['startup_personas']['Row'];

/**
 * The users (0166): personas — a name and a face for each kind of person the
 * startup serves: what they are trying to do, what gets in their way, where
 * they can be reached and what they would pay. One of them leads; the plan
 * and the assistant read that one first.
 */
export default async function UsersPage({ params }: { params: Promise<{ startupId: string }> }) {
  const { startupId } = await params;
  const { t, supabase, startup, editable } = await loadStudio(startupId);
  const { data: rows } = await supabase.from('startup_personas').select('*').eq('startup_id', startupId)
    .order('is_primary', { ascending: false }).order('created_at');
  const personas = (rows ?? []) as Persona[];

  return (
    <>
      <ToolHeader
        startupId={startupId}
        name={startup.name_ar}
        tool="users"
        ask={`اقترح أسئلة مقابلة لأتحقق من شخصيات مستخدمي «${startup.name_ar}» وآلامهم، دون أن أوحي لهم بالإجابة.`}
        intro={t('لكل نوع من المستخدمين شخصية: من هو، ماذا يريد، ما الذي يؤلمه، أين تجده، وكم يدفع. ابنها من مقابلات حقيقية، لا من التخمين.',
                 'A persona for each kind of user: who they are, what they want, what hurts, where to find them and what they pay. Build them from real interviews, not guesses.')}
      />

      {personas.length === 0 ? (
        <p className="notice section-block">{t('لا شخصيات بعد. ابدأ بالمستخدم الذي ستبيع له أولاً.', 'No personas yet. Start with the user you will sell to first.')}</p>
      ) : (
        <div className="studio-cards section-block">
          {personas.map((p) => (
            <article className={`card persona-card${p.is_primary ? ' is-primary' : ''}`} key={p.id}>
              <div className="persona-head">
                <span className="persona-avatar" aria-hidden>{p.name.trim().charAt(0)}</span>
                <div>
                  <h4><bdi>{p.name}</bdi></h4>
                  <p className="muted">{p.occupation_ar}{p.occupation_ar && p.age_range ? ' · ' : ''}{p.age_range && <bdi dir="ltr">{p.age_range}</bdi>}</p>
                </div>
                {p.is_primary && <span className="badge-pill">{t('الأساسية', 'Primary')}</span>}
              </div>
              {p.quote_ar && <blockquote className="persona-quote">«{p.quote_ar}»</blockquote>}
              {p.goals_ar && <p className="studio-line"><strong>🎯 {t('يريد: ', 'Wants: ')}</strong>{p.goals_ar}</p>}
              {p.pains_ar && <p className="studio-line"><strong>😣 {t('يؤلمه: ', 'Pains: ')}</strong>{p.pains_ar}</p>}
              {p.channels_ar && <p className="studio-line"><strong>📍 {t('تجده في: ', 'Find them: ')}</strong>{p.channels_ar}</p>}
              {p.pays_usd != null && (
                <p className="studio-line"><strong>💵 {t('يدفع: ', 'Pays: ')}</strong><bdi dir="ltr" className="eng">{Number(p.pays_usd)}$</bdi>{t(' شهرياً تقريباً', ' a month, roughly')}</p>
              )}
              {editable && (
                <div className="studio-card-actions">
                  <details className="studio-edit">
                    <summary className="btn btn-ghost btn-sm">{t('تعديل', 'Edit')}</summary>
                    <ActionForm action={savePersona} submitLabel={t('احفظ', 'Save')} className="studio-form">
                      <PersonaFields t={t} startupId={startupId} row={p} />
                    </ActionForm>
                  </details>
                  <ActionForm action={deletePersona} submitLabel={t('حذف', 'Remove')} variant="ghost"
                              confirm={t(`حذف شخصية «${p.name}»؟`, `Remove the persona «${p.name}»?`)}>
                    <input type="hidden" name="startup_id" value={startupId} />
                    <input type="hidden" name="id" value={p.id} />
                  </ActionForm>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {editable && (
        <ActionForm action={savePersona} submitLabel={t('أضف الشخصية', 'Add the persona')} className="panel studio-form section-block studio-narrow">
          <h3 className="studio-h3">{t('شخصية جديدة', 'A new persona')}</h3>
          <PersonaFields t={t} startupId={startupId} />
        </ActionForm>
      )}
    </>
  );
}

function PersonaFields({ t, startupId, row }: { t: T; startupId: string; row?: Persona }) {
  const key = row?.id ?? 'new';
  return (
    <>
      <input type="hidden" name="startup_id" value={startupId} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="studio-num-grid">
        <div className="field">
          <label htmlFor={`name-${key}`}>{t('الاسم', 'Name')}</label>
          <input id={`name-${key}`} name="name" required maxLength={60} defaultValue={row?.name ?? ''} placeholder={t('مثال: د. ليلى', 'e.g. Dr. Layla')} />
        </div>
        <div className="field">
          <label htmlFor={`occupation-${key}`}>{t('العمل', 'Occupation')}</label>
          <input id={`occupation-${key}`} name="occupation" maxLength={120} defaultValue={row?.occupation_ar ?? ''} />
        </div>
        <div className="field">
          <label htmlFor={`age-${key}`}>{t('العمر', 'Age')}</label>
          <input id={`age-${key}`} name="age_range" maxLength={20} dir="ltr" defaultValue={row?.age_range ?? ''} placeholder="30–45" />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`goals-${key}`}>{t('ماذا يريد أن ينجز؟', 'What are they trying to get done?')}</label>
        <textarea id={`goals-${key}`} name="goals" rows={2} defaultValue={row?.goals_ar ?? ''} />
      </div>
      <div className="field">
        <label htmlFor={`pains-${key}`}>{t('ما الذي يؤلمه اليوم؟', 'What hurts today?')}</label>
        <textarea id={`pains-${key}`} name="pains" rows={2} defaultValue={row?.pains_ar ?? ''} />
      </div>
      <div className="field">
        <label htmlFor={`channels-${key}`}>{t('أين تجده؟', 'Where do you reach them?')}</label>
        <input id={`channels-${key}`} name="channels" maxLength={600} defaultValue={row?.channels_ar ?? ''} placeholder={t('مجموعات فيسبوك، نقابة الأطباء، لينكدإن…', 'Facebook groups, the doctors’ union, LinkedIn…')} />
      </div>
      <div className="studio-num-grid studio-num-grid-2">
        <div className="field">
          <label htmlFor={`quote-${key}`}>{t('جملة قالها لك', 'Something they told you')}</label>
          <input id={`quote-${key}`} name="quote" maxLength={300} defaultValue={row?.quote_ar ?? ''} />
        </div>
        <div className="field">
          <label htmlFor={`pays-${key}`}>{t('كم يدفع شهرياً ($)', 'Would pay a month ($)')}</label>
          <input id={`pays-${key}`} name="pays" inputMode="decimal" dir="ltr" defaultValue={row?.pays_usd ?? ''} />
        </div>
      </div>
      <label className="badge-pill studio-check">
        <input type="checkbox" name="is_primary" defaultChecked={row?.is_primary ?? false} />
        {t('هذه الشخصية الأساسية', 'This is the primary persona')}
      </label>
    </>
  );
}
