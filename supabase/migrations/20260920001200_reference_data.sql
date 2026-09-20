-- =============================================================================
-- TechMood — 0012 Reference data
-- This is configuration, not content: the platform's economy and price ladder.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- XP economy.
--
-- Deliberately small numbers. The old prototype paid score*10, so a single
-- assignment was worth ~900 XP and the top rank was nine assignments away; the
-- scale carried no information. Here a lesson is 5, a graded assignment is
-- 3-15 by quality, a course is 25, a whole path is 100. Reaching the top rank
-- means finishing several full paths with good work.
-- ---------------------------------------------------------------------------
insert into public.xp_rules (source, base_xp, per_star_xp, description_ar) values
  ('lesson_completed',         5,  0, 'إكمال درس'),
  ('assignment_evaluated',     0,  3, 'تكليف درس مُقيَّم — 3 XP لكل نجمة (3–15)'),
  ('course_project_evaluated', 0,  8, 'مشروع دورة مُقيَّم — 8 XP لكل نجمة (8–40)'),
  ('course_completed',        25,  0, 'إكمال دورة كاملة'),
  ('path_project_evaluated',   0, 12, 'مشروع المسار الجماعي — 12 XP لكل نجمة (12–60)'),
  ('path_completed',         100,  0, 'إكمال مسار كامل'),
  ('mentor_session_attended',  5,  0, 'حضور جلسة إرشاد'),
  ('team_contribution',        3,  0, 'مساهمة موثّقة في عمل الفريق'),
  ('achievement_awarded',      0,  0, 'إنجاز — القيمة محفوظة على الإنجاز نفسه');

insert into public.xp_levels (min_xp, title_ar, sort_order) values
  (   0, 'مبتدئ',            1),
  ( 150, 'متعلّم نشِط',       2),
  ( 400, 'ممارس',            3),
  ( 900, 'محترف',            4),
  (1800, 'خبير TechMood',    5),
  (3000, 'أسطورة TechMood',  6);

-- ---------------------------------------------------------------------------
-- Mentor price ladder, exactly as published.
-- ---------------------------------------------------------------------------
insert into public.mentor_levels
  (level, session_price_usd, platform_share_usd, mentor_share_usd, min_sessions, min_rating, sort_order) values
  ('L1',  15.00,  5.00, 10.00,   0, 0.00, 1),
  ('L2',  25.00,  5.00, 20.00,  20, 4.00, 2),
  ('L3',  35.00, 10.00, 25.00,  50, 4.30, 3),
  ('L4',  50.00, 15.00, 35.00, 100, 4.50, 4),
  ('L5',  75.00, 20.00, 55.00, 180, 4.70, 5),
  ('L6', 100.00, 25.00, 75.00, 300, 4.80, 6);

-- ---------------------------------------------------------------------------
-- Reputation dimensions (the passport meters)
-- ---------------------------------------------------------------------------
insert into public.reputation_dimensions (slug, name_ar, weight) values
  ('learning',     'الأداء التعليمي',   1.00),
  ('projects',     'أداء المشاريع',     1.25),
  ('mentor_rating','تقييم المرشدين',    1.25),
  ('client_rating','تقييم العملاء',     1.00),
  ('team',         'المساهمة في الفريق', 1.00),
  ('reliability',  'الموثوقية',         1.50),
  ('quality',      'جودة التسليم',      1.25),
  ('communication','التواصل',           1.00);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
insert into public.achievements (slug, name_ar, description_ar, icon, xp_award) values
  ('first_submission', 'أول مشروع مسلَّم', 'سلّمت أول عمل لك للمراجعة.',            '🚀', 10),
  ('first_five_stars', 'أول تقييم 5 نجوم', 'حصلت على تقييم كامل من منتور.',          '⭐', 15),
  ('joined_team',      'منضمّ لفريق',      'أصبحت عضواً في فريق يعمل على مشروع حقيقي.', '👥', 10),
  ('first_certificate','أول شهادة',        'أصدرت أول شهادة موثّقة من TechMood.',     '🎓', 20);

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------
insert into public.schools (slug, name_ar, name_en, sort_order) values
  ('ai-data',        'الذكاء الاصطناعي والبيانات', 'AI & Data',              1),
  ('software',       'تطوير البرمجيات',            'Software Development',   2),
  ('product-design', 'المنتج والتصميم',            'Product & Design',       3),
  ('cloud-security', 'الحوسبة السحابية والأمن',     'Cloud & Security',       4),
  ('entrepreneurship','ريادة الأعمال والنمو',       'Entrepreneurship',       5),
  ('project-mgmt',   'إدارة المشاريع',             'Project Management',     6),
  ('tech-languages', 'اللغات التقنية',             'Technical Languages',    7),
  ('leadership',     'القيادة والمهارات الناعمة',   'Leadership & Soft Skills', 8);

-- ---------------------------------------------------------------------------
-- Storage: payment proofs are private, avatars are public.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- A payer may upload into their own folder; only admins may read anyone's.
create policy payment_proofs_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy payment_proofs_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

create policy avatars_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
