-- 0142 — TechMood's links point at techmoodtech.vercel.app for now.
--
-- techmoodtech.com is on hold at the registrar (it stopped resolving on
-- 2026-10-05), so links built from `site_url` — emails, notifications sent
-- outside the app — would lead nowhere. The Vercel address serves the same
-- deployment. When the domain is back, set it again:
--   update public.platform_settings set value = 'https://techmoodtech.com' where key = 'site_url';
-- and SITE_URL in src/lib/contact.ts.
update public.platform_settings set value = 'https://techmoodtech.vercel.app' where key = 'site_url';
