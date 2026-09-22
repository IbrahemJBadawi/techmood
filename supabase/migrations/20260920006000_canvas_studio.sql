-- =============================================================================
-- 0060 — Canvas Studio: many canvases, one wall, and a way out of them
--
-- 0024 gave a startup one canvas — the Business Model Canvas, its nine blocks
-- fixed by an enum. That was right for one canvas and wrong for a company: a
-- lean canvas, a value proposition, a persona, a financial model and a pitch
-- are the same object with different blocks, and a company that thinks in only
-- one of them is a company with one thought.
--
-- So a canvas becomes a thing: it has a kind, a title, blocks that come from a
-- template (or from whoever made it, for a custom one), and cards inside those
-- blocks. The cards that already exist are moved onto a Business Model canvas
-- rather than being thrown away — nobody loses a thought to a migration.
--
-- Two things matter more than the shape:
--
--   * **A canvas can be wrong later.** `canvas_versions` freezes the whole wall
--     with a note, and a version can be restored — because a strategy that
--     cannot be revisited is a strategy nobody dares to change.
--
--   * **A canvas has a way out.** A card is a thought; the platform's point is
--     that a thought becomes work. `card_to_goal()` and `card_to_project()`
--     turn one into something with a date and an owner, and the link back is
--     kept, so "why are we doing this?" has an answer on the wall it came from.
-- =============================================================================

create type public.canvas_kind as enum (
  'business_model', 'lean', 'value_proposition', 'market', 'competitors',
  'persona', 'customer_journey', 'financial', 'funding', 'mvp', 'validation',
  'pitch', 'custom'
);

create type public.canvas_visibility as enum ('workspace', 'mentors', 'public');

create table public.canvases (
  id          uuid primary key default extensions.gen_random_uuid(),
  startup_id  uuid not null references public.startups (id) on delete cascade,
  kind        public.canvas_kind not null,
  title_ar    text not null,
  summary_ar  text,
  visibility  public.canvas_visibility not null default 'workspace',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index canvases_startup_idx on public.canvases (startup_id, kind);

create trigger canvases_touch before update on public.canvases
  for each row execute function public.touch_updated_at();

-- The blocks of one canvas. A built-in kind gets them from the template below;
-- a custom canvas gets whatever its author writes.
create table public.canvas_blocks (
  id         uuid primary key default extensions.gen_random_uuid(),
  canvas_id  uuid not null references public.canvases (id) on delete cascade,
  key        text not null,
  title_ar   text not null,
  hint_ar    text,
  sort_order integer not null default 0,

  unique (canvas_id, key)
);

create index canvas_blocks_canvas_idx on public.canvas_blocks (canvas_id, sort_order);

-- The shapes the platform knows. Reference data: an admin may add a kind,
-- nobody else needs to.
create table public.canvas_templates (
  kind       public.canvas_kind not null,
  key        text not null,
  title_ar   text not null,
  hint_ar    text,
  sort_order integer not null default 0,

  primary key (kind, key)
);

alter table public.canvases        enable row level security;
alter table public.canvas_blocks   enable row level security;
alter table public.canvas_templates enable row level security;

create policy canvas_templates_read on public.canvas_templates
  for select to anon, authenticated using (true);

-- A canvas is the company's, unless the company opened it: to its mentors, or
-- to the world on its showcase.
create policy canvases_read on public.canvases
  for select to anon, authenticated
  using (
    public.can_view_startup_workspace(startup_id)
    or (visibility = 'public' and exists (
      select 1 from public.startups s where s.id = startup_id and s.is_public))
  );

create policy canvases_write on public.canvases
  for all to authenticated
  using (public.can_edit_startup(startup_id))
  with check (public.can_edit_startup(startup_id));

create policy canvas_blocks_read on public.canvas_blocks
  for select to anon, authenticated
  using (exists (select 1 from public.canvases c where c.id = canvas_id));

create policy canvas_blocks_write on public.canvas_blocks
  for all to authenticated
  using (exists (select 1 from public.canvases c
                  where c.id = canvas_id and public.can_edit_startup(c.startup_id)))
  with check (exists (select 1 from public.canvases c
                       where c.id = canvas_id and public.can_edit_startup(c.startup_id)));

grant select on public.canvas_templates to anon, authenticated;
grant select on public.canvases, public.canvas_blocks to anon, authenticated;
grant insert, update, delete on public.canvases, public.canvas_blocks to authenticated;

insert into public.canvas_templates (kind, key, title_ar, hint_ar, sort_order) values
  -- Business Model Canvas: the nine blocks, in the order the picture is read
  ('business_model', 'key_partners',           'الشركاء الرئيسيون', 'من يساعدك ولا تستطيع العمل بدونه؟', 1),
  ('business_model', 'key_activities',         'الأنشطة الرئيسية', 'ما الذي يجب أن يحدث كل يوم؟', 2),
  ('business_model', 'key_resources',          'الموارد الرئيسية', 'ما الذي تحتاجه لتشتغل؟', 3),
  ('business_model', 'value_propositions',     'القيمة المقترحة', 'ما المشكلة التي تحلّها؟', 4),
  ('business_model', 'customer_relationships', 'علاقات العملاء', 'كيف تكسب العميل وتحتفظ به؟', 5),
  ('business_model', 'channels',               'القنوات', 'كيف تصل إليه؟', 6),
  ('business_model', 'customer_segments',      'شرائح العملاء', 'من هو عميلك بالضبط؟', 7),
  ('business_model', 'cost_structure',         'هيكل التكاليف', 'أين يذهب المال؟', 8),
  ('business_model', 'revenue_streams',        'مصادر الإيرادات', 'من أين يأتي المال؟', 9),
  -- Lean canvas
  ('lean', 'problem',            'المشكلة', 'أهم ثلاث مشكلات.', 1),
  ('lean', 'solution',           'الحل', 'أبسط ثلاثة حلول.', 2),
  ('lean', 'key_metrics',        'المؤشرات', 'الأرقام التي تخبرك أنك تتقدّم.', 3),
  ('lean', 'unique_value',       'القيمة الفريدة', 'جملة واحدة تفرّقك عن غيرك.', 4),
  ('lean', 'unfair_advantage',   'الميزة التي لا تُنسخ', 'ما الذي لا يستطيع منافسك شراءه؟', 5),
  ('lean', 'channels',           'القنوات', 'كيف تصل إليهم؟', 6),
  ('lean', 'customer_segments',  'الشرائح', 'من يعاني من هذه المشكلة؟', 7),
  ('lean', 'cost_structure',     'التكاليف', null, 8),
  ('lean', 'revenue_streams',    'الإيرادات', null, 9),
  -- Value proposition canvas
  ('value_proposition', 'jobs',        'مهام العميل', 'ما الذي يحاول إنجازه؟', 1),
  ('value_proposition', 'pains',       'آلامه', 'ما الذي يزعجه في الطريق؟', 2),
  ('value_proposition', 'gains',       'مكاسبه', 'ما الذي يسعده؟', 3),
  ('value_proposition', 'products',    'منتجاتك وخدماتك', null, 4),
  ('value_proposition', 'pain_relievers','مسكّنات الألم', 'كيف يخفف منتجك ما يزعجه؟', 5),
  ('value_proposition', 'gain_creators','صانعات المكسب', 'كيف يمنحه ما يسعده؟', 6),
  -- Market
  ('market', 'size',        'حجم السوق', 'TAM / SAM / SOM بأرقام.', 1),
  ('market', 'segments',    'الشرائح', null, 2),
  ('market', 'trends',      'الاتجاهات', 'ما الذي يتغيّر؟', 3),
  ('market', 'barriers',    'العوائق', 'ما الذي يصعّب الدخول؟', 4),
  -- Competitors
  ('competitors', 'direct',      'منافسون مباشرون', null, 1),
  ('competitors', 'indirect',    'منافسون غير مباشرين', null, 2),
  ('competitors', 'strengths',   'نقاط قوتهم', null, 3),
  ('competitors', 'gaps',        'الفجوات', 'ما الذي لا يقدّمه أحد؟', 4),
  -- Persona
  ('persona', 'who',        'من هو؟', 'العمر، العمل، المكان.', 1),
  ('persona', 'goals',      'أهدافه', null, 2),
  ('persona', 'frustrations','إحباطاته', null, 3),
  ('persona', 'behaviour',  'سلوكه', 'أين يقضي وقته؟ كيف يقرّر؟', 4),
  -- Customer journey
  ('customer_journey', 'awareness',   'المعرفة', 'كيف سمع عنك؟', 1),
  ('customer_journey', 'consideration','المقارنة', 'بمن قارنك؟', 2),
  ('customer_journey', 'purchase',    'القرار', null, 3),
  ('customer_journey', 'use',         'الاستخدام', null, 4),
  ('customer_journey', 'loyalty',     'العودة', 'لماذا يعود؟', 5),
  -- Financial
  ('financial', 'revenue',   'مصادر الدخل', null, 1),
  ('financial', 'costs',     'التكاليف الثابتة والمتغيرة', null, 2),
  ('financial', 'pricing',   'التسعير', null, 3),
  ('financial', 'breakeven', 'نقطة التعادل', 'متى يغطّي الدخل التكاليف؟', 4),
  -- Funding
  ('funding', 'need',     'كم تحتاج؟', null, 1),
  ('funding', 'use',      'أين سيذهب؟', null, 2),
  ('funding', 'sources',  'من أين؟', 'ذاتي، منحة، مستثمر، إيراد.', 3),
  ('funding', 'terms',    'الشروط', null, 4),
  -- MVP
  ('mvp', 'must_have',   'لا بد منه', 'بدونه لا يعمل المنتج.', 1),
  ('mvp', 'nice_to_have','يمكن تأجيله', null, 2),
  ('mvp', 'not_now',     'ليس الآن', 'ما اتفقنا ألا نبنيه بعد.', 3),
  ('mvp', 'success',     'كيف نعرف أنه نجح؟', null, 4),
  -- Validation
  ('validation', 'assumption', 'الافتراض', 'ما الذي نظنّه صحيحاً؟', 1),
  ('validation', 'test',       'الاختبار', 'كيف نتأكد؟', 2),
  ('validation', 'result',     'النتيجة', null, 3),
  ('validation', 'decision',   'القرار', 'نكمل، نعدّل، أم نترك؟', 4),
  -- Pitch
  ('pitch', 'problem',   'المشكلة', null, 1),
  ('pitch', 'solution',  'الحل', null, 2),
  ('pitch', 'market',    'السوق', null, 3),
  ('pitch', 'model',     'نموذج العمل', null, 4),
  ('pitch', 'traction',  'ما أنجزناه', null, 5),
  ('pitch', 'team',      'الفريق', null, 6),
  ('pitch', 'ask',       'الطلب', 'ما الذي تطلبه من المستمع؟', 7);

-- ---------------------------------------------------------------------------
-- Cards belong to a canvas now
-- ---------------------------------------------------------------------------
alter table public.canvas_cards
  add column canvas_id uuid references public.canvases (id) on delete cascade,
  add column block_key text,
  add column note_ar   text,
  add column owner_id  uuid references public.profiles (id) on delete set null,
  add column tags      text[] not null default '{}';

-- Every existing card is on a Business Model canvas; make that canvas real and
-- move them onto it. Nobody loses a thought to a migration.
insert into public.canvases (startup_id, kind, title_ar, created_by)
select distinct c.startup_id, 'business_model'::public.canvas_kind, 'نموذج العمل', null::uuid
  from public.canvas_cards c
 where c.canvas_id is null;

insert into public.canvas_blocks (canvas_id, key, title_ar, hint_ar, sort_order)
select cv.id, t.key, t.title_ar, t.hint_ar, t.sort_order
  from public.canvases cv
  join public.canvas_templates t on t.kind = cv.kind
 where cv.kind = 'business_model'
on conflict do nothing;

update public.canvas_cards c
   set canvas_id = cv.id,
       block_key = c.block::text
  from public.canvases cv
 where cv.startup_id = c.startup_id
   and cv.kind = 'business_model'
   and c.canvas_id is null;

alter table public.canvas_cards
  alter column block drop not null;

create index canvas_cards_canvas_idx on public.canvas_cards (canvas_id, block_key, sort_order);

-- A card written straight into the table — by an older screen, a seed, or a
-- test — still lands somewhere real: on this company's Business Model canvas,
-- in the block it named. The two columns stay in step so nothing that reads
-- `block` breaks while the studio grows.
create or replace function public.place_canvas_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canvas uuid;
begin
  if new.block_key is null and new.block is not null then
    new.block_key := new.block::text;
  end if;

  if new.canvas_id is null then
    select c.id into v_canvas
      from public.canvases c
     where c.startup_id = new.startup_id and c.kind = 'business_model'
     order by c.created_at
     limit 1;

    if v_canvas is null then
      insert into public.canvases (startup_id, kind, title_ar, created_by)
      values (new.startup_id, 'business_model', 'نموذج العمل', (select auth.uid()))
      returning id into v_canvas;

      insert into public.canvas_blocks (canvas_id, key, title_ar, hint_ar, sort_order)
      select v_canvas, t.key, t.title_ar, t.hint_ar, t.sort_order
        from public.canvas_templates t where t.kind = 'business_model'
      on conflict do nothing;
    end if;

    new.canvas_id := v_canvas;
  end if;

  -- Keep the old column readable for the nine blocks it knows.
  if new.block_key is not null
     and new.block_key = any (select b::text from unnest(enum_range(null::public.canvas_block)) b) then
    new.block := new.block_key::public.canvas_block;
  end if;

  return new;
end;
$$;

create trigger canvas_cards_place
  before insert or update of block, block_key, canvas_id on public.canvas_cards
  for each row execute function public.place_canvas_card();

-- ---------------------------------------------------------------------------
-- Making one
-- ---------------------------------------------------------------------------
create or replace function public.create_canvas(
  p_startup uuid,
  p_kind    public.canvas_kind,
  p_title   text default null,
  p_blocks  text[] default null
)
returns public.canvases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canvas public.canvases%rowtype;
  v_block  text;
  v_index  integer := 0;
begin
  if not public.can_edit_startup(p_startup) then
    raise exception 'لا تملك صلاحية التعديل في مساحة العمل هذه';
  end if;

  insert into public.canvases (startup_id, kind, title_ar, created_by)
  values (
    p_startup, p_kind,
    coalesce(nullif(trim(coalesce(p_title, '')), ''),
             (select min(t.title_ar) from public.canvas_templates t where t.kind = p_kind),
             'لوحة'),
    (select auth.uid())
  )
  returning * into v_canvas;

  if p_kind = 'custom' then
    foreach v_block in array coalesce(p_blocks, array['الأول', 'الثاني', 'الثالث']) loop
      v_index := v_index + 1;
      insert into public.canvas_blocks (canvas_id, key, title_ar, sort_order)
      values (v_canvas.id, 'block_' || v_index::text, v_block, v_index);
    end loop;
  else
    insert into public.canvas_blocks (canvas_id, key, title_ar, hint_ar, sort_order)
    select v_canvas.id, t.key, t.title_ar, t.hint_ar, t.sort_order
      from public.canvas_templates t where t.kind = p_kind;
  end if;

  return v_canvas;
end;
$$;

grant execute on function public.create_canvas(uuid, public.canvas_kind, text, text[]) to authenticated;

-- Moving a card, now by block key inside its own canvas.
drop function if exists public.move_canvas_card(uuid, public.canvas_block, integer);

create or replace function public.move_canvas_card(
  p_card  uuid,
  p_block text,
  p_index integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canvas  uuid;
  v_startup uuid;
  v_position integer;
begin
  select canvas_id, startup_id into v_canvas, v_startup
    from public.canvas_cards where id = p_card;

  if v_startup is null then
    raise exception 'البطاقة غير موجودة';
  end if;

  if not public.can_edit_startup(v_startup) then
    raise exception 'لا تملك صلاحية التعديل على هذه اللوحة';
  end if;

  if p_index is null then
    select coalesce(max(sort_order), -1) + 1 into v_position
      from public.canvas_cards
     where canvas_id is not distinct from v_canvas and block_key = p_block and id <> p_card;
  else
    v_position := greatest(p_index, 0);

    update public.canvas_cards
       set sort_order = sort_order + 1
     where canvas_id is not distinct from v_canvas and block_key = p_block
       and sort_order >= v_position and id <> p_card;
  end if;

  update public.canvas_cards
     set block_key = p_block, sort_order = v_position
   where id = p_card;
end;
$$;

grant execute on function public.move_canvas_card(uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- A canvas can be wrong later
-- ---------------------------------------------------------------------------
create table public.canvas_versions (
  id         uuid primary key default extensions.gen_random_uuid(),
  canvas_id  uuid not null references public.canvases (id) on delete cascade,
  version    integer not null,
  snapshot   jsonb not null,
  note_ar    text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  unique (canvas_id, version)
);

alter table public.canvas_versions enable row level security;

create policy canvas_versions_read on public.canvas_versions
  for select to authenticated
  using (exists (select 1 from public.canvases c
                  where c.id = canvas_id and public.can_view_startup_workspace(c.startup_id)));

grant select on public.canvas_versions to authenticated;

create or replace function public.snapshot_canvas(p_canvas uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_startup uuid;
  v_version integer;
begin
  select startup_id into v_startup from public.canvases where id = p_canvas;
  if v_startup is null then
    raise exception 'اللوحة غير موجودة';
  end if;

  if not public.can_edit_startup(v_startup) then
    raise exception 'لا تملك صلاحية التعديل على هذه اللوحة';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.canvas_versions where canvas_id = p_canvas;

  insert into public.canvas_versions (canvas_id, version, snapshot, note_ar, created_by)
  values (
    p_canvas, v_version,
    jsonb_build_object(
      'blocks', coalesce((
        select jsonb_agg(jsonb_build_object('key', b.key, 'title', b.title_ar,
                                            'hint', b.hint_ar, 'sort', b.sort_order)
                         order by b.sort_order)
          from public.canvas_blocks b where b.canvas_id = p_canvas
      ), '[]'::jsonb),
      'cards', coalesce((
        select jsonb_agg(jsonb_build_object('block', c.block_key, 'body', c.body_ar,
                                            'colour', c.colour, 'sort', c.sort_order,
                                            'note', c.note_ar, 'tags', c.tags)
                         order by c.block_key, c.sort_order)
          from public.canvas_cards c where c.canvas_id = p_canvas
      ), '[]'::jsonb)
    ),
    nullif(trim(coalesce(p_note, '')), ''),
    (select auth.uid())
  );

  return v_version;
end;
$$;

grant execute on function public.snapshot_canvas(uuid, text) to authenticated;

-- Restoring takes a snapshot of what is there first, so going back is itself
-- undoable — nobody should have to be brave to revisit a strategy.
create or replace function public.restore_canvas_version(p_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     public.canvas_versions%rowtype;
  v_startup uuid;
  v_card    jsonb;
begin
  select * into v_row from public.canvas_versions where id = p_version;
  if not found then
    raise exception 'النسخة غير موجودة';
  end if;

  select startup_id into v_startup from public.canvases where id = v_row.canvas_id;

  if not public.can_edit_startup(v_startup) then
    raise exception 'لا تملك صلاحية التعديل على هذه اللوحة';
  end if;

  perform public.snapshot_canvas(v_row.canvas_id, 'قبل الرجوع إلى النسخة ' || v_row.version::text);

  delete from public.canvas_cards where canvas_id = v_row.canvas_id;

  for v_card in select * from jsonb_array_elements(v_row.snapshot -> 'cards')
  loop
    insert into public.canvas_cards
      (startup_id, canvas_id, block_key, body_ar, colour, sort_order, note_ar, tags)
    values (
      v_startup, v_row.canvas_id, v_card ->> 'block', v_card ->> 'body',
      coalesce((v_card ->> 'colour')::public.card_colour, 'default'),
      coalesce((v_card ->> 'sort')::int, 0),
      v_card ->> 'note',
      coalesce(array(select jsonb_array_elements_text(v_card -> 'tags')), '{}')
    );
  end loop;
end;
$$;

grant execute on function public.restore_canvas_version(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A thought becomes work
-- ---------------------------------------------------------------------------
create table public.canvas_card_links (
  card_id     uuid not null references public.canvas_cards (id) on delete cascade,
  target_kind text not null check (target_kind in ('goal', 'project', 'opportunity')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),

  primary key (card_id, target_kind, target_id)
);

alter table public.canvas_card_links enable row level security;

create policy canvas_card_links_read on public.canvas_card_links
  for select to authenticated
  using (exists (select 1 from public.canvas_cards c
                  where c.id = card_id and public.can_view_startup_workspace(c.startup_id)));

grant select on public.canvas_card_links to authenticated;

-- A card on a wall, turned into a goal with a number and a date.
create or replace function public.card_to_goal(
  p_card    uuid,
  p_metric  text,
  p_target  numeric,
  p_due     date,
  p_title   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card    public.canvas_cards%rowtype;
  v_goal    uuid;
begin
  select * into v_card from public.canvas_cards where id = p_card;
  if not found then
    raise exception 'البطاقة غير موجودة';
  end if;

  if not public.can_edit_startup(v_card.startup_id) then
    raise exception 'لا تملك صلاحية التعديل في مساحة العمل هذه';
  end if;

  insert into public.smart_goals
    (startup_id, title_ar, specific_ar, metric_label_ar, baseline_value, target_value,
     starts_on, due_on, owner_id)
  values (
    v_card.startup_id,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), left(v_card.body_ar, 120)),
    v_card.body_ar,
    p_metric, 0, p_target,
    current_date, p_due,
    (select auth.uid())
  )
  returning id into v_goal;

  insert into public.canvas_card_links (card_id, target_kind, target_id)
  values (p_card, 'goal', v_goal)
  on conflict do nothing;

  return v_goal;
end;
$$;

grant execute on function public.card_to_goal(uuid, text, numeric, date, text) to authenticated;

-- …or into a project the company will actually run.
create or replace function public.card_to_project(p_card uuid, p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card    public.canvas_cards%rowtype;
  v_startup public.startups%rowtype;
  v_project uuid;
begin
  select * into v_card from public.canvas_cards where id = p_card;
  if not found then
    raise exception 'البطاقة غير موجودة';
  end if;

  if not public.can_edit_startup(v_card.startup_id) then
    raise exception 'لا تملك صلاحية التعديل في مساحة العمل هذه';
  end if;

  select * into v_startup from public.startups where id = v_card.startup_id;

  insert into public.projects
    (title_ar, description_ar, owner_id, startup_id, team_id, status, kind, is_public)
  values (
    coalesce(nullif(trim(coalesce(p_title, '')), ''), left(v_card.body_ar, 120)),
    v_card.body_ar,
    (select auth.uid()),
    v_card.startup_id,
    v_startup.team_id,
    'planning', 'startup', false
  )
  returning id into v_project;

  insert into public.canvas_card_links (card_id, target_kind, target_id)
  values (p_card, 'project', v_project)
  on conflict do nothing;

  return v_project;
end;
$$;

grant execute on function public.card_to_project(uuid, text) to authenticated;

-- The same door from a SWOT square: a weakness is the most common place a goal
-- is actually born.
create or replace function public.swot_to_goal(
  p_item   uuid,
  p_metric text,
  p_target numeric,
  p_due    date,
  p_title  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.swot_items%rowtype;
  v_goal uuid;
begin
  select * into v_item from public.swot_items where id = p_item;
  if not found then
    raise exception 'العنصر غير موجود';
  end if;

  if not public.can_edit_startup(v_item.startup_id) then
    raise exception 'لا تملك صلاحية التعديل في مساحة العمل هذه';
  end if;

  insert into public.smart_goals
    (startup_id, title_ar, specific_ar, metric_label_ar, baseline_value, target_value,
     starts_on, due_on, owner_id)
  values (
    v_item.startup_id,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), left(v_item.body_ar, 120)),
    v_item.body_ar, p_metric, 0, p_target, current_date, p_due, (select auth.uid())
  )
  returning id into v_goal;

  return v_goal;
end;
$$;

grant execute on function public.swot_to_goal(uuid, text, numeric, date, text) to authenticated;

-- What a canvas looks like, blocks and cards in one read.
create or replace function public.canvas_board(p_canvas uuid)
returns table (
  block_key   text,
  block_title text,
  block_hint  text,
  block_sort  integer,
  card_id     uuid,
  body_ar     text,
  colour      public.card_colour,
  note_ar     text,
  tags        text[],
  sort_order  integer,
  linked      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.key, b.title_ar, b.hint_ar, b.sort_order,
         c.id, c.body_ar, c.colour, c.note_ar, c.tags, c.sort_order,
         coalesce((
           select jsonb_agg(jsonb_build_object('kind', l.target_kind, 'id', l.target_id))
             from public.canvas_card_links l where l.card_id = c.id
         ), '[]'::jsonb)
    from public.canvas_blocks b
    left join public.canvas_cards c on c.canvas_id = b.canvas_id and c.block_key = b.key
   where b.canvas_id = p_canvas
     and exists (
       select 1 from public.canvases cv
        where cv.id = p_canvas
          and (public.can_view_startup_workspace(cv.startup_id)
               or (cv.visibility = 'public'
                   and exists (select 1 from public.startups s
                                where s.id = cv.startup_id and s.is_public)))
     )
   order by b.sort_order, c.sort_order;
$$;

grant execute on function public.canvas_board(uuid) to anon, authenticated;
