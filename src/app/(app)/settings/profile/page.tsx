import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import type { Text } from '@/lib/i18n';
import type {
  ExperienceKind, LinkKind, ProfileAudience, ProfileSection, TaxonomyStatus,
} from '@/lib/database.types';

import {
  addEducation, addExperience, addExternalExhibition, addLink, removeRow, setSectionAudience,
} from './actions';
import { BasicsForm } from './BasicsForm';

export const metadata = { title: 'Profile — TechMood' };

const SECTION_LABEL: Record<ProfileSection, Text> = {
  about:       { ar: 'النبذة',            en: 'About' },
  identity:    { ar: 'الهوية المهنية',    en: 'Professional identity' },
  stats:       { ar: 'السجل والأرقام',    en: 'The record' },
  skills:      { ar: 'المهارات',          en: 'Skills' },
  achievements:{ ar: 'الإنجازات',         en: 'Achievements' },
  certificates:{ ar: 'الشهادات',          en: 'Certificates' },
  learning:    { ar: 'رحلة التعلّم',      en: 'Learning journey' },
  projects:    { ar: 'المشاريع',          en: 'Projects' },
  evaluations: { ar: 'تقييمات المنتورين', en: 'Mentor evaluations' },
  teams:       { ar: 'الفرق',             en: 'Teams' },
  experience:  { ar: 'الخبرة',            en: 'Experience' },
  education:   { ar: 'التعليم',           en: 'Education' },
  links:       { ar: 'ملفات أخرى',        en: 'External profiles' },
  external_exhibitions: { ar: 'مشاركات خارجية', en: 'Outside TechMood' },
};

const AUDIENCE_LABEL: Record<ProfileAudience, Text> = {
  public:       { ar: 'للجميع',             en: 'Anyone' },
  professional: { ar: 'للمهنيين المعتمدين', en: 'Approved professionals' },
  private:      { ar: 'لي وحدي',            en: 'Only me' },
};

const LINK_KINDS: LinkKind[] = [
  'linkedin', 'github', 'behance', 'dribbble', 'kaggle', 'youtube', 'portfolio', 'website', 'x', 'other',
];

const EXPERIENCE_KINDS: ExperienceKind[] = ['job', 'freelance', 'volunteer', 'internship', 'techmood'];

const CLAIM_STATUS: Record<TaxonomyStatus, { text: Text; className: string }> = {
  pending_review: { text: { ar: 'بانتظار التحقّق', en: 'Waiting to be checked' }, className: 'status-pending' },
  approved:       { text: { ar: '✓ موثّقة',        en: '✓ Checked' },            className: 'status-ok' },
  rejected:       { text: { ar: 'لم تُقبل',        en: 'Not accepted' },         className: 'status-danger' },
};

/**
 * Where the owner writes the parts of their identity the platform cannot
 * observe, and decides who reads which part.
 *
 * Everything the platform did observe — approved work, certificates, projects,
 * sessions — is not editable here and never will be: a record you can type
 * into is not a record.
 */
export default async function ProfileSettingsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile },
    { data: visibility },
    { data: links },
    { data: education },
    { data: experience },
    { data: external },
  ] = await Promise.all([
    supabase.from('profiles').select('headline, bio, is_public, techmood_id').eq('id', user.id).single(),
    supabase.from('profile_section_visibility').select('section, audience').eq('profile_id', user.id),
    supabase.from('profile_links').select('id, kind, label, url').eq('profile_id', user.id).order('sort_order'),
    supabase.from('profile_education').select('id, institution, degree, field, started_on, ended_on').eq('profile_id', user.id),
    supabase.from('profile_experience').select('id, organisation, title, kind, started_on, ended_on').eq('profile_id', user.id),
    supabase.from('external_exhibitions').select('id, title, organiser, held_on, status, review_note').eq('profile_id', user.id),
  ]);

  const audienceOf = (section: ProfileSection): ProfileAudience =>
    (visibility ?? []).find((row) => row.section === section)?.audience ?? 'public';

  const remover = (table: string, id: string) => (
    <form action={removeRow}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="link-button" type="submit">{t('احذف', 'Remove')}</button>
    </form>
  );

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.2rem' }}>{t('ملفي المهني', 'My professional profile')}</h2>
          {profile && (
            <Link className="btn btn-ghost btn-sm" href={`/u/${profile.techmood_id}`}>
              {t('اعرض ملفي كما يراه الزائر', 'See it as a visitor does')}
            </Link>
          )}
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 6, maxWidth: '68ch' }}>
          {t('ما سجّلته المنصة — عمل معتمد، شهادات، مشاريع معروضة، جلسات — يظهر على ملفك من نفسه ولا يُكتب هنا. ما تكتبه هنا هو ما لم تشهده المنصة، وما تقرّره هنا هو من يرى كل قسم.',
             'What the platform recorded — approved work, certificates, exhibited projects, sessions — appears on your profile by itself and is not typed here. What you write here is what the platform did not witness, and what you decide here is who reads each part.')}
        </p>
      </section>

      {profile && (
        <BasicsForm headline={profile.headline} bio={profile.bio} isPublic={profile.is_public} />
      )}

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('من يرى ماذا', 'Who sees what')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {t('«للمهنيين المعتمدين» تعني منتوراً أو قائد فريق أو شركة أو مؤسساً — أي من له سبب مهني ليقرأ أعمق.',
             '“Approved professionals” means a mentor, a team lead, a company or a founder — somebody with a working reason to read deeper.')}
        </p>
        <ul className="admin-mini-list" style={{ marginTop: 12, gap: 10 }}>
          {(Object.keys(SECTION_LABEL) as ProfileSection[]).map((section) => (
            <li key={section}>
              <span>{t(SECTION_LABEL[section])}</span>
              <form action={setSectionAudience} className="admin-inline-form" style={{ margin: 0 }}>
                <input type="hidden" name="section" value={section} />
                <select name="audience" defaultValue={audienceOf(section)} aria-label={t(SECTION_LABEL[section])}>
                  {(Object.keys(AUDIENCE_LABEL) as ProfileAudience[]).map((audience) => (
                    <option value={audience} key={audience}>{t(AUDIENCE_LABEL[audience])}</option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm" type="submit">{t('طبّق', 'Apply')}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('ملفات أخرى', 'External profiles')}</h3>
        {(links ?? []).length > 0 && (
          <ul className="admin-mini-list" style={{ marginTop: 10 }}>
            {(links ?? []).map((link) => (
              <li key={link.id}>
                <span>{link.label ?? link.kind}</span>
                <a className="eng" href={link.url} target="_blank" rel="noreferrer">{link.url}</a>
                {remover('profile_links', link.id)}
              </li>
            ))}
          </ul>
        )}
        <form action={addLink} className="admin-inline-form">
          <select name="kind" defaultValue="linkedin" aria-label={t('النوع', 'Kind')}>
            {LINK_KINDS.map((kind) => <option value={kind} key={kind}>{kind}</option>)}
          </select>
          <input name="url" type="url" required placeholder="https://" />
          <input name="label" placeholder={t('اسم اختياري', 'Optional label')} />
          <button className="btn btn-primary btn-sm" type="submit">{t('أضف', 'Add')}</button>
        </form>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('الخبرة', 'Experience')}</h3>
        {(experience ?? []).length > 0 && (
          <ul className="admin-mini-list" style={{ marginTop: 10 }}>
            {(experience ?? []).map((row) => (
              <li key={row.id}>
                <span>{row.title} · {row.organisation}</span>
                <span className="muted eng">{(row.started_on ?? '').slice(0, 4)}</span>
                {remover('profile_experience', row.id)}
              </li>
            ))}
          </ul>
        )}
        <form action={addExperience} className="admin-inline-form">
          <input name="title" required placeholder={t('المسمّى', 'Title')} />
          <input name="organisation" required placeholder={t('الجهة', 'Organisation')} />
          <select name="kind" defaultValue="job" aria-label={t('النوع', 'Kind')}>
            {EXPERIENCE_KINDS.map((kind) => <option value={kind} key={kind}>{kind}</option>)}
          </select>
          <input name="started_on" type="date" aria-label={t('من', 'From')} />
          <input name="ended_on" type="date" aria-label={t('إلى', 'To')} />
          <button className="btn btn-primary btn-sm" type="submit">{t('أضف', 'Add')}</button>
        </form>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('التعليم', 'Education')}</h3>
        {(education ?? []).length > 0 && (
          <ul className="admin-mini-list" style={{ marginTop: 10 }}>
            {(education ?? []).map((row) => (
              <li key={row.id}>
                <span>{row.institution}{row.degree ? ` · ${row.degree}` : ''}</span>
                <span className="muted eng">{(row.started_on ?? '').slice(0, 4)}</span>
                {remover('profile_education', row.id)}
              </li>
            ))}
          </ul>
        )}
        <form action={addEducation} className="admin-inline-form">
          <input name="institution" required placeholder={t('الجامعة أو المعهد', 'Institution')} />
          <input name="degree" placeholder={t('الدرجة', 'Degree')} />
          <input name="field" placeholder={t('التخصص', 'Field')} />
          <input name="started_on" type="date" aria-label={t('من', 'From')} />
          <input name="ended_on" type="date" aria-label={t('إلى', 'To')} />
          <button className="btn btn-primary btn-sm" type="submit">{t('أضف', 'Add')}</button>
        </form>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('مشاركات خارج TechMood', 'Outside TechMood')}</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {t('هذه الوحيدة التي لم تشهدها المنصة، فتصل كادّعاء ولا يراها أحد حتى تتحقّق منها الإدارة. أرفق دليلاً.',
             'This is the one thing the platform did not witness, so it arrives as a claim and nobody sees it until an admin has checked it. Attach evidence.')}
        </p>
        {(external ?? []).length > 0 && (
          <ul className="admin-mini-list" style={{ marginTop: 10 }}>
            {(external ?? []).map((row) => (
              <li key={row.id}>
                <span>{row.title}{row.organiser ? ` · ${row.organiser}` : ''}</span>
                <span className={`status-pill ${CLAIM_STATUS[row.status].className}`}>
                  {t(CLAIM_STATUS[row.status].text)}
                </span>
                {row.review_note && <span className="muted">{row.review_note}</span>}
                {remover('external_exhibitions', row.id)}
              </li>
            ))}
          </ul>
        )}
        <form action={addExternalExhibition} className="admin-inline-form">
          <input name="title" required placeholder={t('اسم المعرض أو المسابقة', 'Exhibition or competition')} />
          <input name="organiser" placeholder={t('الجهة المنظّمة', 'Organiser')} />
          <input name="role" placeholder={t('دورك', 'Your role')} />
          <input name="result" placeholder={t('النتيجة', 'Result')} />
          <input name="evidence_url" type="url" placeholder={t('رابط الدليل', 'Evidence link')} />
          <input name="held_on" type="date" aria-label={t('التاريخ', 'Date')} />
          <button className="btn btn-primary btn-sm" type="submit">{t('أضف', 'Add')}</button>
        </form>
      </section>

      <section className="panel section-block">
        <h3 style={{ fontSize: '0.98rem' }}>{t('حسابك وأموالك', 'Your account and your money')}</h3>
        <p className="muted" style={{ fontSize: '0.86rem', marginTop: 6 }}>
          {t('البريد والهاتف والمدفوعات والسحوبات ليست جزءاً من الملف المهني ولا تظهر لأحد. تجدها في صفحاتها.',
             'Email, phone, payments and payouts are not part of the professional profile and are shown to nobody. They live on their own pages.')}
        </p>
        <div className="explore-row" style={{ marginTop: 10 }}>
          <Link className="explore-chip" href="/settings/fields">{t('المجالات والاهتمامات', 'Fields and interests')}</Link>
          <Link className="explore-chip" href="/settings/roles">{t('الأدوار', 'Roles')}</Link>
          <Link className="explore-chip" href="/wallet">{t('المحفظة والسحب', 'Wallet and payouts')}</Link>
        </div>
      </section>
    </>
  );
}
