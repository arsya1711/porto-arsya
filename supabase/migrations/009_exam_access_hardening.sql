-- Membatasi seluruh mutasi ujian siswa ke attempt yang masih aktif dan
-- memindahkan validasi kode akses/jadwal ke server.

drop policy if exists "students manage own attempts" on public.attempts;
drop policy if exists "students read own attempts" on public.attempts;
drop policy if exists "students insert own attempts" on public.attempts;
drop policy if exists "students update own attempts" on public.attempts;

create policy "students read own attempts"
on public.attempts for select
using (student_id = auth.uid());

-- Attempt baru hanya dibuat melalui start_exam_attempt().

drop policy if exists "students manage own answers" on public.answers;
drop policy if exists "students read own answers" on public.answers;
drop policy if exists "students insert active answers" on public.answers;
drop policy if exists "students update active answers" on public.answers;

create policy "students read own answers"
on public.answers for select
using (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_id and a.student_id = auth.uid()
  )
);

create policy "students insert active answers"
on public.answers for insert
with check (
  exists (
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() >= e.starts_at
      and (e.ends_at is null or now() <= e.ends_at)
  )
);

create policy "students update active answers"
on public.answers for update
using (
  exists (
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() >= e.starts_at
      and (e.ends_at is null or now() <= e.ends_at)
  )
)
with check (
  exists (
    select 1
    from public.attempts a
    join public.exams e on e.id = a.exam_id
    where a.id = attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() >= e.starts_at
      and (e.ends_at is null or now() <= e.ends_at)
  )
);

create or replace function public.start_exam_attempt(
  requested_exam_id uuid,
  provided_access_code text default null
)
returns table(attempt_id uuid, started_at timestamptz, deadline timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_exam public.exams%rowtype;
  target_attempt public.attempts%rowtype;
begin
  select e.* into target_exam
  from public.exams e
  join public.exam_assignments ea on ea.exam_id = e.id
  where e.id = requested_exam_id and ea.student_id = auth.uid();

  if target_exam.id is null then
    raise exception 'Ujian tidak ditemukan atau tidak ditugaskan kepada siswa';
  end if;
  if target_exam.status = 'draft' or now() < target_exam.starts_at then
    raise exception 'Ujian belum dapat dimulai';
  end if;
  if target_exam.ends_at is not null and now() > target_exam.ends_at then
    raise exception 'Waktu ujian sudah berakhir';
  end if;
  if target_exam.access_code is not null
     and upper(trim(coalesce(provided_access_code, ''))) <> upper(trim(target_exam.access_code)) then
    raise exception 'Kode akses ujian tidak sesuai';
  end if;

  select * into target_attempt
  from public.attempts
  where exam_id = requested_exam_id and student_id = auth.uid()
  for update;

  if target_attempt.id is not null and target_attempt.status in ('submitted', 'grading', 'final') then
    raise exception 'Ujian ini sudah pernah dikumpulkan';
  end if;

  if target_attempt.id is null then
    insert into public.attempts(exam_id, student_id, status, started_at)
    values(requested_exam_id, auth.uid(), 'in_progress', now())
    returning * into target_attempt;
  end if;

  return query select
    target_attempt.id,
    target_attempt.started_at,
    least(
      target_attempt.started_at + make_interval(mins => target_exam.duration_minutes),
      coalesce(target_exam.ends_at, 'infinity'::timestamptz)
    );
end;
$$;

revoke all on function public.start_exam_attempt(uuid, text) from public, anon;
grant execute on function public.start_exam_attempt(uuid, text) to authenticated;

create or replace function public.get_exam_questions(requested_exam_id uuid)
returns table(
  question_id uuid,
  body text,
  kind public.question_type,
  options jsonb,
  weight numeric
)
language sql
security definer
set search_path = public
as $$
  select q.id, q.body, q.type, q.options, q.weight
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  join public.exams e on e.id = eq.exam_id
  join public.attempts a on a.exam_id = e.id
  where e.id = requested_exam_id
    and a.student_id = auth.uid()
    and a.status = 'in_progress'
    and now() >= e.starts_at
    and (e.ends_at is null or now() <= e.ends_at)
  order by eq.position;
$$;

revoke all on function public.get_exam_questions(uuid) from public, anon;
grant execute on function public.get_exam_questions(uuid) to authenticated;

-- SECURITY DEFINER tidak boleh mewarisi hak execute PUBLIC bawaan PostgreSQL.
revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
revoke all on function public.grade_essay_answer(uuid, numeric, text) from public, anon;
grant execute on function public.grade_essay_answer(uuid, numeric, text) to authenticated;
