import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT, localizedTitle } from '@/lib/i18n.server';

import { SurveyForm } from './SurveyForm';

export const generateMetadata = localizedTitle('رأيك في TechMood', 'Your view of TechMood');

/** The standing experience survey (0164): five short questions, once every 90 days. */
export default async function SurveyPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/survey');
  const { data: due } = await supabase.rpc('ux_survey_due');

  return (
    <>
      <section className="section-block survey-head">
        <p className="kicker">{t('دقيقتان فقط', 'Two minutes')}</p>
        <h1>{t('رأيك يصنع TechMood', 'Your view shapes TechMood')}</h1>
        <p className="muted">{t('خمسة أسئلة قصيرة عن تجربتك. يقرأها فريق المنصة، ولا يراها أحد غيره.',
                                'Five short questions about your experience. Read by the platform team, and nobody else.')}</p>
      </section>
      {due ? <SurveyForm /> : (
        <p className="notice notice-ok section-block">
          {t('أجبت على الاستبيان مؤخراً — شكراً لك. نسألك مجدداً بعد 90 يوماً.', 'You answered recently — thank you. We will ask again after 90 days.')}
        </p>
      )}
    </>
  );
}
