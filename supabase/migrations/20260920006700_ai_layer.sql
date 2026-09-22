-- =============================================================================
-- 0067 — An assistant that lives over the platform, not beside it
--
-- The design decision that everything else follows from: **the assistant reads
-- as the person.** `ai_context()` is a `security invoker` function, so every
-- table it touches is filtered by the same row level security the person is
-- already subject to. There is no service key, no "AI can see everything"
-- bypass, and no profile parameter to tamper with. Changing an id in a URL
-- cannot widen what the assistant knows, because the assistant never had a
-- wider view to narrow (§29).
--
-- The second decision: **the assistant proposes, the person disposes.** An
-- action is a row with a status, not a function call. `propose_ai_action()`
-- only ever writes `proposed`; the work happens in `confirm_ai_action()`, which
-- the person's own click reaches. And `confirm_ai_action()` is `security
-- invoker` too, so even a confirmed action can do no more than the person could
-- have done by hand.
--
-- The third: **some things are not the assistant's to do at all.** Booking a
-- paid session, moving money, changing account data, deleting a project,
-- speaking in the person's name — these live in `ai_action_kinds` as
-- `restricted`. They are listed so the interface can explain the refusal, and
-- they have no branch in the executor. Marking them "needs confirmation" would
-- have been the easy answer and the wrong one: a confirmation dialog is a habit
-- people learn to click through.
--
-- What is NOT here: the model call. That belongs in the application, where an
-- API key can live. The database keeps the thread, the context, the memory and
-- the permission — the parts that must be true whichever model answers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- What the person decided about the assistant
-- ---------------------------------------------------------------------------
create table public.ai_preferences (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  -- «يستطيع المستخدم: عرض ما يتذكره، تعديله، حذفه، إيقافه»
  memory_enabled  boolean not null default true,
  -- with this off the assistant may still suggest, but every proposal is
  -- refused at confirmation time
  actions_enabled boolean not null default true,
  updated_at      timestamptz not null default now()
);

alter table public.ai_preferences enable row level security;

create policy ai_preferences_own on public.ai_preferences
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update on public.ai_preferences to authenticated;

create trigger ai_preferences_touch before update on public.ai_preferences
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- A thread per journey, not one endless chat
-- ---------------------------------------------------------------------------
create table public.ai_threads (
  id          uuid primary key default extensions.gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  title_ar    text not null check (char_length(title_ar) between 1 and 120),
  surface     public.ai_surface not null default 'general',
  scope       public.ai_scope not null default 'page',
  -- what the thread is about, when it is about something
  entity_type text,
  entity_id   uuid,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index ai_threads_owner_idx on public.ai_threads (profile_id, is_archived, last_message_at desc);

alter table public.ai_threads enable row level security;

create policy ai_threads_own on public.ai_threads
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_threads to authenticated;

comment on table public.ai_threads is
  'One thread per journey — «تعلّم Python»، «خطتي المهنية»، «مشروع متجر إلكتروني» — so advice keeps its own memory instead of drowning in one feed.';

create table public.ai_messages (
  id         uuid primary key default extensions.gen_random_uuid(),
  thread_id  uuid not null references public.ai_threads (id) on delete cascade,
  role       public.ai_role not null,
  content    text not null,
  -- the surface and scope the message was asked from, frozen: the same thread
  -- can be resumed from somewhere else and the history still explains itself
  surface    public.ai_surface,
  scope      public.ai_scope,
  model      text,
  -- when the model could not be reached, the reason, in the open
  error_ar   text,
  created_at timestamptz not null default now()
);

create index ai_messages_thread_idx on public.ai_messages (thread_id, created_at);

alter table public.ai_messages enable row level security;

create policy ai_messages_own on public.ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.ai_threads t
       where t.id = thread_id and t.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.ai_threads t
       where t.id = thread_id and t.profile_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.ai_messages to authenticated;

-- A thread's place in the list is the last thing said in it.
create or replace function public.touch_ai_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_threads
     set last_message_at = new.created_at
   where id = new.thread_id;
  return new;
end;
$$;

create trigger ai_messages_touch_thread
  after insert on public.ai_messages
  for each row execute function public.touch_ai_thread();

-- ---------------------------------------------------------------------------
-- What the assistant remembers — and the person owns
-- ---------------------------------------------------------------------------
create table public.ai_memory (
  id         uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       public.ai_memory_kind not null default 'fact',
  content_ar text not null check (char_length(content_ar) between 2 and 400),
  -- who put it there: the person said it, or the assistant inferred it
  from_assistant boolean not null default false,
  is_active  boolean not null default true,
  source_thread uuid references public.ai_threads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_memory_owner_idx on public.ai_memory (profile_id, is_active);

alter table public.ai_memory enable row level security;

create policy ai_memory_own on public.ai_memory
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_memory to authenticated;

create trigger ai_memory_touch before update on public.ai_memory
  for each row execute function public.touch_updated_at();

comment on table public.ai_memory is
  'Memory a person can read, edit, delete and switch off. Nothing is remembered that they cannot see in a list.';

-- ---------------------------------------------------------------------------
-- What the assistant may do, per surface: 👁️ read · ✏️ suggest · ✅ act · 🔒
-- ---------------------------------------------------------------------------
create table public.ai_surface_permissions (
  surface     public.ai_surface primary key,
  title_ar    text not null,
  permission  public.ai_permission not null,
  note_ar     text,
  sort_order  integer not null default 0
);

alter table public.ai_surface_permissions enable row level security;

create policy ai_surface_permissions_read on public.ai_surface_permissions
  for select to anon, authenticated using (true);

grant select on public.ai_surface_permissions to anon, authenticated;

insert into public.ai_surface_permissions (surface, title_ar, permission, note_ar, sort_order) values
  ('general',    'عام',                'suggest', 'يقترح ولا يغيّر شيئًا دون تأكيد.',                        1),
  ('lesson',     'الدرس',              'read',    'يقرأ الدرس ويشرح ويعطي أمثلة. لا يُكمل الدرس نيابة عنك.',  2),
  ('course',     'الدورة',             'read',    'يقرأ تقدّمك في الدورة ويقترح الخطوة التالية.',             3),
  ('assessment', 'الاختبار',           'read',    'يشرح بعد التسليم. لا يجيب عن سؤال مفتوح.',                4),
  ('assignment', 'المهمة',             'suggest', 'يراجع ويقترح تحسينًا. التسليم قرارك.',                    5),
  ('project',    'المشروع',            'act',     'يقترح مهامًا وخطوات، وينفّذها بعد تأكيدك. لا يحذف مشروعًا.', 6),
  ('profile',    'الملف الشخصي',        'act',     'يقترح نبذة أو عنوانًا مهنيًا، ويكتبه بعد تأكيدك.',          7),
  ('cv',         'السيرة الذاتية',      'suggest', 'يعيد صياغة ما هو موجود. لا يخترع خبرة.',                  8),
  ('market',     'السوق',              'suggest', 'يقترح فرصًا ويصيغ عرضًا. التقديم والتسعير قرارك.',          9),
  ('opportunity','الفرصة',             'suggest', 'يحلّل الفرصة ويصيغ مقترحك. الإرسال بيدك.',                10),
  ('mentor',     'المنتور',            'suggest', 'يجهّز أسئلة الجلسة. الحجز المدفوع ليس من عمله.',           11),
  ('booking',    'الحجوزات',           'read',    'يقرأ مواعيدك ويذكّرك. لا يحجز ولا يلغي.',                  12),
  ('team',       'الفريق',             'suggest', 'يقترح توزيع المهام. قرار الفريق للفريق.',                  13),
  ('startup',    'الشركة',             'act',     'يقترح لوحات وخارطة طريق، وينفّذها بعد تأكيد المدير.',       14),
  ('canvas',     'اللوحات',            'act',     'يقترح بطاقات ويضيفها بعد تأكيدك.',                        15),
  ('goal',       'الأهداف',            'act',     'يصوغ هدفًا بصيغة SMART ويحفظه بعد تأكيدك.',                16);

-- ---------------------------------------------------------------------------
-- The whitelist. An action that is not in this table cannot be proposed, and
-- an action marked `restricted` cannot be executed however it is confirmed.
-- ---------------------------------------------------------------------------
create table public.ai_action_kinds (
  kind        text primary key,
  title_ar    text not null,
  detail_ar   text,
  permission  public.ai_permission not null,
  -- what the interface should say when it refuses
  refusal_ar  text,
  is_enabled  boolean not null default true,
  sort_order  integer not null default 0
);

alter table public.ai_action_kinds enable row level security;

create policy ai_action_kinds_read on public.ai_action_kinds
  for select to authenticated using (true);

grant select on public.ai_action_kinds to authenticated;

insert into public.ai_action_kinds (kind, title_ar, detail_ar, permission, refusal_ar, sort_order) values
  -- what it may do, once you press the button
  ('remember',            'يتذكّر معلومة عنك',      'يضيف سطرًا إلى ذاكرة المساعد، ويمكنك حذفه متى شئت.', 'act', null, 1),
  ('save_opportunity',    'يحفظ فرصة',              'يضيف الفرصة إلى قائمتك المحفوظة.',                  'act', null, 2),
  ('create_goal',         'ينشئ هدفًا ذكيًا',        'هدف SMART في شركة تملك صلاحية التحرير فيها.',        'act', null, 3),
  ('create_roadmap_item', 'يضيف بندًا لخارطة الطريق','بند في ربع محدّد من خارطة طريق الشركة.',            'act', null, 4),
  ('add_canvas_card',     'يضيف بطاقة إلى لوحة',    'بطاقة في خانة محدّدة من لوحة تملك تحريرها.',          'act', null, 5),
  ('create_project_draft','ينشئ مسودّة مشروع',      'مشروع جديد باسمك في حالة التخطيط.',                  'act', null, 6),
  ('update_headline',     'يكتب عنوانك المهني',     'السطر الذي يظهر تحت اسمك.',                          'act', null, 7),
  ('update_bio',          'يكتب نبذتك',             'نبذة ملفك الشخصي.',                                  'act', null, 8),

  -- «لا يقوم AI تلقائيًا بـ…» — listed here so the interface can explain, and
  -- deliberately without an execution branch below.
  ('book_paid_session',   'حجز جلسة مدفوعة',        'حجز جلسة مع منتور مقابل مبلغ.',                     'restricted',
     'المساعد لا يحجز جلسة مدفوعة. يجهّز لك الاختيار والأسئلة، والحجز بيدك من صفحة المنتور.', 20),
  ('send_money',          'إرسال أموال',            'دفع، تحرير ضمان، أو طلب سحب.',                      'restricted',
     'المساعد لا يحرّك مالًا بأي حال. المدفوعات والضمان والسحب من صفحاتها ومن حسابك أنت.', 21),
  ('change_account_data', 'تغيير بيانات حسّاسة',     'البريد، كلمة المرور، الأدوار، حساب الاستلام.',        'restricted',
     'بيانات الحساب الحسّاسة تُغيَّر من الإعدادات وبتحقّق منك، لا من المحادثة.', 22),
  ('delete_project',      'حذف مشروع',              'حذف مشروع أو عمل مسلّم.',                           'restricted',
     'المساعد لا يحذف عملًا. الحذف قرار لا رجعة فيه، ويبقى من صفحة المشروع.', 23),
  ('send_message_as_user','إرسال رسالة باسمك',      'رسالة في محادثة، أو ردّ على عميل.',                  'restricted',
     'المساعد يكتب لك المسودّة، ولا يرسلها باسمك. الإرسال من صفحة الرسائل.', 24),
  ('apply_to_opportunity','التقديم على فرصة',        'إرسال عرض بسعر ومدّة إلى صاحب فرصة.',               'restricted',
     'العرض التزام باسمك وبسعرك. المساعد يصيغه، وأنت من يضغط «أرسل».', 25);

comment on table public.ai_action_kinds is
  'The only actions that exist. `restricted` rows have no execution branch in confirm_ai_action() — they are here to be explained, not to be run.';

-- ---------------------------------------------------------------------------
-- A proposal is a row, not a call
-- ---------------------------------------------------------------------------
create table public.ai_actions (
  id          uuid primary key default extensions.gen_random_uuid(),
  thread_id   uuid references public.ai_threads (id) on delete set null,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null references public.ai_action_kinds (kind) on delete restrict,
  -- what the assistant is asking to do, in the person's language, before they
  -- are asked to agree to it
  summary_ar  text not null check (char_length(summary_ar) between 2 and 400),
  params      jsonb not null default '{}'::jsonb,
  status      public.ai_action_status not null default 'proposed',
  result      jsonb,
  error_ar    text,
  proposed_at timestamptz not null default now(),
  decided_at  timestamptz,
  executed_at timestamptz
);

create index ai_actions_owner_idx on public.ai_actions (profile_id, status, proposed_at desc);
create index ai_actions_thread_idx on public.ai_actions (thread_id, proposed_at);

alter table public.ai_actions enable row level security;

-- Readable and refusable by their owner; the writing is done by the functions
-- below, so nothing can insert an `executed` row and skip the door.
create policy ai_actions_read on public.ai_actions
  for select to authenticated
  using (profile_id = (select auth.uid()));

grant select on public.ai_actions to authenticated;

-- ---------------------------------------------------------------------------
-- What the assistant offers before anyone types anything
-- ---------------------------------------------------------------------------
create table public.ai_suggestions (
  id         uuid primary key default extensions.gen_random_uuid(),
  surface    public.ai_surface not null,
  label_ar   text not null,
  prompt_ar  text not null,
  icon       text,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create index ai_suggestions_surface_idx on public.ai_suggestions (surface, sort_order);

alter table public.ai_suggestions enable row level security;

create policy ai_suggestions_read on public.ai_suggestions
  for select to authenticated using (is_active);

grant select on public.ai_suggestions to authenticated;

insert into public.ai_suggestions (surface, label_ar, prompt_ar, icon, sort_order) values
  ('general',    'ما الخطوة التالية؟',      'بالنظر إلى تقدّمي على TechMood، ما الخطوة التالية الأفضل لي هذا الأسبوع؟', 'compass',  1),
  ('general',    'راجع ملفي',               'راجع ملفي الشخصي وقل لي ما ينقصه ليقنع صاحب فرصة.',                       'user',     2),
  ('general',    'خطّة تعلّم',               'اقترح لي خطّة تعلّم لأربعة أسابيع بناءً على هدفي المهني.',                  'map',      3),

  ('lesson',     'اشرح لي ببساطة',          'اشرح لي فكرة هذا الدرس بكلمات أبسط ومثال واحد.',                          'sparkles', 1),
  ('lesson',     'أعطني مثالًا عمليًا',       'أعطني مثالًا عمليًا صغيرًا أطبّق فيه ما في هذا الدرس.',                      'code',     2),
  ('lesson',     'اختبرني',                 'اسألني ثلاثة أسئلة قصيرة على هذا الدرس، ثم صحّح إجاباتي.',                  'check',    3),

  ('course',     'أين أقف؟',                'لخّص لي أين أقف في هذه الدورة وما الذي بقي.',                              'chart',    1),
  ('course',     'ما الذي فاتني؟',          'ما المفاهيم التي مررت عليها بسرعة وتحتاج مراجعة؟',                         'refresh',  2),

  ('assessment', 'اشرح خطئي',               'اشرح لي لماذا كانت إجابتي خاطئة، دون أن تعطيني الإجابة مباشرة.',            'help',     1),
  ('assessment', 'جهّزني للمحاولة القادمة',  'ما الذي أراجعه قبل المحاولة القادمة؟',                                    'book',     2),

  ('assignment', 'راجع تسليمي',             'راجع ما كتبته في هذه المهمة وقل لي ما ينقصه قبل التسليم.',                 'eye',      1),
  ('assignment', 'معايير التقييم',          'ما الذي سينظر إليه المنتور في هذه المهمة؟',                                'list',     2),

  ('project',    'قسّم المشروع',             'قسّم هذا المشروع إلى مهام صغيرة مرتّبة مع تقدير زمني لكل مهمة.',             'layers',   1),
  ('project',    'اكتب وصف المشروع',        'اكتب وصفًا للمشروع يصلح لصفحة المعرض.',                                    'edit',     2),
  ('project',    'ما الذي يعيقني؟',         'بالنظر إلى حالة المشروع، ما العقبة التي يجب أن أحلّها أولًا؟',               'alert',    3),

  ('profile',    'اكتب عنوانًا مهنيًا',       'اقترح لي عنوانًا مهنيًا من سطر واحد بناءً على مهاراتي وأعمالي.',             'edit',     1),
  ('profile',    'ما الذي ينقص ملفي؟',      'قارن ملفي بما يبحث عنه أصحاب الفرص، وقل لي أول ثلاثة أشياء أضيفها.',       'search',   2),

  ('cv',         'حسّن صياغة سيرتي',         'أعد صياغة بنود سيرتي الذاتية بلغة نتائج، دون أن تضيف ما لم أفعله.',         'file',     1),
  ('cv',         'سيرة لفرصة محدّدة',        'أعد ترتيب سيرتي لتناسب فرصة في هذا المجال.',                              'target',   2),

  ('market',     'ما الفرص التي تناسبني؟',  'بالنظر إلى مهاراتي المُوثّقة، أي الفرص المعروضة تناسبني ولماذا؟',            'briefcase',1),
  ('market',     'كم أسعّر عملي؟',           'ساعدني أقدّر سعرًا عادلًا لعمل بهذا الوصف بناءً على خبرتي.',                 'wallet',   2),

  ('opportunity','حلّل هذه الفرصة',          'حلّل هذه الفرصة: ما الذي يطلبه فعلًا، وهل أنا جاهز لها؟',                   'search',   1),
  ('opportunity','اكتب مقترحي',             'اكتب مسودّة مقترح لهذه الفرصة بلغتي، وأنا من سيرسله.',                      'edit',     2),
  ('opportunity','ما الذي ينقصني؟',         'ما المهارات التي تطلبها هذه الفرصة ولا أملك دليلًا عليها بعد؟',              'gap',      3),

  ('mentor',     'جهّز أسئلة الجلسة',        'جهّز لي خمسة أسئلة محدّدة أطرحها على المنتور في الجلسة القادمة.',            'help',     1),
  ('mentor',     'لخّص ما أريد',             'لخّص في فقرة واحدة ما أحتاج مساعدة فيه، لأرسلها مع طلب الحجز.',             'message',  2),

  ('booking',    'ما مواعيدي؟',             'لخّص لي مواعيدي القادمة وما يحتاج إجراءً مني.',                             'calendar', 1),

  ('team',       'وزّع المهام',              'بالنظر إلى أعضاء الفريق ومهامه، اقترح توزيعًا أعدل للمهام المتبقية.',        'users',    1),
  ('team',       'أين يتأخّر الفريق؟',       'ما المهام المتأخّرة في الفريق وما سبب تأخّرها على الأرجح؟',                  'alert',    2),

  ('startup',    'أين تقف الشركة؟',         'لخّص لي مرحلة الشركة وما ينقصها للانتقال إلى المرحلة التالية.',             'rocket',   1),
  ('startup',    'اقترح خارطة الربع',       'اقترح بنود خارطة طريق للربع القادم بناءً على مرحلتنا.',                     'map',      2),

  ('canvas',     'أكمل هذه اللوحة',         'انظر إلى ما كُتب في هذه اللوحة واقترح بطاقات للخانات الفارغة.',             'grid',     1),
  ('canvas',     'اختبر افتراضاتنا',        'ما أخطر افتراض في هذه اللوحة، وكيف نختبره بأقل تكلفة؟',                    'flask',    2),

  ('goal',       'صُغ هدفًا ذكيًا',           'حوّل ما أريده إلى هدف SMART بمؤشّر قياس وتاريخ.',                           'target',   1);

-- ---------------------------------------------------------------------------
-- Preferences and memory
-- ---------------------------------------------------------------------------
create or replace function public.ai_settings()
returns table (memory_enabled boolean, actions_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.memory_enabled, true), coalesce(p.actions_enabled, true)
    from (select (select auth.uid()) as id) me
    left join public.ai_preferences p on p.profile_id = me.id;
$$;

grant execute on function public.ai_settings() to authenticated;

create or replace function public.set_ai_preferences(
  p_memory  boolean default null,
  p_actions boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول.';
  end if;

  insert into public.ai_preferences (profile_id, memory_enabled, actions_enabled)
  values (v_me, coalesce(p_memory, true), coalesce(p_actions, true))
  on conflict (profile_id) do update
    set memory_enabled  = coalesce(p_memory,  public.ai_preferences.memory_enabled),
        actions_enabled = coalesce(p_actions, public.ai_preferences.actions_enabled);
end;
$$;

grant execute on function public.set_ai_preferences(boolean, boolean) to authenticated;

-- Memory, as the assistant would read it. Switching memory off empties this —
-- not "hides it from the screen", empties what the prompt is built from.
create or replace function public.ai_memory_json()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not (select memory_enabled from public.ai_settings()) then '[]'::jsonb
    else coalesce(
      (select jsonb_agg(jsonb_build_object('kind', m.kind, 'content', m.content_ar)
                        order by m.created_at)
         from public.ai_memory m
        where m.profile_id = (select auth.uid()) and m.is_active),
      '[]'::jsonb)
  end;
$$;

grant execute on function public.ai_memory_json() to authenticated;

create or replace function public.ai_remember(
  p_content text,
  p_kind    public.ai_memory_kind default 'fact',
  p_thread  uuid default null,
  p_from_assistant boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول.';
  end if;

  if not (select memory_enabled from public.ai_settings()) then
    raise exception 'ذاكرة المساعد موقوفة. شغّلها من إعدادات المساعد أولًا.';
  end if;

  insert into public.ai_memory (profile_id, kind, content_ar, source_thread, from_assistant)
  values (v_me, p_kind, p_content, p_thread, p_from_assistant)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.ai_remember(text, public.ai_memory_kind, uuid, boolean) to authenticated;

create or replace function public.my_ai_memory()
returns table (
  id         uuid,
  kind       public.ai_memory_kind,
  content_ar text,
  from_assistant boolean,
  is_active  boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.kind, m.content_ar, m.from_assistant, m.is_active, m.created_at
    from public.ai_memory m
   where m.profile_id = (select auth.uid())
   order by m.is_active desc, m.created_at desc;
$$;

grant execute on function public.my_ai_memory() to authenticated;

-- ---------------------------------------------------------------------------
-- Threads
-- ---------------------------------------------------------------------------
create or replace function public.start_ai_thread(
  p_title       text,
  p_surface     public.ai_surface default 'general',
  p_scope       public.ai_scope default 'page',
  p_entity_type text default null,
  p_entity_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول.';
  end if;

  insert into public.ai_threads (profile_id, title_ar, surface, scope, entity_type, entity_id)
  values (v_me, coalesce(nullif(btrim(p_title), ''), 'محادثة جديدة'),
          p_surface, p_scope, p_entity_type, p_entity_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.start_ai_thread(text, public.ai_surface, public.ai_scope, text, uuid) to authenticated;

create or replace function public.my_ai_threads(p_include_archived boolean default false)
returns table (
  id          uuid,
  title_ar    text,
  surface     public.ai_surface,
  scope       public.ai_scope,
  entity_type text,
  entity_id   uuid,
  is_archived boolean,
  messages    integer,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title_ar, t.surface, t.scope, t.entity_type, t.entity_id, t.is_archived,
         (select count(*)::int from public.ai_messages m where m.thread_id = t.id),
         t.last_message_at
    from public.ai_threads t
   where t.profile_id = (select auth.uid())
     and (p_include_archived or not t.is_archived)
   order by t.last_message_at desc;
$$;

grant execute on function public.my_ai_threads(boolean) to authenticated;

-- Saying something into a thread. Deliberately `security invoker`: the thread
-- policy is what decides, so nobody writes into somebody else's history.
create or replace function public.ai_say(
  p_thread  uuid,
  p_role    public.ai_role,
  p_content text,
  p_surface public.ai_surface default null,
  p_scope   public.ai_scope default null,
  p_model   text default null,
  p_error   text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_content), '') = '' then
    raise exception 'لا يمكن إرسال رسالة فارغة.';
  end if;

  insert into public.ai_messages (thread_id, role, content, surface, scope, model, error_ar)
  values (p_thread, p_role, p_content, p_surface, p_scope, p_model, p_error)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.ai_say(uuid, public.ai_role, text, public.ai_surface, public.ai_scope, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The context resolver
--
-- `security invoker`, and that is the whole security argument. Every select
-- below runs under the caller's own row level security, so the assistant's
-- view of TechMood is exactly the person's view of TechMood — never a row
-- wider. Passing somebody else's project id here returns an empty page slice,
-- not their project (§29).
-- ---------------------------------------------------------------------------
create or replace function public.ai_context(
  p_surface     public.ai_surface default 'general',
  p_scope       public.ai_scope default 'page',
  p_entity_type text default null,
  p_entity_id   uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_out  jsonb;
  v_page jsonb := 'null'::jsonb;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول.';
  end if;

  -- who is asking
  v_out := jsonb_build_object(
    'surface', p_surface,
    'scope',   p_scope,
    'me', (
      select jsonb_build_object(
        'name',     coalesce(p.display_name, p.full_name),
        'headline', p.headline,
        'bio',      p.bio,
        'roles',    (select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb)
                       from public.profile_roles r
                      where r.profile_id = p.id and r.status = 'approved'),
        'xp',       (select coalesce(sum(x.xp), 0)::int from public.xp_events x where x.profile_id = p.id),
        'skills',   (select coalesce(jsonb_agg(s.name_ar order by s.name_ar), '[]'::jsonb)
                       from public.profile_skills ps
                       join public.skills s on s.id = ps.skill_id
                      where ps.profile_id = p.id and ps.is_verified)
      )
      from public.profiles p where p.id = v_me
    ),
    'memory', public.ai_memory_json(),
    'permission', (select sp.permission from public.ai_surface_permissions sp where sp.surface = p_surface)
  );

  -- what is on the screen
  if p_entity_id is not null then
    v_page := case p_entity_type
      when 'lesson' then (
        select jsonb_build_object(
          'kind', 'lesson', 'title', l.title_ar, 'summary', l.summary_ar,
          'lesson_kind', l.kind, 'minutes', l.duration_minutes,
          'module', m.title_ar, 'course', c.title_ar,
          'my_status', (select lp.status from public.lesson_progress lp
                         where lp.lesson_id = l.id and lp.profile_id = v_me))
          from public.lessons l
          join public.modules m on m.id = l.module_id
          join public.courses c on c.id = m.course_id
         where l.id = p_entity_id)

      when 'course' then (
        select jsonb_build_object(
          'kind', 'course', 'title', c.title_ar, 'description', c.description_ar,
          'hours', c.estimated_hours,
          'lessons_done', (select count(*)::int
                             from public.lesson_progress lp
                             join public.lessons l on l.id = lp.lesson_id
                             join public.modules m on m.id = l.module_id
                            where m.course_id = c.id and lp.profile_id = v_me
                              and lp.status = 'completed'),
          'lessons_total', (select count(*)::int
                              from public.lessons l
                              join public.modules m on m.id = l.module_id
                             where m.course_id = c.id))
          from public.courses c where c.id = p_entity_id)

      when 'project' then (
        select jsonb_build_object(
          'kind', 'project', 'title', pr.title_ar, 'description', pr.description_ar,
          'status', pr.status, 'tags', to_jsonb(pr.tags),
          'milestones', (select coalesce(jsonb_agg(jsonb_build_object(
                                  'title', ms.title_ar, 'done', ms.is_done)
                                  order by ms.sort_order), '[]'::jsonb)
                           from public.project_milestones ms where ms.project_id = pr.id))
          from public.projects pr where pr.id = p_entity_id)

      when 'opportunity' then (
        select jsonb_build_object(
          'kind', 'opportunity', 'title', o.title_ar, 'org', o.organization_ar,
          'description', o.description_ar, 'tags', to_jsonb(o.tags),
          'compensation', o.compensation_ar, 'opportunity_kind', o.kind)
          from public.opportunities o where o.id = p_entity_id)

      when 'team' then (
        select jsonb_build_object(
          'kind', 'team', 'title', tm.title_ar, 'description', tm.description_ar,
          'needs', to_jsonb(tm.needs),
          'members', (select count(*)::int from public.team_members x where x.team_id = tm.id),
          'open_tasks', (select count(*)::int from public.team_tasks tk
                          where tk.team_id = tm.id and tk.column_key <> 'done'))
          from public.teams tm where tm.id = p_entity_id)

      when 'startup' then (
        select jsonb_build_object(
          'kind', 'startup', 'name', st.name_ar, 'description', st.description_ar,
          'stage', st.stage, 'in_incubator', st.is_in_incubator,
          'requirements_left', (select count(*)::int from public.stage_progress(p_entity_id) sp
                                 where sp.is_required and not sp.met))
          from public.startups st where st.id = p_entity_id)

      when 'canvas' then (
        select jsonb_build_object(
          'kind', 'canvas', 'title', cv.title_ar, 'canvas_kind', cv.kind,
          'blocks', (select coalesce(jsonb_agg(jsonb_build_object(
                              'key', b.key, 'title', b.title_ar,
                              'cards', (select coalesce(jsonb_agg(cc.body_ar order by cc.sort_order), '[]'::jsonb)
                                          from public.canvas_cards cc
                                         where cc.canvas_id = cv.id and cc.block_key = b.key))
                              order by b.sort_order), '[]'::jsonb)
                       from public.canvas_blocks b where b.canvas_id = cv.id))
          from public.canvases cv where cv.id = p_entity_id)

      when 'booking' then (
        select jsonb_build_object(
          'kind', 'booking', 'topic', bk.topic_ar, 'notes', bk.notes_ar,
          'status', bk.status, 'start', bk.scheduled_start)
          from public.bookings bk where bk.id = p_entity_id)

      else null
    end;
  end if;

  v_out := v_out || jsonb_build_object('page', coalesce(v_page, 'null'::jsonb));

  -- how wide the person let it look
  if p_scope in ('course', 'platform') then
    v_out := v_out || jsonb_build_object('learning', coalesce((
      select jsonb_agg(jsonb_build_object(
               'path', cl.path_title, 'course', cl.course_title,
               'next_lesson', cl.lesson_title, 'percent', cl.course_percent))
        from public.continue_learning() cl), '[]'::jsonb));
  end if;

  if p_scope in ('profile', 'platform') then
    v_out := v_out || jsonb_build_object(
      'stars', (select ps.stars_avg from public.profile_stars ps where ps.profile_id = v_me),
      'certificates', (select count(*)::int from public.certificates c
                        where c.profile_id = v_me and c.revoked_at is null));
  end if;

  if p_scope in ('project', 'platform') then
    v_out := v_out || jsonb_build_object('projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title_ar, 'status', pr.status)
                       order by pr.updated_at desc)
        from public.projects pr where pr.owner_id = v_me), '[]'::jsonb));
  end if;

  if p_scope in ('team', 'platform') then
    v_out := v_out || jsonb_build_object('teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', tm.id, 'title', tm.title_ar, 'role', mem.role))
        from public.team_members mem
        join public.teams tm on tm.id = mem.team_id
       where mem.profile_id = v_me), '[]'::jsonb));
  end if;

  if p_scope in ('startup', 'platform') then
    v_out := v_out || jsonb_build_object('startups', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name_ar, 'stage', st.stage))
        from public.startups st
       where st.founder_id = v_me
          or exists (select 1 from public.startup_members sm
                      where sm.startup_id = st.id and sm.profile_id = v_me)), '[]'::jsonb));
  end if;

  if p_scope = 'platform' then
    v_out := v_out || jsonb_build_object('needs_action', coalesce((
      select jsonb_agg(jsonb_build_object('what', na.label_ar, 'count', na.count))
        from public.needs_action() na), '[]'::jsonb));
  end if;

  return v_out;
end;
$$;

grant execute on function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) to authenticated;

comment on function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) is
  'Reads as the caller. The assistant cannot be handed a wider view than the person already has.';

-- ---------------------------------------------------------------------------
-- Proposing, refusing, confirming
-- ---------------------------------------------------------------------------
create or replace function public.propose_ai_action(
  p_thread  uuid,
  p_kind    text,
  p_summary text,
  p_params  jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := (select auth.uid());
  v_kind public.ai_action_kinds%rowtype;
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'يجب تسجيل الدخول.';
  end if;

  select * into v_kind from public.ai_action_kinds where kind = p_kind;

  if not found then
    raise exception 'إجراء غير معروف: %.', p_kind;
  end if;

  if not v_kind.is_enabled then
    raise exception 'هذا الإجراء غير مفعّل.';
  end if;

  -- The refusal happens here, at the proposal, so the person is never shown a
  -- button for something that was never going to run.
  if v_kind.permission = 'restricted' then
    raise exception '%', coalesce(v_kind.refusal_ar, 'هذا الإجراء ليس من عمل المساعد.');
  end if;

  if p_thread is not null and not exists (
    select 1 from public.ai_threads t where t.id = p_thread and t.profile_id = v_me
  ) then
    raise exception 'المحادثة ليست لك.';
  end if;

  insert into public.ai_actions (thread_id, profile_id, kind, summary_ar, params)
  values (p_thread, v_me, p_kind, p_summary, coalesce(p_params, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.propose_ai_action(uuid, text, text, jsonb) to authenticated;

-- The status column is written here and nowhere else, so an `executed` row
-- always means the executor below actually ran.
create or replace function public.set_ai_action_status(
  p_action uuid,
  p_status public.ai_action_status,
  p_result jsonb default null,
  p_error  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_actions
     set status      = p_status,
         result      = coalesce(p_result, result),
         error_ar    = p_error,
         decided_at  = case when p_status = 'proposed' then decided_at else coalesce(decided_at, now()) end,
         executed_at = case when p_status = 'executed' then now() else executed_at end
   where id = p_action and profile_id = (select auth.uid());

  if not found then
    raise exception 'الإجراء غير موجود.';
  end if;
end;
$$;

grant execute on function public.set_ai_action_status(uuid, public.ai_action_status, jsonb, text) to authenticated;

create or replace function public.decline_ai_action(p_action uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.set_ai_action_status(p_action, 'declined', null, null);
$$;

grant execute on function public.decline_ai_action(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The executor
--
-- `security invoker` on purpose. Every branch below is an ordinary write that
-- the person could have made from a form, and row level security refuses it on
-- exactly the same terms. A confirmed action is therefore never a privilege
-- escalation — it is a shortcut through a screen the person can already reach.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_ai_action(p_action uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_action public.ai_actions%rowtype;
  v_kind   public.ai_action_kinds%rowtype;
  v_params jsonb;
  v_result jsonb;
  v_new    uuid;
  v_startup uuid;
  v_error  text;
begin
  select * into v_action from public.ai_actions where id = p_action;

  if not found or v_action.profile_id <> v_me then
    raise exception 'الإجراء غير موجود.';
  end if;

  if v_action.status <> 'proposed' then
    raise exception 'هذا الإجراء تمّت معالجته من قبل.';
  end if;

  if not (select actions_enabled from public.ai_settings()) then
    raise exception 'إجراءات المساعد موقوفة من إعداداتك.';
  end if;

  -- An offer nobody answered is not an offer any more. Note what happens from
  -- here on: the outcome is *returned*, never raised. Raising would abort the
  -- transaction and take the status row down with it, and an assistant whose
  -- failures leave no trace is worse than one that cannot act at all.
  if v_action.proposed_at < now() - interval '24 hours' then
    perform public.set_ai_action_status(p_action, 'expired', null, 'انتهت صلاحية الاقتراح.');
    return jsonb_build_object('ok', false,
      'error_ar', 'انتهت صلاحية هذا الاقتراح. اطلب من المساعد اقتراحه من جديد.');
  end if;

  select * into v_kind from public.ai_action_kinds where kind = v_action.kind;

  -- Belt and braces: a row proposed while its kind was open, and restricted
  -- since, still does not run.
  if not found or not v_kind.is_enabled or v_kind.permission = 'restricted' then
    v_error := coalesce(v_kind.refusal_ar, 'هذا الإجراء ليس من عمل المساعد.');
    perform public.set_ai_action_status(p_action, 'declined', null, v_error);
    return jsonb_build_object('ok', false, 'error_ar', v_error);
  end if;

  v_params := coalesce(v_action.params, '{}'::jsonb);

  begin
    case v_action.kind

      when 'remember' then
        if coalesce(btrim(v_params->>'content'), '') = '' then
          raise exception 'لا توجد معلومة لحفظها.';
        end if;
        v_new := public.ai_remember(
          v_params->>'content',
          coalesce((v_params->>'kind')::public.ai_memory_kind, 'fact'),
          v_action.thread_id, true);
        v_result := jsonb_build_object('memory_id', v_new);

      when 'save_opportunity' then
        perform public.toggle_market_save('opportunity', (v_params->>'opportunity_id')::uuid);
        v_result := jsonb_build_object('opportunity_id', v_params->>'opportunity_id');

      when 'create_goal' then
        insert into public.smart_goals
          (startup_id, title_ar, specific_ar, metric_label_ar,
           baseline_value, target_value, starts_on, due_on, owner_id)
        values (
          (v_params->>'startup_id')::uuid,
          v_params->>'title',
          coalesce(v_params->>'specific', v_params->>'title'),
          coalesce(v_params->>'metric', 'مؤشّر'),
          coalesce((v_params->>'baseline')::numeric, 0),
          coalesce((v_params->>'target')::numeric, 1),
          coalesce((v_params->>'starts_on')::date, current_date),
          coalesce((v_params->>'due_on')::date, current_date + 90),
          v_me)
        returning id into v_new;
        v_result := jsonb_build_object('goal_id', v_new);

      when 'create_roadmap_item' then
        insert into public.roadmap_items
          (startup_id, title_ar, detail_ar, year, quarter, created_by)
        values (
          (v_params->>'startup_id')::uuid,
          v_params->>'title',
          v_params->>'detail',
          coalesce((v_params->>'year')::int, extract(year from current_date)::int),
          coalesce((v_params->>'quarter')::int, extract(quarter from current_date)::int),
          v_me)
        returning id into v_new;
        v_result := jsonb_build_object('roadmap_item_id', v_new);

      when 'add_canvas_card' then
        -- Reading the canvas is itself the permission check: a canvas the
        -- person cannot see returns no row.
        select c.startup_id into v_startup
          from public.canvases c where c.id = (v_params->>'canvas_id')::uuid;

        if v_startup is null then
          raise exception 'اللوحة غير موجودة أو ليست لك.';
        end if;

        insert into public.canvas_cards
          (startup_id, canvas_id, block_key, body_ar, note_ar, created_by)
        values (v_startup, (v_params->>'canvas_id')::uuid, v_params->>'block',
                v_params->>'body', v_params->>'note', v_me)
        returning id into v_new;
        v_result := jsonb_build_object('card_id', v_new);

      when 'create_project_draft' then
        insert into public.projects (title_ar, description_ar, owner_id)
        values (v_params->>'title', v_params->>'description', v_me)
        returning id into v_new;
        v_result := jsonb_build_object('project_id', v_new);

      when 'update_headline' then
        update public.profiles set headline = v_params->>'headline' where id = v_me;
        v_result := jsonb_build_object('headline', v_params->>'headline');

      when 'update_bio' then
        update public.profiles set bio = v_params->>'bio' where id = v_me;
        v_result := jsonb_build_object('bio', v_params->>'bio');

      else
        raise exception 'إجراء غير معروف: %.', v_action.kind;
    end case;

  exception when others then
    v_error := sqlerrm;
    perform public.set_ai_action_status(p_action, 'failed', null, v_error);
    return jsonb_build_object('ok', false, 'error_ar', v_error);
  end;

  perform public.set_ai_action_status(p_action, 'executed', v_result, null);
  return jsonb_build_object('ok', true, 'result', v_result);
end;
$$;

grant execute on function public.confirm_ai_action(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading a thread back
-- ---------------------------------------------------------------------------
create or replace function public.ai_thread_messages(p_thread uuid)
returns table (
  id         uuid,
  role       public.ai_role,
  content    text,
  error_ar   text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.role, m.content, m.error_ar, m.created_at
    from public.ai_messages m
    join public.ai_threads t on t.id = m.thread_id
   where m.thread_id = p_thread
     and t.profile_id = (select auth.uid())
   order by m.created_at;
$$;

grant execute on function public.ai_thread_messages(uuid) to authenticated;

create or replace function public.ai_thread_actions(p_thread uuid default null)
returns table (
  id          uuid,
  kind        text,
  title_ar    text,
  summary_ar  text,
  params      jsonb,
  status      public.ai_action_status,
  error_ar    text,
  proposed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.kind, k.title_ar, a.summary_ar, a.params, a.status, a.error_ar, a.proposed_at
    from public.ai_actions a
    join public.ai_action_kinds k on k.kind = a.kind
   where a.profile_id = (select auth.uid())
     and (p_thread is null or a.thread_id = p_thread)
   order by a.proposed_at desc;
$$;

grant execute on function public.ai_thread_actions(uuid) to authenticated;

create or replace function public.ai_suggestions_for(p_surface public.ai_surface)
returns table (label_ar text, prompt_ar text, icon text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.label_ar, s.prompt_ar, s.icon
    from public.ai_suggestions s
   where s.surface = p_surface and s.is_active
   order by s.sort_order;
$$;

grant execute on function public.ai_suggestions_for(public.ai_surface) to authenticated;

-- What the assistant is not allowed to do, so a screen can say it out loud
-- rather than letting a person find out by being refused.
create or replace function public.ai_restrictions()
returns table (kind text, title_ar text, detail_ar text, refusal_ar text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.kind, k.title_ar, k.detail_ar, k.refusal_ar
    from public.ai_action_kinds k
   where k.permission = 'restricted'
   order by k.sort_order;
$$;

grant execute on function public.ai_restrictions() to authenticated;
