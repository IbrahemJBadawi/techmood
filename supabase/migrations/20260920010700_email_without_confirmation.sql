-- =============================================================================
-- 0107 — Signing up with an email does not wait for a confirmation email
--
-- The founder's decision: an account made with an email and a password is
-- usable at once — no "check your inbox" step. The switch for that lives in
-- the Supabase dashboard (Authentication → Email → "Confirm email"), and until
-- it is turned off the auth server holds back the session and the password
-- sign-in refuses an unconfirmed address.
--
-- This makes the database agree with the decision regardless of the switch:
-- a new email account is marked confirmed as it is created. Accounts already waiting on a
-- confirmation are confirmed too. Google accounts arrive confirmed already.
--
-- Checked against the live auth server with "Confirm email" still on: sign-up
-- returned a session straight away, no confirmation mail was sent, and the
-- password sign-in worked — the server sees the account as confirmed.
--
-- Only on a real Supabase project: the local test shim's auth.users has no
-- email_confirmed_at, and nothing here is needed there.
-- =============================================================================

do $migration$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then

    create or replace function public.confirm_email_on_signup()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
    as $fn$
    begin
      if new.email is not null and new.email_confirmed_at is null then
        new.email_confirmed_at := now();
      end if;
      return new;
    end;
    $fn$;

    revoke execute on function public.confirm_email_on_signup() from public, anon, authenticated;

    drop trigger if exists confirm_email_on_signup on auth.users;
    create trigger confirm_email_on_signup
      before insert on auth.users
      for each row execute function public.confirm_email_on_signup();

    update auth.users
       set email_confirmed_at = now()
     where email is not null and email_confirmed_at is null;
  end if;
end
$migration$;
