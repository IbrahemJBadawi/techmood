import Link from 'next/link';

import { LikeButton } from '@/components/Social';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Stars } from '@/components/Stars';
import { createClient } from '@/lib/supabase/server';
import { getLocale, getT } from '@/lib/i18n.server';
import { formatDate } from '@/lib/i18n';
import { money } from '@/lib/booking';
import { siteOrigin } from '@/lib/site';
import { PUBLIC_METHOD_COLUMNS, type PaymentMethodPublic, type ProjectLink, type ShowcasePage } from '@/lib/database.types';
import { CATEGORIES, LICENCE, LINK_KINDS, PRODUCT_TYPES, galleryPath, mediaUrl, memberHref, videoEmbed } from '@/lib/showcase';

import {
  AdminHideForm, BuyBox, CommentForm, OfferBox, ReplyToggle, ShareRow, TrackedLink, ViewPing,
} from './ShowcaseClient';
import { DeleteCommentButton } from './DeleteCommentButton';

/**
 * One project page (0121, 0122) — the same page in the public gallery link and
 * inside the app. Everything shown is what the database's showcase functions
 * return for this visitor: a public page for anyone, a preview for its editors.
 */
export async function ShowcaseView({ page, inApp }: { page: ShowcasePage; inApp: boolean }) {
  const t = await getT();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: reviews }, { data: comments }, { data: people }, { data: likeRows }, { data: isAdmin }, { data: evaluatorRows }] = await Promise.all([
    supabase.rpc('showcase_reviews', { p_project: page.project_id }),
    supabase.rpc('showcase_comments', { p_project: page.project_id }),
    supabase.rpc('showcase_people', { p_project: page.project_id }),
    supabase.rpc('project_like_stats', { p_projects: [page.project_id] }),
    user ? supabase.rpc('is_admin') : Promise.resolve({ data: false }),
    // the mentor who evaluated the work (0127)
    page.mentor_rating !== null ? supabase.rpc('showcase_evaluator', { p_project: page.project_id }) : Promise.resolve({ data: [] }),
  ]);
  const evaluator = evaluatorRows?.[0] ?? null;

  const listing = page.listing_id && page.listing_status && ['listed', 'reserved', 'sold'].includes(page.listing_status) ? page : null;
  const isPeople = (people ?? []).some((person) => person.profile_id === user?.id);
  const canBuy = Boolean(user && listing?.listing_status === 'listed' && !page.can_edit && !isPeople);

  const [{ data: methods }, { data: agreedRows }, { data: minPctRow }] = await Promise.all([
    canBuy ? supabase.from('payment_methods').select(PUBLIC_METHOD_COLUMNS).eq('is_enabled', true).order('sort_order') : Promise.resolve({ data: [] }),
    canBuy && listing ? supabase.from('listing_offers').select('id, agreed_usd, expires_at')
      .eq('listing_id', listing.listing_id!).eq('buyer_id', user!.id).eq('status', 'accepted')
      .gt('expires_at', new Date().toISOString()).limit(1) : Promise.resolve({ data: [] }),
    canBuy && listing?.negotiable ? supabase.from('platform_settings').select('value').eq('key', 'offer_min_pct').maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const agreed = agreedRows?.[0] ? { offerId: agreedRows[0].id as string, amount: Number(agreedRows[0].agreed_usd) } : null;

  const like = likeRows?.[0];
  const shareUrl = `${await siteOrigin()}${galleryPath(page.code)}`;
  const video = videoEmbed(page.video_url);
  const links = (page.links ?? []) as ProjectLink[];
  const topComments = (comments ?? []).filter((comment) => !comment.parent_id);
  const repliesOf = (id: string) => (comments ?? []).filter((comment) => comment.parent_id === id);
  const here = inApp ? `/p/${page.code}` : galleryPath(page.code);

  return (
    <div className="sc-page">
      {page.is_public_page && <ViewPing projectId={page.project_id} />}

      {!page.is_public_page && page.can_edit && (
        <p className="notice section-block">
          {page.hidden_note
            ? <>{t('أخفت TechMood هذا المشروع: ', 'TechMood hid this project: ')}{page.hidden_note}</>
            : t('معاينة: الصفحة غير منشورة بعد — انشرها في المعرض أو اعرضها للبيع من «تعديل الصفحة».',
                'Preview: the page is not public yet — publish it in the gallery or list it for sale from “Edit page”.')}
        </p>
      )}

      <div className="sc-layout">
        <div className="sc-main">
          {page.images.length > 0 && (
            <div className="sc-gallery" aria-label={t('صور المشروع', 'Project pictures')}>
              {page.images.map((path, index) => (
                <figure key={path} className="sc-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(path) ?? ''} alt={t(`صورة ${index + 1} من ${page.title}`, `Picture ${index + 1} of ${page.title}`)}
                       loading={index === 0 ? 'eager' : 'lazy'} />
                </figure>
              ))}
            </div>
          )}

          <header className="sc-head">
            <div className="sc-badges">
              {page.product_type && <span className="sc-badge">{t(PRODUCT_TYPES[page.product_type])}</span>}
              {page.category && CATEGORIES[page.category] && <span className="sc-badge is-soft">{t(CATEGORIES[page.category])}</span>}
              {page.in_gallery && <span className="sc-badge is-soft">🖼️ {t('في المعرض', 'In the gallery')}</span>}
              {listing && <span className="sc-badge is-soft">🛒 {listing.listing_status === 'sold' ? t('مباع', 'Sold') : t('للبيع', 'For sale')}</span>}
            </div>
            <h1>{page.title}</h1>
            {page.tagline && <p className="sc-tagline">{page.tagline}</p>}
            <p className="sc-code eng">{page.code}</p>
          </header>

          <div className="sc-stats" aria-label={t('أرقام المشروع', 'Project numbers')}>
            <LikeButton projectId={page.project_id} likes={like?.likes ?? page.likes} liked={like?.i_like ?? false}
                        canLike={!page.can_edit && !isPeople} signedIn={Boolean(user)} path={here} />
            <span title={t('مشاهدات', 'Views')}>👁️ <b className="eng">{page.views}</b> <small>{t('مشاهدة', 'views')}</small></span>
            <a href="#comments" title={t('تعليقات', 'Comments')}>💬 <b className="eng">{(comments ?? []).length}</b> <small>{t('تعليق', 'comments')}</small></a>
            {listing && <span title={t('مبيعات', 'Sales')}>🛒 <b className="eng">{page.sales_count}</b> <small>{t('مبيعات', 'sales')}</small></span>}
            {page.reviews_count > 0 && <span>⭐ <b className="eng">{page.rating}</b> <small>({page.reviews_count})</small></span>}
            {page.can_edit && <span title={t('ضغطات الروابط', 'Link clicks')}>🔗 <b className="eng">{page.link_clicks}</b></span>}
          </div>

          {/* On a phone the buy box sits below the page; this jumps to it. */}
          {listing && (
            <a className="sc-mobile-buy" href="#buy">
              <b className="eng">{money(listing.effective_price ?? 0)}</b>
              <span>{listing.listing_status === 'listed' ? t('اشترِ أو قدّم عرضاً ↓', 'Buy or make an offer ↓') : t('تفاصيل البيع ↓', 'Sale details ↓')}</span>
            </a>
          )}

          {(page.demo_url || links.length > 0) && (
            <div className="sc-links">
              {page.demo_url && (
                <TrackedLink projectId={page.project_id} kind="demo" href={page.demo_url} className="btn btn-primary btn-sm">
                  {t('▶ جرّب الديمو', '▶ Try the demo')}
                </TrackedLink>
              )}
              {links.map((link) => (
                <TrackedLink key={link.url} projectId={page.project_id} kind={link.kind} href={link.url} className="sc-link-chip">
                  {t(LINK_KINDS[link.kind] ?? LINK_KINDS.other)} ↗
                </TrackedLink>
              ))}
            </div>
          )}

          {video && (
            <div className="sc-video">
              <iframe src={video} title={t('فيديو المشروع', 'Project video')} loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
          {!video && page.video_url && (
            <TrackedLink projectId={page.project_id} kind="video" href={page.video_url} className="sc-link-chip">{t('🎬 فيديو الشرح ↗', '🎬 Walkthrough video ↗')}</TrackedLink>
          )}

          {page.description && (
            <section className="sc-section">
              <h2>{t('عن المشروع', 'About the project')}</h2>
              <p className="sc-description">{page.description}</p>
            </section>
          )}

          {(page.technologies.length > 0 || page.skills.length > 0) && (
            <section className="sc-section">
              <h2>{t('التقنيات والمهارات', 'Technologies and skills')}</h2>
              <div className="tags-row">
                {page.technologies.map((tech) => <span className="sc-tag eng" key={`t-${tech}`}>{tech}</span>)}
                {page.skills.map((skill) => <span className="sc-tag is-skill" key={`s-${skill}`}>{skill}</span>)}
              </div>
            </section>
          )}

          {(page.path_title || page.course_title || page.mentor_rating !== null) && (
            <section className="sc-section sc-academy">
              {(page.path_title || page.course_title) && (
                <p>🎓 {t('تم إنجاز هذا المشروع ضمن ', 'Built in ')}
                  {page.path_title
                    ? <>{t('مسار ', 'the path ')}<Link href={`/academy/paths/${page.path_slug}`}>{page.path_title}</Link></>
                    : <>{t('دورة ', 'the course ')}<Link href={`/academy/courses/${page.course_slug}`}>{page.course_title}</Link></>}
                  {page.assignment_title && <span className="muted"> — {page.assignment_title}</span>}
                </p>
              )}
              {page.mentor_rating !== null && (
                <p className="sc-mentor-badge">
                  <Stars value={Number(page.mentor_rating)} /> <b className="eng">{Number(page.mentor_rating).toFixed(1)}</b>
                  {' '}{t('تقييم منتور للعمل', 'a mentor’s evaluation of the work')}
                  {page.exhibition_code && <> · <Link href={`/exhibition/${page.exhibition_code}/verify`}>{t('تحقّق', 'Verify')}</Link></>}
                </p>
              )}
              {evaluator && (
                <p className="sc-evaluator">
                  <MemberAvatar id={evaluator.techmood_id} name={evaluator.full_name} url={evaluator.avatar_url} size={30} />
                  <span>
                    {t('قيّمه المنتور ', 'Evaluated by mentor ')}
                    <Link href={memberHref(evaluator.techmood_id, inApp)}><strong>{evaluator.full_name}</strong></Link>
                    {evaluator.reviewed_at && <span className="muted"> · {formatDate(locale, evaluator.reviewed_at)}</span>}
                  </span>
                </p>
              )}
            </section>
          )}

          {(reviews ?? []).length > 0 && (
            <section className="sc-section">
              <h2>{t('تقييمات المشترين', 'What buyers said')}</h2>
              <ul className="sc-reviews">
                {(reviews ?? []).map((review, index) => (
                  <li key={index}>
                    <Stars value={review.stars} /> <span className="muted">{review.buyer_name} · {formatDate(locale, review.created_at)}</span>
                    {review.comment_ar && <p>{review.comment_ar}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sc-section" id="comments">
            <h2>💬 {t('التعليقات', 'Comments')} <span className="muted eng">({(comments ?? []).length})</span></h2>
            {page.is_public_page && (user
              ? <CommentForm projectId={page.project_id} code={page.code} />
              : <p className="muted"><Link href={`/login?next=${encodeURIComponent(here)}`}>{t('سجّل الدخول', 'Sign in')}</Link>{t(' لتعلّق أو تسأل.', ' to comment or ask.')}</p>)}
            <ul className="sc-comments">
              {topComments.map((comment) => (
                <li key={comment.id}>
                  <CommentItem comment={comment} code={page.code} locale={locale} t={t} />
                  {repliesOf(comment.id).length > 0 && (
                    <ul className="sc-replies">
                      {repliesOf(comment.id).map((reply) => (
                        <li key={reply.id}><CommentItem comment={reply} code={page.code} locale={locale} t={t} /></li>
                      ))}
                    </ul>
                  )}
                  {user && page.is_public_page && <ReplyToggle projectId={page.project_id} code={page.code} parentId={comment.id} />}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="sc-side">
          {listing && (
            <section className="sc-card sc-buybox" id="buy">
              <p className="sc-price eng">
                {money(listing.effective_price ?? 0)}
                {listing.discount_pct > 0 && <s>{money(listing.price_usd ?? 0)}</s>}
                {listing.discount_pct > 0 && <span className="sc-badge">-{listing.discount_pct}%</span>}
              </p>
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                {listing.licence && t(LICENCE[listing.licence])}
                {listing.verified && <> · ✓ {t('تحقّقت منه TechMood', 'Checked by TechMood')}</>}
                {listing.negotiable && <> · {t('السعر قابل للتفاوض', 'Negotiable')}</>}
              </p>
              {listing.listing_summary && <p style={{ fontSize: '0.88rem' }}>{listing.listing_summary}</p>}
              {(listing.includes ?? []).length > 0 && (
                <ul className="sc-includes">{(listing.includes ?? []).map((item) => <li key={item}>✓ {item}</li>)}</ul>
              )}
              {listing.listing_status === 'sold' && <p className="notice">{t('بيع بنقل كامل — غير متاح.', 'Sold as a full transfer — unavailable.')}</p>}
              {listing.listing_status === 'reserved' && <p className="notice">{t('محجوز لشراء جارٍ.', 'Reserved for a purchase in progress.')}</p>}
              {canBuy && listing.listing_id && (
                <>
                  <BuyBox listingId={listing.listing_id} methods={(methods ?? []) as PaymentMethodPublic[]} agreed={agreed} />
                  {listing.negotiable && !agreed && (
                    <OfferBox listingId={listing.listing_id} price={Number(listing.effective_price ?? 0)}
                              minPct={Number(minPctRow?.value ?? 50)} />
                  )}
                </>
              )}
              {!user && listing.listing_status === 'listed' && (
                <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(here)}`}>{t('سجّل الدخول للشراء', 'Sign in to buy')}</Link>
              )}
              <p className="muted" style={{ fontSize: '0.74rem', marginTop: 8 }}>
                <Link href="/policies#market">{t('شروط البيع والشراء والمفاصلة', 'Buying, selling and negotiation terms')}</Link>
              </p>
            </section>
          )}

          <section className="sc-card">
            <h3>{page.team_title ? t('الفريق', 'The team') : t('صاحب المشروع', 'Built by')}</h3>
            {page.team_title && <p className="muted" style={{ fontSize: '0.84rem' }}>{page.team_title}</p>}
            <ul className="sc-people">
              {(people ?? []).map((person) => (
                <li key={person.profile_id}>
                  {person.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={person.avatar_url} alt="" className="sc-avatar" />
                    : <span className="sc-avatar is-initial">{(person.full_name ?? '?').charAt(0)}</span>}
                  <span>
                    {person.techmood_id ? <Link href={memberHref(person.techmood_id, inApp)}>{person.full_name}</Link> : person.full_name}
                    {person.is_leader && <span className="sc-leader">{t('القائد', 'Lead')}</span>}
                    {person.role_ar && <small className="muted"> · {person.role_ar}</small>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="sc-card">
            <h3>{t('شارك المشروع', 'Share it')}</h3>
            <ShareRow url={shareUrl} title={page.title} />
            <p className="muted eng" style={{ fontSize: '0.72rem', wordBreak: 'break-all', marginTop: 6 }}>{shareUrl}</p>
          </section>

          {page.can_edit && (
            <section className="sc-card">
              <Link className="btn btn-primary btn-sm" href={`/projects/${page.project_id}/edit`}>{t('✎ تعديل الصفحة', '✎ Edit page')}</Link>
            </section>
          )}
          {isAdmin === true && !page.can_edit && (
            <section className="sc-card">
              <h3>{t('إشراف', 'Moderation')}</h3>
              <AdminHideForm projectId={page.project_id} hidden={Boolean(page.hidden_note)} />
            </section>
          )}
          {user && !page.can_edit && (
            <p className="muted" style={{ fontSize: '0.78rem' }}>
              <Link href={`/support/new?type=project&id=${page.project_id}`}>{t('🚩 أبلغ عن هذا المشروع', '🚩 Report this project')}</Link>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

type Comment = {
  id: string; body_ar: string; created_at: string; author_name: string | null; author_avatar: string | null;
  author_techmood_id: string | null; is_owner: boolean; can_delete: boolean;
};

function CommentItem({ comment, code, locale, t }: {
  comment: Comment; code: string; locale: 'ar' | 'en'; t: Awaited<ReturnType<typeof getT>>;
}) {
  return (
    <div className="sc-comment">
      {comment.author_avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={comment.author_avatar} alt="" className="sc-avatar" />
        : <span className="sc-avatar is-initial">{(comment.author_name ?? '?').charAt(0)}</span>}
      <div>
        <p className="sc-comment-head">
          <b>{comment.author_name}</b>
          {comment.is_owner && <span className="sc-leader">{t('صاحب المشروع', 'Owner')}</span>}
          <span className="muted"> · {formatDate(locale, comment.created_at)}</span>
        </p>
        <p className="sc-comment-body">{comment.body_ar}</p>
        {comment.can_delete && <DeleteCommentButton commentId={comment.id} code={code} />}
      </div>
    </div>
  );
}
