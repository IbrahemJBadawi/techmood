-- =============================================================================
-- 0133 — The assistant knows the platform, not only the member
--
-- A live test showed the gap: asked "which path should I start with?", the
-- assistant had the member's own data but no list of paths, so it said it did
-- not know and then guessed a name. Its context now also carries, read as the
-- member (row level security still decides what is visible):
--   * catalogue — the open paths, their courses, hours and the page of each;
--   * mentors   — who takes bookings: level, field, starting price;
--   * rules     — the numbers members ask about (prices, notice, instant
--                 booking, absences, daily question limit), from the settings.
-- The member's own context (0067) is unchanged; it is now ai_context_core().
-- =============================================================================

alter function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) rename to ai_context_core;

create or replace function public.ai_context(
  p_surface     public.ai_surface default 'general',
  p_scope       public.ai_scope default 'page',
  p_entity_type text default null,
  p_entity_id   uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.ai_context_core(p_surface, p_scope, p_entity_type, p_entity_id)
    || jsonb_build_object(
      'catalogue', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'path', lp.title_ar,
                 'link', '/academy/' || lp.slug,
                 'about', coalesce(lp.tagline_ar, left(lp.description_ar, 160)),
                 'hours', lp.estimated_hours,
                 'courses', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                            'course', c.title_ar,
                            'link', '/academy/' || lp.slug || '/' || c.slug,
                            'hours', c.estimated_hours,
                            'level', c.level) order by pc.sort_order), '[]'::jsonb)
                     from public.path_courses pc
                     join public.courses c on c.id = pc.course_id
                    where pc.path_id = lp.id and c.status = 'published'))
               order by lp.sort_order, lp.title_ar)
          from public.learning_paths lp
         where lp.status = 'published'), '[]'::jsonb),
      'mentors', coalesce((
        select jsonb_agg(m order by (m->>'rating')::numeric desc nulls last)
          from (
            select jsonb_build_object(
                     'name', coalesce(p.display_name, p.full_name),
                     'link', '/mentors/' || mp.profile_id,
                     'level', lv.title,
                     'fields', coalesce((select jsonb_agg(coalesce(f.name_ar, d))
                                           from unnest(mp.domains) d
                                           left join public.fields f on f.slug = d), '[]'::jsonb),
                     'from_usd', lv.min_session_usd,
                     'rating', mp.rating_avg,
                     'sessions', mp.sessions_count) as m
              from public.mentor_profiles mp
              join public.profiles p on p.id = mp.profile_id
              join public.mentor_levels lv on lv.level = mp.level
             where mp.is_accepting and mp.approved_at is not null
             limit 12) x), '[]'::jsonb),
      'rules', (
        select jsonb_build_object(
          'mentor_levels', (select jsonb_agg(jsonb_build_object('level', l.title, 'from_usd', l.min_session_usd,
                                                                'default_usd', l.session_price_usd, 'to_usd', l.max_session_usd)
                                             order by l.sort_order) from public.mentor_levels l),
          'booking_notice_hours', max(case when s.key = 'booking_min_notice_hours' then s.value end),
          'instant_booking_extra_pct', max(case when s.key = 'instant_booking_surcharge_pct' then s.value end),
          'mentor_absence', 'refund in full if the mentor does not dispute within '
                            || coalesce(max(case when s.key = 'mentor_absence_dispute_hours' then s.value end), '24') || ' hours',
          'learner_absence', 'first absence: one free new time within '
                            || coalesce(max(case when s.key = 'learner_reschedule_days' then s.value end), '14') || ' days, no refund; second: the session counts',
          'assistant_questions_per_day', max(case when s.key = 'ai_daily_messages' then s.value end),
          'support', max(case when s.key = 'support_email' then s.value end))
          from public.platform_settings s));
$$;

revoke execute on function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) from public, anon;
grant execute on function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) to authenticated;
revoke execute on function public.ai_context_core(public.ai_surface, public.ai_scope, text, uuid) from public, anon;
grant execute on function public.ai_context_core(public.ai_surface, public.ai_scope, text, uuid) to authenticated;

comment on function public.ai_context(public.ai_surface, public.ai_scope, text, uuid) is
  'Reads as the caller: the member''s own context (ai_context_core) plus the open catalogue, the mentors taking bookings and the platform''s rules (0133).';
