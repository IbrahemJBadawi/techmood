-- ============================================================================
-- 0157 — TechMood's three addresses
--
--   noreply@techmoodtech.com — the sender of automatic emails and notifications;
--                              a reply to it goes to support (`email_reply_to`);
--   support@techmoodtech.com — help for members (already `support_email`);
--   contact@techmoodtech.com — official contact: companies, partners, legal.
--
-- All three are settings, editable from «الإدارة ← الأسعار». Nothing is sent
-- until the mail provider's key is in Vault, as before (0111, 0130).
-- ============================================================================

insert into public.platform_settings (key, value, description_ar) values
  ('email_reply_to', 'support@techmoodtech.com', 'عنوان الردّ على الرسائل التلقائية — تصل الردود إليه بدل noreply'),
  ('contact_email',  'contact@techmoodtech.com', 'بريد التواصل الرسمي: الشركات والشراكات والشؤون القانونية'),
  ('support_email',  'support@techmoodtech.com', 'بريد الدعم الظاهر للأعضاء')
on conflict (key) do update set value = excluded.value, description_ar = excluded.description_ar;

update public.platform_settings set value = 'TechMood <noreply@techmoodtech.com>' where key = 'email_from';
update public.platform_settings set value = 'mailto:contact@techmoodtech.com' where key = 'push_vapid_subject';
