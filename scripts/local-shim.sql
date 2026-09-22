-- Local-only shim that emulates the parts of a Supabase database our migrations
-- depend on, so `scripts/validate-migrations.sh` can run them against a plain
-- PostgreSQL instance. This file is NEVER applied to a real project.
create schema if not exists extensions;
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Emulates the request-scoped JWT claim Supabase exposes.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Supabase's built-in roles, created here only so GRANT statements in the
-- migrations resolve locally.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- Supabase grants these on a real project, and client-facing SQL depends on it:
-- every RLS policy calls auth.uid(), and so does any `security invoker`
-- function meant to read as the caller. The schema is reachable; the users
-- table behind it is not.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase Storage, shimmed to the two objects our migrations touch.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/'); $$;

-- Supabase grants these too. Without them a client hits "permission denied"
-- before any storage policy is consulted, which would make the policies in the
-- migrations untestable — and untested storage policies are how private files
-- become public ones.
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
