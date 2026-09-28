import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';
import { Icon } from '@/components/Icon';
import { TICKET_CATEGORY, TICKET_STATUS } from '@/lib/support';
import type { Text } from '@/lib/i18n';
import type { TicketCategory, TicketStatus } from '@/lib/database.types';

export const metadata = { title: 'Help & reports — TechMood' };

// The problems people bring most, one tap from a form with the kind chosen.
const QUICK: { key: TicketCategory; icon: string; color: string; hint: Text }[] = [
  { key: 'payment',   icon: '💳', color: '#16A36A', hint: { ar: 'دفعت ولم يتأكد شيء', en: 'Paid and nothing confirmed' } },
  { key: 'booking',   icon: '🗓️', color: '#0B8FB3', hint: { ar: 'موعد، إلغاء، أو غياب', en: 'A time, a cancellation, a no-show' } },
  { key: 'mentor',    icon: '🧑‍🏫', color: '#7C5CFF', hint: { ar: 'مشكلة مع منتور', en: 'A problem with a mentor' } },
  { key: 'technical', icon: '🛠️', color: '#E8590C', hint: { ar: 'شيء لا يعمل كما يجب', en: 'Something is not working' } },
  { key: 'account',   icon: '🔐', color: '#2F6BFF', hint: { ar: 'الدخول، البريد، البيانات', en: 'Sign-in, email, your details' } },
  { key: 'behavior',  icon: '🚩', color: '#D6336C', hint: { ar: 'إساءة أو سلوك غير لائق', en: 'Abuse or misconduct' } },
];

const STATUS_COLOR: Partial<Record<TicketStatus, string>> = {
  open: '#2F6BFF', assistant: '#0B8FB3', needs_human: '#E8590C', pending_user: '#D64545',
  under_review: '#C77700', resolved: '#16A36A', rejected: '#5B6B7C', closed: '#5B6B7C',
};

/**
 * Support Center: the person's own tickets, newest activity first.
 * A problem is not only a complaint — a payment question, a booking that did
 * not go through, a bug — so it is "Help & reports", not "Complaints".
 */
export default async function SupportCenterPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: tickets }, { data: articles }] = await Promise.all([
    supabase.rpc('my_tickets'),
    supabase.from('kb_articles').select('slug, title_ar, title_en').eq('status', 'published').order('sort_order').limit(12),
  ]);
  const date = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' });

  const list = tickets ?? [];
  const open = list.filter((ticket) => !['resolved', 'rejected', 'closed'].includes(ticket.status));
  const done = list.filter((ticket) => ['resolved', 'rejected', 'closed'].includes(ticket.status));

  return (
    <div className="sp-page">
      <section className="sp-hero section-block">
        <div>
          <h1>{t('كيف نقدر نساعدك؟', 'How can we help?')}</h1>
          <p>
            {t('يردّ عليك المساعد فوراً بما يعرفه عن عمليتك، ويحوّل ما يحتاج قراراً إلى فريق الدعم. ما تكتبه يراه فريق الدعم فقط.',
               'The assistant answers at once with what it knows about your operation, and sends anything that needs a decision to the support team. Only the support team reads what you write.')}
          </p>
        </div>
        <Link className="btn sp-hero-cta" href="/support/new">{t('بلّغ عن مشكلة', 'Report a problem')}</Link>
      </section>

      <section className="section-block">
        <div className="hm-head"><h2>{t('ابدأ من هنا', 'Start here')}</h2></div>
        <div className="sp-topics">
          {QUICK.map((topic) => (
            <Link className="hm-card sp-topic" href={`/support/new?category=${topic.key}`} key={topic.key}>
              <span className="sp-topic-icon" style={{ background: `color-mix(in srgb, ${topic.color} 14%, transparent)` }} aria-hidden="true">{topic.icon}</span>
              <strong>{t(TICKET_CATEGORY[topic.key])}</strong>
              <span className="muted">{t(topic.hint)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="hm-head">
          <h2>{t('بلاغاتي', 'My reports')}{open.length > 0 && <span className="hm-count" style={{ marginInlineStart: 8 }}>{open.length}</span>}</h2>
        </div>
        {list.length === 0 ? (
          <div className="hm-card hm-empty">
            <span className="hm-empty-icon" aria-hidden="true"><Icon name="check" size={22} /></span>
            <div>
              <strong>{t('لا بلاغات لديك', 'No reports')}</strong>
              <p className="muted">{t('إن واجهتك مشكلة، اختر نوعها من فوق.', 'If something goes wrong, pick its kind above.')}</p>
            </div>
          </div>
        ) : (
          <ul className="hm-card hm-list">
            {[...open, ...done].map((ticket) => (
              <li key={ticket.id}>
                <Link className="hm-row" href={`/support/${ticket.id}`}>
                  <span className="hm-row-icon" style={{ background: STATUS_COLOR[ticket.status] ?? '#5B6B7C' }}>
                    <Icon name={['resolved', 'closed'].includes(ticket.status) ? 'check' : 'message'} size={16} />
                  </span>
                  <span className="hm-row-main">
                    <strong>{ticket.subject_ar}</strong>
                    <span className="muted">
                      <bdi className="eng">#{ticket.code}</bdi> · {t(TICKET_CATEGORY[ticket.category])} · <span className="date">{date.format(new Date(ticket.updated_at))}</span>
                    </span>
                  </span>
                  <span className={`status-pill ${TICKET_STATUS[ticket.status].className}`}>{t(TICKET_STATUS[ticket.status].label)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(articles ?? []).length > 0 && (
        <section className="section-block">
          <div className="hm-head"><h2>{t('أسئلة شائعة', 'Common questions')}</h2></div>
          <ul className="st-group">
            {articles!.map((article) => (
              <li key={article.slug}>
                <Link className="st-row" href={`/support/help/${article.slug}`}>
                  <span className="st-row-icon" style={{ background: '#0B8FB3' }} aria-hidden="true">?</span>
                  <span className="st-row-main">
                    <strong>{t.locale === 'en' && article.title_en ? article.title_en : article.title_ar}</strong>
                  </span>
                  <span className="st-chevron" aria-hidden="true"><Icon name="arrow" size={16} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
