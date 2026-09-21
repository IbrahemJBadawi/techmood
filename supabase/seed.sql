-- =============================================================================
-- TechMood — seed catalogue
--
-- GENERATED FILE. Edit scripts/build-seed.py and re-run it, not this file.
--
-- Content is the v23 prototype catalogue, carried over unchanged: six paths,
-- eighteen courses, thirty-six lessons with their original durations, and the
-- eighteen practical tasks. Every lesson, course and path now also carries a
-- gradeable assignment, because a certificate is issued from approved work.
-- =============================================================================

begin;


-- ---------------------------------------------------------------------------
-- مسار الذكاء الاصطناعي التوليدي
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'genai', s.id, 'مسار الذكاء الاصطناعي التوليدي', 'مجموعة دورات من أساسيات Python إلى بناء تطبيقات GenAI حقيقية.', 'من الكود إلى الذكاء — نبني مستقبلك خطوة بخطوة.', array['AI', 'Python']::text[], 'published', 4, 14
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ الذكاء الاصطناعي التوليدي',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'genai';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('python-for-ai', 'دورة Python للذكاء الاصطناعي', 'أساسيات Python وهياكل البيانات اللازمة للانطلاق في الذكاء الاصطناعي.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'genai' and c.slug = 'python-for-ai'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة Python للذكاء الاصطناعي', 1 from public.courses c where c.slug = 'python-for-ai';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'Python للمبتدئين', 'Python for Beginners', 'video', 45, 'ملخص يغطي أهم الأفكار في "Python للمبتدئين"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'python-for-ai';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: Python للمبتدئين',
       'طبّق ما تعلمته في "Python للمبتدئين" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'python-for-ai' and l.title_ar = 'Python للمبتدئين';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'هياكل البيانات في Python', 'Data Structures in Python', 'video', 30, 'ملخص يغطي أهم الأفكار في "هياكل البيانات في Python"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'python-for-ai';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: هياكل البيانات في Python',
       'طبّق ما تعلمته في "هياكل البيانات في Python" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'python-for-ai' and l.title_ar = 'هياكل البيانات في Python';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء سكربت تحليل نصوص بسيط',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'python-for-ai';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: Python للذكاء الاصطناعي',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'python-for-ai';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('ml-foundations', 'دورة أساسيات تعلّم الآلة', 'مدخل عملي لمفاهيم Machine Learning وأدوات تحليل البيانات.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'genai' and c.slug = 'ml-foundations'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة أساسيات تعلّم الآلة', 1 from public.courses c where c.slug = 'ml-foundations';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مقدمة في Machine Learning', 'Introduction to Machine Learning', 'video', 50, 'ملخص يغطي أهم الأفكار في "مقدمة في Machine Learning"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'ml-foundations';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مقدمة في Machine Learning',
       'طبّق ما تعلمته في "مقدمة في Machine Learning" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'ml-foundations' and l.title_ar = 'مقدمة في Machine Learning';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'NumPy وPandas عملياً', 'NumPy & Pandas in Practice', 'article', 25, 'ملخص يغطي أهم الأفكار في "NumPy وPandas عملياً"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'ml-foundations';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: NumPy وPandas عملياً',
       'طبّق ما تعلمته في "NumPy وPandas عملياً" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'ml-foundations' and l.title_ar = 'NumPy وPandas عملياً';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: تدريب نموذج تصنيف بسيط',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'ml-foundations';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: أساسيات تعلّم الآلة',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'ml-foundations';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('generative-ai', 'دورة الذكاء الاصطناعي التوليدي', 'نماذج اللغة الكبيرة وPrompt Engineering وبناء أول تطبيق GenAI.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'genai' and c.slug = 'generative-ai'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة الذكاء الاصطناعي التوليدي', 1 from public.courses c where c.slug = 'generative-ai';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مقدمة في نماذج اللغة الكبيرة (LLMs)', 'Introduction to Large Language Models (LLMs)', 'video', 40, 'ملخص يغطي أهم الأفكار في "مقدمة في نماذج اللغة الكبيرة (LLMs)"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'generative-ai';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مقدمة في نماذج اللغة الكبيرة (LLMs)',
       'طبّق ما تعلمته في "مقدمة في نماذج اللغة الكبيرة (LLMs)" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'generative-ai' and l.title_ar = 'مقدمة في نماذج اللغة الكبيرة (LLMs)';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات Prompt Engineering', 'Prompt Engineering Fundamentals', 'video', 35, 'ملخص يغطي أهم الأفكار في "أساسيات Prompt Engineering"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'generative-ai';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات Prompt Engineering',
       'طبّق ما تعلمته في "أساسيات Prompt Engineering" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'generative-ai' and l.title_ar = 'أساسيات Prompt Engineering';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء تطبيق GenAI مصغّر',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'generative-ai';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: الذكاء الاصطناعي التوليدي',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'generative-ai';

-- ---------------------------------------------------------------------------
-- مسار تحليل البيانات
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'data', s.id, 'مسار تحليل البيانات', 'مجموعة دورات من Excel وSQL إلى لوحات تحكم وتقارير احترافية.', 'من الأرقام إلى القرارات — بيانات تتحدث.', array['Data', 'SQL']::text[], 'published', 4, 17
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ تحليل البيانات',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'data';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('data-excel', 'دورة أساسيات البيانات وExcel', 'تنظيف البيانات والتعامل مع الجداول والدوال المحورية.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'data' and c.slug = 'data-excel'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة أساسيات البيانات وExcel', 1 from public.courses c where c.slug = 'data-excel';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'تنظيف البيانات في Excel', 'Data Cleaning in Excel', 'video', 35, 'ملخص يغطي أهم الأفكار في "تنظيف البيانات في Excel"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'data-excel';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: تنظيف البيانات في Excel',
       'طبّق ما تعلمته في "تنظيف البيانات في Excel" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'data-excel' and l.title_ar = 'تنظيف البيانات في Excel';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'الدوال والجداول المحورية', 'Functions & Pivot Tables', 'video', 30, 'ملخص يغطي أهم الأفكار في "الدوال والجداول المحورية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'data-excel';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: الدوال والجداول المحورية',
       'طبّق ما تعلمته في "الدوال والجداول المحورية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'data-excel' and l.title_ar = 'الدوال والجداول المحورية';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: تنظيف مجموعة بيانات مبيعات حقيقية',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'data-excel';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: أساسيات البيانات وExcel',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'data-excel';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('sql-analysis', 'دورة SQL للتحليل', 'كتابة استعلامات وربط الجداول لاستخراج تقارير دقيقة.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'data' and c.slug = 'sql-analysis'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة SQL للتحليل', 1 from public.courses c where c.slug = 'sql-analysis';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات الاستعلامات SQL', 'SQL Query Fundamentals', 'video', 40, 'ملخص يغطي أهم الأفكار في "أساسيات الاستعلامات SQL"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'sql-analysis';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات الاستعلامات SQL',
       'طبّق ما تعلمته في "أساسيات الاستعلامات SQL" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'sql-analysis' and l.title_ar = 'أساسيات الاستعلامات SQL';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'الدمج بين الجداول (Joins)', 'Table Joins', 'article', 20, 'ملخص يغطي أهم الأفكار في "الدمج بين الجداول (Joins)"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'sql-analysis';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: الدمج بين الجداول (Joins)',
       'طبّق ما تعلمته في "الدمج بين الجداول (Joins)" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'sql-analysis' and l.title_ar = 'الدمج بين الجداول (Joins)';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: كتابة استعلامات لتقرير مبيعات',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'sql-analysis';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: SQL للتحليل',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'sql-analysis';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('dashboards', 'دورة لوحات التحكم والتقارير', 'تصميم لوحات تحكم تفاعلية توصل الرسالة بوضوح.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'data' and c.slug = 'dashboards'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة لوحات التحكم والتقارير', 1 from public.courses c where c.slug = 'dashboards';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مبادئ تصميم لوحات التحكم', 'Dashboard Design Principles', 'video', 30, 'ملخص يغطي أهم الأفكار في "مبادئ تصميم لوحات التحكم"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'dashboards';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مبادئ تصميم لوحات التحكم',
       'طبّق ما تعلمته في "مبادئ تصميم لوحات التحكم" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'dashboards' and l.title_ar = 'مبادئ تصميم لوحات التحكم';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'بناء لوحة تحكم تفاعلية', 'Building an Interactive Dashboard', 'video', 45, 'ملخص يغطي أهم الأفكار في "بناء لوحة تحكم تفاعلية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'dashboards';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: بناء لوحة تحكم تفاعلية',
       'طبّق ما تعلمته في "بناء لوحة تحكم تفاعلية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'dashboards' and l.title_ar = 'بناء لوحة تحكم تفاعلية';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء لوحة تحكم لمشروع تحليل المبيعات',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'dashboards';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: لوحات التحكم والتقارير',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'dashboards';

-- ---------------------------------------------------------------------------
-- مسار تطوير الويب
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'web', s.id, 'مسار تطوير الويب', 'مجموعة دورات لبناء واجهات وتطبيقات ويب حديثة من الصفر حتى النشر.', 'من السطر الأول إلى الإطلاق — نبني الويب معاً.', array['Web', 'React']::text[], 'published', 5, 1
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ تطوير الويب',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'web';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('html-css', 'دورة أساسيات HTML وCSS', 'بنية الصفحات والتنسيق باستخدام Flexbox.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'web' and c.slug = 'html-css'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة أساسيات HTML وCSS', 1 from public.courses c where c.slug = 'html-css';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'بنية صفحات HTML', 'HTML Page Structure', 'video', 30, 'ملخص يغطي أهم الأفكار في "بنية صفحات HTML"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'html-css';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: بنية صفحات HTML',
       'طبّق ما تعلمته في "بنية صفحات HTML" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'html-css' and l.title_ar = 'بنية صفحات HTML';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'تنسيق الصفحات بـ CSS وFlexbox', 'Styling with CSS & Flexbox', 'video', 40, 'ملخص يغطي أهم الأفكار في "تنسيق الصفحات بـ CSS وFlexbox"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'html-css';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: تنسيق الصفحات بـ CSS وFlexbox',
       'طبّق ما تعلمته في "تنسيق الصفحات بـ CSS وFlexbox" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'html-css' and l.title_ar = 'تنسيق الصفحات بـ CSS وFlexbox';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء صفحة هبوط ثابتة',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'html-css';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: أساسيات HTML وCSS',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'html-css';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('modern-js', 'دورة JavaScript الحديث', 'أساسيات اللغة وES6 والتعامل مع DOM والأحداث.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'web' and c.slug = 'modern-js'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة JavaScript الحديث', 1 from public.courses c where c.slug = 'modern-js';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات JavaScript وES6', 'JavaScript & ES6 Fundamentals', 'video', 50, 'ملخص يغطي أهم الأفكار في "أساسيات JavaScript وES6"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'modern-js';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات JavaScript وES6',
       'طبّق ما تعلمته في "أساسيات JavaScript وES6" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'modern-js' and l.title_ar = 'أساسيات JavaScript وES6';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'التعامل مع DOM والأحداث', 'Working with the DOM & Events', 'video', 35, 'ملخص يغطي أهم الأفكار في "التعامل مع DOM والأحداث"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'modern-js';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: التعامل مع DOM والأحداث',
       'طبّق ما تعلمته في "التعامل مع DOM والأحداث" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'modern-js' and l.title_ar = 'التعامل مع DOM والأحداث';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء تطبيق قائمة مهام بسيط',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'modern-js';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: JavaScript الحديث',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'modern-js';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('react', 'دورة React وبناء الواجهات', 'مكوّنات React وإدارة الحالة عبر Hooks.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'web' and c.slug = 'react'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة React وبناء الواجهات', 1 from public.courses c where c.slug = 'react';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مكوّنات React الأساسية', 'React Components Basics', 'video', 45, 'ملخص يغطي أهم الأفكار في "مكوّنات React الأساسية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'react';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مكوّنات React الأساسية',
       'طبّق ما تعلمته في "مكوّنات React الأساسية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'react' and l.title_ar = 'مكوّنات React الأساسية';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'إدارة الحالة بـ Hooks', 'State Management with Hooks', 'video', 40, 'ملخص يغطي أهم الأفكار في "إدارة الحالة بـ Hooks"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'react';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: إدارة الحالة بـ Hooks',
       'طبّق ما تعلمته في "إدارة الحالة بـ Hooks" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'react' and l.title_ar = 'إدارة الحالة بـ Hooks';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء تطبيق ويب تفاعلي كامل',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'react';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: React وبناء الواجهات',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'react';

-- ---------------------------------------------------------------------------
-- مسار إدارة المنتجات
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'product', s.id, 'مسار إدارة المنتجات', 'مجموعة دورات من فهم المستخدم إلى بناء وإطلاق منتج رقمي.', 'من الفكرة إلى المنتج — نصمم لتجربة أفضل.', array['Product', 'UX']::text[], 'published', 3, 36
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ إدارة المنتجات',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'product';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('user-research', 'دورة فهم المستخدم', 'بحث المستخدم وبناء Personas قبل أي قرار تصميم.', 'published', 1)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'product' and c.slug = 'user-research'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة فهم المستخدم', 1 from public.courses c where c.slug = 'user-research';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات بحث المستخدم', 'User Research Fundamentals', 'video', 30, 'ملخص يغطي أهم الأفكار في "أساسيات بحث المستخدم"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'user-research';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات بحث المستخدم',
       'طبّق ما تعلمته في "أساسيات بحث المستخدم" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'user-research' and l.title_ar = 'أساسيات بحث المستخدم';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'بناء Personas', 'Building Personas', 'article', 20, 'ملخص يغطي أهم الأفكار في "بناء Personas"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'user-research';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: بناء Personas',
       'طبّق ما تعلمته في "بناء Personas" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'user-research' and l.title_ar = 'بناء Personas';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: إجراء 3 مقابلات مستخدم',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'user-research';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: فهم المستخدم',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'user-research';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('product-design', 'دورة تصميم المنتج', 'مبادئ UX وبناء Wireframes أولية.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'product' and c.slug = 'product-design'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة تصميم المنتج', 1 from public.courses c where c.slug = 'product-design';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مبادئ UX الأساسية', 'Core UX Principles', 'video', 35, 'ملخص يغطي أهم الأفكار في "مبادئ UX الأساسية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'product-design';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مبادئ UX الأساسية',
       'طبّق ما تعلمته في "مبادئ UX الأساسية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'product-design' and l.title_ar = 'مبادئ UX الأساسية';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'بناء Wireframes', 'Building Wireframes', 'video', 30, 'ملخص يغطي أهم الأفكار في "بناء Wireframes"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'product-design';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: بناء Wireframes',
       'طبّق ما تعلمته في "بناء Wireframes" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'product-design' and l.title_ar = 'بناء Wireframes';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: تصميم نموذج أولي بسيط',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'product-design';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: تصميم المنتج',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'product-design';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('launch-measure', 'دورة الإطلاق والقياس', 'مؤشرات النجاح واستراتيجيات إطلاق المنتج.', 'published', 1)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'product' and c.slug = 'launch-measure'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة الإطلاق والقياس', 1 from public.courses c where c.slug = 'launch-measure';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مؤشرات نجاح المنتج', 'Product Success Metrics', 'video', 25, 'ملخص يغطي أهم الأفكار في "مؤشرات نجاح المنتج"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'launch-measure';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مؤشرات نجاح المنتج',
       'طبّق ما تعلمته في "مؤشرات نجاح المنتج" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'launch-measure' and l.title_ar = 'مؤشرات نجاح المنتج';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'استراتيجيات الإطلاق', 'Launch Strategies', 'article', 20, 'ملخص يغطي أهم الأفكار في "استراتيجيات الإطلاق"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'launch-measure';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: استراتيجيات الإطلاق',
       'طبّق ما تعلمته في "استراتيجيات الإطلاق" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'launch-measure' and l.title_ar = 'استراتيجيات الإطلاق';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: كتابة خطة إطلاق منتج',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'launch-measure';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: الإطلاق والقياس',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'launch-measure';

-- ---------------------------------------------------------------------------
-- مسار الحوسبة السحابية
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'cloud', s.id, 'مسار الحوسبة السحابية', 'مجموعة دورات في أساسيات البنية التحتية والنشر والتشغيل الآلي.', 'من الخادم إلى النظام الذكي — نؤتمت المستقبل.', array['Cloud', 'DevOps']::text[], 'published', 4, 13
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ الحوسبة السحابية',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'cloud';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('cloud-foundations', 'دورة أساسيات الحوسبة السحابية', 'الخدمات السحابية الأساسية والشبكات والتخزين.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'cloud' and c.slug = 'cloud-foundations'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة أساسيات الحوسبة السحابية', 1 from public.courses c where c.slug = 'cloud-foundations';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مقدمة في الخدمات السحابية', 'Introduction to Cloud Services', 'video', 30, 'ملخص يغطي أهم الأفكار في "مقدمة في الخدمات السحابية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'cloud-foundations';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مقدمة في الخدمات السحابية',
       'طبّق ما تعلمته في "مقدمة في الخدمات السحابية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'cloud-foundations' and l.title_ar = 'مقدمة في الخدمات السحابية';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'الشبكات والتخزين السحابي', 'Cloud Networking & Storage', 'video', 35, 'ملخص يغطي أهم الأفكار في "الشبكات والتخزين السحابي"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'cloud-foundations';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: الشبكات والتخزين السحابي',
       'طبّق ما تعلمته في "الشبكات والتخزين السحابي" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'cloud-foundations' and l.title_ar = 'الشبكات والتخزين السحابي';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: إعداد أول خادم سحابي',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'cloud-foundations';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: أساسيات الحوسبة السحابية',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'cloud-foundations';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('containers', 'دورة النشر والحاويات', 'Docker وأساسيات CI/CD لنشر موثوق.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'cloud' and c.slug = 'containers'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة النشر والحاويات', 1 from public.courses c where c.slug = 'containers';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مقدمة في Docker', 'Introduction to Docker', 'video', 40, 'ملخص يغطي أهم الأفكار في "مقدمة في Docker"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'containers';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مقدمة في Docker',
       'طبّق ما تعلمته في "مقدمة في Docker" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'containers' and l.title_ar = 'مقدمة في Docker';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات CI/CD', 'CI/CD Fundamentals', 'article', 25, 'ملخص يغطي أهم الأفكار في "أساسيات CI/CD"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'containers';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات CI/CD',
       'طبّق ما تعلمته في "أساسيات CI/CD" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'containers' and l.title_ar = 'أساسيات CI/CD';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: نشر تطبيق باستخدام Docker',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'containers';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: النشر والحاويات',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'containers';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('observability', 'دورة المراقبة والتشغيل الآلي', 'مراقبة الأنظمة وأتمتة عمليات النشر.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'cloud' and c.slug = 'observability'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة المراقبة والتشغيل الآلي', 1 from public.courses c where c.slug = 'observability';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مراقبة الأنظمة السحابية', 'Cloud Systems Monitoring', 'video', 30, 'ملخص يغطي أهم الأفكار في "مراقبة الأنظمة السحابية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'observability';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مراقبة الأنظمة السحابية',
       'طبّق ما تعلمته في "مراقبة الأنظمة السحابية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'observability' and l.title_ar = 'مراقبة الأنظمة السحابية';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'التشغيل الآلي للبنية التحتية', 'Infrastructure Automation', 'video', 35, 'ملخص يغطي أهم الأفكار في "التشغيل الآلي للبنية التحتية"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'observability';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: التشغيل الآلي للبنية التحتية',
       'طبّق ما تعلمته في "التشغيل الآلي للبنية التحتية" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'observability' and l.title_ar = 'التشغيل الآلي للبنية التحتية';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: أتمتة عملية نشر كاملة',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'observability';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: المراقبة والتشغيل الآلي',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'observability';

-- ---------------------------------------------------------------------------
-- مسار ريادة الأعمال الرقمية
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select 'business', s.id, 'مسار ريادة الأعمال الرقمية', 'مجموعة دورات من الفكرة إلى التحقق من السوق وبناء نموذج عمل.', 'من الفكرة إلى الشركة — نبني رواد الأعمال.', array['Business', 'Growth']::text[], 'published', 3, 39
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       'المشروع الجماعي لـ ريادة الأعمال الرقمية',
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = 'business';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('idea-to-opportunity', 'دورة من الفكرة إلى الفرصة', 'كيف تجد فكرة مشروع وتحلل السوق المبدئي.', 'published', 1)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'business' and c.slug = 'idea-to-opportunity'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة من الفكرة إلى الفرصة', 1 from public.courses c where c.slug = 'idea-to-opportunity';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'كيف تجد فكرة مشروع', 'How to Find a Startup Idea', 'video', 25, 'ملخص يغطي أهم الأفكار في "كيف تجد فكرة مشروع"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'idea-to-opportunity';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: كيف تجد فكرة مشروع',
       'طبّق ما تعلمته في "كيف تجد فكرة مشروع" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'idea-to-opportunity' and l.title_ar = 'كيف تجد فكرة مشروع';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'تحليل السوق المبدئي', 'Initial Market Analysis', 'article', 20, 'ملخص يغطي أهم الأفكار في "تحليل السوق المبدئي"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'idea-to-opportunity';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: تحليل السوق المبدئي',
       'طبّق ما تعلمته في "تحليل السوق المبدئي" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'idea-to-opportunity' and l.title_ar = 'تحليل السوق المبدئي';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: صياغة فكرة مشروع أولية',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'idea-to-opportunity';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: من الفكرة إلى الفرصة',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'idea-to-opportunity';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('validation', 'دورة التحقق من الفكرة', 'مقابلات واستبيانات للتحقق من المشكلة قبل البناء.', 'published', 1)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'business' and c.slug = 'validation'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة التحقق من الفكرة', 1 from public.courses c where c.slug = 'validation';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'مقابلات التحقق من المشكلة', 'Problem Validation Interviews', 'video', 30, 'ملخص يغطي أهم الأفكار في "مقابلات التحقق من المشكلة"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'validation';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: مقابلات التحقق من المشكلة',
       'طبّق ما تعلمته في "مقابلات التحقق من المشكلة" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'validation' and l.title_ar = 'مقابلات التحقق من المشكلة';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'بناء استبيان تحقق فعّال', 'Building an Effective Validation Survey', 'article', 20, 'ملخص يغطي أهم الأفكار في "بناء استبيان تحقق فعّال"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'validation';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: بناء استبيان تحقق فعّال',
       'طبّق ما تعلمته في "بناء استبيان تحقق فعّال" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       '{}'::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'validation' and l.title_ar = 'بناء استبيان تحقق فعّال';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: إجراء تحقق أولي من الفكرة',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'validation';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: التحقق من الفكرة',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'validation';

insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ('business-model', 'دورة نموذج العمل', 'Business Model Canvas وأساسيات التسعير.', 'published', 2)
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'business' and c.slug = 'business-model'
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, 'وحدة نموذج العمل', 1 from public.courses c where c.slug = 'business-model';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'Business Model Canvas', 'Business Model Canvas', 'video', 35, 'ملخص يغطي أهم الأفكار في "Business Model Canvas"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 1
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'business-model';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: Business Model Canvas',
       'طبّق ما تعلمته في "Business Model Canvas" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'business-model' and l.title_ar = 'Business Model Canvas';

insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, 'أساسيات التسعير', 'Pricing Fundamentals', 'video', 25, 'ملخص يغطي أهم الأفكار في "أساسيات التسعير"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.', 2
from public.modules m join public.courses c on c.id = m.course_id where c.slug = 'business-model';

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, 'تكليف: أساسيات التسعير',
       'طبّق ما تعلمته في "أساسيات التسعير" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.',
       array['github']::public.evidence_kind[], true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = 'business-model' and l.title_ar = 'أساسيات التسعير';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, 'مهمة تطبيقية: بناء نموذج عمل أولي',
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{}'::public.evidence_kind[], true
from public.courses c where c.slug = 'business-model';

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, 'مشروع الدورة: نموذج العمل',
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = 'business-model';


-- ===========================================================================
-- The rest of the map
--
-- Announced, not written: these paths carry their outline and nothing else.
-- A planned path has no lessons, so academy_paths() never sees it and no one
-- can start it; what it does have is what it will teach, in the order it will
-- teach it, with the depth courses marked required and the breadth ones not.
-- ===========================================================================


insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'back-end', s.id, 'مسار تطوير الخلفية Back-End', 'Back-End Development', 'تطوير الخوادم وواجهات البرمجة وقواعد البيانات والمنطق الخلفي للتطبيقات.', array['Back-End', 'Node.js', 'APIs']::text[], 'planned', 2
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('http-apis', 'أساسيات HTTP وواجهات REST', 'HTTP & REST API Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'http-apis'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('auth-basics', 'المصادقة والصلاحيات', 'Authentication & Authorization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'auth-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('nodejs', 'Node.js من الصفر', 'Node.js from Zero', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'nodejs'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('express', 'بناء واجهات برمجية بـ Express', 'Building APIs with Express', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'express'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('nestjs', 'بنية التطبيقات بـ NestJS', 'Application Architecture with NestJS', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'nestjs'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sql-analysis', 'دورة SQL للتحليل', 'SQL for Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'sql-analysis'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('django', 'مدخل إلى Django', 'Introduction to Django', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'django'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('fastapi', 'مدخل إلى FastAPI', 'Introduction to FastAPI', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'fastapi'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('laravel', 'مدخل إلى Laravel', 'Introduction to Laravel', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 9
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'laravel'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('aspnet-core', 'مدخل إلى ASP.NET Core', 'Introduction to ASP.NET Core', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 10
from public.learning_paths lp, public.courses c
where lp.slug = 'back-end' and c.slug = 'aspnet-core'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'full-stack', s.id, 'مسار التطوير المتكامل Full-Stack', 'Full-Stack Development', 'بناء تطبيق كامل من الواجهة حتى قاعدة البيانات والخادم والنشر.', array['Full-Stack', 'Next.js', 'PostgreSQL']::text[], 'planned', 3
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('html-css', 'دورة أساسيات الويب', 'Web Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'html-css'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('modern-js', 'دورة JavaScript الحديثة', 'Modern JavaScript', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'modern-js'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('react', 'دورة React التطبيقية', 'React in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'react'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('nextjs', 'بناء التطبيقات بـ Next.js', 'Building Apps with Next.js', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'nextjs'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('nodejs', 'Node.js من الصفر', 'Node.js from Zero', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'nodejs'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('postgresql', 'PostgreSQL عملياً', 'PostgreSQL in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'postgresql'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('deployment', 'النشر والتشغيل', 'Deployment & Operations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'deployment'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('dotnet-stack', 'واجهة React مع .NET', 'React with .NET', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'dotnet-stack'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('laravel', 'مدخل إلى Laravel', 'Introduction to Laravel', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 9
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'laravel'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('django', 'مدخل إلى Django', 'Introduction to Django', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 10
from public.learning_paths lp, public.courses c
where lp.slug = 'full-stack' and c.slug = 'django'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'python', s.id, 'مسار تطوير Python', 'Python Development', 'من أساسيات Python والبرمجة الكائنية إلى الأتمتة وتطوير الويب.', array['Python', 'Automation']::text[], 'planned', 4
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('python-basics', 'أساسيات Python', 'Python Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'python-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('python-oop', 'البرمجة الكائنية في Python', 'Object-Oriented Python', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'python-oop'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('python-files-apis', 'الملفات وواجهات البرمجة', 'Files & APIs in Python', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'python-files-apis'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('python-automation', 'الأتمتة بـ Python', 'Automation with Python', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'python-automation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('django', 'مدخل إلى Django', 'Introduction to Django', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'django'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('fastapi', 'مدخل إلى FastAPI', 'Introduction to FastAPI', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'fastapi'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flask', 'مدخل إلى Flask', 'Introduction to Flask', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'python' and c.slug = 'flask'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'csharp-dotnet', s.id, 'مسار C# و‎.NET', 'C# & .NET', 'تطوير الأنظمة والتطبيقات المؤسسية بـ C# و‎.NET.', array['C#', '.NET']::text[], 'planned', 5
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('csharp', 'أساسيات C#', 'C# Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'csharp'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('csharp-oop', 'البرمجة الكائنية وLINQ', 'OOP & LINQ', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'csharp-oop'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('aspnet-core', 'مدخل إلى ASP.NET Core', 'Introduction to ASP.NET Core', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'aspnet-core'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('entity-framework', 'Entity Framework وقواعد البيانات', 'Entity Framework & Databases', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'entity-framework'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('clean-architecture', 'البنية النظيفة', 'Clean Architecture', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'clean-architecture'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sql-server', 'SQL Server عملياً', 'SQL Server in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'sql-server'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('auth-basics', 'المصادقة والصلاحيات', 'Authentication & Authorization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'csharp-dotnet' and c.slug = 'auth-basics'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'java', s.id, 'مسار تطوير Java', 'Java Development', 'أساس احترافي في Java وتطوير الخلفية بـ Spring Boot.', array['Java', 'Spring']::text[], 'planned', 6
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('java-basics', 'أساسيات Java', 'Java Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'java-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('java-oop', 'البرمجة الكائنية والمجموعات', 'OOP & Collections', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'java-oop'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('spring-boot', 'بناء الخدمات بـ Spring Boot', 'Services with Spring Boot', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'spring-boot'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('spring-security', 'الأمان بـ Spring Security', 'Spring Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'spring-security'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('postgresql', 'PostgreSQL عملياً', 'PostgreSQL in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'postgresql'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('http-apis', 'أساسيات HTTP وواجهات REST', 'HTTP & REST API Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'java' and c.slug = 'http-apis'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'js-ts', s.id, 'مسار JavaScript وTypeScript', 'JavaScript & TypeScript', 'من أساسيات JavaScript إلى البرمجة غير المتزامنة وTypeScript.', array['JavaScript', 'TypeScript']::text[], 'planned', 7
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('modern-js', 'دورة JavaScript الحديثة', 'Modern JavaScript', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'modern-js'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('js-dom', 'التعامل مع DOM والأحداث', 'The DOM & Events', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'js-dom'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('js-async', 'البرمجة غير المتزامنة', 'Asynchronous JavaScript', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'js-async'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('typescript', 'TypeScript عملياً', 'TypeScript in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'typescript'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('nodejs', 'Node.js من الصفر', 'Node.js from Zero', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'nodejs'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('react', 'دورة React التطبيقية', 'React in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'js-ts' and c.slug = 'react'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'mobile', s.id, 'مسار تطوير تطبيقات الهاتف', 'Mobile Development', 'أساسيات تطبيقات الهاتف وتجربة المستخدم وربطها بالخدمات.', array['Mobile', 'Firebase']::text[], 'planned', 8
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mobile-foundations', 'أساسيات تطبيقات الهاتف', 'Mobile App Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'mobile-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mobile-ux', 'تجربة المستخدم في الهاتف', 'Mobile UX', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'mobile-ux'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mobile-apis', 'ربط التطبيق بالخدمات', 'Apps & APIs', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'mobile-apis'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('firebase', 'Firebase عملياً', 'Firebase in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'firebase'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flutter', 'Flutter من الصفر', 'Flutter from Zero', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'flutter'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('react-native', 'مدخل إلى React Native', 'Introduction to React Native', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'react-native'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('native-android', 'مدخل إلى Android الأصلي', 'Introduction to Native Android', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'mobile' and c.slug = 'native-android'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'flutter', s.id, 'مسار Flutter', 'Flutter Development', 'بناء تطبيقات تعمل على المنصتين بـ Dart وFlutter حتى النشر.', array['Flutter', 'Dart']::text[], 'planned', 9
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('dart', 'أساسيات Dart', 'Dart Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'dart'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flutter', 'Flutter من الصفر', 'Flutter from Zero', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'flutter'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flutter-state', 'إدارة الحالة في Flutter', 'State Management in Flutter', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'flutter-state'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flutter-architecture', 'بنية تطبيقات Flutter', 'Flutter App Architecture', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'flutter-architecture'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('flutter-release', 'الاختبار والنشر', 'Testing & Release', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'flutter-release'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('firebase', 'Firebase عملياً', 'Firebase in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'firebase'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mobile-apis', 'ربط التطبيق بالخدمات', 'Apps & APIs', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'flutter' and c.slug = 'mobile-apis'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'software-engineering', s.id, 'مسار هندسة البرمجيات', 'Software Engineering', 'من معرفة البرمجة إلى فهم بناء البرمجيات هندسياً.', array['Engineering', 'Architecture']::text[], 'planned', 10
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sdlc', 'دورة حياة تطوير البرمجيات', 'Software Development Life Cycle', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'sdlc'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('requirements', 'تحليل المتطلبات', 'Requirements Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'requirements'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('software-architecture', 'معمارية البرمجيات', 'Software Architecture', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'software-architecture'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('design-patterns', 'أنماط التصميم', 'Design Patterns', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'design-patterns'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('clean-code', 'الكود النظيف', 'Clean Code', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'clean-code'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('git', 'Git وسير العمل', 'Git & Workflow', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'git'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('testing-foundations', 'أساسيات الاختبار', 'Testing Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'testing-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('tech-writing', 'توثيق البرمجيات', 'Software Documentation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'software-engineering' and c.slug = 'tech-writing'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'qa-testing', s.id, 'مسار ضمان الجودة والاختبار', 'QA & Software Testing', 'اختبار التطبيقات يدوياً وآلياً وكتابة تقارير الأخطاء.', array['QA', 'Testing']::text[], 'planned', 11
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('manual-testing', 'الاختبار اليدوي', 'Manual Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'manual-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('test-cases', 'حالات الاختبار وتقارير الأخطاء', 'Test Cases & Bug Reports', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'test-cases'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('api-testing', 'اختبار واجهات البرمجة', 'API Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'api-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('playwright', 'الأتمتة بـ Playwright', 'Automation with Playwright', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'playwright'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('selenium', 'مدخل إلى Selenium', 'Introduction to Selenium', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'selenium'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('cypress', 'مدخل إلى Cypress', 'Introduction to Cypress', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'qa-testing' and c.slug = 'cypress'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'devops', s.id, 'مسار DevOps والنشر المستمر', 'DevOps & CI/CD', 'نقل التطبيق من التطوير إلى الإنتاج بخطوط نشر موثوقة.', array['DevOps', 'CI/CD', 'Docker']::text[], 'planned', 12
from public.schools s where s.slug = 'software-engineering'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('linux', 'أساسيات Linux', 'Linux Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'linux'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('git', 'Git وسير العمل', 'Git & Workflow', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'git'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ci-cd', 'بناء خط CI/CD', 'Building a CI/CD Pipeline', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'ci-cd'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('containers', 'دورة الحاويات وDocker', 'Containers & Docker', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'containers'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('observability', 'دورة المراقبة والتشغيل', 'Monitoring & Operations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'observability'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('kubernetes', 'أساسيات Kubernetes', 'Kubernetes Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'kubernetes'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('deployment', 'النشر والتشغيل', 'Deployment & Operations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'devops' and c.slug = 'deployment'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'ai-engineering', s.id, 'مسار هندسة الذكاء الاصطناعي', 'AI Engineering', 'بناء تطبيقات تعتمد على نماذج اللغة: RAG ووكلاء وتقييم.', array['AI', 'LLM', 'RAG']::text[], 'planned', 15
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('llm-apps', 'بناء تطبيقات نماذج اللغة', 'Building LLM Applications', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'llm-apps'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('prompt-context', 'هندسة التوجيه والسياق', 'Prompt & Context Engineering', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'prompt-context'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('embeddings', 'التضمينات وقواعد البيانات المتجهة', 'Embeddings & Vector Databases', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'embeddings'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('rag', 'بناء أنظمة RAG', 'Building RAG Systems', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'rag'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-agents', 'الوكلاء واستدعاء الأدوات', 'Agents & Tool Calling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'ai-agents'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-evaluation', 'تقييم أنظمة الذكاء الاصطناعي', 'Evaluating AI Systems', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'ai-evaluation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-providers', 'مزودو النماذج وأدواتهم', 'Model Providers & Their Tools', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-engineering' and c.slug = 'ai-providers'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'ai-automation', s.id, 'مسار الأتمتة بالذكاء الاصطناعي', 'AI Automation', 'تحويل المهام المتكررة إلى سير عمل ذكي بالأدوات وواجهات البرمجة.', array['Automation', 'AI']::text[], 'planned', 16
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('workflow-automation', 'أتمتة سير العمل', 'Workflow Automation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'workflow-automation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('webhooks', 'واجهات البرمجة وWebhooks', 'APIs & Webhooks', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'webhooks'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-agents', 'الوكلاء واستدعاء الأدوات', 'Agents & Tool Calling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'ai-agents'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('business-automation', 'أتمتة عمليات الأعمال', 'Business Process Automation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'business-automation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('n8n', 'مدخل إلى n8n', 'Introduction to n8n', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'n8n'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('make-zapier', 'مدخل إلى Make وZapier', 'Introduction to Make & Zapier', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'ai-automation' and c.slug = 'make-zapier'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'data-science', s.id, 'مسار علم البيانات', 'Data Science', 'البرمجة والإحصاء والتحليل الاستكشافي حتى النمذجة.', array['Data Science', 'Python']::text[], 'planned', 18
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('python-basics', 'أساسيات Python', 'Python Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'python-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('statistics', 'الإحصاء الوصفي والاستدلالي', 'Descriptive & Inferential Statistics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'statistics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pandas-numpy', 'Pandas وNumPy عملياً', 'Pandas & NumPy in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'pandas-numpy'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('eda', 'التحليل الاستكشافي للبيانات', 'Exploratory Data Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'eda'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ml-foundations', 'دورة أساسيات تعلّم الآلة', 'Machine Learning Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'ml-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('probability', 'الاحتمالات', 'Probability', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'probability'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('data-visualization', 'تصوير البيانات', 'Data Visualization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'data-science' and c.slug = 'data-visualization'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'machine-learning', s.id, 'مسار تعلّم الآلة', 'Machine Learning', 'من الانحدار والتصنيف إلى هندسة الخصائص وتقييم النماذج.', array['ML', 'Scikit-Learn']::text[], 'planned', 19
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ml-regression', 'الانحدار والتصنيف', 'Regression & Classification', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'ml-regression'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ml-clustering', 'التجميع وتقليل الأبعاد', 'Clustering & Dimensionality', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'ml-clustering'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('feature-engineering', 'هندسة الخصائص', 'Feature Engineering', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'feature-engineering'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('model-evaluation', 'تقييم النماذج', 'Model Evaluation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'model-evaluation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('scikit-learn', 'Scikit-Learn عملياً', 'Scikit-Learn in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'scikit-learn'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('deep-learning', 'مقدمة في التعلّم العميق', 'Introduction to Deep Learning', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'machine-learning' and c.slug = 'deep-learning'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'databases', s.id, 'مسار قواعد البيانات وأنظمة البيانات', 'Databases & Data Systems', 'تصميم قواعد البيانات وإدارتها واستخدامها بكفاءة.', array['Databases', 'SQL']::text[], 'planned', 20
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('db-foundations', 'أساسيات قواعد البيانات', 'Database Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'db-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sql-analysis', 'دورة SQL للتحليل', 'SQL for Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'sql-analysis'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('db-design', 'تصميم قواعد البيانات وERD', 'Database Design & ERD', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'db-design'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('normalization', 'التطبيع', 'Normalization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'normalization'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('postgresql', 'PostgreSQL عملياً', 'PostgreSQL in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'postgresql'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('db-optimization', 'تحسين الأداء', 'Query & Index Optimization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'db-optimization'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mysql', 'MySQL', 'MySQL', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'mysql'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sql-server', 'SQL Server عملياً', 'SQL Server in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'sql-server'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mongodb', 'MongoDB', 'MongoDB', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 9
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'mongodb'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('redis', 'Redis', 'Redis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 10
from public.learning_paths lp, public.courses c
where lp.slug = 'databases' and c.slug = 'redis'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'math-for-tech', s.id, 'مسار الرياضيات للتقنية', 'Mathematics for Technology', 'الأساس الرياضي الذي تحتاجه البرمجة والذكاء الاصطناعي والبيانات.', array['Mathematics']::text[], 'planned', 21
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('math-basics', 'الرياضيات الأساسية', 'Basic Mathematics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'math-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('algebra', 'الجبر والدوال والمعادلات', 'Algebra, Functions & Equations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'algebra'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('logic-sets', 'المنطق والمجموعات', 'Logic & Sets', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'logic-sets'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('discrete-math', 'الرياضيات المتقطعة', 'Discrete Mathematics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'discrete-math'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('linear-algebra', 'الجبر الخطي', 'Linear Algebra', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'linear-algebra'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('calculus', 'أسس التفاضل والتكامل', 'Calculus Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'calculus'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('math-thinking', 'التفكير الرياضي', 'Mathematical Thinking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'math-for-tech' and c.slug = 'math-thinking'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'statistics', s.id, 'مسار الإحصاء والاحتمالات', 'Statistics & Probability', 'فهم البيانات وتحليلها علمياً واختبار الفرضيات.', array['Statistics']::text[], 'planned', 22
from public.schools s where s.slug = 'ai-data'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('statistics', 'الإحصاء الوصفي والاستدلالي', 'Descriptive & Inferential Statistics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'statistics' and c.slug = 'statistics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('probability', 'الاحتمالات', 'Probability', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'statistics' and c.slug = 'probability'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('distributions', 'التوزيعات والمعاينة', 'Distributions & Sampling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'statistics' and c.slug = 'distributions'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('hypothesis-testing', 'اختبار الفرضيات', 'Hypothesis Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'statistics' and c.slug = 'hypothesis-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('correlation-regression', 'الارتباط والانحدار', 'Correlation & Regression', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'statistics' and c.slug = 'correlation-regression'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'cybersecurity', s.id, 'مسار الأمن السيبراني', 'Cybersecurity', 'التهديدات والثغرات والمخاطر وأمن الشبكات والتطبيقات والاستجابة للحوادث.', array['Security']::text[], 'planned', 23
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('security-foundations', 'أسس الأمن السيبراني', 'Cybersecurity Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'security-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('threats-vulnerabilities', 'التهديدات والثغرات', 'Threats & Vulnerabilities', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'threats-vulnerabilities'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('risk-management', 'إدارة المخاطر', 'Risk Management', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'risk-management'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('network-security', 'أمن الشبكات', 'Network Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'network-security'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('web-security', 'أمن تطبيقات الويب', 'Web Application Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'web-security'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('identity-access', 'الهوية والصلاحيات', 'Identity & Access', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'identity-access'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('incident-response', 'الاستجابة للحوادث', 'Incident Response', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'cybersecurity' and c.slug = 'incident-response'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'ethical-hacking', s.id, 'مسار الاختراق الأخلاقي', 'Ethical Hacking', 'اختبار أمن الأنظمة والتطبيقات ضمن بيئات قانونية وآمنة.', array['Security', 'Pentesting']::text[], 'planned', 24
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('linux', 'أساسيات Linux', 'Linux Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'linux'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('reconnaissance', 'جمع المعلومات', 'Reconnaissance', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'reconnaissance'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('vulnerability-assessment', 'تقييم الثغرات', 'Vulnerability Assessment', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'vulnerability-assessment'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('web-security', 'أمن تطبيقات الويب', 'Web Application Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'web-security'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('penetration-testing', 'اختبار الاختراق', 'Penetration Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'penetration-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('security-reporting', 'كتابة التقارير الأمنية', 'Security Reporting', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'security-reporting'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('network-security', 'أمن الشبكات', 'Network Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'ethical-hacking' and c.slug = 'network-security'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'soc-defense', s.id, 'مسار الدفاع السيبراني ومراكز العمليات', 'Defensive Security / SOC', 'المراقبة والكشف عن التهديدات والاستجابة داخل مركز عمليات أمنية.', array['SOC', 'Blue Team']::text[], 'planned', 25
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('logs-siem', 'السجلات وأنظمة SIEM', 'Logs & SIEM', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'soc-defense' and c.slug = 'logs-siem'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('threat-detection', 'كشف التهديدات', 'Threat Detection', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'soc-defense' and c.slug = 'threat-detection'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('incident-response', 'الاستجابة للحوادث', 'Incident Response', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'soc-defense' and c.slug = 'incident-response'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('security-monitoring', 'المراقبة الأمنية', 'Security Monitoring', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'soc-defense' and c.slug = 'security-monitoring'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('threat-intelligence', 'الاستخبارات التهديدية', 'Threat Intelligence', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'soc-defense' and c.slug = 'threat-intelligence'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'networking', s.id, 'مسار الشبكات', 'Networking', 'من نموذج OSI وعنونة IP إلى التوجيه والتبديل والخدمات.', array['Networking']::text[], 'planned', 26
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('osi-tcpip', 'نموذج OSI وTCP/IP', 'OSI & TCP/IP', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'networking' and c.slug = 'osi-tcpip'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ip-subnetting', 'عنونة IP والتقسيم الفرعي', 'IP Addressing & Subnetting', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'networking' and c.slug = 'ip-subnetting'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('routing-switching', 'التوجيه والتبديل', 'Routing & Switching', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'networking' and c.slug = 'routing-switching'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('network-services', 'DNS وDHCP وVLAN', 'DNS, DHCP & VLAN', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'networking' and c.slug = 'network-services'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('vpn', 'الشبكات الخاصة الافتراضية', 'VPN', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'networking' and c.slug = 'vpn'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'sysadmin', s.id, 'مسار إدارة الأنظمة', 'Systems Administration', 'إدارة أنظمة التشغيل والخوادم والنسخ الاحتياطي والمراقبة.', array['Systems', 'Linux']::text[], 'planned', 27
from public.schools s where s.slug = 'cyber-infrastructure'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('linux', 'أساسيات Linux', 'Linux Fundamentals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'linux'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('windows-admin', 'إدارة أنظمة Windows', 'Windows Administration', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'windows-admin'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('users-permissions', 'المستخدمون والصلاحيات', 'Users & Permissions', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'users-permissions'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('servers-virtualization', 'الخوادم والمحاكاة الافتراضية', 'Servers & Virtualization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'servers-virtualization'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('backup-recovery', 'النسخ الاحتياطي والاستعادة', 'Backup & Recovery', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'backup-recovery'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('observability', 'دورة المراقبة والتشغيل', 'Monitoring & Operations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'observability'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('troubleshooting', 'تشخيص الأعطال', 'Troubleshooting', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'sysadmin' and c.slug = 'troubleshooting'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'ui-ux', s.id, 'مسار تصميم تجربة وواجهة المستخدم', 'UI/UX Design', 'من بحث المستخدم إلى أنظمة التصميم واختبار قابلية الاستخدام.', array['UX', 'UI', 'Figma']::text[], 'planned', 28
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('user-research', 'دورة بحث المستخدم', 'User Research', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'user-research'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('user-journey', 'رحلات وتدفقات المستخدم', 'User Journeys & Flows', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'user-journey'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('information-architecture', 'معمارية المعلومات', 'Information Architecture', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'information-architecture'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('wireframing', 'الهياكل السلكية', 'Wireframing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'wireframing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ui-design', 'تصميم الواجهات', 'UI Design', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'ui-design'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('design-systems', 'أنظمة التصميم', 'Design Systems', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'design-systems'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('usability-testing', 'اختبار قابلية الاستخدام', 'Usability Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'usability-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('figma', 'Figma عملياً', 'Figma in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'ui-ux' and c.slug = 'figma'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'product-design-path', s.id, 'مسار تصميم المنتجات', 'Product Design', 'التفكير كمصمم منتج: من مشكلة المستخدم إلى MVP وتكرار التحسين.', array['Product', 'Design']::text[], 'planned', 29
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('product-discovery', 'اكتشاف المنتج', 'Product Discovery', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'product-discovery'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('user-problems', 'مشكلات المستخدم', 'Understanding User Problems', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'user-problems'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('mvp', 'بناء المنتج الأولي', 'Building an MVP', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'mvp'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('prototyping', 'النماذج التفاعلية', 'Prototyping', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'prototyping'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('product-iteration', 'تحسين المنتج بالتكرار', 'Product Iteration', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'product-iteration'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('usability-testing', 'اختبار قابلية الاستخدام', 'Usability Testing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'usability-testing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ui-design', 'تصميم الواجهات', 'UI Design', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'product-design-path' and c.slug = 'ui-design'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'graphic-design', s.id, 'مسار التصميم الجرافيكي', 'Graphic Design', 'مبادئ التصميم والطباعة واللون والهوية البصرية.', array['Design', 'Branding']::text[], 'planned', 30
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('design-principles', 'مبادئ التصميم', 'Design Principles', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'design-principles'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('typography', 'الطباعة والخطوط', 'Typography', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'typography'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('color-composition', 'اللون والتكوين', 'Color & Composition', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'color-composition'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('branding', 'الهوية البصرية', 'Branding', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'branding'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('photoshop', 'Photoshop', 'Photoshop', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'photoshop'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('illustrator', 'Illustrator', 'Illustrator', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'illustrator'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('canva', 'Canva', 'Canva', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'graphic-design' and c.slug = 'canva'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'motion-graphics', s.id, 'مسار الموشن جرافيك', 'Motion Graphics', 'من مبادئ الحركة إلى تحريك النصوص والشعارات وفيديوهات الشرح.', array['Motion', 'After Effects']::text[], 'planned', 31
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('motion-principles', 'مبادئ الحركة', 'Motion Principles', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-graphics' and c.slug = 'motion-principles'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('after-effects', 'After Effects عملياً', 'After Effects in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-graphics' and c.slug = 'after-effects'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('text-logo-animation', 'تحريك النصوص والشعارات', 'Text & Logo Animation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-graphics' and c.slug = 'text-logo-animation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('explainer-videos', 'فيديوهات الشرح', 'Explainer Videos', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-graphics' and c.slug = 'explainer-videos'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('video-editing', 'تحرير الفيديو', 'Video Editing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-graphics' and c.slug = 'video-editing'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'motion-3d', s.id, 'مسار الموشن والثلاثي الأبعاد', 'Motion Design & 3D', 'السرد البصري وأساسيات 3D والنمذجة والإضاءة والإخراج.', array['3D', 'Blender']::text[], 'planned', 32
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('visual-storytelling', 'السرد البصري', 'Visual Storytelling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = 'visual-storytelling'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('3d-foundations', 'أساسيات الثلاثي الأبعاد', '3D Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = '3d-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('blender', 'Blender عملياً', 'Blender in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = 'blender'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('modeling-materials', 'النمذجة والخامات', 'Modeling & Materials', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = 'modeling-materials'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('lighting-rendering', 'الإضاءة والإخراج', 'Lighting & Rendering', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = 'lighting-rendering'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('motion-principles', 'مبادئ الحركة', 'Motion Principles', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'motion-3d' and c.slug = 'motion-principles'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'video-editing', s.id, 'مسار تحرير وإنتاج الفيديو', 'Video Editing', 'من أساسيات المونتاج والسرد إلى الصوت واللون والنشر.', array['Video', 'Editing']::text[], 'planned', 33
from public.schools s where s.slug = 'design-creative'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('video-editing', 'تحرير الفيديو', 'Video Editing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'video-editing' and c.slug = 'video-editing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('video-storytelling', 'السرد في الفيديو', 'Storytelling for Video', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'video-editing' and c.slug = 'video-storytelling'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('audio-color', 'الصوت وتصحيح الألوان', 'Audio & Color', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'video-editing' and c.slug = 'audio-color'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('short-form', 'المحتوى القصير والنشر', 'Short-Form & Publishing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'video-editing' and c.slug = 'short-form'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-video-tools', 'أدوات الذكاء الاصطناعي للفيديو', 'AI Tools for Video', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'video-editing' and c.slug = 'ai-video-tools'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'digital-marketing', s.id, 'مسار التسويق الرقمي', 'Digital Marketing', 'من بحث العملاء والمحتوى إلى SEO والإعلانات والتحليلات.', array['Marketing', 'SEO']::text[], 'planned', 34
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('marketing-foundations', 'أسس التسويق', 'Marketing Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'marketing-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('customer-research', 'بحث العملاء', 'Customer Research', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'customer-research'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('content-social', 'المحتوى ووسائل التواصل', 'Content & Social Media', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'content-social'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('seo', 'تحسين محركات البحث', 'SEO', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'seo'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('paid-ads', 'الإعلانات المدفوعة', 'Paid Advertising', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'paid-ads'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('marketing-analytics', 'تحليلات التسويق', 'Marketing Analytics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'marketing-analytics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('email-marketing', 'التسويق بالبريد', 'Email Marketing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'email-marketing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('growth-marketing', 'تسويق النمو', 'Growth Marketing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-marketing' and c.slug = 'growth-marketing'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'business-analysis', s.id, 'مسار تحليل الأعمال', 'Business Analysis', 'ربط احتياجات الأعمال بالحلول التقنية وتوثيقها.', array['Business Analysis', 'BPMN']::text[], 'planned', 35
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ba-foundations', 'أسس تحليل الأعمال', 'Business Analysis Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'ba-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('requirements', 'تحليل المتطلبات', 'Requirements Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'requirements'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('stakeholders', 'أصحاب المصلحة', 'Stakeholder Management', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'stakeholders'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('process-mapping', 'رسم العمليات وBPMN', 'Process Mapping & BPMN', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'process-mapping'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('user-stories', 'قصص المستخدم وحالات الاستخدام', 'User Stories & Use Cases', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'user-stories'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('business-documentation', 'توثيق الأعمال ودراسة الجدوى', 'Business Documentation & Case', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'business-documentation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sql-analysis', 'دورة SQL للتحليل', 'SQL for Analysis', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'business-analysis' and c.slug = 'sql-analysis'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'project-management', s.id, 'مسار إدارة المشاريع', 'Project Management', 'النطاق والجدول والميزانية والمخاطر والتواصل حتى الإغلاق.', array['Project Management']::text[], 'planned', 37
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pm-scope-schedule', 'النطاق والجدول الزمني', 'Scope & Schedule', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'project-management' and c.slug = 'pm-scope-schedule'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pm-budget-risk', 'الميزانية والمخاطر', 'Budget & Risk', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'project-management' and c.slug = 'pm-budget-risk'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pm-communication', 'التواصل وأصحاب المصلحة', 'Communication & Stakeholders', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'project-management' and c.slug = 'pm-communication'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pm-monitoring', 'المتابعة والإغلاق', 'Monitoring & Closure', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'project-management' and c.slug = 'pm-monitoring'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('agile-scrum', 'Agile وScrum عملياً', 'Agile & Scrum in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'project-management' and c.slug = 'agile-scrum'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'agile-scrum', s.id, 'مسار Agile وScrum', 'Agile & Scrum', 'العمل بأساليب Agile: Scrum وKanban ودورة السبرنت كاملة.', array['Agile', 'Scrum']::text[], 'planned', 38
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('agile-foundations', 'أسس Agile', 'Agile Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'agile-scrum' and c.slug = 'agile-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('agile-scrum', 'Agile وScrum عملياً', 'Agile & Scrum in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'agile-scrum' and c.slug = 'agile-scrum'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('kanban', 'Kanban عملياً', 'Kanban in Practice', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'agile-scrum' and c.slug = 'kanban'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('sprint-cycle', 'دورة السبرنت كاملة', 'The Full Sprint Cycle', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'agile-scrum' and c.slug = 'sprint-cycle'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('user-stories', 'قصص المستخدم وحالات الاستخدام', 'User Stories & Use Cases', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'agile-scrum' and c.slug = 'user-stories'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'freelancing', s.id, 'مسار العمل الحر الرقمي', 'Freelancing & Digital Work', 'تحويل المهارة إلى عمل: العروض والتسعير والعقود وإدارة العملاء.', array['Freelancing']::text[], 'planned', 40
from public.schools s where s.slug = 'business-management'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('skill-positioning', 'تموضع المهارة', 'Skill Positioning', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'skill-positioning'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('portfolio-profiles', 'المعرض والملفات المهنية', 'Portfolio & Profiles', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'portfolio-profiles'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('proposals', 'كتابة العروض', 'Writing Proposals', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'proposals'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pricing-contracts', 'التسعير والعقود', 'Pricing & Contracts', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'pricing-contracts'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('client-management', 'إدارة العملاء والتسليم', 'Client & Delivery Management', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'client-management'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('personal-branding', 'العلامة الشخصية', 'Personal Branding', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'freelancing' and c.slug = 'personal-branding'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'personal-branding', s.id, 'مسار العلامة الشخصية', 'Personal Branding', 'بناء هوية مهنية رقمية: السيرة وLinkedIn والمعرض والشبكة.', array['Career', 'Branding']::text[], 'planned', 41
from public.schools s where s.slug = 'career-human'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('personal-branding', 'العلامة الشخصية', 'Personal Branding', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'personal-branding' and c.slug = 'personal-branding'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('cv-linkedin', 'السيرة الذاتية وLinkedIn', 'CV & LinkedIn', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'personal-branding' and c.slug = 'cv-linkedin'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('portfolio-profiles', 'المعرض والملفات المهنية', 'Portfolio & Profiles', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'personal-branding' and c.slug = 'portfolio-profiles'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('networking', 'بناء الشبكة المهنية', 'Professional Networking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'personal-branding' and c.slug = 'networking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('content-social', 'المحتوى ووسائل التواصل', 'Content & Social Media', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'personal-branding' and c.slug = 'content-social'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'communication', s.id, 'مسار التواصل والخطابة', 'Communication & Public Speaking', 'الإنصات والحوار ولغة الجسد والعرض والتفاوض.', array['Communication']::text[], 'planned', 42
from public.schools s where s.slug = 'career-human'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('active-listening', 'الإنصات والحوار', 'Listening & Conversation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'active-listening'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('body-language', 'لغة الجسد', 'Body Language', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'body-language'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('presentation', 'مهارات العرض', 'Presentation Skills', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'presentation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('public-speaking', 'الخطابة أمام الجمهور', 'Public Speaking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'public-speaking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('negotiation', 'التفاوض وإدارة الخلاف', 'Negotiation & Conflict', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'negotiation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('storytelling', 'السرد', 'Storytelling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'communication' and c.slug = 'storytelling'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'life-professional-skills', s.id, 'مسار المهارات الشخصية والمهنية', 'Life & Professional Skills', 'الأهداف وإدارة الوقت والتركيز واتخاذ القرار وأخلاقيات العمل.', array['Soft Skills']::text[], 'planned', 43
from public.schools s where s.slug = 'career-human'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('goal-setting', 'تحديد الأهداف', 'Goal Setting', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'goal-setting'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('time-management', 'إدارة الوقت والإنتاجية', 'Time Management & Productivity', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'time-management'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('decision-making', 'اتخاذ القرار وحل المشكلات', 'Decision Making & Problem Solving', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'decision-making'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('critical-thinking', 'التفكير النقدي', 'Critical Thinking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'critical-thinking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('emotional-intelligence', 'الذكاء العاطفي', 'Emotional Intelligence', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'emotional-intelligence'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('work-ethics', 'أخلاقيات العمل', 'Work Ethics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'life-professional-skills' and c.slug = 'work-ethics'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'english-for-work', s.id, 'مسار الإنجليزية للعمل والتقنية', 'English for Work & Technology', 'القواعد والمفردات والمهارات الأربع موجّهة للعمل والتقنية.', array['English']::text[], 'planned', 44
from public.schools s where s.slug = 'career-human'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('english-grammar', 'القواعد والمفردات', 'Grammar & Vocabulary', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'english-grammar'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('english-listening-speaking', 'الاستماع والتحدث', 'Listening & Speaking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'english-listening-speaking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('english-reading-writing', 'القراءة والكتابة', 'Reading & Writing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'english-reading-writing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('english-at-work', 'الإنجليزية في بيئة العمل', 'English at Work', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'english-at-work'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('technical-english', 'الإنجليزية التقنية', 'Technical English', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'technical-english'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('interview-english', 'المقابلات بالإنجليزية', 'Interview English', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'english-for-work' and c.slug = 'interview-english'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'icdl', s.id, 'مسار المهارات الرقمية الأساسية ICDL', 'ICDL & Digital Literacy', 'أساسيات الحاسوب والملفات والإنترنت وحزمة المكتب والأمن الرقمي.', array['ICDL', 'Digital Literacy']::text[], 'planned', 45
from public.schools s where s.slug = 'digital-admin'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('computer-essentials', 'أساسيات الحاسوب', 'Computer Essentials', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'computer-essentials'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('files-folders', 'الملفات والمجلدات', 'Files & Folders', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'files-folders'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('internet-basics', 'الإنترنت والبريد', 'Internet & Email', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'internet-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('word', 'Word', 'Word', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'word'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('excel-basics', 'Excel للمبتدئين', 'Excel for Beginners', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'excel-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('powerpoint', 'PowerPoint', 'PowerPoint', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'powerpoint'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('digital-security', 'الأمن الرقمي', 'Digital Security', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'digital-security'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('cloud-basics', 'التخزين السحابي', 'Cloud Storage', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'icdl' and c.slug = 'cloud-basics'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'advanced-excel', s.id, 'مسار Excel المتقدم والإنتاجية المكتبية', 'Advanced Excel & Office Productivity', 'الدوال المتقدمة والجداول المحورية وPower Query ولوحات التحكم.', array['Excel', 'Office']::text[], 'planned', 46
from public.schools s where s.slug = 'digital-admin'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('data-excel', 'دورة أساسيات البيانات وExcel', 'Data & Excel Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'data-excel'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('excel-functions', 'الدوال المتقدمة', 'Advanced Functions', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'excel-functions'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('pivot-tables', 'الجداول المحورية', 'Pivot Tables', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'pivot-tables'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('power-query', 'Power Query', 'Power Query', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'power-query'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('excel-dashboards', 'لوحات تحكم Excel', 'Excel Dashboards', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'excel-dashboards'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('word-advanced', 'Word المتقدم', 'Advanced Word', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'word-advanced'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('powerpoint-advanced', 'PowerPoint المتقدم', 'Advanced PowerPoint', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'powerpoint-advanced'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('microsoft-365', 'Microsoft 365', 'Microsoft 365', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 8
from public.learning_paths lp, public.courses c
where lp.slug = 'advanced-excel' and c.slug = 'microsoft-365'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'digital-workplace', s.id, 'مسار بيئة العمل الرقمية', 'Digital Skills & Digital Workplace', 'التعاون عن بُعد والتنظيم الرقمي والنظافة السيبرانية والذكاء الاصطناعي في العمل.', array['Remote Work', 'Collaboration']::text[], 'planned', 47
from public.schools s where s.slug = 'digital-admin'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('google-workspace', 'Google Workspace', 'Google Workspace', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'google-workspace'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('microsoft-365', 'Microsoft 365', 'Microsoft 365', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'microsoft-365'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('online-collaboration', 'التعاون عبر الإنترنت', 'Online Collaboration', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'online-collaboration'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('remote-work', 'العمل عن بُعد', 'Remote Work', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'remote-work'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('digital-organization', 'التنظيم الرقمي', 'Digital Organization', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'digital-organization'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('cyber-hygiene', 'النظافة السيبرانية', 'Cyber Hygiene', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'cyber-hygiene'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('ai-at-work', 'الذكاء الاصطناعي في العمل', 'AI at Work', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'digital-workplace' and c.slug = 'ai-at-work'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'administrative-skills', s.id, 'مسار المهارات الإدارية والمكتبية', 'Administrative & Office Skills', 'إدارة المكتب والوثائق والمراسلات والتقارير والاجتماعات والمتابعة.', array['Administration']::text[], 'planned', 48
from public.schools s where s.slug = 'digital-admin'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('office-management', 'إدارة المكتب', 'Office Management', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'office-management'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('document-management', 'إدارة الوثائق والسجلات', 'Document & Records Management', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'document-management'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('correspondence', 'المراسلات والتقارير', 'Correspondence & Reports', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'correspondence'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('meetings-scheduling', 'الاجتماعات والجدولة', 'Meetings & Scheduling', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'meetings-scheduling'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('data-entry', 'إدخال البيانات', 'Data Entry', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'data-entry'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('confidentiality', 'السرية المهنية', 'Confidentiality', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'administrative-skills' and c.slug = 'confidentiality'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'science-foundations', s.id, 'مسار أسس العلوم والتقنية', 'Science & Technology Foundations', 'تفكير علمي وأساس في الفيزياء والكيمياء والأحياء وقراءة البحث.', array['Science']::text[], 'planned', 49
from public.schools s where s.slug = 'foundations'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('scientific-thinking', 'التفكير العلمي', 'Scientific Thinking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'scientific-thinking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('physics-basics', 'أساسيات الفيزياء', 'Physics Basics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'physics-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('chemistry-basics', 'أساسيات الكيمياء', 'Chemistry Basics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'chemistry-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('biology-basics', 'أساسيات الأحياء', 'Biology Basics', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'biology-basics'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('tech-and-society', 'التقنية والمجتمع', 'Technology & Society', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'tech-and-society'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('scientific-writing', 'القراءة والكتابة العلمية', 'Scientific Reading & Writing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'science-foundations' and c.slug = 'scientific-writing'
on conflict do nothing;

insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select 'research-thinking', s.id, 'مسار البحث والتفكير النقدي والابتكار', 'Research, Critical Thinking & Innovation', 'مهارات البحث وتقييم المصادر والتحقق والتفكير المنطقي والكتابة الأكاديمية.', array['Research', 'Critical Thinking']::text[], 'planned', 50
from public.schools s where s.slug = 'foundations'
on conflict (slug) do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('research-foundations', 'أسس البحث', 'Research Foundations', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 1
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'research-foundations'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('information-literacy', 'الثقافة المعلوماتية ومهارات البحث', 'Information Literacy & Search', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 2
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'information-literacy'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('source-evaluation', 'تقييم المصادر والتحقق', 'Source Evaluation & Fact Checking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 3
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'source-evaluation'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('critical-thinking', 'التفكير النقدي', 'Critical Thinking', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 4
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'critical-thinking'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('academic-writing', 'الكتابة الأكاديمية', 'Academic Writing', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, 5
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'academic-writing'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('logical-reasoning', 'الاستدلال المنطقي', 'Logical Reasoning', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 6
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'logical-reasoning'
on conflict do nothing;

insert into public.courses (slug, title_ar, title_en, status)
values ('data-interpretation', 'تفسير البيانات', 'Data Interpretation', 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, false, 7
from public.learning_paths lp, public.courses c
where lp.slug = 'research-thinking' and c.slug = 'data-interpretation'
on conflict do nothing;


-- Course levels come from each course's position in its path, which is how the
-- catalogue above is built: three courses per path, each one building on the
-- last. The rule itself lives in the migration so there is only one copy of it.
select public.backfill_course_levels();

commit;
