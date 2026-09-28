import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/ActionForm';
import { aiConfigured } from '@/lib/ai-claude';
import { CASE_STATUS, FEATURE } from '@/lib/cases';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { TICKET_PRIORITY } from '@/lib/support';

import { addCaseEvidence, addCaseNote, assistCase, linkToCase } from '../../support/actions';
import { CaseActionForm } from './CaseActionForm';

const LINK_TYPES = ['booking', 'payment', 'escrow', 'project', 'video_session', 'message', 'payout', 'ticket', 'profile'] as const;

/**
 * Case management: everything about one case in one place — who reported whom,
 * the operations, the evidence, what the AI read (a suggestion), the admins'
 * notes, the timeline, and the decision with the actions that followed it.
 */
export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) redirect('/home');

  const { data: item } = await supabase.from('cases').select('*').eq('id', caseId).maybeSingle();
  if (!item) notFound();

  const [{ data: links }, { data: notes }, { data: evidence }, { data: events }, { data: facts }, { data: tickets }] = await Promise.all([
    supabase.from('case_links').select('entity_type, entity_id, note_ar, created_at').eq('case_id', caseId).order('created_at'),
    supabase.from('case_notes').select('id, author_id, body_ar, created_at').eq('case_id', caseId).order('created_at'),
    supabase.from('case_evidence').select('id, label_ar, path, url, created_at').eq('case_id', caseId).order('created_at'),
    supabase.from('case_events').select('id, kind, note_ar, created_at').eq('case_id', caseId).order('created_at', { ascending: false }),
    supabase.rpc('case_facts', { p_case: caseId }),
    supabase.from('support_tickets').select('id, code, subject_ar, status').eq('case_id', caseId),
  ]);

  const profileIds = [...new Set([
    item.reporter_id, item.reported_profile_id,
    ...(links ?? []).filter((row) => row.entity_type === 'profile').map((row) => row.entity_id),
  ].filter(Boolean))] as string[];
  const bookingIds = (links ?? []).filter((row) => row.entity_type === 'booking').map((row) => row.entity_id);
  const escrowIds = (links ?? []).filter((row) => row.entity_type === 'escrow').map((row) => row.entity_id);
  const sessionIds = (links ?? []).filter((row) => row.entity_type === 'video_session').map((row) => row.entity_id);
  const none = ['00000000-0000-0000-0000-000000000000'];

  const [{ data: people }, { data: bookings }, { data: escrows }, { data: sessions }, { data: restrictions }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, techmood_id').in('id', profileIds.length ? profileIds : none),
    supabase.from('bookings').select('id, booking_code, status').in('id', bookingIds.length ? bookingIds : none),
    supabase.from('escrows').select('id, escrow_code, status').in('id', escrowIds.length ? escrowIds : none),
    supabase.from('video_sessions').select('id, session_code, status').in('id', sessionIds.length ? sessionIds : none),
    supabase.from('user_restrictions').select('id, profile_id, feature, reason_ar, ends_at')
      .in('profile_id', profileIds.length ? profileIds : none).is('lifted_at', null),
  ]);

  const nameOf = new Map((people ?? []).map((row) => [row.id, `${row.full_name} (${row.techmood_id})`]));
  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'short', timeStyle: 'short' });
  const featureLabel = (feature: string) => feature === 'everything' ? t('الحساب كله', 'The whole account') : t(FEATURE[feature as keyof typeof FEATURE]);

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/admin/cases">{t('→ القضايا', '← Cases')}</Link>

      <section className="panel section-block" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="kicker eng">Case #{item.code}</p>
            <h2 style={{ fontSize: '1.15rem', marginTop: 4 }}>{item.title_ar}</h2>
            <p style={{ fontSize: '0.86rem', marginTop: 8 }}>
              {t('المُبلِّغ: ', 'Reporter: ')}
              {item.reporter_id ? <Link href={`/admin/users/${item.reporter_id}`}>{nameOf.get(item.reporter_id)}</Link> : '—'}
              {' · '}{t('المُبلَّغ عنه: ', 'Reported: ')}
              {item.reported_profile_id ? <Link href={`/admin/users/${item.reported_profile_id}`}>{nameOf.get(item.reported_profile_id)}</Link> : '—'}
            </p>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className={`status-pill ${CASE_STATUS[item.status].className}`}>{t(CASE_STATUS[item.status].label)}</span>
            <span className={`status-pill ${TICKET_PRIORITY[item.priority].className}`}>{t(TICKET_PRIORITY[item.priority].label)}</span>
          </div>
        </div>
        {item.decision_ar && (
          <p className="notice notice-ok" style={{ marginTop: 12 }}><strong>{t('القرار: ', 'Decision: ')}</strong>{item.decision_ar}</p>
        )}
      </section>

      <div className="detail-grid">
        <section>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('الحقائق المجمّعة', 'The facts, gathered')}</h3>
            <ul className="lesson-outcomes" style={{ marginTop: 8 }}>
              {(facts?.facts ?? []).map((line, index) => <li key={index} style={{ fontSize: '0.86rem' }}>{line}</li>)}
            </ul>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
              {t(`${facts?.messages ?? 0} رسالة في البلاغات، ${facts?.attachments ?? 0} مرفق، ${facts?.evidence ?? 0} دليل.`,
                 `${facts?.messages ?? 0} ticket messages, ${facts?.attachments ?? 0} attachments, ${facts?.evidence ?? 0} pieces of evidence.`)}
            </p>
            {(tickets ?? []).map((ticket) => (
              <Link key={ticket.id} className="badge-pill" href={`/admin/support/${ticket.id}`} style={{ marginTop: 8 }}>
                <span className="eng">#{ticket.code}</span> {ticket.subject_ar}
              </Link>
            ))}
          </div>

          <div className="panel section-block">
            <div className="row-between">
              <h3 style={{ fontSize: '0.98rem' }}>✨ AI Assist</h3>
              <ActionForm action={assistCase} variant="ghost" submitLabel={t('اقرأ القضية', 'Read the case')}>
                <input type="hidden" name="case_id" value={item.id} />
              </ActionForm>
            </div>
            {!aiConfigured() && (
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                {t('غير موصول بمزوّد نموذج هنا — الحقائق أعلاه من قاعدة البيانات مباشرة.', 'No model provider is connected here — the facts above come straight from the database.')}
              </p>
            )}
            {item.ai_summary_ar && (
              <>
                <p style={{ fontSize: '0.88rem', marginTop: 8, whiteSpace: 'pre-line' }}>{item.ai_summary_ar}</p>
                <p style={{ fontSize: '0.86rem', marginTop: 8 }}><strong>{t('الخطوة المقترحة: ', 'Suggested next step: ')}</strong>{item.ai_next_step_ar}</p>
                <p className="muted" style={{ fontSize: '0.76rem' }}>{t('اقتراح — القرار للإدارة.', 'A suggestion — the administration decides.')}</p>
              </>
            )}
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('المرتبط بالقضية', 'Linked to the case')}</h3>
            <ul className="admin-mini-list" style={{ marginTop: 8 }}>
              {(links ?? []).map((row) => (
                <li key={`${row.entity_type}-${row.entity_id}`}>
                  <span className="tag">{row.entity_type}</span>
                  {row.entity_type === 'profile'
                    ? <Link href={`/admin/users/${row.entity_id}`}>{nameOf.get(row.entity_id) ?? row.entity_id}</Link>
                    : <span className="eng muted">{row.entity_id.slice(0, 8)}</span>}
                  {row.note_ar && <span className="muted">{row.note_ar}</span>}
                </li>
              ))}
            </ul>
            <ActionForm action={linkToCase} className="admin-inline-form" variant="ghost" submitLabel={t('اربط', 'Link')}>
              <input type="hidden" name="case_id" value={item.id} />
              <select name="type" aria-label={t('النوع', 'Type')}>
                {LINK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input name="entity_id" required placeholder="uuid" className="eng" pattern="[0-9a-fA-F-]{36}" />
              <input name="note" placeholder={t('ملاحظة', 'Note')} />
            </ActionForm>
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('الأدلة', 'Evidence')}</h3>
            <ul className="admin-mini-list" style={{ marginTop: 8 }}>
              {(evidence ?? []).map((row) => (
                <li key={row.id}>📎 {row.url ? <a href={row.url} target="_blank" rel="noreferrer noopener">{row.label_ar}</a> : row.label_ar}</li>
              ))}
            </ul>
            <ActionForm action={addCaseEvidence} className="admin-inline-form" variant="ghost" submitLabel={t('أضف دليلاً', 'Add evidence')}>
              <input type="hidden" name="case_id" value={item.id} />
              <input name="label" required placeholder={t('الوصف', 'Label')} />
              <input name="url" type="url" required pattern="https://.*" placeholder="https://…" />
            </ActionForm>
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem' }}>{t('ملاحظات الإدارة', 'Admin notes')}</h3>
            {(notes ?? []).map((row) => (
              <p key={row.id} style={{ fontSize: '0.86rem', marginTop: 8 }}>
                <span className="muted" style={{ fontSize: '0.74rem' }}>{time.format(new Date(row.created_at))} — </span>{row.body_ar}
              </p>
            ))}
            <ActionForm action={addCaseNote} className="stack" variant="ghost" submitLabel={t('أضف ملاحظة', 'Add a note')}>
              <input type="hidden" name="case_id" value={item.id} />
              <textarea name="body" rows={2} required aria-label={t('ملاحظة', 'Note')} />
            </ActionForm>
          </div>
        </section>

        <aside>
          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('القرار والإجراء', 'Decision and action')}</h3>
            <CaseActionForm
              caseId={item.id}
              people={profileIds.map((id) => ({ value: id, label: nameOf.get(id) ?? id }))}
              targets={[
                ...(bookings ?? []).map((row) => ({ value: row.id, label: `${t('حجز', 'Booking')} ${row.booking_code} (${row.status})` })),
                ...(escrows ?? []).map((row) => ({ value: row.id, label: `${t('مبلغ محتجز', 'Escrow')} ${row.escrow_code} (${row.status})` })),
                ...(sessions ?? []).map((row) => ({ value: row.id, label: `${t('جلسة', 'Session')} ${row.session_code} (${row.status})` })),
              ]}
              restrictions={(restrictions ?? [])
                .filter((row) => !row.ends_at || new Date(row.ends_at) > new Date())
                .map((row) => ({ value: row.id, label: `${nameOf.get(row.profile_id) ?? ''} — ${featureLabel(row.feature)}` }))}
            />
          </div>

          <div className="panel section-block">
            <h3 style={{ fontSize: '0.98rem', marginBottom: 10 }}>{t('الخط الزمني', 'Timeline')}</h3>
            <ul className="finance-timeline">
              {(events ?? []).map((row) => (
                <li key={row.id}>
                  <span className="finance-dot">•</span>
                  <div>
                    <strong style={{ fontSize: '0.84rem' }}>{row.note_ar ?? row.kind}</strong>
                    <div className="muted" style={{ fontSize: '0.74rem' }}>{time.format(new Date(row.created_at))}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
