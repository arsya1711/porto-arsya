-- Kesiapan operasional ujian:
-- 1. auto-finalisasi attempt kedaluwarsa;
-- 2. penyimpanan jawaban batch;
-- 3. heartbeat siswa;
-- 4. kontrol massal dan operasional pengawas;
-- 5. timeline indikasi aktivitas;
-- 6. rubrik penilaian essay.

alter table public.attempts
  add column if not exists last_seen_at timestamptz,
  add column if not exists extra_time_seconds integer not null default 0;

alter table public.attempts
  drop constraint if exists attempts_extra_time_nonnegative;
alter table public.attempts
  add constraint attempts_extra_time_nonnegative
  check (extra_time_seconds >= 0 and extra_time_seconds <= 86400);

alter table public.questions
  add column if not exists rubric jsonb not null default '[]'::jsonb;

alter table public.questions
  drop constraint if exists questions_rubric_array;
alter table public.questions
  add constraint questions_rubric_array
  check (jsonb_typeof(rubric) = 'array' and jsonb_array_length(rubric) <= 20);

alter table public.answers
  add column if not exists rubric_scores jsonb not null default '[]'::jsonb;

alter table public.answers
  drop constraint if exists answers_rubric_scores_array;
alter table public.answers
  add constraint answers_rubric_scores_array
  check (jsonb_typeof(rubric_scores) = 'array' and jsonb_array_length(rubric_scores) <= 20);

update public.questions
set rubric = jsonb_build_array(
  jsonb_build_object('label', 'Ketepatan jawaban', 'points', weight)
)
where type = 'essay' and rubric = '[]'::jsonb;

create index if not exists attempts_live_presence_idx
  on public.attempts(exam_id, last_seen_at desc)
  where status = 'in_progress';

create or replace function public.exam_attempt_deadline(target_attempt_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(
    attempt.started_at
      + make_interval(mins => exam.duration_minutes)
      + attempt.paused_seconds * interval '1 second'
      + attempt.extra_time_seconds * interval '1 second'
      + case
          when attempt.paused_at is not null then now() - attempt.paused_at
          else interval '0 seconds'
        end,
    coalesce(exam.ends_at, 'infinity'::timestamptz)
      + attempt.extra_time_seconds * interval '1 second'
  )
  from public.attempts attempt
  join public.exams exam on exam.id = attempt.exam_id
  where attempt.id = target_attempt_id and attempt.started_at is not null;
$$;

revoke all on function public.exam_attempt_deadline(uuid)
  from public, anon, authenticated;

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
      and now() <= public.exam_attempt_deadline(attempt.id) + interval '10 seconds'
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
    public.exam_attempt_deadline(attempt.id)
  from public.attempts attempt
  where attempt.id = target_attempt_id
    and attempt.student_id = auth.uid()
    and public.current_role() = 'siswa';
$$;

revoke all on function public.get_student_attempt_control(uuid) from public, anon;
grant execute on function public.get_student_attempt_control(uuid) to authenticated;

create or replace function public.touch_exam_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.attempts
  set last_seen_at = now()
  where id = target_attempt_id
    and student_id = auth.uid()
    and status = 'in_progress';

  if not found then
    raise exception 'Sesi ujian tidak aktif';
  end if;
end;
$$;

revoke all on function public.touch_exam_attempt(uuid) from public, anon;
grant execute on function public.touch_exam_attempt(uuid) to authenticated;

create or replace function public.save_exam_answers_batch(
  target_attempt_id uuid,
  answer_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  saved_count integer := 0;
begin
  if jsonb_typeof(answer_payload) <> 'array'
     or jsonb_array_length(answer_payload) > 500
     or octet_length(answer_payload::text) > 2000000 then
    raise exception 'Payload jawaban tidak valid atau terlalu besar';
  end if;

  if not public.student_attempt_is_active(target_attempt_id) then
    raise exception 'Attempt tidak aktif, dihentikan, atau waktunya sudah berakhir';
  end if;

  for item in select value from jsonb_array_elements(answer_payload)
  loop
    if jsonb_typeof(item) <> 'object'
       or nullif(item->>'question_id', '') is null then
      raise exception 'Format salah satu jawaban tidak valid';
    end if;

    perform public.save_exam_answer(
      target_attempt_id,
      (item->>'question_id')::uuid,
      case when item ? 'selected_option' and item->>'selected_option' is not null
        then (item->>'selected_option')::integer else null end,
      case when item ? 'essay_text' then item->>'essay_text' else null end
    );
    saved_count := saved_count + 1;
  end loop;

  return saved_count;
end;
$$;

revoke all on function public.save_exam_answers_batch(uuid, jsonb)
  from public, anon;
grant execute on function public.save_exam_answers_batch(uuid, jsonb)
  to authenticated;

create or replace function public.finalize_exam_attempt_internal(
  target_attempt_id uuid,
  finalization_reason text,
  action_actor_id uuid default null
)
returns public.attempt_status
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
  final_status public.attempt_status;
begin
  select * into target_attempt
  from public.attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null then
    raise exception 'Attempt tidak ditemukan';
  end if;
  if target_attempt.status <> 'in_progress' then
    return target_attempt.status;
  end if;

  insert into public.answers(attempt_id, question_id)
  select target_attempt.id, exam_question.question_id
  from public.exam_questions exam_question
  where exam_question.exam_id = target_attempt.exam_id
  on conflict (attempt_id, question_id) do nothing;

  update public.attempts
  set status = 'submitted',
      submitted_at = now(),
      paused_at = null,
      last_seen_at = now()
  where id = target_attempt.id
  returning status into final_status;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    action_actor_id,
    'attempt.finalized',
    'attempts',
    target_attempt.id,
    jsonb_build_object(
      'exam_id', target_attempt.exam_id,
      'student_id', target_attempt.student_id,
      'reason', left(coalesce(finalization_reason, 'unknown'), 80),
      'result_status', final_status
    )
  );

  return final_status;
end;
$$;

revoke all on function public.finalize_exam_attempt_internal(uuid, text, uuid)
  from public, anon, authenticated;

create or replace function public.submit_exam_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
begin
  select * into target_attempt
  from public.attempts
  where id = target_attempt_id and student_id = auth.uid()
  for update;

  if target_attempt.id is null then
    raise exception 'Attempt tidak ditemukan atau bukan milik siswa';
  end if;
  if target_attempt.status <> 'in_progress' then
    raise exception 'Attempt sudah dikumpulkan dan tidak dapat diubah';
  end if;
  if target_attempt.paused_at is not null
     and now() <= public.exam_attempt_deadline(target_attempt.id) then
    raise exception 'Sesi sedang dihentikan oleh guru';
  end if;

  perform public.finalize_exam_attempt_internal(
    target_attempt.id,
    'student_submit',
    auth.uid()
  );
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

create or replace function public.finalize_expired_exam_attempts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item record;
  finalized_count integer := 0;
begin
  for item in
    select attempt.id
    from public.attempts attempt
    where attempt.status = 'in_progress'
      and attempt.started_at is not null
      and now() > public.exam_attempt_deadline(attempt.id)
    order by attempt.id
    for update skip locked
  loop
    perform public.finalize_exam_attempt_internal(
      item.id,
      'server_deadline',
      null
    );
    finalized_count := finalized_count + 1;
  end loop;

  return finalized_count;
end;
$$;

revoke all on function public.finalize_expired_exam_attempts()
  from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname = 'finalize-expired-exam-attempts'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'finalize-expired-exam-attempts',
    '* * * * *',
    'select public.finalize_expired_exam_attempts();'
  );
end;
$$;

create or replace function public.set_exam_attempts_paused(
  target_exam_id uuid,
  should_pause boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  affected_count integer := 0;
begin
  if public.current_role() <> 'guru'
     or not public.teacher_owns_exam(target_exam_id) then
    raise exception 'Ujian tidak ditemukan atau bukan milik guru';
  end if;

  for item in
    select id
    from public.attempts
    where exam_id = target_exam_id and status = 'in_progress'
    order by id
  loop
    perform public.set_student_attempt_paused(item.id, should_pause);
    affected_count := affected_count + 1;
  end loop;

  return affected_count;
end;
$$;

revoke all on function public.set_exam_attempts_paused(uuid, boolean)
  from public, anon;
grant execute on function public.set_exam_attempts_paused(uuid, boolean)
  to authenticated;

create or replace function public.grant_attempt_extra_time(
  target_attempt_id uuid,
  extra_minutes integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
  new_deadline timestamptz;
begin
  if public.current_role() <> 'guru'
     or extra_minutes is null
     or extra_minutes < 1
     or extra_minutes > 240 then
    raise exception 'Waktu tambahan harus antara 1 dan 240 menit';
  end if;

  select * into target_attempt
  from public.attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null
     or not public.teacher_owns_exam(target_attempt.exam_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;
  if target_attempt.status <> 'in_progress' then
    raise exception 'Waktu hanya dapat ditambah pada sesi yang sedang dikerjakan';
  end if;
  if target_attempt.extra_time_seconds + extra_minutes * 60 > 86400 then
    raise exception 'Total waktu tambahan tidak boleh melebihi 24 jam';
  end if;

  update public.attempts
  set extra_time_seconds = extra_time_seconds + extra_minutes * 60
  where id = target_attempt.id;

  new_deadline := public.exam_attempt_deadline(target_attempt.id);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(),
    'attempt.time_extended',
    'attempts',
    target_attempt.id,
    jsonb_build_object('minutes', extra_minutes, 'deadline', new_deadline)
  );

  return new_deadline;
end;
$$;

revoke all on function public.grant_attempt_extra_time(uuid, integer)
  from public, anon;
grant execute on function public.grant_attempt_extra_time(uuid, integer)
  to authenticated;

create or replace function public.force_submit_exam_attempt(target_attempt_id uuid)
returns public.attempt_status
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat mengumpulkan paksa ujian';
  end if;

  select * into target_attempt
  from public.attempts
  where id = target_attempt_id;

  if target_attempt.id is null
     or not public.teacher_owns_exam(target_attempt.exam_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;

  return public.finalize_exam_attempt_internal(
    target_attempt.id,
    'teacher_force_submit',
    auth.uid()
  );
end;
$$;

revoke all on function public.force_submit_exam_attempt(uuid) from public, anon;
grant execute on function public.force_submit_exam_attempt(uuid) to authenticated;

create or replace function public.reset_exam_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.attempts%rowtype;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat membuka ulang attempt';
  end if;

  select * into target_attempt
  from public.attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null
     or not public.teacher_owns_exam(target_attempt.exam_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;

  delete from public.integrity_events where attempt_id = target_attempt.id;
  delete from public.answers where attempt_id = target_attempt.id;
  delete from public.attempts where id = target_attempt.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(),
    'attempt.reset',
    'attempts',
    target_attempt.id,
    jsonb_build_object(
      'exam_id', target_attempt.exam_id,
      'student_id', target_attempt.student_id
    )
  );
end;
$$;

revoke all on function public.reset_exam_attempt(uuid) from public, anon;
grant execute on function public.reset_exam_attempt(uuid) to authenticated;

drop function if exists public.get_exam_monitor(uuid);
create function public.get_exam_monitor(target_exam_id uuid)
returns table(
  student_id uuid,
  student_name text,
  attempt_id uuid,
  attempt_status text,
  started_at timestamptz,
  submitted_at timestamptz,
  is_paused boolean,
  is_online boolean,
  last_seen_at timestamptz,
  extra_time_minutes integer,
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
    coalesce(
      attempt.status = 'in_progress'
        and attempt.last_seen_at >= now() - interval '35 seconds',
      false
    ),
    attempt.last_seen_at,
    coalesce(attempt.extra_time_seconds / 60, 0),
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

create or replace function public.get_attempt_integrity_timeline(target_attempt_id uuid)
returns table(
  event_id uuid,
  event_type text,
  occurred_at timestamptz,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'guru'
     or not public.teacher_owns_attempt(target_attempt_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;

  return query
  select event.id, event.event_type, event.occurred_at, event.metadata
  from public.integrity_events event
  where event.attempt_id = target_attempt_id
  order by event.occurred_at desc, event.id desc
  limit 200;
end;
$$;

revoke all on function public.get_attempt_integrity_timeline(uuid)
  from public, anon;
grant execute on function public.get_attempt_integrity_timeline(uuid)
  to authenticated;

create or replace function public.enforce_question_weight_by_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  criterion jsonb;
  total_points numeric := 0;
begin
  if new.type = 'multiple_choice' then
    new.weight := 1;
    new.rubric := '[]'::jsonb;
    return new;
  end if;

  if new.rubric is null
     or jsonb_typeof(new.rubric) <> 'array'
     or jsonb_array_length(new.rubric) = 0 then
    new.rubric := jsonb_build_array(
      jsonb_build_object(
        'label', 'Ketepatan jawaban',
        'points', greatest(coalesce(new.weight, 1), 0.01)
      )
    );
  end if;

  if jsonb_array_length(new.rubric) > 20 then
    raise exception 'Rubrik maksimal memiliki 20 kriteria';
  end if;

  for criterion in select value from jsonb_array_elements(new.rubric)
  loop
    if jsonb_typeof(criterion) <> 'object'
       or nullif(trim(criterion->>'label'), '') is null
       or length(trim(criterion->>'label')) > 160
       or not (criterion ? 'points')
       or (criterion->>'points')::numeric <= 0 then
      raise exception 'Setiap kriteria rubrik harus memiliki nama dan poin positif';
    end if;
    total_points := total_points + (criterion->>'points')::numeric;
  end loop;

  if total_points > 10000 then
    raise exception 'Total bobot rubrik terlalu besar';
  end if;
  new.weight := total_points;
  return new;
end;
$$;

revoke all on function public.enforce_question_weight_by_type()
  from public, anon, authenticated;

drop function if exists public.grade_essay_answer(uuid, numeric, text);
create function public.grade_essay_answer(
  target_answer_id uuid,
  awarded_score numeric,
  feedback text default null,
  rubric_scores_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt_id uuid;
  target_status public.attempt_status;
  max_weight numeric;
  target_rubric jsonb;
  total_points numeric;
  earned_points numeric;
  pending_essays integer;
  criterion jsonb;
  score_item jsonb;
  criterion_index integer;
  rubric_total numeric := 0;
begin
  select answer.attempt_id, question.weight, question.rubric, attempt.status
  into target_attempt_id, max_weight, target_rubric, target_status
  from public.answers answer
  join public.questions question on question.id = answer.question_id
  join public.attempts attempt on attempt.id = answer.attempt_id
  where answer.id = target_answer_id and question.type = 'essay'
  for update of attempt;

  if target_attempt_id is null
     or public.current_role() <> 'guru'
     or not public.teacher_owns_attempt(target_attempt_id) then
    raise exception 'Jawaban tidak ditemukan atau tidak dapat dinilai';
  end if;
  if target_status not in ('grading', 'final') then
    raise exception 'Attempt belum dapat dinilai';
  end if;
  if awarded_score is null
     or awarded_score < 0
     or awarded_score > max_weight then
    raise exception 'Skor harus berada antara 0 dan bobot soal';
  end if;
  if length(coalesce(feedback, '')) > 5000 then
    raise exception 'Catatan penilaian terlalu panjang';
  end if;

  if rubric_scores_payload is not null
     and rubric_scores_payload <> '[]'::jsonb then
    if jsonb_typeof(rubric_scores_payload) <> 'array'
       or jsonb_array_length(rubric_scores_payload) <> jsonb_array_length(target_rubric) then
      raise exception 'Nilai rubrik tidak sesuai dengan kriteria soal';
    end if;

    for criterion_index in 0..jsonb_array_length(target_rubric) - 1
    loop
      criterion := target_rubric->criterion_index;
      score_item := rubric_scores_payload->criterion_index;
      if jsonb_typeof(score_item) <> 'object'
         or not (score_item ? 'score')
         or (score_item->>'score')::numeric < 0
         or (score_item->>'score')::numeric > (criterion->>'points')::numeric then
        raise exception 'Skor salah satu kriteria rubrik tidak valid';
      end if;
      rubric_total := rubric_total + (score_item->>'score')::numeric;
    end loop;

    if abs(rubric_total - awarded_score) > 0.001 then
      raise exception 'Total skor tidak sama dengan jumlah nilai rubrik';
    end if;
  end if;

  update public.answers
  set score = awarded_score,
      teacher_comment = nullif(trim(feedback), ''),
      rubric_scores = coalesce(rubric_scores_payload, '[]'::jsonb)
  where id = target_answer_id;

  select count(*) into pending_essays
  from public.exam_questions exam_question
  join public.attempts attempt on attempt.exam_id = exam_question.exam_id
  join public.questions question
    on question.id = exam_question.question_id and question.type = 'essay'
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id and answer.score is null;

  select
    coalesce(sum(question.weight), 0),
    coalesce(sum(case
      when question.type = 'multiple_choice'
        and answer.selected_option = question.correct_option
        then question.weight
      when question.type = 'essay' then coalesce(answer.score, 0)
      else 0
    end), 0)
  into total_points, earned_points
  from public.attempts attempt
  join public.exam_questions exam_question
    on exam_question.exam_id = attempt.exam_id
  join public.questions question on question.id = exam_question.question_id
  left join public.answers answer
    on answer.attempt_id = attempt.id
    and answer.question_id = question.id
  where attempt.id = target_attempt_id;

  update public.attempts
  set essay_score = earned_points - coalesce(objective_score, 0),
      status = (
        case when pending_essays = 0 then 'final' else 'grading' end
      )::public.attempt_status,
      final_score = case
        when pending_essays = 0 and total_points > 0
          then round(earned_points / total_points * 100, 2)
        else null
      end,
      finalized_at = case when pending_essays = 0 then now() else null end
  where id = target_attempt_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(),
    'answer.graded',
    'answers',
    target_answer_id,
    jsonb_build_object(
      'attempt_id', target_attempt_id,
      'score', awarded_score,
      'rubric_used', rubric_scores_payload is not null,
      'finalized', pending_essays = 0
    )
  );
end;
$$;

revoke all on function public.grade_essay_answer(uuid, numeric, text, jsonb)
  from public, anon;
grant execute on function public.grade_essay_answer(uuid, numeric, text, jsonb)
  to authenticated;

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
  action_name text;
begin
  if public.current_role() <> 'guru' then
    raise exception 'Hanya guru yang dapat mengatur sesi siswa';
  end if;

  select * into target_attempt
  from public.attempts
  where id = target_attempt_id
  for update;

  if target_attempt.id is null
     or not public.teacher_owns_exam(target_attempt.exam_id) then
    raise exception 'Attempt tidak ditemukan atau bukan milik guru';
  end if;
  if target_attempt.status <> 'in_progress' or target_attempt.started_at is null then
    raise exception 'Hanya sesi yang sedang dikerjakan yang dapat diatur';
  end if;

  if should_pause then
    if target_attempt.paused_at is null then
      if now() > public.exam_attempt_deadline(target_attempt.id) then
        raise exception 'Waktu pengerjaan siswa sudah berakhir';
      end if;
      update public.attempts set paused_at = now() where id = target_attempt.id;
      action_name := 'attempt.paused';
    end if;
  elsif target_attempt.paused_at is not null then
    if now() > public.exam_attempt_deadline(target_attempt.id) then
      raise exception 'Ujian sudah melewati waktu selesai dan tidak dapat dilanjutkan';
    end if;
    update public.attempts
    set paused_seconds = paused_seconds
          + greatest(0, floor(extract(epoch from (now() - paused_at))))::integer,
        paused_at = null
    where id = target_attempt.id;
    action_name := 'attempt.resumed';
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
    and now() <= public.exam_attempt_deadline(attempt.id)
  order by case
    when exam.shuffle_questions then
      hashtextextended(question.id::text, hashtextextended(attempt.id::text, 0))
    else exam_question.position::bigint
  end;
$$;

revoke all on function public.get_exam_questions(uuid) from public, anon;
grant execute on function public.get_exam_questions(uuid) to authenticated;

comment on column public.attempts.last_seen_at is
  'Heartbeat terakhir browser siswa selama sesi ujian.';
comment on column public.attempts.extra_time_seconds is
  'Waktu tambahan individual dari pengawas dalam detik.';
comment on column public.questions.rubric is
  'Kriteria penilaian essay berupa array objek label dan points.';
comment on column public.answers.rubric_scores is
  'Nilai per kriteria rubrik yang disimpan saat koreksi essay.';
