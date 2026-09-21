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

# The live catalogue in English. A certificate is issued in English, and the
# name of the work it was earned on has to be English too — so this is not
# decoration, it is the line that appears on the document.
EN_PATH = {
 'genai':    'Generative AI',
 'data':     'Data Analysis',
 'web':      'Web Development',
 'product':  'Product Management',
 'cloud':    'Cloud Computing',
 'business': 'Digital Entrepreneurship',
}

EN_COURSE = {
 'python-for-ai':       'Python for Artificial Intelligence',
 'ml-foundations':      'Machine Learning Foundations',
 'generative-ai':       'Generative AI',
 'data-excel':          'Data Foundations with Excel',
 'sql-analysis':        'SQL for Analysis',
 'dashboards':          'Dashboards and Reporting',
 'html-css':            'Web Foundations: HTML and CSS',
 'modern-js':           'Modern JavaScript',
 'react':               'React in Practice',
 'user-research':       'User Research',
 'product-design':      'Product Design',
 'launch-measure':      'Launch and Measure',
 'cloud-foundations':   'Cloud Foundations',
 'containers':          'Containers and Docker',
 'observability':       'Monitoring and Operations',
 'idea-to-opportunity': 'From Idea to Opportunity',
 'validation':          'Validating the Problem',
 'business-model':      'Business Model and Pricing',
}


# The skills the live catalogue actually teaches, and which lesson teaches each
# one. This is the only place a skill is attached to content: a course's skills
# and a path's are derived from these by course_skills() and path_skills().
SKILLS = [
 ('python', 'Python', 'Python'),
 ('data-structures', 'هياكل البيانات', 'Data Structures'),
 ('machine-learning', 'تعلّم الآلة', 'Machine Learning'),
 ('pandas-numpy', 'Pandas وNumPy', 'Pandas & NumPy'),
 ('llm', 'نماذج اللغة الكبيرة', 'Large Language Models'),
 ('prompt-engineering', 'هندسة التوجيه', 'Prompt Engineering'),
 ('excel', 'Excel', 'Excel'),
 ('data-cleaning', 'تنظيف البيانات', 'Data Cleaning'),
 ('pivot-tables', 'الجداول المحورية', 'Pivot Tables'),
 ('sql', 'SQL', 'SQL'),
 ('sql-joins', 'الدمج بين الجداول', 'SQL Joins'),
 ('data-visualization', 'تصوير البيانات', 'Data Visualization'),
 ('dashboards', 'لوحات التحكم', 'Dashboards'),
 ('html', 'HTML', 'HTML'),
 ('css', 'CSS', 'CSS'),
 ('javascript', 'JavaScript', 'JavaScript'),
 ('dom', 'التعامل مع DOM', 'DOM Scripting'),
 ('react', 'React', 'React'),
 ('state-management', 'إدارة الحالة', 'State Management'),
 ('user-research', 'بحث المستخدم', 'User Research'),
 ('personas', 'بناء Personas', 'Personas'),
 ('ux-principles', 'مبادئ تجربة المستخدم', 'UX Principles'),
 ('wireframing', 'الهياكل السلكية', 'Wireframing'),
 ('product-metrics', 'مؤشرات المنتج', 'Product Metrics'),
 ('go-to-market', 'استراتيجية الإطلاق', 'Go-to-Market'),
 ('cloud-computing', 'الحوسبة السحابية', 'Cloud Computing'),
 ('cloud-networking', 'الشبكات والتخزين السحابي', 'Cloud Networking & Storage'),
 ('docker', 'Docker', 'Docker'),
 ('ci-cd', 'CI/CD', 'CI/CD'),
 ('monitoring', 'مراقبة الأنظمة', 'Systems Monitoring'),
 ('infrastructure-automation', 'أتمتة البنية التحتية', 'Infrastructure Automation'),
 ('opportunity-discovery', 'اكتشاف الفرص', 'Opportunity Discovery'),
 ('market-research', 'بحث السوق', 'Market Research'),
 ('customer-interviews', 'مقابلات العملاء', 'Customer Interviews'),
 ('survey-design', 'تصميم الاستبيانات', 'Survey Design'),
 ('business-modeling', 'نمذجة الأعمال', 'Business Modelling'),
 ('pricing', 'التسعير', 'Pricing'),
]

# lesson title -> the skills finishing it proves
LESSON_SKILLS = {
 'Python للمبتدئين': ['python'],
 'هياكل البيانات في Python': ['python', 'data-structures'],
 'مقدمة في Machine Learning': ['machine-learning'],
 'NumPy وPandas عملياً': ['pandas-numpy'],
 'مقدمة في نماذج اللغة الكبيرة (LLMs)': ['llm'],
 'أساسيات Prompt Engineering': ['prompt-engineering'],
 'تنظيف البيانات في Excel': ['excel', 'data-cleaning'],
 'الدوال والجداول المحورية': ['excel', 'pivot-tables'],
 'أساسيات الاستعلامات SQL': ['sql'],
 'الدمج بين الجداول (Joins)': ['sql', 'sql-joins'],
 'مبادئ تصميم لوحات التحكم': ['data-visualization'],
 'بناء لوحة تحكم تفاعلية': ['dashboards', 'data-visualization'],
 'بنية صفحات HTML': ['html'],
 'تنسيق الصفحات بـ CSS وFlexbox': ['css'],
 'أساسيات JavaScript وES6': ['javascript'],
 'التعامل مع DOM والأحداث': ['javascript', 'dom'],
 'مكوّنات React الأساسية': ['react'],
 'إدارة الحالة بـ Hooks': ['react', 'state-management'],
 'أساسيات بحث المستخدم': ['user-research'],
 'بناء Personas': ['personas', 'user-research'],
 'مبادئ UX الأساسية': ['ux-principles'],
 'بناء Wireframes': ['wireframing'],
 'مؤشرات نجاح المنتج': ['product-metrics'],
 'استراتيجيات الإطلاق': ['go-to-market'],
 'مقدمة في الخدمات السحابية': ['cloud-computing'],
 'الشبكات والتخزين السحابي': ['cloud-networking'],
 'مقدمة في Docker': ['docker'],
 'أساسيات CI/CD': ['ci-cd'],
 'مراقبة الأنظمة السحابية': ['monitoring'],
 'التشغيل الآلي للبنية التحتية': ['infrastructure-automation'],
 'كيف تجد فكرة مشروع': ['opportunity-discovery'],
 'تحليل السوق المبدئي': ['market-research'],
 'مقابلات التحقق من المشكلة': ['customer-interviews'],
 'بناء استبيان تحقق فعّال': ['survey-design'],
 'Business Model Canvas': ['business-modeling'],
 'أساسيات التسعير': ['pricing'],
}


V, A = 'video', 'article'
PATHS = [
 dict(slug='genai', school='ai-data', num=14, title='مسار الذكاء الاصطناعي التوليدي',
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
 dict(slug='data', school='ai-data', num=17, title='مسار تحليل البيانات',
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
 dict(slug='web', school='software-engineering', num=1, title='مسار تطوير الويب',
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
 dict(slug='product', school='design-creative', num=36, title='مسار إدارة المنتجات',
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
 dict(slug='cloud', school='cyber-infrastructure', num=13, title='مسار الحوسبة السحابية',
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
 dict(slug='business', school='business-management', num=39, title='مسار ريادة الأعمال الرقمية',
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

# =============================================================================
# The rest of the map: the paths the document names but the academy has not
# written yet.
#
# Each one is seeded as a real row with status 'planned' and its outline as
# course rows that stay 'draft': the depth list is what the path requires, the
# breadth list what it carries without gating completion (path_courses
# .is_required). Nothing here invents a lesson, so nothing here can be started.
# =============================================================================
PLANNED = [
 # ---- Software Engineering -------------------------------------------------
 dict(num=2, slug='back-end', school='software-engineering',
      ar='مسار تطوير الخلفية Back-End', en='Back-End Development',
      desc='تطوير الخوادم وواجهات البرمجة وقواعد البيانات والمنطق الخلفي للتطبيقات.',
      tags=['Back-End','Node.js','APIs'],
      deep=['http-apis|أساسيات HTTP وواجهات REST|HTTP & REST API Fundamentals',
            'auth-basics|المصادقة والصلاحيات|Authentication & Authorization',
            'nodejs|Node.js من الصفر|Node.js from Zero',
            'express|بناء واجهات برمجية بـ Express|Building APIs with Express',
            'nestjs|بنية التطبيقات بـ NestJS|Application Architecture with NestJS',
            'sql-analysis|دورة SQL للتحليل|SQL for Analysis'],
      exposure=['django|مدخل إلى Django|Introduction to Django',
                'fastapi|مدخل إلى FastAPI|Introduction to FastAPI',
                'laravel|مدخل إلى Laravel|Introduction to Laravel',
                'aspnet-core|مدخل إلى ASP.NET Core|Introduction to ASP.NET Core']),
 dict(num=3, slug='full-stack', school='software-engineering',
      ar='مسار التطوير المتكامل Full-Stack', en='Full-Stack Development',
      desc='بناء تطبيق كامل من الواجهة حتى قاعدة البيانات والخادم والنشر.',
      tags=['Full-Stack','Next.js','PostgreSQL'],
      deep=['html-css|دورة أساسيات الويب|Web Foundations',
            'modern-js|دورة JavaScript الحديثة|Modern JavaScript',
            'react|دورة React التطبيقية|React in Practice',
            'nextjs|بناء التطبيقات بـ Next.js|Building Apps with Next.js',
            'nodejs|Node.js من الصفر|Node.js from Zero',
            'postgresql|PostgreSQL عملياً|PostgreSQL in Practice',
            'deployment|النشر والتشغيل|Deployment & Operations'],
      exposure=['dotnet-stack|واجهة React مع .NET|React with .NET',
                'laravel|مدخل إلى Laravel|Introduction to Laravel',
                'django|مدخل إلى Django|Introduction to Django']),
 dict(num=4, slug='python', school='software-engineering',
      ar='مسار تطوير Python', en='Python Development',
      desc='من أساسيات Python والبرمجة الكائنية إلى الأتمتة وتطوير الويب.',
      tags=['Python','Automation'],
      deep=['python-basics|أساسيات Python|Python Fundamentals',
            'python-oop|البرمجة الكائنية في Python|Object-Oriented Python',
            'python-files-apis|الملفات وواجهات البرمجة|Files & APIs in Python',
            'python-automation|الأتمتة بـ Python|Automation with Python'],
      exposure=['django|مدخل إلى Django|Introduction to Django',
                'fastapi|مدخل إلى FastAPI|Introduction to FastAPI',
                'flask|مدخل إلى Flask|Introduction to Flask']),
 dict(num=5, slug='csharp-dotnet', school='software-engineering',
      ar='مسار C# و‎.NET', en='C# & .NET',
      desc='تطوير الأنظمة والتطبيقات المؤسسية بـ C# و‎.NET.',
      tags=['C#','.NET'],
      deep=['csharp|أساسيات C#|C# Fundamentals',
            'csharp-oop|البرمجة الكائنية وLINQ|OOP & LINQ',
            'aspnet-core|مدخل إلى ASP.NET Core|Introduction to ASP.NET Core',
            'entity-framework|Entity Framework وقواعد البيانات|Entity Framework & Databases',
            'clean-architecture|البنية النظيفة|Clean Architecture'],
      exposure=['sql-server|SQL Server عملياً|SQL Server in Practice',
                'auth-basics|المصادقة والصلاحيات|Authentication & Authorization']),
 dict(num=6, slug='java', school='software-engineering',
      ar='مسار تطوير Java', en='Java Development',
      desc='أساس احترافي في Java وتطوير الخلفية بـ Spring Boot.',
      tags=['Java','Spring'],
      deep=['java-basics|أساسيات Java|Java Fundamentals',
            'java-oop|البرمجة الكائنية والمجموعات|OOP & Collections',
            'spring-boot|بناء الخدمات بـ Spring Boot|Services with Spring Boot',
            'spring-security|الأمان بـ Spring Security|Spring Security'],
      exposure=['postgresql|PostgreSQL عملياً|PostgreSQL in Practice',
                'http-apis|أساسيات HTTP وواجهات REST|HTTP & REST API Fundamentals']),
 dict(num=7, slug='js-ts', school='software-engineering',
      ar='مسار JavaScript وTypeScript', en='JavaScript & TypeScript',
      desc='من أساسيات JavaScript إلى البرمجة غير المتزامنة وTypeScript.',
      tags=['JavaScript','TypeScript'],
      deep=['modern-js|دورة JavaScript الحديثة|Modern JavaScript',
            'js-dom|التعامل مع DOM والأحداث|The DOM & Events',
            'js-async|البرمجة غير المتزامنة|Asynchronous JavaScript',
            'typescript|TypeScript عملياً|TypeScript in Practice'],
      exposure=['nodejs|Node.js من الصفر|Node.js from Zero',
                'react|دورة React التطبيقية|React in Practice']),
 dict(num=8, slug='mobile', school='software-engineering',
      ar='مسار تطوير تطبيقات الهاتف', en='Mobile Development',
      desc='أساسيات تطبيقات الهاتف وتجربة المستخدم وربطها بالخدمات.',
      tags=['Mobile','Firebase'],
      deep=['mobile-foundations|أساسيات تطبيقات الهاتف|Mobile App Foundations',
            'mobile-ux|تجربة المستخدم في الهاتف|Mobile UX',
            'mobile-apis|ربط التطبيق بالخدمات|Apps & APIs',
            'firebase|Firebase عملياً|Firebase in Practice'],
      exposure=['flutter|Flutter من الصفر|Flutter from Zero',
                'react-native|مدخل إلى React Native|Introduction to React Native',
                'native-android|مدخل إلى Android الأصلي|Introduction to Native Android']),
 dict(num=9, slug='flutter', school='software-engineering',
      ar='مسار Flutter', en='Flutter Development',
      desc='بناء تطبيقات تعمل على المنصتين بـ Dart وFlutter حتى النشر.',
      tags=['Flutter','Dart'],
      deep=['dart|أساسيات Dart|Dart Fundamentals',
            'flutter|Flutter من الصفر|Flutter from Zero',
            'flutter-state|إدارة الحالة في Flutter|State Management in Flutter',
            'flutter-architecture|بنية تطبيقات Flutter|Flutter App Architecture',
            'flutter-release|الاختبار والنشر|Testing & Release'],
      exposure=['firebase|Firebase عملياً|Firebase in Practice',
                'mobile-apis|ربط التطبيق بالخدمات|Apps & APIs']),
 dict(num=10, slug='software-engineering', school='software-engineering',
      ar='مسار هندسة البرمجيات', en='Software Engineering',
      desc='من معرفة البرمجة إلى فهم بناء البرمجيات هندسياً.',
      tags=['Engineering','Architecture'],
      deep=['sdlc|دورة حياة تطوير البرمجيات|Software Development Life Cycle',
            'requirements|تحليل المتطلبات|Requirements Analysis',
            'software-architecture|معمارية البرمجيات|Software Architecture',
            'design-patterns|أنماط التصميم|Design Patterns',
            'clean-code|الكود النظيف|Clean Code',
            'git|Git وسير العمل|Git & Workflow'],
      exposure=['testing-foundations|أساسيات الاختبار|Testing Foundations',
                'tech-writing|توثيق البرمجيات|Software Documentation']),
 dict(num=11, slug='qa-testing', school='software-engineering',
      ar='مسار ضمان الجودة والاختبار', en='QA & Software Testing',
      desc='اختبار التطبيقات يدوياً وآلياً وكتابة تقارير الأخطاء.',
      tags=['QA','Testing'],
      deep=['manual-testing|الاختبار اليدوي|Manual Testing',
            'test-cases|حالات الاختبار وتقارير الأخطاء|Test Cases & Bug Reports',
            'api-testing|اختبار واجهات البرمجة|API Testing',
            'playwright|الأتمتة بـ Playwright|Automation with Playwright'],
      exposure=['selenium|مدخل إلى Selenium|Introduction to Selenium',
                'cypress|مدخل إلى Cypress|Introduction to Cypress']),
 dict(num=12, slug='devops', school='software-engineering',
      ar='مسار DevOps والنشر المستمر', en='DevOps & CI/CD',
      desc='نقل التطبيق من التطوير إلى الإنتاج بخطوط نشر موثوقة.',
      tags=['DevOps','CI/CD','Docker'],
      deep=['linux|أساسيات Linux|Linux Fundamentals',
            'git|Git وسير العمل|Git & Workflow',
            'ci-cd|بناء خط CI/CD|Building a CI/CD Pipeline',
            'containers|دورة الحاويات وDocker|Containers & Docker',
            'observability|دورة المراقبة والتشغيل|Monitoring & Operations'],
      exposure=['kubernetes|أساسيات Kubernetes|Kubernetes Foundations',
                'deployment|النشر والتشغيل|Deployment & Operations']),

 # ---- AI & Data ------------------------------------------------------------
 dict(num=15, slug='ai-engineering', school='ai-data',
      ar='مسار هندسة الذكاء الاصطناعي', en='AI Engineering',
      desc='بناء تطبيقات تعتمد على نماذج اللغة: RAG ووكلاء وتقييم.',
      tags=['AI','LLM','RAG'],
      deep=['llm-apps|بناء تطبيقات نماذج اللغة|Building LLM Applications',
            'prompt-context|هندسة التوجيه والسياق|Prompt & Context Engineering',
            'embeddings|التضمينات وقواعد البيانات المتجهة|Embeddings & Vector Databases',
            'rag|بناء أنظمة RAG|Building RAG Systems',
            'ai-agents|الوكلاء واستدعاء الأدوات|Agents & Tool Calling',
            'ai-evaluation|تقييم أنظمة الذكاء الاصطناعي|Evaluating AI Systems'],
      exposure=['ai-providers|مزودو النماذج وأدواتهم|Model Providers & Their Tools']),
 dict(num=16, slug='ai-automation', school='ai-data',
      ar='مسار الأتمتة بالذكاء الاصطناعي', en='AI Automation',
      desc='تحويل المهام المتكررة إلى سير عمل ذكي بالأدوات وواجهات البرمجة.',
      tags=['Automation','AI'],
      deep=['workflow-automation|أتمتة سير العمل|Workflow Automation',
            'webhooks|واجهات البرمجة وWebhooks|APIs & Webhooks',
            'ai-agents|الوكلاء واستدعاء الأدوات|Agents & Tool Calling',
            'business-automation|أتمتة عمليات الأعمال|Business Process Automation'],
      exposure=['n8n|مدخل إلى n8n|Introduction to n8n',
                'make-zapier|مدخل إلى Make وZapier|Introduction to Make & Zapier']),
 dict(num=18, slug='data-science', school='ai-data',
      ar='مسار علم البيانات', en='Data Science',
      desc='البرمجة والإحصاء والتحليل الاستكشافي حتى النمذجة.',
      tags=['Data Science','Python'],
      deep=['python-basics|أساسيات Python|Python Fundamentals',
            'statistics|الإحصاء الوصفي والاستدلالي|Descriptive & Inferential Statistics',
            'pandas-numpy|Pandas وNumPy عملياً|Pandas & NumPy in Practice',
            'eda|التحليل الاستكشافي للبيانات|Exploratory Data Analysis',
            'ml-foundations|دورة أساسيات تعلّم الآلة|Machine Learning Foundations'],
      exposure=['probability|الاحتمالات|Probability',
                'data-visualization|تصوير البيانات|Data Visualization']),
 dict(num=19, slug='machine-learning', school='ai-data',
      ar='مسار تعلّم الآلة', en='Machine Learning',
      desc='من الانحدار والتصنيف إلى هندسة الخصائص وتقييم النماذج.',
      tags=['ML','Scikit-Learn'],
      deep=['ml-regression|الانحدار والتصنيف|Regression & Classification',
            'ml-clustering|التجميع وتقليل الأبعاد|Clustering & Dimensionality',
            'feature-engineering|هندسة الخصائص|Feature Engineering',
            'model-evaluation|تقييم النماذج|Model Evaluation',
            'scikit-learn|Scikit-Learn عملياً|Scikit-Learn in Practice'],
      exposure=['deep-learning|مقدمة في التعلّم العميق|Introduction to Deep Learning']),
 dict(num=20, slug='databases', school='ai-data',
      ar='مسار قواعد البيانات وأنظمة البيانات', en='Databases & Data Systems',
      desc='تصميم قواعد البيانات وإدارتها واستخدامها بكفاءة.',
      tags=['Databases','SQL'],
      deep=['db-foundations|أساسيات قواعد البيانات|Database Foundations',
            'sql-analysis|دورة SQL للتحليل|SQL for Analysis',
            'db-design|تصميم قواعد البيانات وERD|Database Design & ERD',
            'normalization|التطبيع|Normalization',
            'postgresql|PostgreSQL عملياً|PostgreSQL in Practice',
            'db-optimization|تحسين الأداء|Query & Index Optimization'],
      exposure=['mysql|MySQL|MySQL','sql-server|SQL Server عملياً|SQL Server in Practice',
                'mongodb|MongoDB|MongoDB','redis|Redis|Redis']),
 dict(num=21, slug='math-for-tech', school='ai-data',
      ar='مسار الرياضيات للتقنية', en='Mathematics for Technology',
      desc='الأساس الرياضي الذي تحتاجه البرمجة والذكاء الاصطناعي والبيانات.',
      tags=['Mathematics'],
      deep=['math-basics|الرياضيات الأساسية|Basic Mathematics',
            'algebra|الجبر والدوال والمعادلات|Algebra, Functions & Equations',
            'logic-sets|المنطق والمجموعات|Logic & Sets',
            'discrete-math|الرياضيات المتقطعة|Discrete Mathematics',
            'linear-algebra|الجبر الخطي|Linear Algebra'],
      exposure=['calculus|أسس التفاضل والتكامل|Calculus Foundations',
                'math-thinking|التفكير الرياضي|Mathematical Thinking']),
 dict(num=22, slug='statistics', school='ai-data',
      ar='مسار الإحصاء والاحتمالات', en='Statistics & Probability',
      desc='فهم البيانات وتحليلها علمياً واختبار الفرضيات.',
      tags=['Statistics'],
      deep=['statistics|الإحصاء الوصفي والاستدلالي|Descriptive & Inferential Statistics',
            'probability|الاحتمالات|Probability',
            'distributions|التوزيعات والمعاينة|Distributions & Sampling',
            'hypothesis-testing|اختبار الفرضيات|Hypothesis Testing'],
      exposure=['correlation-regression|الارتباط والانحدار|Correlation & Regression']),
 # ---- Cybersecurity & Infrastructure ---------------------------------------
 dict(num=23, slug='cybersecurity', school='cyber-infrastructure',
      ar='مسار الأمن السيبراني', en='Cybersecurity',
      desc='التهديدات والثغرات والمخاطر وأمن الشبكات والتطبيقات والاستجابة للحوادث.',
      tags=['Security'],
      deep=['security-foundations|أسس الأمن السيبراني|Cybersecurity Foundations',
            'threats-vulnerabilities|التهديدات والثغرات|Threats & Vulnerabilities',
            'risk-management|إدارة المخاطر|Risk Management',
            'network-security|أمن الشبكات|Network Security',
            'web-security|أمن تطبيقات الويب|Web Application Security',
            'identity-access|الهوية والصلاحيات|Identity & Access'],
      exposure=['incident-response|الاستجابة للحوادث|Incident Response']),
 dict(num=24, slug='ethical-hacking', school='cyber-infrastructure',
      ar='مسار الاختراق الأخلاقي', en='Ethical Hacking',
      desc='اختبار أمن الأنظمة والتطبيقات ضمن بيئات قانونية وآمنة.',
      tags=['Security','Pentesting'],
      deep=['linux|أساسيات Linux|Linux Fundamentals',
            'reconnaissance|جمع المعلومات|Reconnaissance',
            'vulnerability-assessment|تقييم الثغرات|Vulnerability Assessment',
            'web-security|أمن تطبيقات الويب|Web Application Security',
            'penetration-testing|اختبار الاختراق|Penetration Testing',
            'security-reporting|كتابة التقارير الأمنية|Security Reporting'],
      exposure=['network-security|أمن الشبكات|Network Security']),
 dict(num=25, slug='soc-defense', school='cyber-infrastructure',
      ar='مسار الدفاع السيبراني ومراكز العمليات', en='Defensive Security / SOC',
      desc='المراقبة والكشف عن التهديدات والاستجابة داخل مركز عمليات أمنية.',
      tags=['SOC','Blue Team'],
      deep=['logs-siem|السجلات وأنظمة SIEM|Logs & SIEM',
            'threat-detection|كشف التهديدات|Threat Detection',
            'incident-response|الاستجابة للحوادث|Incident Response',
            'security-monitoring|المراقبة الأمنية|Security Monitoring'],
      exposure=['threat-intelligence|الاستخبارات التهديدية|Threat Intelligence']),
 dict(num=26, slug='networking', school='cyber-infrastructure',
      ar='مسار الشبكات', en='Networking',
      desc='من نموذج OSI وعنونة IP إلى التوجيه والتبديل والخدمات.',
      tags=['Networking'],
      deep=['osi-tcpip|نموذج OSI وTCP/IP|OSI & TCP/IP',
            'ip-subnetting|عنونة IP والتقسيم الفرعي|IP Addressing & Subnetting',
            'routing-switching|التوجيه والتبديل|Routing & Switching',
            'network-services|DNS وDHCP وVLAN|DNS, DHCP & VLAN'],
      exposure=['vpn|الشبكات الخاصة الافتراضية|VPN']),
 dict(num=27, slug='sysadmin', school='cyber-infrastructure',
      ar='مسار إدارة الأنظمة', en='Systems Administration',
      desc='إدارة أنظمة التشغيل والخوادم والنسخ الاحتياطي والمراقبة.',
      tags=['Systems','Linux'],
      deep=['linux|أساسيات Linux|Linux Fundamentals',
            'windows-admin|إدارة أنظمة Windows|Windows Administration',
            'users-permissions|المستخدمون والصلاحيات|Users & Permissions',
            'servers-virtualization|الخوادم والمحاكاة الافتراضية|Servers & Virtualization',
            'backup-recovery|النسخ الاحتياطي والاستعادة|Backup & Recovery'],
      exposure=['observability|دورة المراقبة والتشغيل|Monitoring & Operations',
                'troubleshooting|تشخيص الأعطال|Troubleshooting']),

 # ---- Design & Creative ----------------------------------------------------
 dict(num=28, slug='ui-ux', school='design-creative',
      ar='مسار تصميم تجربة وواجهة المستخدم', en='UI/UX Design',
      desc='من بحث المستخدم إلى أنظمة التصميم واختبار قابلية الاستخدام.',
      tags=['UX','UI','Figma'],
      deep=['user-research|دورة بحث المستخدم|User Research',
            'user-journey|رحلات وتدفقات المستخدم|User Journeys & Flows',
            'information-architecture|معمارية المعلومات|Information Architecture',
            'wireframing|الهياكل السلكية|Wireframing',
            'ui-design|تصميم الواجهات|UI Design',
            'design-systems|أنظمة التصميم|Design Systems',
            'usability-testing|اختبار قابلية الاستخدام|Usability Testing'],
      exposure=['figma|Figma عملياً|Figma in Practice']),
 dict(num=29, slug='product-design-path', school='design-creative',
      ar='مسار تصميم المنتجات', en='Product Design',
      desc='التفكير كمصمم منتج: من مشكلة المستخدم إلى MVP وتكرار التحسين.',
      tags=['Product','Design'],
      deep=['product-discovery|اكتشاف المنتج|Product Discovery',
            'user-problems|مشكلات المستخدم|Understanding User Problems',
            'mvp|بناء المنتج الأولي|Building an MVP',
            'prototyping|النماذج التفاعلية|Prototyping',
            'product-iteration|تحسين المنتج بالتكرار|Product Iteration'],
      exposure=['usability-testing|اختبار قابلية الاستخدام|Usability Testing',
                'ui-design|تصميم الواجهات|UI Design']),
 dict(num=30, slug='graphic-design', school='design-creative',
      ar='مسار التصميم الجرافيكي', en='Graphic Design',
      desc='مبادئ التصميم والطباعة واللون والهوية البصرية.',
      tags=['Design','Branding'],
      deep=['design-principles|مبادئ التصميم|Design Principles',
            'typography|الطباعة والخطوط|Typography',
            'color-composition|اللون والتكوين|Color & Composition',
            'branding|الهوية البصرية|Branding'],
      exposure=['photoshop|Photoshop|Photoshop','illustrator|Illustrator|Illustrator',
                'canva|Canva|Canva']),
 dict(num=31, slug='motion-graphics', school='design-creative',
      ar='مسار الموشن جرافيك', en='Motion Graphics',
      desc='من مبادئ الحركة إلى تحريك النصوص والشعارات وفيديوهات الشرح.',
      tags=['Motion','After Effects'],
      deep=['motion-principles|مبادئ الحركة|Motion Principles',
            'after-effects|After Effects عملياً|After Effects in Practice',
            'text-logo-animation|تحريك النصوص والشعارات|Text & Logo Animation',
            'explainer-videos|فيديوهات الشرح|Explainer Videos'],
      exposure=['video-editing|تحرير الفيديو|Video Editing']),
 dict(num=32, slug='motion-3d', school='design-creative',
      ar='مسار الموشن والثلاثي الأبعاد', en='Motion Design & 3D',
      desc='السرد البصري وأساسيات 3D والنمذجة والإضاءة والإخراج.',
      tags=['3D','Blender'],
      deep=['visual-storytelling|السرد البصري|Visual Storytelling',
            '3d-foundations|أساسيات الثلاثي الأبعاد|3D Foundations',
            'blender|Blender عملياً|Blender in Practice',
            'modeling-materials|النمذجة والخامات|Modeling & Materials',
            'lighting-rendering|الإضاءة والإخراج|Lighting & Rendering'],
      exposure=['motion-principles|مبادئ الحركة|Motion Principles']),
 dict(num=33, slug='video-editing', school='design-creative',
      ar='مسار تحرير وإنتاج الفيديو', en='Video Editing',
      desc='من أساسيات المونتاج والسرد إلى الصوت واللون والنشر.',
      tags=['Video','Editing'],
      deep=['video-editing|تحرير الفيديو|Video Editing',
            'video-storytelling|السرد في الفيديو|Storytelling for Video',
            'audio-color|الصوت وتصحيح الألوان|Audio & Color',
            'short-form|المحتوى القصير والنشر|Short-Form & Publishing'],
      exposure=['ai-video-tools|أدوات الذكاء الاصطناعي للفيديو|AI Tools for Video']),

 # ---- Business & Management ------------------------------------------------
 dict(num=34, slug='digital-marketing', school='business-management',
      ar='مسار التسويق الرقمي', en='Digital Marketing',
      desc='من بحث العملاء والمحتوى إلى SEO والإعلانات والتحليلات.',
      tags=['Marketing','SEO'],
      deep=['marketing-foundations|أسس التسويق|Marketing Foundations',
            'customer-research|بحث العملاء|Customer Research',
            'content-social|المحتوى ووسائل التواصل|Content & Social Media',
            'seo|تحسين محركات البحث|SEO',
            'paid-ads|الإعلانات المدفوعة|Paid Advertising',
            'marketing-analytics|تحليلات التسويق|Marketing Analytics'],
      exposure=['email-marketing|التسويق بالبريد|Email Marketing',
                'growth-marketing|تسويق النمو|Growth Marketing']),
 dict(num=35, slug='business-analysis', school='business-management',
      ar='مسار تحليل الأعمال', en='Business Analysis',
      desc='ربط احتياجات الأعمال بالحلول التقنية وتوثيقها.',
      tags=['Business Analysis','BPMN'],
      deep=['ba-foundations|أسس تحليل الأعمال|Business Analysis Foundations',
            'requirements|تحليل المتطلبات|Requirements Analysis',
            'stakeholders|أصحاب المصلحة|Stakeholder Management',
            'process-mapping|رسم العمليات وBPMN|Process Mapping & BPMN',
            'user-stories|قصص المستخدم وحالات الاستخدام|User Stories & Use Cases',
            'business-documentation|توثيق الأعمال ودراسة الجدوى|Business Documentation & Case'],
      exposure=['sql-analysis|دورة SQL للتحليل|SQL for Analysis']),
 dict(num=37, slug='project-management', school='business-management',
      ar='مسار إدارة المشاريع', en='Project Management',
      desc='النطاق والجدول والميزانية والمخاطر والتواصل حتى الإغلاق.',
      tags=['Project Management'],
      deep=['pm-scope-schedule|النطاق والجدول الزمني|Scope & Schedule',
            'pm-budget-risk|الميزانية والمخاطر|Budget & Risk',
            'pm-communication|التواصل وأصحاب المصلحة|Communication & Stakeholders',
            'pm-monitoring|المتابعة والإغلاق|Monitoring & Closure'],
      exposure=['agile-scrum|Agile وScrum عملياً|Agile & Scrum in Practice']),
 dict(num=38, slug='agile-scrum', school='business-management',
      ar='مسار Agile وScrum', en='Agile & Scrum',
      desc='العمل بأساليب Agile: Scrum وKanban ودورة السبرنت كاملة.',
      tags=['Agile','Scrum'],
      deep=['agile-foundations|أسس Agile|Agile Foundations',
            'agile-scrum|Agile وScrum عملياً|Agile & Scrum in Practice',
            'kanban|Kanban عملياً|Kanban in Practice',
            'sprint-cycle|دورة السبرنت كاملة|The Full Sprint Cycle'],
      exposure=['user-stories|قصص المستخدم وحالات الاستخدام|User Stories & Use Cases']),
 dict(num=40, slug='freelancing', school='business-management',
      ar='مسار العمل الحر الرقمي', en='Freelancing & Digital Work',
      desc='تحويل المهارة إلى عمل: العروض والتسعير والعقود وإدارة العملاء.',
      tags=['Freelancing'],
      deep=['skill-positioning|تموضع المهارة|Skill Positioning',
            'portfolio-profiles|المعرض والملفات المهنية|Portfolio & Profiles',
            'proposals|كتابة العروض|Writing Proposals',
            'pricing-contracts|التسعير والعقود|Pricing & Contracts',
            'client-management|إدارة العملاء والتسليم|Client & Delivery Management'],
      exposure=['personal-branding|العلامة الشخصية|Personal Branding']),

 # ---- Career & Human Skills ------------------------------------------------
 dict(num=41, slug='personal-branding', school='career-human',
      ar='مسار العلامة الشخصية', en='Personal Branding',
      desc='بناء هوية مهنية رقمية: السيرة وLinkedIn والمعرض والشبكة.',
      tags=['Career','Branding'],
      deep=['personal-branding|العلامة الشخصية|Personal Branding',
            'cv-linkedin|السيرة الذاتية وLinkedIn|CV & LinkedIn',
            'portfolio-profiles|المعرض والملفات المهنية|Portfolio & Profiles',
            'networking|بناء الشبكة المهنية|Professional Networking'],
      exposure=['content-social|المحتوى ووسائل التواصل|Content & Social Media']),
 dict(num=42, slug='communication', school='career-human',
      ar='مسار التواصل والخطابة', en='Communication & Public Speaking',
      desc='الإنصات والحوار ولغة الجسد والعرض والتفاوض.',
      tags=['Communication'],
      deep=['active-listening|الإنصات والحوار|Listening & Conversation',
            'body-language|لغة الجسد|Body Language',
            'presentation|مهارات العرض|Presentation Skills',
            'public-speaking|الخطابة أمام الجمهور|Public Speaking'],
      exposure=['negotiation|التفاوض وإدارة الخلاف|Negotiation & Conflict',
                'storytelling|السرد|Storytelling']),
 dict(num=43, slug='life-professional-skills', school='career-human',
      ar='مسار المهارات الشخصية والمهنية', en='Life & Professional Skills',
      desc='الأهداف وإدارة الوقت والتركيز واتخاذ القرار وأخلاقيات العمل.',
      tags=['Soft Skills'],
      deep=['goal-setting|تحديد الأهداف|Goal Setting',
            'time-management|إدارة الوقت والإنتاجية|Time Management & Productivity',
            'decision-making|اتخاذ القرار وحل المشكلات|Decision Making & Problem Solving',
            'critical-thinking|التفكير النقدي|Critical Thinking'],
      exposure=['emotional-intelligence|الذكاء العاطفي|Emotional Intelligence',
                'work-ethics|أخلاقيات العمل|Work Ethics']),
 dict(num=44, slug='english-for-work', school='career-human',
      ar='مسار الإنجليزية للعمل والتقنية', en='English for Work & Technology',
      desc='القواعد والمفردات والمهارات الأربع موجّهة للعمل والتقنية.',
      tags=['English'],
      deep=['english-grammar|القواعد والمفردات|Grammar & Vocabulary',
            'english-listening-speaking|الاستماع والتحدث|Listening & Speaking',
            'english-reading-writing|القراءة والكتابة|Reading & Writing',
            'english-at-work|الإنجليزية في بيئة العمل|English at Work'],
      exposure=['technical-english|الإنجليزية التقنية|Technical English',
                'interview-english|المقابلات بالإنجليزية|Interview English']),

 # ---- Digital & Administrative Skills --------------------------------------
 dict(num=45, slug='icdl', school='digital-admin',
      ar='مسار المهارات الرقمية الأساسية ICDL', en='ICDL & Digital Literacy',
      desc='أساسيات الحاسوب والملفات والإنترنت وحزمة المكتب والأمن الرقمي.',
      tags=['ICDL','Digital Literacy'],
      deep=['computer-essentials|أساسيات الحاسوب|Computer Essentials',
            'files-folders|الملفات والمجلدات|Files & Folders',
            'internet-basics|الإنترنت والبريد|Internet & Email',
            'word|Word|Word','excel-basics|Excel للمبتدئين|Excel for Beginners',
            'powerpoint|PowerPoint|PowerPoint'],
      exposure=['digital-security|الأمن الرقمي|Digital Security',
                'cloud-basics|التخزين السحابي|Cloud Storage']),
 dict(num=46, slug='advanced-excel', school='digital-admin',
      ar='مسار Excel المتقدم والإنتاجية المكتبية', en='Advanced Excel & Office Productivity',
      desc='الدوال المتقدمة والجداول المحورية وPower Query ولوحات التحكم.',
      tags=['Excel','Office'],
      deep=['data-excel|دورة أساسيات البيانات وExcel|Data & Excel Foundations',
            'excel-functions|الدوال المتقدمة|Advanced Functions',
            'pivot-tables|الجداول المحورية|Pivot Tables',
            'power-query|Power Query|Power Query',
            'excel-dashboards|لوحات تحكم Excel|Excel Dashboards'],
      exposure=['word-advanced|Word المتقدم|Advanced Word',
                'powerpoint-advanced|PowerPoint المتقدم|Advanced PowerPoint',
                'microsoft-365|Microsoft 365|Microsoft 365']),
 dict(num=47, slug='digital-workplace', school='digital-admin',
      ar='مسار بيئة العمل الرقمية', en='Digital Skills & Digital Workplace',
      desc='التعاون عن بُعد والتنظيم الرقمي والنظافة السيبرانية والذكاء الاصطناعي في العمل.',
      tags=['Remote Work','Collaboration'],
      deep=['google-workspace|Google Workspace|Google Workspace',
            'microsoft-365|Microsoft 365|Microsoft 365',
            'online-collaboration|التعاون عبر الإنترنت|Online Collaboration',
            'remote-work|العمل عن بُعد|Remote Work',
            'digital-organization|التنظيم الرقمي|Digital Organization'],
      exposure=['cyber-hygiene|النظافة السيبرانية|Cyber Hygiene',
                'ai-at-work|الذكاء الاصطناعي في العمل|AI at Work']),
 dict(num=48, slug='administrative-skills', school='digital-admin',
      ar='مسار المهارات الإدارية والمكتبية', en='Administrative & Office Skills',
      desc='إدارة المكتب والوثائق والمراسلات والتقارير والاجتماعات والمتابعة.',
      tags=['Administration'],
      deep=['office-management|إدارة المكتب|Office Management',
            'document-management|إدارة الوثائق والسجلات|Document & Records Management',
            'correspondence|المراسلات والتقارير|Correspondence & Reports',
            'meetings-scheduling|الاجتماعات والجدولة|Meetings & Scheduling'],
      exposure=['data-entry|إدخال البيانات|Data Entry',
                'confidentiality|السرية المهنية|Confidentiality']),

 # ---- Academic & Professional Foundations ----------------------------------
 dict(num=49, slug='science-foundations', school='foundations',
      ar='مسار أسس العلوم والتقنية', en='Science & Technology Foundations',
      desc='تفكير علمي وأساس في الفيزياء والكيمياء والأحياء وقراءة البحث.',
      tags=['Science'],
      deep=['scientific-thinking|التفكير العلمي|Scientific Thinking',
            'physics-basics|أساسيات الفيزياء|Physics Basics',
            'chemistry-basics|أساسيات الكيمياء|Chemistry Basics',
            'biology-basics|أساسيات الأحياء|Biology Basics'],
      exposure=['tech-and-society|التقنية والمجتمع|Technology & Society',
                'scientific-writing|القراءة والكتابة العلمية|Scientific Reading & Writing']),
 dict(num=50, slug='research-thinking', school='foundations',
      ar='مسار البحث والتفكير النقدي والابتكار', en='Research, Critical Thinking & Innovation',
      desc='مهارات البحث وتقييم المصادر والتحقق والتفكير المنطقي والكتابة الأكاديمية.',
      tags=['Research','Critical Thinking'],
      deep=['research-foundations|أسس البحث|Research Foundations',
            'information-literacy|الثقافة المعلوماتية ومهارات البحث|Information Literacy & Search',
            'source-evaluation|تقييم المصادر والتحقق|Source Evaluation & Fact Checking',
            'critical-thinking|التفكير النقدي|Critical Thinking',
            'academic-writing|الكتابة الأكاديمية|Academic Writing'],
      exposure=['logical-reasoning|الاستدلال المنطقي|Logical Reasoning',
                'data-interpretation|تفسير البيانات|Data Interpretation']),
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

-- ---------------------------------------------------------------------------
-- The skills this catalogue teaches
-- ---------------------------------------------------------------------------
"""]

out.append("insert into public.skills (slug, name_ar, name_en, status) values\n  "
           + ",\n  ".join(f"({q(slug)}, {q(ar)}, {q(en)}, 'approved')" for slug, ar, en in SKILLS)
           + "\non conflict (slug) do nothing;\n")

for p in PATHS:
    hours = sum(l[2] for c in p['courses'] for l in c[3]) // 60 + 1
    out.append(f"""
-- ---------------------------------------------------------------------------
-- {p['title']}
-- ---------------------------------------------------------------------------
insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tagline_ar, tags, status, estimated_hours, sort_order)
select {q(p['slug'])}, s.id, {q(p['title'])}, {q(EN_PATH.get(p['slug']))}, {q(p['desc'])}, {q(p['tagline'])}, {arr(p['tags'])}, 'published', {hours}, {p['num']}
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
insert into public.courses (slug, title_ar, title_en, description_ar, status, estimated_hours)
values ({q(cslug)}, {q(ctitle)}, {q(EN_COURSE.get(cslug))}, {q(cdesc)}, 'published', {chours})
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

insert into public.lesson_skills (lesson_id, skill_id)
select l.id, s.id
from public.lessons l
join public.modules m on m.id = l.module_id
join public.courses c on c.id = m.course_id
join public.skills s on s.slug = any ({arr(LESSON_SKILLS.get(ltitle, []))})
where c.slug = {q(cslug)} and l.title_ar = {q(ltitle)}
on conflict do nothing;

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


# ---------------------------------------------------------------------------
# The planned half of the map
# ---------------------------------------------------------------------------
out.append("""

-- ===========================================================================
-- The rest of the map
--
-- Announced, not written: these paths carry their outline and nothing else.
-- A planned path has no lessons, so academy_paths() never sees it and no one
-- can start it; what it does have is what it will teach, in the order it will
-- teach it, with the depth courses marked required and the breadth ones not.
-- ===========================================================================
""")

for p in PLANNED:
    out.append(f"""
insert into public.learning_paths (slug, school_id, title_ar, title_en, description_ar, tags, status, sort_order)
select {q(p['slug'])}, s.id, {q(p['ar'])}, {q(p['en'])}, {q(p['desc'])}, {arr(p['tags'])}, 'planned', {p['num']}
from public.schools s where s.slug = {q(p['school'])}
on conflict (slug) do nothing;""")

    for i, item in enumerate(p['deep'] + p['exposure'], start=1):
        cslug, car, cen = item.split('|')
        required = 'true' if i <= len(p['deep']) else 'false'
        out.append(f"""
insert into public.courses (slug, title_ar, title_en, status)
values ({q(cslug)}, {q(car)}, {q(cen)}, 'draft')
on conflict (slug) do nothing;

insert into public.path_courses (path_id, course_id, is_required, sort_order)
select lp.id, c.id, {required}, {i}
from public.learning_paths lp, public.courses c
where lp.slug = {q(p['slug'])} and c.slug = {q(cslug)}
on conflict do nothing;""")


# =============================================================================
# Career goals
#
# The document asks the learner what they want to become, not which courses
# they want. Each goal below is the ladder the document draws for it, mapped
# onto courses that actually exist: the rungs already built point at published
# courses, the rest point at outlines, and the plan says which is which rather
# than pretending.
#
# A step is a course, a whole path, or a milestone the academy cannot award —
# a real project, a portfolio, a team, work.
# =============================================================================
GOALS = [
 dict(slug='data-analyst', ar='محلّل بيانات', en='Data Analyst',
      desc='من جدول بيانات إلى قرار: تنظيف البيانات، الاستعلام عنها، تحليلها وعرضها.',
      outcome='تصبح قادراً على أخذ بيانات خام وإخراج تقرير يُتخذ بناءً عليه قرار.',
      tags=['Data','SQL','Excel'],
      steps=['c:computer-essentials', 'c:data-excel', 'c:excel-functions', 'c:pivot-tables',
             'c:sql-analysis', 'c:statistics', 'c:dashboards', 'c:python-basics',
             'c:pandas-numpy', 'c:ba-foundations', 'c:ml-foundations',
             'm:assessment', 'm:real_project', 'm:portfolio', 'm:team', 'm:work']),
 dict(slug='full-stack-developer', ar='مطوّر متكامل', en='Full-Stack Developer',
      desc='من الواجهة إلى قاعدة البيانات إلى النشر: تطبيق كامل تبنيه وتشغّله.',
      outcome='تصبح قادراً على بناء تطبيق ويب كامل ونشره والعمل عليه ضمن فريق.',
      tags=['Web','Full-Stack'],
      steps=['c:html-css', 'c:modern-js', 'c:typescript', 'c:react', 'c:nextjs',
             'c:http-apis', 'c:nodejs', 'c:nestjs', 'c:postgresql',
             'c:testing-foundations', 'c:containers', 'c:cloud-foundations', 'c:generative-ai',
             'm:real_project', 'm:team', 'm:portfolio', 'm:work']),
 dict(slug='front-end-developer', ar='مطوّر واجهات', en='Front-End Developer',
      desc='واجهات ويب حديثة تعمل على كل شاشة، مبنية بأدوات السوق.',
      outcome='تصبح قادراً على بناء واجهة حقيقية والعمل ضمن فريق تطوير.',
      tags=['Front-End','React'],
      steps=['p:web', 'c:typescript', 'c:nextjs', 'm:real_project', 'm:portfolio', 'm:work']),
]

MILESTONES = {
 'assessment':   ('اجتز تقييماً معتمداً', 'Pass a graded assessment',
                  'التقييم يثبت أن المهارة انتقلت من المشاهدة إلى القدرة.'),
 'real_project': ('نفّذ مشروعاً حقيقياً يُراجَع', 'Ship a real reviewed project',
                  'مشروع دورة أو مسار يعتمده منتور — لا تمرين مغلق.'),
 'portfolio':    ('ابنِ معرض أعمال قابلاً للعرض', 'Build a portfolio you can show',
                  'عمل معتمد يحمل رابطاً عاماً: مستودع، منشور، أو موقع.'),
 'mentorship':   ('اجلس مع منتور', 'Sit with a mentor',
                  'جلسة مكتملة مع منتور في مجالك.'),
 'team':         ('اعمل داخل فريق', 'Work inside a team',
                  'مقعد فعّال في فريق TechMood — العمل الحقيقي جماعي.'),
 'work':         ('احصل على فرصة عمل', 'Land an opportunity',
                  'طلب مقبول على فرصة في سوق TechMood.'),
 'startup':      ('أسّس مشروعك', 'Found your startup',
                  'مشروع ناشئ داخل حاضنة TechMood.'),
}

out.append("""

-- ===========================================================================
-- Career goals
--
-- A goal is an ordered ladder across paths and schools, ending outside the
-- catalogue: a real project, a portfolio, a team, work. It stores no
-- progress — every step is read from the rule that already owns it.
-- ===========================================================================
""")

for gi, g in enumerate(GOALS, start=1):
    out.append(f"""
insert into public.career_goals (slug, title_ar, title_en, description_ar, outcome_ar, tags, status, sort_order)
values ({q(g['slug'])}, {q(g['ar'])}, {q(g['en'])}, {q(g['desc'])}, {q(g['outcome'])}, {arr(g['tags'])}, 'published', {gi})
on conflict (slug) do nothing;""")

    for si, step in enumerate(g['steps'], start=1):
        kind, key = step.split(':', 1)
        if kind == 'c':
            out.append(f"""
insert into public.career_goal_steps (goal_id, kind, course_id, sort_order)
select g.id, 'course', c.id, {si}
from public.career_goals g, public.courses c
where g.slug = {q(g['slug'])} and c.slug = {q(key)}
on conflict do nothing;""")
        elif kind == 'p':
            out.append(f"""
insert into public.career_goal_steps (goal_id, kind, path_id, sort_order)
select g.id, 'path', lp.id, {si}
from public.career_goals g, public.learning_paths lp
where g.slug = {q(g['slug'])} and lp.slug = {q(key)}
on conflict do nothing;""")
        else:
            ar, en, note = MILESTONES[key]
            out.append(f"""
insert into public.career_goal_steps (goal_id, kind, milestone, label_ar, label_en, note_ar, sort_order)
select g.id, 'milestone', '{key}', {q(ar)}, {q(en)}, {q(note)}, {si}
from public.career_goals g where g.slug = {q(g['slug'])}
on conflict do nothing;""")

out.append("""

-- Course levels come from each course's position in its path, which is how the
-- catalogue above is built: three courses per path, each one building on the
-- last. The rule itself lives in the migration so there is only one copy of it.
select public.backfill_course_levels();

commit;
""")
pathlib.Path(__file__).resolve().parent.parent.joinpath('supabase/seed.sql').write_text("\n".join(out))
print("seed.sql written")
