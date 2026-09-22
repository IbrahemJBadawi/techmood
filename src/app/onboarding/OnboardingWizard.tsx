'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { SELECTABLE_ROLES, ROLE_STATUS_LABEL, roleLabel } from '@/lib/roles';
import { useT } from '@/lib/i18n.client';
import type { T } from '@/lib/i18n';
import type { RoleStatus, TaxonomyKind, UiLanguage, UserRole } from '@/lib/database.types';

import { finishOnboarding, requestRoles, saveBasics, saveTerms, suggestTerm } from './actions';
import { LogoMark } from '@/components/Logo';

type Term = { id: string; slug: string; name_ar: string; name_en: string; status: string };
type RoleRow = { id: string; role: UserRole; status: RoleStatus; application_note: string | null };

type Props = {
  userId: string;
  profile: {
    techmood_id: string;
    full_name: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    headline: string | null;
    country: string | null;
    city: string | null;
    language: UiLanguage;
  };
  roles: RoleRow[];
  catalogues: Record<TaxonomyKind, Term[]>;
  selected: Record<TaxonomyKind, string[]>;
};

const steps = (t: T) => [
  t('المعلومات الأساسية', 'Basics'),
  t('الأدوار', 'Roles'),
  t('المجالات', 'Fields'),
  t('الاهتمامات', 'Interests'),
  t('المهارات', 'Skills'),
  t('الملخّص', 'Summary'),
];

export function OnboardingWizard({ userId, profile, roles, catalogues, selected }: Props) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(selected);
  const [requested, setRequested] = useState<UserRole[]>(
    roles.filter((r) => r.role !== 'student').map((r) => r.role),
  );

  const approved = roles.filter((r) => r.status === 'approved').map((r) => r.role);

  return (
    <main className="onboarding">
      <header className="onboarding-head">
        <div className="row-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
            <LogoMark />
            TechMood
          </div>
          <span className="id-chip">{profile.techmood_id}</span>
        </div>
        <h1>{t('لنُعِدّ حسابك', 'Let\u2019s set up your account')}</h1>
        <p className="muted">
          {t('هذه المعلومات تبني هويتك المهنية الواحدة. رقمك ',
             'This is what your one professional identity is built from. Your ID ')}
          <strong>{profile.techmood_id}</strong>
          {t(' صدر بالفعل ولا يتغيّر مهما غيّرت اسمك أو أدوارك.',
             ' has already been issued and never changes, whatever you call yourself or which roles you take on.')}
        </p>

        <ol className="stepper">
          {steps(t).map((label, index) => (
            <li
              key={label}
              className={index === step ? 'current' : index < step ? 'done' : ''}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="stepper-dot">{index + 1}</span>
              <span className="stepper-label">{label}</span>
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <BasicsStep userId={userId} profile={profile} onDone={() => setStep(1)} />
      )}

      {step === 1 && (
        <RolesStep
          roles={roles}
          requested={requested}
          setRequested={setRequested}
          onBack={() => setStep(0)}
          onDone={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <TermStep
          kind="field"
          title={t('المجالات', 'Fields')}
          lede={t('أين تعمل؟ ثلاثة مجالات كحد أقصى — هذه هي التي تقود المطابقة مع المنتورز والفرق والفرص.',
                  'Where do you work? Three at most — these are what drive matching with mentors, teams and openings.')}
          max={3}
          terms={catalogues.field}
          value={picked.field}
          onChange={(ids) => setPicked((prev) => ({ ...prev, field: ids }))}
          onBack={() => setStep(1)}
          onDone={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <TermStep
          kind="interest"
          title={t('الاهتمامات', 'Interests')}
          lede={t('ما الذي يهمّك؟ بلا حد أقصى — هذه تقود التوصيات وما يظهر لك في المنصة.',
                  'What do you care about? No limit — these drive your recommendations and what surfaces for you.')}
          terms={catalogues.interest}
          value={picked.interest}
          onChange={(ids) => setPicked((prev) => ({ ...prev, interest: ids }))}
          onBack={() => setStep(2)}
          onDone={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <TermStep
          kind="skill"
          title={t('المهارات', 'Skills')}
          lede={t('ما الذي تستطيع فعله؟ بلا حد أقصى. المهارة تبقى منفصلة عن المجال والاهتمام، ويمكن لأعمالك المعتمدة أن توثّقها لاحقاً.',
                  'What can you do? No limit. A skill stays separate from a field and an interest, and approved work can verify it later.')}
          terms={catalogues.skill}
          value={picked.skill}
          onChange={(ids) => setPicked((prev) => ({ ...prev, skill: ids }))}
          onBack={() => setStep(3)}
          onDone={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <SummaryStep
          profile={profile}
          roles={roles}
          approved={approved}
          requested={requested}
          picked={picked}
          catalogues={catalogues}
          onBack={() => setStep(4)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ step 1 */

function BasicsStep({
  userId,
  profile,
  onDone,
}: {
  userId: string;
  profile: Props['profile'];
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveBasics, undefined);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Advancing is a side effect of the action succeeding, never something done
  // while rendering.
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    setUploadError('');
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      setUploadError(t('تعذّر رفع الصورة.', 'The image could not be uploaded.'));
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
    }
    setUploading(false);
  }

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>{t('من أنت؟', 'Who are you?')}</h2>

      <div className="avatar-picker">
        <span className="avatar-preview" aria-hidden="true">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt="" width={72} height={72} />
            : (profile.display_name ?? profile.full_name).slice(0, 1)}
        </span>
        <div>
          <label className="btn btn-ghost btn-sm" htmlFor="avatar">
            {uploading ? t('جارٍ الرفع…', 'Uploading…') : t('اختر صورة', 'Choose a photo')}
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {t('اختيارية. تظهر في ملفك العام وفي الفرق التي تنضم إليها.', 'Optional. It appears on your public profile and in the teams you join.')}
          </p>
          {uploadError && <p className="notice notice-danger">{uploadError}</p>}
        </div>
      </div>
      <input type="hidden" name="avatar_url" value={avatar} />

      <div className="field-row">
        <div className="field">
          <label htmlFor="full_name">{t('الاسم الكامل بالإنجليزية', 'Full name in English')}</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} required
                 dir="ltr" placeholder="Ibrahem Jamal Badawi" />
          <small className="muted">{t('كما تريده أن يظهر على الشهادات.', 'As you want it printed on your certificates.')}</small>
        </div>
        <div className="field">
          <label htmlFor="display_name">{t('الاسم الظاهر', 'Display name')}</label>
          <input id="display_name" name="display_name"
                 defaultValue={profile.display_name ?? profile.full_name} required
                 placeholder={t('إبراهيم', 'Ibrahem')} />
          <small className="muted">{t('ما يناديك به الناس داخل المنصة.', 'What people call you on the platform.')}</small>
        </div>
      </div>

      <div className="field">
        <label htmlFor="username">{t('اسم المستخدم', 'Username')}</label>
        <div className="username-field">
          <span className="username-prefix" dir="ltr">techmood.app/@</span>
          <input id="username" name="username" defaultValue={profile.username ?? ''} required
                 dir="ltr" pattern="[a-z0-9_]{3,30}" placeholder="ibrahem" />
        </div>
        <small className="muted">
          {t('حروف إنجليزية صغيرة وأرقام و_ فقط. هذا اسم مستعار للعرض؛ معرّفك الحقيقي هو ',
             'Lowercase letters, digits and _ only. This is a display handle; your real identifier is ')}
          <strong>{profile.techmood_id}</strong>
          {t(' ولا يتغيّر.', ', and it never changes.')}
        </small>
      </div>

      <div className="field">
        <label htmlFor="headline">{t('سطر تعريفي', 'Headline')}</label>
        <input id="headline" name="headline" defaultValue={profile.headline ?? ''}
               placeholder={t('مطوّر واجهات أمامية — أتعلّم وأبني في غزة', 'Frontend developer — learning and building in Gaza')} maxLength={120} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="country">{t('الدولة', 'Country')}</label>
          <input id="country" name="country" defaultValue={profile.country ?? ''} placeholder={t('فلسطين', 'Palestine')} />
        </div>
        <div className="field">
          <label htmlFor="city">{t('المدينة', 'City')}</label>
          <input id="city" name="city" defaultValue={profile.city ?? ''} placeholder={t('غزة', 'Gaza')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="language">{t('لغة الواجهة', 'Interface language')}</label>
        <select id="language" name="language" defaultValue={profile.language}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-primary" disabled={pending || uploading}>
          {pending ? t('جارٍ الحفظ…', 'Saving…') : t('التالي', 'Next')}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ step 2 */

function RolesStep({
  roles,
  requested,
  setRequested,
  onBack,
  onDone,
}: {
  roles: RoleRow[];
  requested: UserRole[];
  setRequested: (roles: UserRole[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(requestRoles, undefined);
  const byRole = new Map(roles.map((row) => [row.role, row]));

  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>{t('ماذا تريد أن تفعل هنا؟', 'What do you want to do here?')}</h2>
      <p className="muted">
        {t('الأدوار ليست ترتيباً اجتماعياً — لا يوجد دور «أعلى» من آخر. كل دور يفتح مساحة عمل مختلفة، ويمكنك حمل أكثر من دور في الوقت نفسه.',
           'Roles are not a social ranking — none of them sits above another. Each opens a different workspace, and you can hold more than one at a time.')}
      </p>

      <div className="role-card is-active">
        <div className="row-between">
          <strong>{t('طالب', 'Student')}</strong>
          <span className="pill pill-ok">{t('مفعّل', 'Active')}</span>
        </div>
        <p className="muted">{t(SELECTABLE_ROLES[0].blurb)}</p>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          {t('كل حساب في TechMood طالب — هذا الدور لا يحتاج طلباً ولا يمكن إزالته.', 'Every TechMood account is a student — this role needs no application and cannot be removed.')}
        </p>
      </div>

      {SELECTABLE_ROLES.filter((role) => role.grant !== 'automatic').map((role) => {
        const existing = byRole.get(role.value);
        const checked = requested.includes(role.value);
        return (
          <div className={`role-card${checked || existing ? ' is-selected' : ''}`} key={role.value}>
            <label className="row-between" style={{ cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  name="roles"
                  value={role.value}
                  checked={checked}
                  disabled={Boolean(existing)}
                  onChange={(event) =>
                    setRequested(
                      event.target.checked
                        ? [...requested, role.value]
                        : requested.filter((value) => value !== role.value),
                    )
                  }
                />
                <strong>{t(role.label)}</strong>
              </span>
              {existing
                ? <span className="pill pill-wait">{t(ROLE_STATUS_LABEL[existing.status])}</span>
                : role.grant === 'self_serve'
                  ? <span className="pill pill-ok">{t('يفتح فوراً', 'Opens at once')}</span>
                  : <span className="pill">{t('يحتاج مراجعة', 'Needs review')}</span>}
            </label>
            <p className="muted">{t(role.blurb)}</p>

            {checked && !existing && role.grant === 'review' && (
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor={`note_${role.value}`}>{t('لماذا هذا الدور؟', 'Why this role?')}</label>
                <textarea id={`note_${role.value}`} name={`note_${role.value}`} rows={2}
                          placeholder={t('اكتب سطرين يساعدان من سيراجع طلبك.', 'A couple of lines to help whoever reviews this.')} />
              </div>
            )}
          </div>
        );
      })}

      <p className="notice">
        {t('دور يقول شيئاً عنك — منتور، فريلانسر، مؤسس، قائد فريق، مؤسسة — يبدأ ',
           'A role that makes a claim about you — mentor, freelancer, founder, team lead, organisation — starts as ')}
        <strong>{t('قيد المراجعة', 'pending review')}</strong>
        {t('. أمّا «متدرّب» و«عميل» فيفتحان فوراً: طلب الإرشاد أو وجود عمل تريد تنفيذه ليس ادّعاءً يحتاج من يتحقّق منه.',
           '. Mentee and client open at once: wanting guidance, or having work to hand out, claims nothing anyone could verify.')}
      </p>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-ghost" type="button" onClick={onBack}>{t('رجوع', 'Back')}</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('التالي', 'Next')}
        </button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- steps 3-5 */

function TermStep({
  kind, title, lede, max, terms, value, onChange, onBack, onDone,
}: {
  kind: TaxonomyKind;
  title: string;
  lede: string;
  max?: number;
  terms: Term[];
  value: string[];
  onChange: (ids: string[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveTerms, undefined);
  const [query, setQuery] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  const approvedTerms = useMemo(() => terms.filter((term) => term.status === 'approved'), [terms]);
  const pendingTerms = useMemo(() => terms.filter((term) => term.status === 'pending_review'), [terms]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return approvedTerms;
    return approvedTerms.filter(
      (term) =>
        term.name_ar.toLowerCase().includes(needle) ||
        term.name_en.toLowerCase().includes(needle) ||
        term.slug.includes(needle),
    );
  }, [approvedTerms, query]);

  const atLimit = max !== undefined && value.length >= max;

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
    } else if (!atLimit) {
      onChange([...value, id]);
    }
  }

  return (
    <div className="panel onboarding-card">
      <h2>{title}</h2>
      <p className="muted">{lede}</p>

      <div className="field">
        <label htmlFor={`search_${kind}`}>{t('ابحث', 'Search')}</label>
        <input
          id={`search_${kind}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('اكتب بالعربية أو بالإنجليزية…', 'Type in Arabic or English…')}
        />
      </div>

      <p className="muted" style={{ fontSize: '0.84rem' }}>
        {max !== undefined
          ? t(`اخترت ${value.length} من ${max}`, `${value.length} of ${max} chosen`)
          : t(`اخترت ${value.length}`, `${value.length} chosen`)}
      </p>

      <div className="tags-row term-list">
        {matches.map((term) => {
          const on = value.includes(term.id);
          return (
            <button
              type="button"
              key={term.id}
              className={`tag term-tag${on ? ' is-on' : ''}`}
              aria-pressed={on}
              disabled={!on && atLimit}
              onClick={() => toggle(term.id)}
            >
              {t.locale === 'ar' ? term.name_ar : term.name_en}
              <span className="term-en" dir={t.locale === 'ar' ? 'ltr' : 'rtl'}>
                {t.locale === 'ar' ? term.name_en : term.name_ar}
              </span>
            </button>
          );
        })}
        {matches.length === 0 && (
          <p className="muted">{t('لا نتيجة مطابقة — يمكنك اقتراح المصطلح أدناه.', 'Nothing matches — you can suggest the term below.')}</p>
        )}
      </div>

      {pendingTerms.length > 0 && (
        <p className="notice">
          {t('قيد المراجعة من اقتراحاتك: ', 'Your suggestions under review: ')}
          {pendingTerms.map((term) => (t.locale === 'ar' ? term.name_ar : term.name_en)).join(t('، ', ', '))}
        </p>
      )}

      {suggesting
        ? <SuggestForm kind={kind} onClose={() => setSuggesting(false)} />
        : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSuggesting(true)}>
            {t('لم تجد ما تبحث عنه؟ اقترح مصطلحاً', 'Not finding it? Suggest a term')}
          </button>
        )}

      <form action={formAction} className="onboarding-actions">
        <input type="hidden" name="kind" value={kind} />
        {value.map((id) => <input key={id} type="hidden" name="term" value={id} />)}
        <button className="btn btn-ghost" type="button" onClick={onBack}>{t('رجوع', 'Back')}</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? t('جارٍ الحفظ…', 'Saving…') : t('التالي', 'Next')}
        </button>
      </form>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </div>
  );
}

function SuggestForm({ kind, onClose }: { kind: TaxonomyKind; onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(suggestTerm, undefined);

  return (
    <form action={formAction} className="suggest-form">
      <input type="hidden" name="kind" value={kind} />
      <div className="field-row">
        <div className="field">
          <label htmlFor={`sug_ar_${kind}`}>{t('الاسم بالعربية', 'Name in Arabic')}</label>
          <input id={`sug_ar_${kind}`} name="name_ar" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor={`sug_en_${kind}`}>{t('الاسم بالإنجليزية', 'Name in English')}</label>
          <input id={`sug_en_${kind}`} name="name_en" required minLength={2} dir="ltr" />
        </div>
      </div>
      <p className="muted" style={{ fontSize: '0.82rem' }}>
        {t('الاقتراح يذهب إلى المراجعة ولا يُنشر مباشرة.', 'A suggestion goes to review; it is not published straight away.')}
      </p>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t('جارٍ الإرسال…', 'Sending…') : t('أرسل الاقتراح', 'Send suggestion')}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>{t('إغلاق', 'Close')}</button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ step 6 */

function SummaryStep({
  profile, roles, approved, requested, picked, catalogues, onBack,
}: {
  profile: Props['profile'];
  roles: RoleRow[];
  approved: UserRole[];
  requested: UserRole[];
  picked: Record<TaxonomyKind, string[]>;
  catalogues: Record<TaxonomyKind, Term[]>;
  onBack: () => void;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(finishOnboarding, undefined);

  function names(kind: TaxonomyKind) {
    const lookup = new Map(
      catalogues[kind].map((term) => [term.id, t.locale === 'ar' ? term.name_ar : term.name_en]),
    );
    return picked[kind].map((id) => lookup.get(id)).filter(Boolean) as string[];
  }

  const pending_roles = roles.filter((row) => row.status !== 'approved');

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>{t('حسابك جاهز', 'Your account is ready')}</h2>

      <dl className="summary-list">
        <div>
          <dt>{t('معرّف TechMood', 'TechMood ID')}</dt>
          <dd><span className="id-chip">{profile.techmood_id}</span></dd>
        </div>
        <div>
          <dt>{t('الاسم', 'Name')}</dt>
          <dd>{profile.display_name ?? profile.full_name}</dd>
        </div>
        <div>
          <dt>{t('المجالات', 'Fields')}</dt>
          <dd>{names('field').join(t('، ', ', ')) || '—'}</dd>
        </div>
        <div>
          <dt>{t('الاهتمامات', 'Interests')}</dt>
          <dd>{names('interest').join(t('، ', ', ')) || '—'}</dd>
        </div>
        <div>
          <dt>{t('المهارات', 'Skills')}</dt>
          <dd>{names('skill').join(t('، ', ', ')) || '—'}</dd>
        </div>
      </dl>

      <h3 style={{ fontSize: '0.95rem', marginTop: 18 }}>{t('أدوارك', 'Your roles')}</h3>
      <ul className="summary-roles">
        <li>
          <span>{t(roleLabel('student'))}</span>
          <span className="pill pill-ok">{t('مفعّل', 'Active')}</span>
        </li>
        {roles.filter((row) => row.role !== 'student').map((row) => (
          <li key={row.id}>
            <span>{t(roleLabel(row.role))}</span>
            <span className={`pill pill-${row.status === 'approved' ? 'ok' : 'wait'}`}>
              {t(ROLE_STATUS_LABEL[row.status])}
            </span>
          </li>
        ))}
        {requested.length === 0 && roles.length <= 1 && (
          <li className="muted">{t('لم تطلب أدواراً إضافية — يمكنك طلبها لاحقاً من «أدواري».', 'You have not asked for any extra roles — you can do that later from My roles.')}</li>
        )}
      </ul>

      {pending_roles.length > 0 && (
        <p className="notice">
          {t('الأدوار قيد المراجعة تظهر في حسابك من الآن، لكن مساحة العمل الخاصة بها تبقى مغلقة حتى الاعتماد.',
             'Roles under review show up on your account right away, but their workspace stays shut until they are approved.')}
        </p>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="primary_role">{t('الدور الأساسي', 'Primary role')}</label>
        <select id="primary_role" name="primary_role" defaultValue="student">
          {approved.map((role) => (
            <option key={role} value={role}>{t(roleLabel(role))}</option>
          ))}
        </select>
        <small className="muted">
          {t('هو ما تفتح عليه المنصة عند الدخول، ويمكنك تغييره متى شئت. لا يعني أنه أهم من بقية أدوارك.',
             'This is what the platform opens on when you sign in, and you can change it whenever you like. It does not make that role more important than the rest.')}
        </small>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-ghost" type="button" onClick={onBack}>{t('رجوع', 'Back')}</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? t('جارٍ الإنهاء…', 'Finishing…') : t('ابدأ رحلتك', 'Start your journey')}
        </button>
      </div>
    </form>
  );
}
