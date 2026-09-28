-- =============================================================================
-- 0108 — Profile photos
--
-- A member may add a photo while setting up the account, or later from
-- Settings. It is optional, and it is theirs:
--   * the avatars bucket takes images only (JPEG, PNG, WebP) up to 2 MB — the
--     app shrinks a photo to a 512px square before it is sent, so a real one
--     is far below that;
--   * a member may upload, replace and delete files in their own folder only,
--     and may list only their own folder: a photo is public by its link, but
--     nobody can page through everybody's photos;
--   * profiles.avatar_url may point only at the member's own folder in this
--     bucket, or at the photo their Google account brought with it — never at
--     an arbitrary address, which would let a profile load anything from
--     anywhere into every page that shows it.
-- =============================================================================

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';

-- Public URLs of a public bucket do not go through these policies; listing does.
drop policy if exists avatars_public_read on storage.objects;

create policy avatars_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.check_avatar_url()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.avatar_url := nullif(btrim(new.avatar_url), '');

  if new.avatar_url is null then
    return new;
  end if;

  -- https for the project; http only for a local development stack.
  if new.avatar_url ~ ('^(https://[^/]+|http://(localhost|127\.0\.0\.1)(:[0-9]+)?)/storage/v1/object/public/avatars/'
                       || new.id::text || '/[^/?#]+$')
     or new.avatar_url ~ '^https://lh[0-9]\.googleusercontent\.com/[^\s]+$' then
    return new;
  end if;

  raise exception 'الصورة الشخصية تُرفع من المنصة نفسها'
    using errcode = 'check_violation';
end;
$$;

revoke execute on function public.check_avatar_url() from public, anon, authenticated;

create trigger profiles_avatar_url
  before insert or update of avatar_url on public.profiles
  for each row execute function public.check_avatar_url();
