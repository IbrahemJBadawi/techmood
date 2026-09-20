#!/usr/bin/env python3
"""Regenerates supabase/seed.sql from the academy catalogue below.

The catalogue is a faithful port of the v23 prototype: same six paths, same
eighteen courses, same lessons, durations and practical tasks. What is new is
the structure around it — modules, explicit required/elective courses, and a
gradeable assignment for every lesson, course and path.
"""
import pathlib

EN = {
 'Python للمبتدئين':'Python for Beginners','هياكل البيانات في Python':'Data Structures in Python',
 'مقدمة في Machine Learning':'Introduction to Machine Learning','NumPy وPandas عملياً':'NumPy & Pandas in Practice',
 'مقدمة في نماذج اللغة الكبيرة (LLMs)':'Introduction to Large Language Models (LLMs)',
 'أساسيات Prompt Engineering':'Prompt Engineering Fundamentals','تنظيف البيانات في Excel':'Data Cleaning in Excel',
 'الدوال والجداول المحورية':'Functions & Pivot Tables','أساسيات الاستعلامات SQL':'SQL Query Fundamentals',
 'الدمج بين الجداول (Joins)':'Table Joins','مبادئ تصميم لوحات التحكم':'Dashboard Design Principles',
 'بناء لوحة تحكم تفاعلية':'Building an Interactive Dashboard','بنية صفحات HTML':'HTML Page Structure',
 'تنسيق الصفحات بـ CSS وFlexbox':'Styling with CSS & Flexbox','أساسيات JavaScript وES6':'JavaScript & ES6 Fundamentals',
 'التعامل مع DOM والأحداث':'Working with the DOM & Events','مكوّنات React الأساسية':'React Components Basics',
 'إدارة الحالة بـ Hooks':'State Management with Hooks','أساسيات بحث المستخدم':'User Research Fundamentals',
 'بناء Personas':'Building Personas','مبادئ UX الأساسية':'Core UX Principles','بناء Wireframes':'Building Wireframes',
 'مؤشرات نجاح المنتج':'Product Success Metrics','استراتيجيات الإطلاق':'Launch Strategies',
 'مقدمة في الخدمات السحابية':'Introduction to Cloud Services','الشبكات والتخزين السحابي':'Cloud Networking & Storage',
 'مقدمة في Docker':'Introduction to Docker','أساسيات CI/CD':'CI/CD Fundamentals',
 'مراقبة الأنظمة السحابية':'Cloud Systems Monitoring','التشغيل الآلي للبنية التحتية':'Infrastructure Automation',
 'كيف تجد فكرة مشروع':'How to Find a Startup Idea','تحليل السوق المبدئي':'Initial Market Analysis',
 'مقابلات التحقق من المشكلة':'Problem Validation Interviews','بناء استبيان تحقق فعّال':'Building an Effective Validation Survey',
 'Business Model Canvas':'Business Model Canvas','أساسيات التسعير':'Pricing Fundamentals',
}

V, A = 'video', 'article'
PATHS = [
 dict(slug='genai', school='ai-data', title='مسار الذكاء الاصطناعي التوليدي',
      desc='مجموعة دورات من أساسيات Python إلى بناء تطبيقات GenAI حقيقية.',
      tagline='من الكود إلى الذكاء — نبني مستقبلك خطوة بخطوة.', tags=['AI','Python'],
      courses=[
        ('python-for-ai','دورة Python للذكاء الاصطناعي','أساسيات Python وهياكل البيانات اللازمة للانطلاق في الذكاء الاصطناعي.',
         [('Python للمبتدئين',V,45),('هياكل البيانات في Python',V,30)],'بناء سكربت تحليل نصوص بسيط'),
        ('ml-foundations','دورة أساسيات تعلّم الآلة','مدخل عملي لمفاهيم Machine Learning وأدوات تحليل البيانات.',
         [('مقدمة في Machine Learning',V,50),('NumPy وPandas عملياً',A,25)],'تدريب نموذج تصنيف بسيط'),
        ('generative-ai','دورة الذكاء الاصطناعي التوليدي','نماذج اللغة الكبيرة وPrompt Engineering وبناء أول تطبيق GenAI.',
         [('مقدمة في نماذج اللغة الكبيرة (LLMs)',V,40),('أساسيات Prompt Engineering',V,35)],'بناء تطبيق GenAI مصغّر'),
      ]),
 dict(slug='data', school='ai-data', title='مسار تحليل البيانات',
      desc='مجموعة دورات من Excel وSQL إلى لوحات تحكم وتقارير احترافية.',
      tagline='من الأرقام إلى القرارات — بيانات تتحدث.', tags=['Data','SQL'],
      courses=[
        ('data-excel','دورة أساسيات البيانات وExcel','تنظيف البيانات والتعامل مع الجداول والدوال المحورية.',
         [('تنظيف البيانات في Excel',V,35),('الدوال والجداول المحورية',V,30)],'تنظيف مجموعة بيانات مبيعات حقيقية'),
        ('sql-analysis','دورة SQL للتحليل','كتابة استعلامات وربط الجداول لاستخراج تقارير دقيقة.',
         [('أساسيات الاستعلامات SQL',V,40),('الدمج بين الجداول (Joins)',A,20)],'كتابة استعلامات لتقرير مبيعات'),
        ('dashboards','دورة لوحات التحكم والتقارير','تصميم لوحات تحكم تفاعلية توصل الرسالة بوضوح.',
         [('مبادئ تصميم لوحات التحكم',V,30),('بناء لوحة تحكم تفاعلية',V,45)],'بناء لوحة تحكم لمشروع تحليل المبيعات'),
      ]),
 dict(slug='web', school='software', title='مسار تطوير الويب',
      desc='مجموعة دورات لبناء واجهات وتطبيقات ويب حديثة من الصفر حتى النشر.',
      tagline='من السطر الأول إلى الإطلاق — نبني الويب معاً.', tags=['Web','React'],
      courses=[
        ('html-css','دورة أساسيات HTML وCSS','بنية الصفحات والتنسيق باستخدام Flexbox.',
         [('بنية صفحات HTML',V,30),('تنسيق الصفحات بـ CSS وFlexbox',V,40)],'بناء صفحة هبوط ثابتة'),
        ('modern-js','دورة JavaScript الحديث','أساسيات اللغة وES6 والتعامل مع DOM والأحداث.',
         [('أساسيات JavaScript وES6',V,50),('التعامل مع DOM والأحداث',V,35)],'بناء تطبيق قائمة مهام بسيط'),
        ('react','دورة React وبناء الواجهات','مكوّنات React وإدارة الحالة عبر Hooks.',
         [('مكوّنات React الأساسية',V,45),('إدارة الحالة بـ Hooks',V,40)],'بناء تطبيق ويب تفاعلي كامل'),
      ]),
 dict(slug='product', school='product-design', title='مسار إدارة المنتجات',
      desc='مجموعة دورات من فهم المستخدم إلى بناء وإطلاق منتج رقمي.',
      tagline='من الفكرة إلى المنتج — نصمم لتجربة أفضل.', tags=['Product','UX'],
      courses=[
        ('user-research','دورة فهم المستخدم','بحث المستخدم وبناء Personas قبل أي قرار تصميم.',
         [('أساسيات بحث المستخدم',V,30),('بناء Personas',A,20)],'إجراء 3 مقابلات مستخدم'),
        ('product-design','دورة تصميم المنتج','مبادئ UX وبناء Wireframes أولية.',
         [('مبادئ UX الأساسية',V,35),('بناء Wireframes',V,30)],'تصميم نموذج أولي بسيط'),
        ('launch-measure','دورة الإطلاق والقياس','مؤشرات النجاح واستراتيجيات إطلاق المنتج.',
         [('مؤشرات نجاح المنتج',V,25),('استراتيجيات الإطلاق',A,20)],'كتابة خطة إطلاق منتج'),
      ]),
 dict(slug='cloud', school='cloud-security', title='مسار الحوسبة السحابية',
      desc='مجموعة دورات في أساسيات البنية التحتية والنشر والتشغيل الآلي.',
      tagline='من الخادم إلى النظام الذكي — نؤتمت المستقبل.', tags=['Cloud','DevOps'],
      courses=[
        ('cloud-foundations','دورة أساسيات الحوسبة السحابية','الخدمات السحابية الأساسية والشبكات والتخزين.',
         [('مقدمة في الخدمات السحابية',V,30),('الشبكات والتخزين السحابي',V,35)],'إعداد أول خادم سحابي'),
        ('containers','دورة النشر والحاويات','Docker وأساسيات CI/CD لنشر موثوق.',
         [('مقدمة في Docker',V,40),('أساسيات CI/CD',A,25)],'نشر تطبيق باستخدام Docker'),
        ('observability','دورة المراقبة والتشغيل الآلي','مراقبة الأنظمة وأتمتة عمليات النشر.',
         [('مراقبة الأنظمة السحابية',V,30),('التشغيل الآلي للبنية التحتية',V,35)],'أتمتة عملية نشر كاملة'),
      ]),
 dict(slug='business', school='entrepreneurship', title='مسار ريادة الأعمال الرقمية',
      desc='مجموعة دورات من الفكرة إلى التحقق من السوق وبناء نموذج عمل.',
      tagline='من الفكرة إلى الشركة — نبني رواد الأعمال.', tags=['Business','Growth'],
      courses=[
        ('idea-to-opportunity','دورة من الفكرة إلى الفرصة','كيف تجد فكرة مشروع وتحلل السوق المبدئي.',
         [('كيف تجد فكرة مشروع',V,25),('تحليل السوق المبدئي',A,20)],'صياغة فكرة مشروع أولية'),
        ('validation','دورة التحقق من الفكرة','مقابلات واستبيانات للتحقق من المشكلة قبل البناء.',
         [('مقابلات التحقق من المشكلة',V,30),('بناء استبيان تحقق فعّال',A,20)],'إجراء تحقق أولي من الفكرة'),
        ('business-model','دورة نموذج العمل','Business Model Canvas وأساسيات التسعير.',
         [('Business Model Canvas',V,35),('أساسيات التسعير',V,25)],'بناء نموذج عمل أولي'),
      ]),
]

def q(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"

def arr(items):
    return "array[" + ", ".join(q(i) for i in items) + "]::text[]" if items else "'{}'::text[]"

out = ["""-- =============================================================================
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
"""]

for p in PATHS:
    hours = sum(l[2] for c in p['courses'] for l in c[3]) // 60 + 1
    out.append(f"""
-- ---------------------------------------------------------------------------
-- {p['title']}
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select {q(p['slug'])}, s.id, {q(p['title'])}, {q(p['desc'])}, {q(p['tagline'])}, {arr(p['tags'])}, 'published', {hours}, {PATHS.index(p) + 1}
from public.schools s where s.slug = {q(p['school'])}
on conflict (slug) do nothing;

insert into public.assignments (kind, path_id, title_ar, brief_ar, required_evidence, is_required, is_group_work)
select 'path_project', lp.id,
       {q('المشروع الجماعي لـ ' + p['title'].replace('مسار ', ''))},
       'مشروع تخرّج جماعي يطبّق كل دورات المسار معاً، ويُنفَّذ ضمن فريق. يُسلَّم بمستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true, true
from public.learning_paths lp where lp.slug = {q(p['slug'])};""")

    for ci, (cslug, ctitle, cdesc, lessons, task) in enumerate(p['courses'], start=1):
        chours = sum(l[2] for l in lessons) // 60 + 1
        out.append(f"""
insert into public.courses (slug, title_ar, description_ar, status, estimated_hours)
values ({q(cslug)}, {q(ctitle)}, {q(cdesc)}, 'published', {chours})
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, true, {ci}
from public.learning_paths lp, public.courses c
where lp.slug = {q(p['slug'])} and c.slug = {q(cslug)}
on conflict do nothing;

insert into public.modules (course_id, title_ar, sort_order)
select c.id, {q(ctitle.replace('دورة ', 'وحدة '))}, 1 from public.courses c where c.slug = {q(cslug)};""")

        for li, (ltitle, lkind, ldur) in enumerate(lessons, start=1):
            summary = f'ملخص يغطي أهم الأفكار في "{ltitle}"، مع أمثلة مبسّطة تثبّت الفهم قبل الانتقال للتطبيق.'
            evidence = "array['github']::public.evidence_kind[]" if lkind == V else "'{}'::public.evidence_kind[]"
            out.append(f"""
insert into public.lessons (module_id, title_ar, title_en, kind, duration_minutes, summary_ar, sort_order)
select m.id, {q(ltitle)}, {q(EN.get(ltitle, ltitle))}, '{lkind}', {ldur}, {q(summary)}, {li}
from public.modules m join public.courses c on c.id = m.course_id where c.slug = {q(cslug)};

insert into public.assignments (kind, lesson_id, title_ar, brief_ar, required_evidence, is_required)
select 'lesson_assignment', l.id, {q('تكليف: ' + ltitle)},
       {q(f'طبّق ما تعلمته في "{ltitle}" على مثال واقعي بسيط، وسلّم ما نفّذته ليراجعه منتورك.')},
       {evidence}, true
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
where c.slug = {q(cslug)} and l.title_ar = {q(ltitle)};""")

        out.append(f"""
insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_task', c.id, {q('مهمة تطبيقية: ' + task)},
       'مهمة تطبيقية تثبّت مهارات هذه الدورة قبل الانتقال إلى مشروعها.',
       '{{}}'::public.evidence_kind[], true
from public.courses c where c.slug = {q(cslug)};

insert into public.assignments (kind, course_id, title_ar, brief_ar, required_evidence, is_required)
select 'course_project', c.id, {q('مشروع الدورة: ' + ctitle.replace('دورة ', ''))},
       'مشروع تطبيقي يجمع كل ما تعلمته في هذه الدورة في عمل واحد قابل للعرض: مستودع الكود، منشور توثيق على LinkedIn، وفيديو شرح.',
       array['github','linkedin','youtube']::public.evidence_kind[], true
from public.courses c where c.slug = {q(cslug)};""")

out.append("\n\ncommit;\n")
pathlib.Path(__file__).resolve().parent.parent.joinpath('supabase/seed.sql').write_text("\n".join(out))
print("seed.sql written")
