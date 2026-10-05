-- =============================================================================
-- 0134 — One question, up to two model calls
--
-- A live test showed that when Gemini proposes an action it often stops there,
-- with no written answer: the protocol expects a second round in which it is
-- told what became of the call. A question now buys up to two calls — the
-- answer, and the follow-up after a proposal — still within three minutes of
-- being asked and still counted once against the daily limit.
-- =============================================================================

alter table public.ai_model_calls
  add column calls smallint not null default 1 check (calls between 1 and 2);

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
  on conflict (message_id) do update set calls = public.ai_model_calls.calls + 1, called_at = now()
   where public.ai_model_calls.calls < 2;
  if not found then
    raise exception 'أُجيب هذا السؤال بالفعل';
  end if;
  return true;
end;
$$;

revoke execute on function public.claim_ai_model_call(uuid) from public, anon;
grant execute on function public.claim_ai_model_call(uuid) to authenticated;
