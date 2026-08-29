-- Pengawasan ujian langsung, hitungan keluar halaman, dan pause/resume attempt.

alter table public.attempts
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

alter table public.attempts
  drop constraint if exists attempts_paused_seconds_nonnegative;
alter table public.attempts
  add constraint attempts_paused_seconds_nonnegative
  check (paused_seconds >= 0);

create index if not exists attempts_exam_live_monitor_idx
  on public.attempts(exam_id, status, paused_at);

create or replace function public.student_attempt_is_active(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.attempts attempt
    join public.exams exam on exam.id = attempt.exam_id
    join public.profiles student on student.id = attempt.student_id
    where attempt.id = target_attempt_id
      and attempt.student_id = auth.uid()
      and student.role = 'siswa'
      and student.active
      and attempt.status = 'in_progress'
      and attempt.started_at is not null
      and attempt.paused_at is null
      and now() >= exam.starts_at
      and now() <= least(
        attempt.started_at
          + make_interval(mins => exam.duration_minutes)
          + attempt.paused_seconds * interval '1 second',
        coalesce(exam.ends_at, 'infinity'::timestamptz)
      ) + interval '10 seconds'
  );
$$;

revoke all on function public.student_attempt_is_active(uuid) from public, anon;
grant execute on function public.student_attempt_is_active(uuid) to authenticated;

create or replace function public.get_student_attempt_control(target_attempt_id uuid)
returns table(is_paused boolean, deadline timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    attempt.paused_at is not null,
    least(
      attempt.started_at
        + make_interval(mins => exam.duration_minutes)
        + attempt.paused_seconds * interval '1 second'
        + case
            when attempt.paused_at is not null then now() - attempt.paused_at
            else interval '0 seconds'
          end,
      coalesce(exam.ends_at, 'infinity'::timestamptz)
    )
  from public.attempts attempt
  join public.exams exam on exam.id = attempt.exam_id
  where attempt.id = target_attempt_id
    and attempt.student_id = auth.uid()
    and public.current_role() = 'siswa';
$$;

revoke all on function public.get_student_attempt_control(uuid) from public, anon;
grant execute on function public.get_student_attempt_control(uuid) to authenticated;

create or replace function public.get_exam_monitor(target_exam_id uuid)
returns table(
  student_id uuid,
  student_name text,
  attempt_id uuid,
  attempt_status text,
  started_at timestamptz,
  submitted_at timestamptz,
  is_paused boolean,
  answered_count bigint,
  exit_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'guru'
     or not public.teacher_owns_exam(target_exam_id) then
    raise exception 'Ujian tidak ditemukan atau bukan milik guru';
  end if;

  return query
  select
    assignment.student_id,
    student.full_name,
    attempt.id,
    coalesce(attempt.status::text, 'not_started'),
    attempt.started_at,
    attempt.submitted_at,
    coalesce(attempt.paused_at is not null, false),
    coalesce(answer_summary.answered_count, 0),
    coalesce(integrity_summary.exit_count, 0)
  from public.exam_assignments assignment
  join public.profiles student
    on student.id = assignment.student_id
    and student.role = 'siswa'
  left join public.attempts attempt
    on attempt.exam_id = assignment.exam_id
    and attempt.student_id = assignment.student_id
  left join lateral (
    select count(*) as answered_count
    from public.answers answer
    where answer.attempt_id = attempt.id
      and (answer.selected_option is not null or nullif(trim(answer.essay_text), '') is not null)
  ) answer_summary on true
  left join lateral (
    select count(*) as exit_count
    from public.integrity_events integrity_event
    where integrity_event.attempt_id = attempt.id
      and integrity_event.event_type in ('tab_hidden', 'app_backgrounded')
  ) integrity_summary on true
  where assignment.exam_id = target_exam_id
  order by student.full_name, student.id;
end;
$$;

revoke all on function public.get_exam_monitor(uuid) from public, anon;
grant execute on function public.get_exam_monitor(uuid) to authenticated;

create or replace function public.set_student_attempt_paused(
  target_attempt_id uuid,
  should_pause boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
  target_exam public.exams%rowtype;
  action_name text;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat mengatur sesi siswa';
  end if;

  select attempt.* into target_attempt
  from public.attempts attempt
  where attempt.id = target_attempt_id
  for update;

  if target_attempt.id is null
     or not public.teacher_owns_exam(target_attempt.exam_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;
  if target_attempt.status <> 'in_progress' or target_attempt.started_at is null then
    raise exception 'Hanya sesi yang sedang dikerjakan yang dapat diatur';
  end if;

  select exam.* into target_exam
  from public.exams exam
  where exam.id = target_attempt.exam_id;

  if should_pause then
    if target_attempt.paused_at is null then
      if now() > least(
        target_attempt.started_at
          + make_interval(mins => target_exam.duration_minutes)
          + target_attempt.paused_seconds * interval '1 second',
        coalesce(target_exam.ends_at, 'infinity'::timestamptz)
      ) then
        raise exception 'Waktu pengerjaan siswa sudah berakhir';
      end if;
      update public.attempts
      set paused_at = now()
      where id = target_attempt.id;
      action_name := 'attempt.paused';
    end if;
  else
    if target_attempt.paused_at is not null then
      if now() > coalesce(target_exam.ends_at, 'infinity'::timestamptz) then
        raise exception 'Ujian sudah melewati waktu selesai dan tidak dapat dilanjutkan';
      end if;
      update public.attempts
      set paused_seconds = paused_seconds
            + greatest(0, floor(extract(epoch from (now() - paused_at))))::integer,
          paused_at = null
      where id = target_attempt.id;
      action_name := 'attempt.resumed';
    end if;
  end if;

  if action_name is not null then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values(
      auth.uid(),
      action_name,
      'attempts',
      target_attempt.id,
      jsonb_build_object(
        'exam_id', target_attempt.exam_id,
        'student_id', target_attempt.student_id
      )
    );
  end if;
end;
$$;

revoke all on function public.set_student_attempt_paused(uuid, boolean)
  from public, anon;
grant execute on function public.set_student_attempt_paused(uuid, boolean)
  to authenticated;

-- Soal tetap dapat dimuat ketika sesi sedang dihentikan agar browser dapat
-- mempertahankan tampilan, tetapi save_exam_answer ditolak oleh fungsi aktif.
create or replace function public.get_exam_questions(requested_exam_id uuid)
returns table(
  question_id uuid,
  body text,
  kind public.question_type,
  options jsonb,
  weight numeric,
  selected_option integer,
  essay_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    question.id,
    question.body,
    question.type,
    case
      when exam.shuffle_options and question.type = 'multiple_choice' then (
        select coalesce(
          jsonb_agg(
            option_item.value
            order by
              hashtextextended(
                option_item.ordinality::text,
                hashtextextended(attempt.id::text || ':' || question.id::text, 0)
              ),
              option_item.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(
          case when jsonb_typeof(question.options) = 'array'
            then question.options else '[]'::jsonb end
        ) with ordinality as option_item(value, ordinality)
      )
      else question.options
    end,
    question.weight,
    case
      when answer.selected_option is null then null
      when exam.shuffle_options then (
        select ordered_option.displayed_index
        from (
          select
            (option_item.ordinality - 1)::integer as original_index,
            (row_number() over (
              order by
                hashtextextended(
                  option_item.ordinality::text,
                  hashtextextended(attempt.id::text || ':' || question.id::text, 0)
                ),
                option_item.ordinality
            ) - 1)::integer as displayed_index
          from jsonb_array_elements(
            case when jsonb_typeof(question.options) = 'array'
              then question.options else '[]'::jsonb end
          ) with ordinality as option_item(value, ordinality)
        ) ordered_option
        where ordered_option.original_index = answer.selected_option
      )
      else answer.selected_option
    end,
    answer.essay_text
  from public.exam_questions exam_question
  join public.questions question on question.id = exam_question.question_id
  join public.exams exam on exam.id = exam_question.exam_id
  join public.attempts attempt on attempt.exam_id = exam.id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  join public.profiles student
    on student.id = attempt.student_id
    and student.role = 'siswa'
    and student.active
  where exam.id = requested_exam_id
    and attempt.student_id = auth.uid()
    and public.current_role() = 'siswa'
    and attempt.status = 'in_progress'
    and now() >= exam.starts_at
    and now() <= least(
      attempt.started_at
        + make_interval(mins => exam.duration_minutes)
        + attempt.paused_seconds * interval '1 second'
        + case
            when attempt.paused_at is not null then now() - attempt.paused_at
            else interval '0 seconds'
          end,
      coalesce(exam.ends_at, 'infinity'::timestamptz)
    )
  order by case
    when exam.shuffle_questions then
      hashtextextended(question.id::text, hashtextextended(attempt.id::text, 0))
    else exam_question.position::bigint
  end;
$$;

revoke all on function public.get_exam_questions(uuid) from public, anon;
grant execute on function public.get_exam_questions(uuid) to authenticated;

create or replace function public.submit_exam_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  objective_points numeric := 0;
  total_points numeric := 0;
  has_essay boolean := false;
  current_status public.attempt_status;
  current_paused_at timestamptz;
  exam_ends_at timestamptz;
begin
  select attempt.status, attempt.paused_at, exam.ends_at
  into current_status, current_paused_at, exam_ends_at
  from public.attempts attempt
  join public.exams exam on exam.id = attempt.exam_id
  where attempt.id = target_attempt_id and attempt.student_id = auth.uid()
  for update of attempt;

  if current_status is null then
    raise exception 'Attempt tidak ditemukan atau bukan milik siswa';
  end if;
  if current_status <> 'in_progress' then
    raise exception 'Attempt sudah dikumpulkan dan tidak dapat diubah';
  end if;
  if current_paused_at is not null
     and now() <= coalesce(exam_ends_at, 'infinity'::timestamptz) then
    raise exception 'Sesi sedang dihentikan oleh guru';
  end if;

  select
    coalesce(sum(case
      when question.type = 'multiple_choice'
        and answer.selected_option = question.correct_option
        then question.weight
      else 0
    end), 0),
    coalesce(sum(question.weight), 0),
    bool_or(question.type = 'essay')
  into objective_points, total_points, has_essay
  from public.attempts attempt
  join public.exam_questions exam_question
    on exam_question.exam_id = attempt.exam_id
  join public.questions question on question.id = exam_question.question_id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id;

  update public.attempts
  set objective_score = objective_points,
      status = (
        case when coalesce(has_essay, false)
          then 'submitted'
          else 'final'
        end
      )::public.attempt_status,
      submitted_at = now(),
      paused_at = null,
      final_score = case
        when not coalesce(has_essay, false) and total_points > 0
          then round(objective_points / total_points * 100, 2)
        else null
      end,
      finalized_at = case
        when not coalesce(has_essay, false) then now()
        else null
      end
  where id = target_attempt_id;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

drop policy if exists "students log active integrity" on public.integrity_events;
drop policy if exists "students log own integrity" on public.integrity_events;
create policy "students log active integrity"
on public.integrity_events for insert
with check (
  student_id = auth.uid()
  and public.student_attempt_is_active(integrity_events.attempt_id)
  and event_type in (
    'tab_hidden',
    'app_backgrounded',
    'fullscreen_exit',
    'copy',
    'paste',
    'reconnect'
  )
  and octet_length(coalesce(metadata, '{}'::jsonb)::text) <= 4096
);

do $$
begin
  if exists(
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists(
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'integrity_events'
  ) then
    alter publication supabase_realtime add table public.integrity_events;
  end if;
end;
$$;

comment on column public.attempts.paused_at is
  'Waktu ketika guru menghentikan sementara sesi siswa; null berarti aktif.';
comment on column public.attempts.paused_seconds is
  'Total detik pause yang menambah deadline personal tanpa melewati ends_at ujian.';
