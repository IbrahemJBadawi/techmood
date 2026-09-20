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
select 'genai', s.id, 'مسار الذكاء الاصطناعي التوليدي', 'مجموعة دورات من أساسيات Python إلى بناء تطبيقات GenAI حقيقية.', 'من الكود إلى الذكاء — نبني مستقبلك خطوة بخطوة.', array['AI', 'Python']::text[], 'published', 4, 1
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
select 'data', s.id, 'مسار تحليل البيانات', 'مجموعة دورات من Excel وSQL إلى لوحات تحكم وتقارير احترافية.', 'من الأرقام إلى القرارات — بيانات تتحدث.', array['Data', 'SQL']::text[], 'published', 4, 2
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
select 'web', s.id, 'مسار تطوير الويب', 'مجموعة دورات لبناء واجهات وتطبيقات ويب حديثة من الصفر حتى النشر.', 'من السطر الأول إلى الإطلاق — نبني الويب معاً.', array['Web', 'React']::text[], 'published', 5, 3
from public.schools s where s.slug = 'software'
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
select 'product', s.id, 'مسار إدارة المنتجات', 'مجموعة دورات من فهم المستخدم إلى بناء وإطلاق منتج رقمي.', 'من الفكرة إلى المنتج — نصمم لتجربة أفضل.', array['Product', 'UX']::text[], 'published', 3, 4
from public.schools s where s.slug = 'product-design'
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
select 'cloud', s.id, 'مسار الحوسبة السحابية', 'مجموعة دورات في أساسيات البنية التحتية والنشر والتشغيل الآلي.', 'من الخادم إلى النظام الذكي — نؤتمت المستقبل.', array['Cloud', 'DevOps']::text[], 'published', 4, 5
from public.schools s where s.slug = 'cloud-security'
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
select 'business', s.id, 'مسار ريادة الأعمال الرقمية', 'مجموعة دورات من الفكرة إلى التحقق من السوق وبناء نموذج عمل.', 'من الفكرة إلى الشركة — نبني رواد الأعمال.', array['Business', 'Growth']::text[], 'published', 3, 6
from public.schools s where s.slug = 'entrepreneurship'
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


commit;
