import Link from 'next/link';
import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { snoozeSurvey } from '@/app/(app)/survey/actions';

/**
 * The standing invitation to the experience survey (0164): shown until the
 * member answers, then again after 90 days; «لاحقاً» rests it for a week.
 */
export async function SurveyInvite({ className = '' }: { className?: string }) {
  const jar = await cookies();
  if (jar.get('tm-survey-later')) return null;
  const supabase = await createClient();
  const { data: due } = await supabase.rpc('ux_survey_due');
  if (!due) return null;
  const t = await getT();

  return (
    <aside className={`survey-invite ${className}`} aria-label={t('استبيان التجربة', 'Experience survey')}>
      <span className="survey-invite-icon" aria-hidden="true">📝</span>
      <div className="survey-invite-text">
        <strong>{t('ساعدنا نحسّن TechMood', 'Help us improve TechMood')}</strong>
        <span>{t('خمسة أسئلة عن تجربتك واقتراحاتك — دقيقتان.', 'Five questions about your experience and ideas — two minutes.')}</span>
      </div>
      <div className="survey-invite-actions">
        <Link className="btn btn-sm btn-primary" href="/survey">{t('شارك رأيك', 'Share your view')}</Link>
        <form action={snoozeSurvey}><button className="btn btn-sm btn-ghost" type="submit">{t('لاحقاً', 'Later')}</button></form>
      </div>
    </aside>
  );
}
