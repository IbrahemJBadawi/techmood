-- ============================================================================
-- 0155 — Premium and session packages paid by transfer, too
--
-- Until now both were paid from the balance only (0152, 0154): whoever wanted
-- to pay by transfer topped up first, waited, then came back to buy. Now a
-- top-up can carry what it is for. The member picks a plan or a package,
-- transfers its price and uploads the receipt as for any top-up; when an admin
-- approves it, the money goes into the balance and the purchase completes from
-- it in the same step, at the price the member was shown.
--
-- If the purchase cannot complete then (the mentor stopped taking sessions,
-- say), the money stays in the balance and the member is told so — nothing
-- is lost and nothing is bought by surprise.
--
-- The package discounts (3 sessions 10%, 5 sessions 15%) become settings, like
-- the Premium prices and the assistant's daily questions, so TechMood can
-- change them from «الإدارة ← الأسعار» without a migration.
-- ============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('package_3_discount_pct', '10', 'خصم باقة 3 جلسات (٪).'),
  ('package_5_discount_pct', '15', 'خصم باقة 5 جلسات (٪).')
on conflict (key) do nothing;

alter table public.credit_topups
  add column purpose        text not null default 'balance' check (purpose in ('balance', 'premium', 'package')),
  add column purpose_detail jsonb,
  add column purpose_label  text check (purpose_label is null or char_length(purpose_label) <= 160),
  add column fulfilled_at   timestamptz;

-- A plain top-up stays 5$–500$; a purchase is exactly its price.
alter table public.credit_topups drop constraint if exists credit_topups_amount_usd_check;
alter table public.credit_topups add constraint credit_topups_amount_usd_check
  check (amount_usd > 0 and amount_usd <= 5000 and (purpose <> 'balance' or amount_usd between 5 and 500));

-- ---------------------------------------------------------------------------
-- The packages on offer, with the discounts from the settings
-- ---------------------------------------------------------------------------
create or replace function public.package_quote(p_mentor uuid, p_session_type uuid)
returns table (sessions integer, discount_pct integer, unit_usd numeric, total_usd numeric, saves_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select price_usd from public.session_quote(p_mentor, p_session_type) limit 1),
  tiers (n, pct) as (
    values (3, least(greatest(coalesce((select nullif(value, '')::integer from public.platform_settings
                                         where key = 'package_3_discount_pct'), 10), 0), 50)),
           (5, least(greatest(coalesce((select nullif(value, '')::integer from public.platform_settings
                                         where key = 'package_5_discount_pct'), 15), 0), 50))
  )
  select t.n, t.pct, q.price_usd,
         round(q.price_usd * t.n * (100 - t.pct) / 100.0, 2),
         round(q.price_usd * t.n * t.pct / 100.0, 2)
    from tiers t, q
   where q.price_usd > 0
   order by t.n;
$$;

-- ---------------------------------------------------------------------------
-- The purchases themselves, for a given member — the member's own buttons and
-- an approved transfer both end here. Never callable from outside.
-- ---------------------------------------------------------------------------
create or replace function public.premium_grant(p_profile uuid, p_plan text, p_price numeric default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price numeric := p_price;
  v_from  timestamptz;
  v_until timestamptz;
  v_id    uuid := extensions.gen_random_uuid();
begin
  if p_plan not in ('month', 'year') then
    raise exception 'الخطة شهرية أو سنوية';
  end if;
  if v_price is null then
    select case when p_plan = 'month' then monthly_usd else yearly_usd end into v_price from public.premium_offer();
  end if;

  perform pg_advisory_xact_lock(hashtext('premium:' || p_profile::text));
  perform public.spend_credit(p_profile, v_price, 'TechMood Premium — ' || case when p_plan = 'month' then 'شهر' else 'سنة' end,
                              'premium_purchases', v_id);

  select greatest(now(), coalesce((select until from public.premium_memberships where profile_id = p_profile), now()))
    into v_from;
  v_until := v_from + case when p_plan = 'month' then interval '1 month' else interval '1 year' end;

  insert into public.premium_memberships (profile_id, until) values (p_profile, v_until)
  on conflict (profile_id) do update
    set until = excluded.until, reminded_at = null,
        since = case when public.premium_memberships.until < now() then now() else public.premium_memberships.since end;
  insert into public.premium_purchases (id, profile_id, plan, paid_usd, from_at, until)
  values (v_id, p_profile, p_plan, v_price, v_from, v_until);

  perform public.notify(p_profile, 'payment', '✦ أصبحت عضواً في TechMood Premium',
    'شارتك ومزاياك فعّالة حتى ' || to_char(v_until at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') || '.', '/premium');
  return v_until;
end;
$$;

revoke execute on function public.premium_grant(uuid, text, numeric) from public, anon, authenticated;

create or replace function public.subscribe_premium(p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  return public.premium_grant((select auth.uid()), p_plan, null);
end;
$$;

create or replace function public.package_grant(p_profile uuid, p_mentor uuid, p_session_type uuid, p_sessions integer,
                                                p_total numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote record;
  v_total numeric;
  v_id    uuid := extensions.gen_random_uuid();
begin
  if p_profile = p_mentor then
    raise exception 'لا تشترِ باقة من نفسك';
  end if;
  if not exists (select 1 from public.profile_roles pr
                  where pr.profile_id = p_mentor and pr.role = 'mentor' and pr.status = 'approved') then
    raise exception 'المنتور غير متاح';
  end if;
  select * into v_quote from public.package_quote(p_mentor, p_session_type) q where q.sessions = p_sessions;
  if not found then
    raise exception 'الباقات 3 أو 5 جلسات';
  end if;
  v_total := coalesce(p_total, v_quote.total_usd);

  perform public.spend_credit(p_profile, v_total, 'باقة ' || p_sessions || ' جلسات', 'session_packages', v_id);
  insert into public.session_packages
    (id, profile_id, mentor_id, session_type_id, sessions_total, unit_list_usd, discount_pct, paid_usd)
  values (v_id, p_profile, p_mentor, p_session_type, p_sessions, v_quote.unit_usd, v_quote.discount_pct, v_total);

  perform public.notify(p_mentor, 'booking', '🎟️ اشترى عضو باقة ' || p_sessions || ' جلسات معك',
    'ستصلك حجوزاتها كالمعتاد.', '/bookings', 'session_package', v_id);
  perform public.notify(p_profile, 'payment', '🎟️ باقتك جاهزة — ' || p_sessions || ' جلسات',
    'اختر «ادفع من باقتك» عند الحجز مع هذا المنتور.', '/mentors/' || p_mentor::text, 'session_package', v_id);
  return v_id;
end;
$$;

revoke execute on function public.package_grant(uuid, uuid, uuid, integer, numeric) from public, anon, authenticated;

create or replace function public.buy_session_package(p_mentor uuid, p_session_type uuid, p_sessions integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  return public.package_grant((select auth.uid()), p_mentor, p_session_type, p_sessions, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Asking to pay for a plan or a package by transfer
-- ---------------------------------------------------------------------------
create or replace function public.request_purchase_topup(
  p_purpose text, p_method text,
  p_plan text default null, p_mentor uuid default null, p_session_type uuid default null, p_sessions integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_amount numeric;
  v_label  text;
  v_detail jsonb;
  v_quote  record;
  v_id     uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if not exists (select 1 from public.payment_methods m
                  where m.key = p_method and 'mentoring' = any (m.use_for) and public.method_is_ready(m.key)) then
    raise exception 'طريقة الدفع هذه غير متاحة للشحن';
  end if;
  if (select count(*) from public.credit_topups
       where profile_id = v_me and status in ('pending', 'under_review')) >= 3 then
    raise exception 'لديك طلبات شحن مفتوحة — أكملها أو ألغها أولاً';
  end if;

  if p_purpose = 'premium' then
    if p_plan not in ('month', 'year') then
      raise exception 'الخطة شهرية أو سنوية';
    end if;
    select case when p_plan = 'month' then monthly_usd else yearly_usd end into v_amount from public.premium_offer();
    v_label  := 'TechMood Premium — ' || case when p_plan = 'month' then 'شهر' else 'سنة' end;
    v_detail := jsonb_build_object('plan', p_plan);
  elsif p_purpose = 'package' then
    if v_me = p_mentor then
      raise exception 'لا تشترِ باقة من نفسك';
    end if;
    if not exists (select 1 from public.profile_roles pr
                    where pr.profile_id = p_mentor and pr.role = 'mentor' and pr.status = 'approved') then
      raise exception 'المنتور غير متاح';
    end if;
    select * into v_quote from public.package_quote(p_mentor, p_session_type) q where q.sessions = p_sessions;
    if not found then
      raise exception 'الباقات 3 أو 5 جلسات';
    end if;
    v_amount := v_quote.total_usd;
    v_label  := 'باقة ' || p_sessions || ' جلسات مع ' || coalesce((select full_name from public.profiles where id = p_mentor), 'منتور');
    v_detail := jsonb_build_object('mentor', p_mentor, 'session_type', p_session_type, 'sessions', p_sessions);
  else
    raise exception 'غرض الدفع غير معروف';
  end if;

  insert into public.credit_topups (profile_id, amount_usd, method_key, purpose, purpose_detail, purpose_label)
  values (v_me, v_amount, p_method, p_purpose, v_detail, left(v_label, 160))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.request_purchase_topup(text, text, text, uuid, uuid, integer) from public, anon;
grant execute on function public.request_purchase_topup(text, text, text, uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- The admin's approval completes the purchase
-- ---------------------------------------------------------------------------
create or replace function public.review_topup(p_topup uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.credit_topups%rowtype;
begin
  if not public.is_admin() then
    raise exception 'للإدارة فقط';
  end if;
  select * into v_t from public.credit_topups where id = p_topup for update;
  if not found then
    raise exception 'طلب الشحن غير موجود';
  end if;
  if v_t.status <> 'under_review' then
    raise exception 'هذا الطلب رُوجع بالفعل أو لم يُرسل بعد';
  end if;

  if p_approve then
    update public.credit_topups
       set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = p_topup;
    insert into public.credit_entries (profile_id, amount_usd, kind, description_ar, ref_table, ref_id)
    values (v_t.profile_id, v_t.amount_usd, 'topup', 'شحن رصيد ' || v_t.topup_code, 'credit_topups', p_topup);

    if v_t.purpose = 'balance' then
      perform public.notify(v_t.profile_id, 'payment', '✓ شُحن رصيدك بـ ' || v_t.amount_usd || '$',
        'أصبح بإمكانك الدفع من رصيدك للجلسات والسوق.', '/wallet', 'credit_topup', p_topup);
    else
      begin
        if v_t.purpose = 'premium' then
          perform public.premium_grant(v_t.profile_id, v_t.purpose_detail ->> 'plan', v_t.amount_usd);
        else
          perform public.package_grant(v_t.profile_id, (v_t.purpose_detail ->> 'mentor')::uuid,
                                       (v_t.purpose_detail ->> 'session_type')::uuid,
                                       (v_t.purpose_detail ->> 'sessions')::integer, v_t.amount_usd);
        end if;
        update public.credit_topups set fulfilled_at = now() where id = p_topup;
      exception when others then
        perform public.notify(v_t.profile_id, 'payment', '✓ وصل تحويلك ' || v_t.amount_usd || '$ إلى رصيدك',
          'تعذّر إتمام «' || coalesce(v_t.purpose_label, 'الشراء') || '» تلقائياً (' || sqlerrm
          || ') — المبلغ في رصيدك، ويمكنك الشراء منه متى أردت.', '/wallet', 'credit_topup', p_topup);
      end;
    end if;
  else
    if nullif(btrim(p_reason), '') is null then
      raise exception 'اكتب سبب الرفض ليعرفه العضو';
    end if;
    update public.credit_topups
       set status = 'rejected', rejection_reason = btrim(p_reason),
           reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = p_topup;
    perform public.notify(v_t.profile_id, 'payment', 'لم يُقبل إيصال الدفع ' || v_t.topup_code,
      btrim(p_reason) || ' — يمكنك رفع إيصال جديد.', '/wallet/topup/' || p_topup::text, 'credit_topup', p_topup);
  end if;
end;
$$;

-- The receipt's alert says what it is for.
create or replace function public.submit_topup_proof(p_topup uuid, p_proof_path text, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_t  public.credit_topups%rowtype;
  v_m  public.payment_methods%rowtype;
begin
  select * into v_t from public.credit_topups where id = p_topup for update;
  if not found or v_t.profile_id is distinct from v_me then
    raise exception 'طلب الشحن غير موجود';
  end if;
  if v_t.status not in ('pending', 'rejected') then
    raise exception 'هذا الطلب أُرسل للمراجعة بالفعل';
  end if;
  select * into v_m from public.payment_methods where key = v_t.method_key;
  if v_m.requires_receipt and nullif(btrim(p_proof_path), '') is null then
    raise exception 'ارفع صورة الإيصال';
  end if;
  if v_m.requires_reference and nullif(btrim(p_reference), '') is null then
    raise exception 'اكتب الرقم المرجعي للتحويل';
  end if;
  if nullif(btrim(p_proof_path), '') is not null and split_part(p_proof_path, '/', 1) <> v_me::text then
    raise exception 'ملف الإيصال غير صالح';
  end if;

  update public.credit_topups
     set status = 'under_review', proof_path = nullif(btrim(p_proof_path), ''),
         reference = nullif(btrim(p_reference), ''), submitted_at = now(), rejection_reason = null
   where id = p_topup;

  perform public.notify_admins(
    case when v_t.purpose = 'balance' then '💳 طلب شحن رصيد ' || v_t.amount_usd || '$ — ' || v_t.topup_code
         else '💳 دفع بتحويل: ' || coalesce(v_t.purpose_label, v_t.purpose) || ' — ' || v_t.amount_usd || '$' end,
    'راجع الإيصال وأكّد الدفع.', '/admin/topups', 'credit_topup', p_topup, 'important');
end;
$$;

-- The transfer instructions serve sessions, top-ups and purchases alike now.
update public.payment_methods
   set instructions_ar = replace(replace(instructions_ar, 'حوّل قيمة الجلسة كاملة', 'حوّل المبلغ المطلوب كاملاً'),
                                 'أرسل قيمة الجلسة', 'أرسل المبلغ المطلوب')
 where instructions_ar like '%قيمة الجلسة%';
