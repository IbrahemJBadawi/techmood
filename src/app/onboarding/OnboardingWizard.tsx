'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { SELECTABLE_ROLES, ROLE_STATUS_LABEL, roleLabel } from '@/lib/roles';
import type { RoleStatus, TaxonomyKind, UiLanguage, UserRole } from '@/lib/database.types';

import { finishOnboarding, requestRoles, saveBasics, saveTerms, suggestTerm } from './actions';

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

const STEPS = [
  'المعلومات الأساسية',
  'الأدوار',
  'المجالات',
  'الاهتمامات',
  'المهارات',
  'الملخّص',
];

export function OnboardingWizard({ userId, profile, roles, catalogues, selected }: Props) {
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
            <span className="logo-mark" />
            TechMood
          </div>
          <span className="id-chip">{profile.techmood_id}</span>
        </div>
        <h1>لنُعِدّ حسابك</h1>
        <p className="muted">
          هذه المعلومات تبني هويتك المهنية الواحدة. رقمك <strong>{profile.techmood_id}</strong> صدر
          بالفعل ولا يتغيّر مهما غيّرت اسمك أو أدوارك.
        </p>

        <ol className="stepper">
          {STEPS.map((label, index) => (
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
          title="المجالات"
          lede="أين تعمل؟ ثلاثة مجالات كحد أقصى — هذه هي التي تقود المطابقة مع المنتورز والفرق والفرص."
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
          title="الاهتمامات"
          lede="ما الذي يهمّك؟ بلا حد أقصى — هذه تقود التوصيات وما يظهر لك في المنصة."
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
          title="المهارات"
          lede="ما الذي تستطيع فعله؟ بلا حد أقصى. المهارة تبقى منفصلة عن المجال والاهتمام، ويمكن لأعمالك المعتمدة أن توثّقها لاحقاً."
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
      setUploadError('تعذّر رفع الصورة.');
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatar(data.publicUrl);
    }
    setUploading(false);
  }

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>من أنت؟</h2>

      <div className="avatar-picker">
        <span className="avatar-preview" aria-hidden="true">
          {avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatar} alt="" width={72} height={72} />
            : (profile.display_name ?? profile.full_name).slice(0, 1)}
        </span>
        <div>
          <label className="btn btn-ghost btn-sm" htmlFor="avatar">
            {uploading ? 'جارٍ الرفع…' : 'اختر صورة'}
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
            اختيارية. تظهر في ملفك العام وفي الفرق التي تنضم إليها.
          </p>
          {uploadError && <p className="notice notice-danger">{uploadError}</p>}
        </div>
      </div>
      <input type="hidden" name="avatar_url" value={avatar} />

      <div className="field-row">
        <div className="field">
          <label htmlFor="full_name">الاسم الكامل بالإنجليزية</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} required
                 dir="ltr" placeholder="Ibrahem Jamal Badawi" />
          <small className="muted">كما تريده أن يظهر على الشهادات.</small>
        </div>
        <div className="field">
          <label htmlFor="display_name">الاسم الظاهر</label>
          <input id="display_name" name="display_name"
                 defaultValue={profile.display_name ?? profile.full_name} required
                 placeholder="إبراهيم" />
          <small className="muted">ما يناديك به الناس داخل المنصة.</small>
        </div>
      </div>

      <div className="field">
        <label htmlFor="username">اسم المستخدم</label>
        <div className="username-field">
          <span className="username-prefix" dir="ltr">techmood.app/@</span>
          <input id="username" name="username" defaultValue={profile.username ?? ''} required
                 dir="ltr" pattern="[a-z0-9_]{3,30}" placeholder="ibrahem" />
        </div>
        <small className="muted">
          حروف إنجليزية صغيرة وأرقام و_ فقط. هذا اسم مستعار للعرض؛ معرّفك الحقيقي
          هو <strong>{profile.techmood_id}</strong> ولا يتغيّر.
        </small>
      </div>

      <div className="field">
        <label htmlFor="headline">سطر تعريفي</label>
        <input id="headline" name="headline" defaultValue={profile.headline ?? ''}
               placeholder="مطوّر واجهات أمامية — أتعلّم وأبني في غزة" maxLength={120} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="country">الدولة</label>
          <input id="country" name="country" defaultValue={profile.country ?? ''} placeholder="فلسطين" />
        </div>
        <div className="field">
          <label htmlFor="city">المدينة</label>
          <input id="city" name="city" defaultValue={profile.city ?? ''} placeholder="غزة" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="language">لغة الواجهة</label>
        <select id="language" name="language" defaultValue={profile.language}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-primary" disabled={pending || uploading}>
          {pending ? 'جارٍ الحفظ…' : 'التالي'}
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
  const [state, formAction, pending] = useActionState(requestRoles, undefined);
  const byRole = new Map(roles.map((row) => [row.role, row]));

  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>ماذا تريد أن تفعل هنا؟</h2>
      <p className="muted">
        الأدوار ليست ترتيباً اجتماعياً — لا يوجد دور «أعلى» من آخر. كل دور يفتح
        مساحة عمل مختلفة، ويمكنك حمل أكثر من دور في الوقت نفسه.
      </p>

      <div className="role-card is-active">
        <div className="row-between">
          <strong>طالب</strong>
          <span className="pill pill-ok">مفعّل</span>
        </div>
        <p className="muted">{SELECTABLE_ROLES[0].blurb}</p>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          كل حساب في TechMood طالب — هذا الدور لا يحتاج طلباً ولا يمكن إزالته.
        </p>
      </div>

      {SELECTABLE_ROLES.filter((role) => role.needsReview).map((role) => {
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
                <strong>{role.label}</strong>
              </span>
              {existing
                ? <span className="pill pill-wait">{ROLE_STATUS_LABEL[existing.status]}</span>
                : <span className="pill">يحتاج مراجعة</span>}
            </label>
            <p className="muted">{role.blurb}</p>

            {checked && !existing && (
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor={`note_${role.value}`}>لماذا هذا الدور؟</label>
                <textarea id={`note_${role.value}`} name={`note_${role.value}`} rows={2}
                          placeholder="اكتب سطرين يساعدان من سيراجع طلبك." />
              </div>
            )}
          </div>
        );
      })}

      <p className="notice">
        الأدوار التي تطلبها تبدأ بحالة <strong>قيد المراجعة</strong>. تراها في
        حسابك، لكنك لا تدخل مساحتها قبل الاعتماد.
      </p>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-ghost" type="button" onClick={onBack}>رجوع</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الإرسال…' : 'التالي'}
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
        <label htmlFor={`search_${kind}`}>ابحث</label>
        <input
          id={`search_${kind}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="اكتب بالعربية أو بالإنجليزية…"
        />
      </div>

      <p className="muted" style={{ fontSize: '0.84rem' }}>
        {max !== undefined
          ? `اخترت ${value.length} من ${max}`
          : `اخترت ${value.length}`}
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
              {term.name_ar}
              <span className="term-en" dir="ltr">{term.name_en}</span>
            </button>
          );
        })}
        {matches.length === 0 && (
          <p className="muted">لا نتيجة مطابقة — يمكنك اقتراح المصطلح أدناه.</p>
        )}
      </div>

      {pendingTerms.length > 0 && (
        <p className="notice">
          قيد المراجعة من اقتراحاتك: {pendingTerms.map((term) => term.name_ar).join('، ')}
        </p>
      )}

      {suggesting
        ? <SuggestForm kind={kind} onClose={() => setSuggesting(false)} />
        : (
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSuggesting(true)}>
            لم تجد ما تبحث عنه؟ اقترح مصطلحاً
          </button>
        )}

      <form action={formAction} className="onboarding-actions">
        <input type="hidden" name="kind" value={kind} />
        {value.map((id) => <input key={id} type="hidden" name="term" value={id} />)}
        <button className="btn btn-ghost" type="button" onClick={onBack}>رجوع</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الحفظ…' : 'التالي'}
        </button>
      </form>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}
    </div>
  );
}

function SuggestForm({ kind, onClose }: { kind: TaxonomyKind; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(suggestTerm, undefined);

  return (
    <form action={formAction} className="suggest-form">
      <input type="hidden" name="kind" value={kind} />
      <div className="field-row">
        <div className="field">
          <label htmlFor={`sug_ar_${kind}`}>الاسم بالعربية</label>
          <input id={`sug_ar_${kind}`} name="name_ar" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor={`sug_en_${kind}`}>الاسم بالإنجليزية</label>
          <input id={`sug_en_${kind}`} name="name_en" required minLength={2} dir="ltr" />
        </div>
      </div>
      <p className="muted" style={{ fontSize: '0.82rem' }}>
        الاقتراح يذهب إلى المراجعة ولا يُنشر مباشرة.
      </p>
      {state?.error && <p className="notice notice-danger">{state.error}</p>}
      {state?.ok && <p className="notice notice-ok">{state.ok}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'جارٍ الإرسال…' : 'أرسل الاقتراح'}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>إغلاق</button>
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
  const [state, formAction, pending] = useActionState(finishOnboarding, undefined);

  function names(kind: TaxonomyKind) {
    const lookup = new Map(catalogues[kind].map((term) => [term.id, term.name_ar]));
    return picked[kind].map((id) => lookup.get(id)).filter(Boolean) as string[];
  }

  const pending_roles = roles.filter((row) => row.status !== 'approved');

  return (
    <form action={formAction} className="panel onboarding-card">
      <h2>حسابك جاهز</h2>

      <dl className="summary-list">
        <div>
          <dt>معرّف TechMood</dt>
          <dd><span className="id-chip">{profile.techmood_id}</span></dd>
        </div>
        <div>
          <dt>الاسم</dt>
          <dd>{profile.display_name ?? profile.full_name}</dd>
        </div>
        <div>
          <dt>المجالات</dt>
          <dd>{names('field').join('، ') || '—'}</dd>
        </div>
        <div>
          <dt>الاهتمامات</dt>
          <dd>{names('interest').join('، ') || '—'}</dd>
        </div>
        <div>
          <dt>المهارات</dt>
          <dd>{names('skill').join('، ') || '—'}</dd>
        </div>
      </dl>

      <h3 style={{ fontSize: '0.95rem', marginTop: 18 }}>أدوارك</h3>
      <ul className="summary-roles">
        <li>
          <span>{roleLabel('student')}</span>
          <span className="pill pill-ok">مفعّل</span>
        </li>
        {roles.filter((row) => row.role !== 'student').map((row) => (
          <li key={row.id}>
            <span>{roleLabel(row.role)}</span>
            <span className={`pill pill-${row.status === 'approved' ? 'ok' : 'wait'}`}>
              {ROLE_STATUS_LABEL[row.status]}
            </span>
          </li>
        ))}
        {requested.length === 0 && roles.length <= 1 && (
          <li className="muted">لم تطلب أدواراً إضافية — يمكنك طلبها لاحقاً من «أدواري».</li>
        )}
      </ul>

      {pending_roles.length > 0 && (
        <p className="notice">
          الأدوار قيد المراجعة تظهر في حسابك من الآن، لكن مساحة العمل الخاصة بها
          تبقى مغلقة حتى الاعتماد.
        </p>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="primary_role">الدور الأساسي</label>
        <select id="primary_role" name="primary_role" defaultValue="student">
          {approved.map((role) => (
            <option key={role} value={role}>{roleLabel(role)}</option>
          ))}
        </select>
        <small className="muted">
          هو ما تفتح عليه المنصة عند الدخول، ويمكنك تغييره متى شئت. لا يعني أنه
          أهم من بقية أدوارك.
        </small>
      </div>

      {state?.error && <p className="notice notice-danger">{state.error}</p>}

      <div className="onboarding-actions">
        <button className="btn btn-ghost" type="button" onClick={onBack}>رجوع</button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'جارٍ الإنهاء…' : 'ابدأ رحلتك'}
        </button>
      </div>
    </form>
  );
}
