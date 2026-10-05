-- =============================================================================
-- 0130 — Instant bookings wait for the payment; the domain; Gemini's key
--
-- 1. An instant booking never opens without a confirmed payment. The session
--    (and its Join button) opens only for a confirmed booking, and a booking
--    is confirmed only once its payment is verified (0104). Here:
--      * a payment for an instant booking is announced to the admins at once,
--        as urgent, so it can be checked in time;
--      * an instant booking whose start comes before its payment is confirmed
--        is closed: still unpaid → expired; a receipt under review →
--        cancelled, the learner told, the admins asked to return the money if
--        the receipt is real;
--      * confirming an instant booking after its start is refused.
-- 2. TechMood's own domain and support address: techmoodtech.com.
-- 3. The Gemini key lives in Vault (never in code or a table). The assistant
--    reaches it through the `ai-gemini` Edge Function, which may make one model
--    call per question a member actually asked (counted against their daily
--    limit), or per admin reading.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Instant bookings and their payment
-- ---------------------------------------------------------------------------
create or replace function public.guard_instant_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_instant and new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and new.scheduled_start <= now() then
    raise exception 'انتهى موعد الحجز الفوري قبل تأكيد الدفع — ارفض الدفع وأعد المبلغ';
  end if;

  if new.is_instant and new.status = 'payment_submitted' and old.status is distinct from 'payment_submitted' then
    perform public.notify_admins('⚡ دفع حجز فوري — راجعه الآن',
      'الحجز ' || new.booking_code || ' يبدأ ' || to_char(new.scheduled_start at time zone 'Asia/Jerusalem', 'YYYY-MM-DD HH24:MI')
        || ' ولا تُفتح الجلسة قبل تأكيد الدفع.', '/admin/payments', 'booking', new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_instant_confirmation() from public, anon, authenticated;

create trigger bookings_instant_gate
  before update of status on public.bookings
  for each row execute function public.guard_instant_confirmation();

-- Every few minutes: an instant booking whose time came before its payment was confirmed.
create or replace function public.instant_booking_housekeeping()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r       record;
begin
  for r in
    select b.id, b.booking_code, b.student_id, b.status
      from public.bookings b
     where b.is_instant and b.status in ('payment_pending', 'payment_submitted')
       and b.scheduled_start <= now()
     for update skip locked
  loop
    v_count := v_count + 1;
    if r.status = 'payment_pending' then
      update public.bookings set status = 'expired' where id = r.id;
      update public.payments set status = 'failed' where booking_id = r.id and status = 'pending';
    else
      update public.bookings
         set status = 'cancelled', cancelled_reason = 'لم يتأكد الدفع قبل موعد الحجز الفوري'
       where id = r.id;
      perform public.notify_admins('حجز فوري أُلغي قبل تأكيد دفعه',
        'الحجز ' || r.booking_code || ' بدأ موعده وإيصاله قيد المراجعة. إن كان الدفع صحيحاً فأعد المبلغ للطالب.',
        '/admin/payments', 'booking', r.id);
    end if;
    if r.student_id is not null then
      perform public.notify(r.student_id, 'booking', 'لم تُفتح الجلسة الفورية',
        'بدأ موعد الحجز ' || r.booking_code || ' قبل تأكيد الدفع، فلم تُفتح الجلسة. '
          || case when r.status = 'payment_submitted'
                  then 'يراجع فريق TechMood إيصالك ويعيد المبلغ إن كان صحيحاً.'
                  else 'لم يُسجَّل دفع، فلا شيء عليك.' end,
        '/bookings/' || r.id::text);
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.instant_booking_housekeeping() from public, anon, authenticated;

do $migration$
begin
  if to_regnamespace('cron') is not null
     and coalesce(current_setting('cron.database_name', true), 'postgres') = current_database() then
    perform cron.schedule('techmood-instant-bookings', '*/5 * * * *', $$select public.instant_booking_housekeeping()$$);
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 2. The domain and the support address
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('support_email', 'support@techmoodtech.com', 'بريد الدعم الظاهر للأعضاء')
on conflict (key) do update set value = excluded.value;

update public.platform_settings set value = 'https://techmoodtech.com' where key = 'site_url';
insert into public.platform_settings (key, value, description_ar) values
  ('push_vapid_subject', 'mailto:support@techmoodtech.com', 'جهة الاتصال المعلنة لخدمة الإشعارات')
on conflict (key) do update set value = excluded.value;
-- the sender of platform emails; nothing is sent until the mail provider's key exists
update public.platform_settings set value = 'TechMood <support@techmoodtech.com>'
 where key = 'email_from' and nullif(value, '') is null;

-- ---------------------------------------------------------------------------
-- 3. Gemini, through Vault and one Edge Function
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value, description_ar) values
  ('ai_gemini_model', 'gemini-2.5-flash', 'نموذج Gemini الذي يجيب في المساعد')
on conflict (key) do nothing;

-- Whether the assistant has a Gemini key, without revealing it.
create or replace function public.ai_gemini_ready()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (select 1 from vault.decrypted_secrets where name = 'gemini_api_key' and nullif(decrypted_secret, '') is not null);
exception when others then
  return false;
end;
$$;

revoke execute on function public.ai_gemini_ready() from public, anon;
grant execute on function public.ai_gemini_ready() to authenticated;

-- The key and the model, for the Edge Function's service role only.
create or replace function public.ai_gemini_config()
returns table (api_key text, model text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select (select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1),
         coalesce((select nullif(value, '') from public.platform_settings where key = 'ai_gemini_model'), 'gemini-2.5-flash');
end;
$$;

revoke execute on function public.ai_gemini_config() from public, anon, authenticated;
grant execute on function public.ai_gemini_config() to service_role;

-- One model call per question asked: the question is the ticket.
create table public.ai_model_calls (
  message_id uuid primary key references public.ai_messages (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  called_at  timestamptz not null default now()
);

alter table public.ai_model_calls enable row level security;
revoke all on public.ai_model_calls from anon, authenticated;

-- Called by the Edge Function as the member. A member's latest question in a
-- thread of their own, asked in the last three minutes and not yet answered by
-- a model call, buys one call. An admin's reading of a case or ticket needs no
-- thread.
create or replace function public.claim_ai_model_call(p_thread uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_msg uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_thread is null then
    if public.is_admin() then
      return true;
    end if;
    raise exception 'لا سؤال لهذه المحادثة';
  end if;

  select m.id into v_msg
    from public.ai_messages m join public.ai_threads t on t.id = m.thread_id
   where m.thread_id = p_thread and t.profile_id = v_me
   order by m.created_at desc
   limit 1;

  if v_msg is null or not exists (
    select 1 from public.ai_messages m
     where m.id = v_msg and m.role = 'user' and m.created_at > now() - interval '3 minutes'
  ) then
    raise exception 'لا سؤال ينتظر جواباً في هذه المحادثة';
  end if;

  insert into public.ai_model_calls (message_id, profile_id) values (v_msg, v_me)
  on conflict (message_id) do nothing;
  if not found then
    raise exception 'أُجيب هذا السؤال بالفعل';
  end if;
  return true;
end;
$$;

revoke execute on function public.claim_ai_model_call(uuid) from public, anon;
grant execute on function public.claim_ai_model_call(uuid) to authenticated;
