'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { dbError } from '@/lib/db-errors';
import { getT } from '@/lib/i18n.server';
import type { ProductType, ProjectLink, SaleLicence } from '@/lib/database.types';
import { CATEGORIES, PRODUCT_TYPES, galleryPath } from '@/lib/showcase';

/**
 * The project showcase (0121). Every rule — who may edit, what a complete page
 * needs, where pictures may live, what a listing and an offer must satisfy —
 * is checked again in the database; these actions only carry the form.
 */

export type ShowcaseState = { error?: string; ok?: string } | undefined;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();
const list = (value: string) => value.split(/[,،\n]/).map((item) => item.trim()).filter(Boolean);

function jsonArray<T>(raw: string): T[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Step one: a name and what it is. The project starts complete (a page shows
 * finished work) and private until its owner publishes it; the full page is
 * filled in on the next screen, where pictures can be uploaded into its folder.
 * Coming from a hand-in (?assignment=…), it is linked to that submission.
 */
export async function createShowcaseProject(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/projects/new');

  const title = text(formData, 'title');
  if (title.length < 3) return { error: t('اكتب اسماً واضحاً للمشروع.', 'Give the project a clear name.') };

  const type = text(formData, 'product_type');
  const category = text(formData, 'category');
  const intent = ['gallery', 'market', 'both'].includes(text(formData, 'intent')) ? text(formData, 'intent') : 'gallery';

  // A hand-in of one's own, and its links to start the page with.
  let submissionId: string | null = null;
  let links: ProjectLink[] = [];
  const assignment = text(formData, 'assignment_id');
  if (assignment) {
    const { data: submission } = await supabase
      .from('submissions').select('id, current_version')
      .eq('assignment_id', assignment).eq('profile_id', user.id).maybeSingle();
    if (submission) {
      submissionId = submission.id;
      const { data: version } = await supabase
        .from('submission_versions').select('id')
        .eq('submission_id', submission.id).eq('version', submission.current_version).maybeSingle();
      if (version) {
        const { data: evidence } = await supabase.from('submission_evidence').select('kind, url').eq('version_id', version.id);
        links = (evidence ?? []).map((row) => ({
          kind: row.kind === 'portfolio' ? 'website' : row.kind === 'file' ? 'drive' : String(row.kind),
          url: row.url,
        }));
      }
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title_ar: title.slice(0, 160),
      owner_id: user.id,
      kind: 'personal',
      status: 'completed',
      completed_at: new Date().toISOString(),
      product_type: type in PRODUCT_TYPES ? (type as ProductType) : null,
      category: category in CATEGORIES ? category : null,
      submission_id: submissionId,
      links,
    })
    .select('id')
    .single();

  if (error || !data) return { error: dbError(t, error?.message ?? '') || t('تعذّر إنشاء المشروع.', 'The project could not be created.') };

  revalidatePath('/projects');
  redirect(`/projects/${data.id}/edit?intent=${intent}&new=1`);
}

/** The page itself: text, pictures, links, the academy link, and the gallery switch. */
export async function saveShowcase(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = text(formData, 'project_id');
  const images = jsonArray<string>(text(formData, 'images')).filter((path) => typeof path === 'string');
  const before = jsonArray<string>(text(formData, 'images_before'));

  const kinds = formData.getAll('link_kind').map(String);
  const urls = formData.getAll('link_url').map((value) => String(value).trim());
  const links: ProjectLink[] = urls
    .map((url, index) => ({ kind: kinds[index] || 'other', url }))
    .filter((link) => link.url.length > 0);

  const academic = text(formData, 'academic'); // "path:<id>" | "course:<id>" | "submission:<id>" | ""
  const [academicKind, academicId] = academic.split(':');
  const type = text(formData, 'product_type');
  const category = text(formData, 'category');

  // The academy link: a hand-in carries its own course and path (the database
  // fills them in), so only the chosen kind is written; a form without the
  // field (a team project) leaves the link as it is.
  const academicFields = !formData.has('academic') ? {}
    : academicKind === 'submission' ? { submission_id: academicId }
    : { submission_id: null, course_id: academicKind === 'course' ? academicId : null,
        path_id: academicKind === 'path' ? academicId : null };

  const { error } = await supabase
    .from('projects')
    .update({
      ...academicFields,
      title_ar: text(formData, 'title').slice(0, 160),
      tagline_ar: text(formData, 'tagline').slice(0, 200) || null,
      description_ar: text(formData, 'description').slice(0, 8000) || null,
      product_type: type in PRODUCT_TYPES ? (type as ProductType) : null,
      category: category in CATEGORIES ? category : null,
      tags: list(text(formData, 'technologies')).slice(0, 15),
      skills: list(text(formData, 'skills')).slice(0, 15),
      demo_url: text(formData, 'demo_url') || null,
      video_url: text(formData, 'video_url') || null,
      links,
      images: images.slice(0, 8),
      in_gallery: formData.get('in_gallery') === 'on',
      status: 'completed',
    })
    .eq('id', projectId);

  if (error) return { error: dbError(t, error.message) };

  // Pictures taken off the page are deleted once the page no longer uses them.
  const dropped = before.filter((path) => !images.includes(path) && path.startsWith(`${projectId}/`));
  if (dropped.length) await supabase.storage.from('project-media').remove(dropped);

  const { data: row } = await supabase.from('projects').select('code, in_gallery').eq('id', projectId).single();
  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  revalidatePath('/exhibition');
  if (row) revalidatePath(galleryPath(row.code));
  return {
    ok: row?.in_gallery
      ? t('حُفظت الصفحة وهي منشورة في المعرض.', 'Saved — the page is live in the gallery.')
      : t('حُفظت الصفحة (غير منشورة في المعرض).', 'Saved — the page is not in the gallery.'),
  };
}

/** The market side of the page: price, licence, the hidden delivery link, negotiable, terms. */
export async function saveShowcaseListing(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = text(formData, 'project_id');
  // how long the discount runs: kept, open-ended, or a number of days from now (0149's countdown)
  const discountFor = text(formData, 'discount_for');
  let discountEndsAt: string | null = null;
  if (discountFor === 'keep') {
    const { data: current } = await supabase.from('project_listings').select('discount_ends_at').eq('project_id', projectId).maybeSingle();
    discountEndsAt = current?.discount_ends_at ?? null;
  } else if (['1', '3', '7', '14'].includes(discountFor)) {
    discountEndsAt = new Date(Date.now() + Number(discountFor) * 86_400_000).toISOString();
  }
  const { data: saved, error } = await supabase.rpc('list_project_for_sale', {
    p_project: projectId,
    p_price: Number(formData.get('price') ?? 0),
    p_summary: text(formData, 'summary'),
    p_delivery_url: text(formData, 'delivery_url'),
    p_licence: (text(formData, 'licence') || 'usage_rights') as SaleLicence,
    p_includes: list(text(formData, 'includes')).slice(0, 12),
    p_demo_url: text(formData, 'demo_url') || null,
    p_discount_pct: Number(formData.get('discount_pct') ?? 0) || 0,
    p_discount_ends_at: discountEndsAt,
    p_negotiable: formData.get('negotiable') === 'on',
    p_accept_terms: formData.get('accept_terms') === 'on',
  });
  const repeatPct = Number(formData.get('repeat_buyer_pct') ?? 0) || 0;
  const listingId = (saved as { id?: string } | null)?.id;
  const repeat = !error && listingId
    ? await supabase.rpc('set_repeat_buyer_discount', { p_listing: listingId, p_pct: repeatPct })
    : { error: null };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/edit`);
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  if (repeat.error) return { error: dbError(t, repeat.error.message) };
  return { ok: t('أُرسل العرض للمراجعة — يظهر في السوق بعد تحقق الإدارة منه ومن رابط التسليم.',
                 'Sent for review — it shows in the market once TechMood has checked it and its delivery link.') };
}

/** Off the market, for now. Buyers who paid keep what they bought. */
export async function withdrawShowcaseListing(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const projectId = text(formData, 'project_id');
  await supabase.rpc('withdraw_listing', { p_listing: text(formData, 'listing_id') });
  revalidatePath(`/projects/${projectId}/edit`);
  revalidatePath('/marketplace');
}

/** Deleting — refused by the database once a copy was sold (0121). */
export async function deleteShowcase(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = text(formData, 'project_id');
  if (text(formData, 'confirm') !== 'حذف' && text(formData, 'confirm').toLowerCase() !== 'delete') {
    return { error: t('اكتب «حذف» للتأكيد.', 'Type “delete” to confirm.') };
  }
  const { data: project } = await supabase.from('projects').select('images').eq('id', projectId).maybeSingle();
  const { error } = await supabase.rpc('delete_showcase_project', { p_project: projectId });
  if (error) return { error: dbError(t, error.message) };

  const paths = (project?.images ?? []).filter((path: string) => path.startsWith(`${projectId}/`));
  if (paths.length) await supabase.storage.from('project-media').remove(paths);

  revalidatePath('/projects');
  revalidatePath('/exhibition');
  redirect('/projects?deleted=1');
}

/**
 * A visit or a click on one of the page's links, counted once a visitor a day
 * (0121). A signed-out visitor is told apart by a random id kept in a cookie —
 * it identifies a browser, not a person, and is used for nothing else.
 */
export async function recordShowcaseHit(projectId: string, kind: string) {
  const supabase = await createClient();
  const jar = await cookies();
  let visitor = jar.get('tm_vid')?.value ?? '';
  if (!/^[0-9a-f-]{36}$/.test(visitor)) {
    visitor = crypto.randomUUID();
    jar.set('tm_vid', visitor, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  await supabase.rpc('record_project_hit', { p_project: projectId, p_kind: kind, p_visitor: visitor });
}

/** TechMood hides a page from the gallery and the market, with the reason the owner reads. */
export async function adminHideShowcase(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const projectId = text(formData, 'project_id');
  const hide = text(formData, 'hide') !== 'false';
  const { error } = await supabase.rpc('admin_set_project_hidden', {
    p_project: projectId, p_hidden: hide, p_note: text(formData, 'note') || null,
  });
  revalidatePath('/exhibition');
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: hide ? t('أُخفي المشروع ووصل صاحبه السبب.', 'Hidden; the owner has the reason.') : t('أُعيد إظهاره.', 'Shown again.') };
}

/**
 * Buying from a project page: at the shown price, or at a price agreed in an
 * offer. Opens a hold (escrow); the buyer then sends the receipt from the
 * market's money tab, and the delivery link arrives once TechMood confirms it.
 */
export async function buyShowcase(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('buy_project', {
    p_listing: text(formData, 'listing_id'),
    p_method_key: text(formData, 'method_key'),
    p_offer: text(formData, 'offer_id') || null,
    p_accept_terms: formData.get('accept_terms') === 'on',
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath('/marketplace');
  redirect('/marketplace?tab=money&bought=1');
}

/** A price offer (المفاصلة) — the rules are the market terms, enforced in make_offer(). */
export async function makeOfferAction(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.rpc('make_offer', {
    p_listing: text(formData, 'listing_id'),
    p_amount: Number(formData.get('amount') ?? 0),
    p_message: text(formData, 'message') || null,
    p_accept_terms: formData.get('accept_terms') === 'on',
  });
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('وصل عرضك للبائع — تصلك إجابته في الإشعارات وفي «عروض الأسعار».',
                 'Your offer reached the seller — the answer arrives in notifications and under “Offers”.') };
}

/** The seller answers an offer: accept, decline, or counter once. */
export async function respondOfferAction(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const action = text(formData, 'action') as 'accept' | 'reject' | 'counter';
  const { error } = await supabase.rpc('respond_to_offer', {
    p_offer: text(formData, 'offer_id'),
    p_action: action,
    p_counter: action === 'counter' ? Number(formData.get('counter') ?? 0) : null,
    p_note: text(formData, 'note') || null,
  });
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: action === 'accept' ? t('قبلت العرض — ينتظر دفع المشتري.', 'Accepted — waiting for the buyer to pay.')
              : action === 'counter' ? t('أُرسل سعرك المقابل.', 'Your counter-offer was sent.')
              : t('اعتذرت عن العرض.', 'You declined the offer.') };
}

/** The buyer answers a counter-offer, or withdraws their own. */
export async function answerOfferAction(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const action = text(formData, 'action') as 'accept' | 'reject' | 'withdraw';
  const { error } = await supabase.rpc('answer_offer', { p_offer: text(formData, 'offer_id'), p_action: action });
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: action === 'accept' ? t('اتفقتما — ادفع قبل انتهاء المهلة.', 'Agreed — pay before the deadline.')
              : t('تم.', 'Done.') };
}

/** A buyer's stars, once, after they released the money. */
export async function ratePurchaseAction(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('rate_purchase', {
    p_sale: text(formData, 'sale_id'),
    p_stars: Number(formData.get('stars') ?? 0),
    p_comment: text(formData, 'comment') || null,
  });
  revalidatePath('/marketplace');
  if (error) return { error: dbError(t, error.message) };
  return { ok: t('شكراً — وصل تقييمك.', 'Thank you — your rating is in.') };
}

/** A comment on a project page (0122): signed-in, no links, ten an hour. */
export async function addCommentAction(_prev: ShowcaseState, formData: FormData): Promise<ShowcaseState> {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('add_project_comment', {
    p_project: text(formData, 'project_id'),
    p_body: text(formData, 'body'),
    p_parent: text(formData, 'parent_id') || null,
  });
  if (error) return { error: dbError(t, error.message) };
  revalidatePath(`/p/${text(formData, 'code')}`);
  revalidatePath(galleryPath(text(formData, 'code')));
  return { ok: t('نُشر تعليقك.', 'Your comment is up.') };
}

export async function deleteCommentAction(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc('delete_project_comment', { p_comment: text(formData, 'comment_id') });
  revalidatePath(`/p/${text(formData, 'code')}`);
  revalidatePath(galleryPath(text(formData, 'code')));
}
