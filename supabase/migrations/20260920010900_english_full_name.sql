-- =============================================================================
-- 0109 — The full name is written in English
--
-- The full name is what certificates print and what an employer reads when
-- they verify one, so it is written in Latin letters. The display name — what
-- people call you inside TechMood — stays in any script.
--
-- The rule applies whenever the name is changed. A new account may still
-- arrive with whatever name Google holds (in Arabic, say): refusing it there
-- would refuse the sign-up itself. Onboarding then asks for the English
-- spelling, and cannot be finished without it.
-- =============================================================================

create or replace function public.check_english_full_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));

  if new.full_name is distinct from old.full_name
     and new.full_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .''-]{1,119}$' then
    raise exception 'الاسم الكامل يُكتب بالإنجليزية (حروف لاتينية)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_english_full_name() from public, anon, authenticated;

create trigger profiles_english_full_name
  before update of full_name on public.profiles
  for each row execute function public.check_english_full_name();
